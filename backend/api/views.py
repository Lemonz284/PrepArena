import json
import re
import os
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from dotenv import load_dotenv
from groq import Groq

load_dotenv()


@csrf_exempt
@require_http_methods(["POST"])
def generate_mock_test(request):
    try:
        body = json.loads(request.body)
        topic = body.get("topic", "General Computer Science")
        difficulty = body.get("difficulty", "Medium")
        count = int(body.get("count", 15))

        api_key = os.getenv("GROQ_API_KEY", "")
        if not api_key or api_key == "gsk_your_actual_key_here":
            return JsonResponse({"error": "GROQ_API_KEY not configured. Add it to backend/.env"}, status=500)

        client = Groq(api_key=api_key)

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
