import json
import re
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from dotenv import load_dotenv
from groq import Groq
from api import proctor
from django.contrib.auth.models import User
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


load_dotenv()


@csrf_exempt
@require_http_methods(["POST"])
def generate_mock_test(request):
    try:
        body = json.loads(request.body)
        topic      = body.get("topic", "General Computer Science")
        difficulty = body.get("difficulty", "Medium")
        count      = int(body.get("count", 15))
        mode       = body.get("mode", "standard")
        resume_text = (body.get("resume_text") or "").strip()
        jd_text     = (body.get("jd_text")     or "").strip()

        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key or api_key == "gsk_your_actual_key_here":
            return JsonResponse({"error": "GROQ_API_KEY not configured. Add it to backend/.env"}, status=500)

        client = Groq(api_key=api_key)

        if mode == "custom" and (resume_text or jd_text):
            # Truncate to ~3000 chars each to stay within token limits
            r_snippet = resume_text[:3000] if resume_text else ""
            j_snippet = jd_text[:3000]     if jd_text     else ""
            context_block = ""
            if r_snippet:
                context_block += f"--- RESUME ---\n{r_snippet}\n\n"
            if j_snippet:
                context_block += f"--- JOB DESCRIPTION ---\n{j_snippet}\n\n"
            prompt = (
                f"You are a technical interview coach. A candidate has provided their resume and/or a job description below.\n\n"
                f"{context_block}"
                f"Based ONLY on the skills, technologies, and topics mentioned in the above documents, "
                f"generate exactly {count} multiple choice questions at {difficulty} difficulty "
                f"that would help the candidate prepare for this specific role.\n"
                f"Focus on topics that appear in the job description but may be weak or missing from the resume.\n\n"
                "Return ONLY a valid JSON array with zero extra text, markdown, or explanation. "
                "Each element must have exactly these keys:\n"
                "  \"q\": question text (string)\n"
                "  \"options\": exactly 4 answer choices (array of 4 strings)\n"
                "  \"answer\": zero-based index of the correct option (integer 0-3)\n\n"
                "Example:\n"
                "[\n"
                "  {\"q\": \"What is ..?\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"answer\": 2}\n"
                "]\n\n"
                f"Generate {count} questions now. Return ONLY the JSON array, nothing else."
            )
        else:
            prompt = (
                f"Generate exactly {count} multiple choice questions about \"{topic}\" "
                f"at {difficulty} difficulty for a technical interview preparation test.\n\n"
                "Return ONLY a valid JSON array with zero extra text, markdown, or explanation. "
                "Each element must have exactly these keys:\n"
                "  \"q\": question text (string)\n"
                "  \"options\": exactly 4 answer choices (array of 4 strings)\n"
                "  \"answer\": zero-based index of the correct option (integer 0-3)\n\n"
                "Example:\n"
                "[\n"
                "  {\"q\": \"What is ..?\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"answer\": 2}\n"
                "]\n\n"
                f"Generate {count} questions now about \"{topic}\" at {difficulty} difficulty. "
                "Return ONLY the JSON array, nothing else."
            )

        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_completion_tokens=4096,
        )

        raw = completion.choices[0].message.content.strip()

        # Strip markdown code fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        # Extract the JSON array
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            return JsonResponse({"error": "AI response did not contain a JSON array", "raw": raw[:500]}, status=500)

        questions_raw = json.loads(match.group())

        # Validate each question
        validated = []
        for q in questions_raw:
            if (
                isinstance(q.get("q"), str)
                and isinstance(q.get("options"), list)
                and len(q["options"]) == 4
                and isinstance(q.get("answer"), int)
                and 0 <= q["answer"] <= 3
            ):
                validated.append({
                    "q": q["q"].strip(),
                    "options": [str(o).strip() for o in q["options"][:4]],
                    "answer": q["answer"],
                })

        if not validated:
            return JsonResponse({"error": "No valid questions in AI response", "raw": raw[:500]}, status=500)

        return JsonResponse({"questions": validated[:count]})

    except json.JSONDecodeError as e:
        return JsonResponse({"error": f"Failed to parse request body: {e}"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def start_proctoring(request):
    """Start a background proctoring session. Returns {session_id}."""
    try:
        sid = proctor.start_session()
        return JsonResponse({"session_id": sid})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def push_proctoring_frame(request):
    """Receive a raw JPEG frame and push it into the proctoring session.
    Expects multipart/form-data: session_id (str) + frame (file/blob)."""
    try:
        sid = request.POST.get("session_id", "")
        if not sid:
            return JsonResponse({"error": "session_id required"}, status=400)
        frame_file = request.FILES.get("frame")
        if not frame_file:
            return JsonResponse({"error": "frame required"}, status=400)
        jpeg_bytes = frame_file.read()
        proctor.push_frame(sid, jpeg_bytes)
        return JsonResponse({"ok": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def stop_proctoring(request):
    """Stop proctoring and return the verdict. Body: {session_id}."""
    try:
        body   = json.loads(request.body)
        sid    = body.get("session_id", "")
        if not sid:
            return JsonResponse({"error": "session_id required"}, status=400)
        result = proctor.stop_session(sid)
        if result is None:
            return JsonResponse({"error": "session not found"}, status=404)
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@api_view(["POST"])
def register_user(request):
    username = request.data.get("username")
    email = request.data.get("email")
    password = request.data.get("password")

    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    return Response({"message": "User created successfully"}, status=status.HTTP_201_CREATED)