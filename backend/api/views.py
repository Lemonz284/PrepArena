import json
import re
import os
import csv
import uuid
from datetime import datetime
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

        primary_key = os.getenv("GROQ_API_KEY", "").strip()
        fallback_key1 = os.getenv("GROQ_API_KEY2", "").strip()
        fallback_key2 = os.getenv("GROQ_API_KEY3", "").strip()

        candidate_keys = []
        for k in (primary_key, fallback_key1, fallback_key2):
            if k and k != "gsk_your_actual_key_here" and k not in candidate_keys:
                candidate_keys.append(k)

        if not candidate_keys:
            return JsonResponse({"error": "No valid Groq API key configured. Add GROQ_API_KEY, GROQ_API_KEY2 or GROQ_API_KEY3 in backend/.env"}, status=500)

        schema_block = (
            "Return ONLY a valid JSON array with zero extra text, markdown, or explanation. "
            "Each element MUST be one of these two shapes:\n"
            "1) MCQ question:\n"
            "   {\"type\": \"mcq\", \"q\": string, \"options\": [4 strings], \"answer\": 0-3}\n"
            "2) Text/code question:\n"
            "   {\"type\": \"text\", \"q\": string, \"expected_answer\": string, \"expected_keywords\": [strings]}\n\n"
            "Rules:\n"
            "- Generate exactly the requested count.\n"
            "- Mix question types: around 70% mcq and 30% text/code/syntax questions.\n"
            "- For text/code questions, expected_keywords must include 4-10 essential words/tokens used to score answers.\n"
            "- Do not include any keys other than those described above.\n"
        )

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
                f"generate exactly {count} interview-prep questions at {difficulty} difficulty "
                f"that would help the candidate prepare for this specific role.\n"
                f"Focus on topics that appear in the job description but may be weak or missing from the resume.\n\n"
                f"{schema_block}\n"
                f"Generate {count} questions now. Return ONLY the JSON array, nothing else."
            )
        else:
            prompt = (
                f"Generate exactly {count} technical interview prep questions about \"{topic}\" "
                f"at {difficulty} difficulty for a technical interview preparation test.\n\n"
                f"{schema_block}\n"
                f"Generate {count} questions now about \"{topic}\" at {difficulty} difficulty. "
                "Return ONLY the JSON array, nothing else."
            )

        completion = None
        last_err = None
        for api_key in candidate_keys:
            try:
                client = Groq(api_key=api_key)
                completion = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_completion_tokens=4096,
                )
                break
            except Exception as err:
                last_err = err

        if completion is None:
            raise RuntimeError(f"Groq request failed for all configured keys: {last_err}")

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
            q_type = str(q.get("type", "mcq")).strip().lower()
            q_text = q.get("q")
            if not isinstance(q_text, str) or not q_text.strip():
                continue

            # Backward-compatible MCQ validation (works even if model omits type)
            if q_type == "mcq":
                options = q.get("options")
                answer = q.get("answer")
                if (
                    isinstance(options, list)
                    and len(options) == 4
                    and isinstance(answer, int)
                    and 0 <= answer <= 3
                ):
                    validated.append({
                        "type": "mcq",
                        "q": q_text.strip(),
                        "options": [str(o).strip() for o in options[:4]],
                        "answer": answer,
                    })
                continue

            # Text/code validation
            if q_type == "text":
                expected_answer = q.get("expected_answer")
                keywords = q.get("expected_keywords")
                if isinstance(expected_answer, str) and isinstance(keywords, list):
                    cleaned_keywords = []
                    for k in keywords:
                        kk = str(k).strip().lower()
                        if kk and kk not in cleaned_keywords:
                            cleaned_keywords.append(kk)
                    if expected_answer.strip() and len(cleaned_keywords) >= 3:
                        validated.append({
                            "type": "text",
                            "q": q_text.strip(),
                            "expected_answer": expected_answer.strip(),
                            "expected_keywords": cleaned_keywords[:10],
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
def generate_mock_test_review(request):
    try:
        body = json.loads(request.body)
        primary_key = os.getenv("GROQ_API_KEY", "").strip()
        fallback_key1 = os.getenv("GROQ_API_KEY2", "").strip()
        fallback_key2 = os.getenv("GROQ_API_KEY3", "").strip()
        candidate_keys = [k for k in (primary_key, fallback_key1, fallback_key2) if k and k != "gsk_your_actual_key_here"]
        
        if not candidate_keys:
            return JsonResponse({"error": "No valid Groq API key configured."}, status=500)

        questions = body.get("questions") if isinstance(body.get("questions"), list) else []
        compact_questions = []
        for q in questions[:25]:
            if not isinstance(q, dict):
                continue
            compact_questions.append({
                "q": str(q.get("q", ""))[:220],
                "type": str(q.get("type", ""))[:20],
                "points": float(q.get("points", 0) or 0),
                "expected_keywords": [str(k)[:32] for k in (q.get("expected_keywords") or [])[:10]],
                "user_answer": str(q.get("user_answer", ""))[:280],
                "correct_answer": str(q.get("correct_answer", ""))[:120],
            })

        signal = {
            "topic": str(body.get("topic", "General"))[:80],
            "difficulty": str(body.get("difficulty", "Medium"))[:24],
            "score": body.get("score", 0),
            "maxScore": body.get("maxScore", 0),
            "pct": body.get("pct", 0),
            "timeTaken": body.get("timeTaken", 0),
            "proctor": body.get("proctor") if isinstance(body.get("proctor"), dict) else None,
            "questions": compact_questions,
        }

        prompt = (
            "You are an interview coach. Analyze this mock test result and return ONLY JSON object with keys: "
            "overview (string), strengths (array of strings), gaps (array of strings), recommendations (array of strings). "
            "Each list must have 3-5 concise items. Recommendations must be actionable and prioritized.\n\n"
            f"RESULT_DATA:\n{json.dumps(signal, ensure_ascii=True)}"
        )

        completion = None
        last_err = None
        for api_key in candidate_keys:
            try:
                client = Groq(api_key=api_key)
                completion = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.4,
                    max_completion_tokens=1200,
                )
                break
            except Exception as err:
                last_err = err

        if completion is None:
            raise RuntimeError(f"Groq request failed for all configured keys: {last_err}")

        raw = (completion.choices[0].message.content or "").strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return JsonResponse({"error": "AI response did not contain a JSON object"}, status=500)

        parsed = json.loads(match.group())

        def _list(key):
            value = parsed.get(key)
            if not isinstance(value, list):
                return []
            cleaned = [str(item).strip() for item in value if str(item).strip()]
            return cleaned[:5]

        result = {
            "overview": str(parsed.get("overview", "")).strip(),
            "strengths": _list("strengths"),
            "gaps": _list("gaps"),
            "recommendations": _list("recommendations"),
        }

        return JsonResponse(result)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def generate_interview_review(request):
    try:
        body = json.loads(request.body)
        primary_key = os.getenv("GROQ_API_KEY", "").strip()
        fallback_key1 = os.getenv("GROQ_API_KEY2", "").strip()
        fallback_key2 = os.getenv("GROQ_API_KEY3", "").strip()
        candidate_keys = [k for k in (primary_key, fallback_key1, fallback_key2) if k and k != "gsk_your_actual_key_here"]
        
        if not candidate_keys:
            return JsonResponse({"error": "No valid Groq API key configured."}, status=500)

        history = body.get("history") if isinstance(body.get("history"), list) else []
        role = str(body.get("role", "Candidate"))[:80]
        company = str(body.get("company", ""))[:80]
        
        compact_history = []
        for ex in history[:15]:
            if not isinstance(ex, dict):
                continue
            compact_history.append({
                "question": str(ex.get("q", ""))[:300],
                "answer": str(ex.get("a", ""))[:600],
            })

        signal = {
            "role": role,
            "company": company,
            "proctor": body.get("proctor") if isinstance(body.get("proctor"), dict) else None,
            "history": compact_history,
        }

        prompt = (
            "You are an expert interview coach. Analyze this oral interview transcript and return ONLY a JSON object with keys: "
            "overview (string), strengths (array of strings), gaps (array of strings), recommendations (array of strings). "
            "Each list must have 3-5 concise, actionable items.\n\n"
            f"INTERVIEW_DATA:\n{json.dumps(signal, ensure_ascii=True)}"
        )

        completion = None
        last_err = None
        for api_key in candidate_keys:
            try:
                client = Groq(api_key=api_key)
                completion = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.4,
                    max_completion_tokens=1500,
                )
                break
            except Exception as err:
                last_err = err

        if completion is None:
            raise RuntimeError(f"Groq request failed for all configured keys: {last_err}")

        raw = (completion.choices[0].message.content or "").strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            return JsonResponse({"error": "AI response did not contain a JSON object"}, status=500)

        parsed = json.loads(match.group())

        def _list(key):
            value = parsed.get(key)
            if not isinstance(value, list):
                return []
            return [str(item).strip() for item in value if str(item).strip()][:6]

        result = {
            "overview": str(parsed.get("overview", "")).strip(),
            "strengths": _list("strengths"),
            "gaps": _list("gaps"),
            "recommendations": _list("recommendations"),
        }

        return JsonResponse(result)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
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


@csrf_exempt
@require_http_methods(["POST"])
def upload_proctor_report(request):
    try:
        body = json.loads(request.body)
        if not isinstance(body, dict):
            return JsonResponse({"error": "Invalid report body"}, status=400)

        reports_dir = os.path.join(os.path.dirname(__file__), "proctor_reports")
        os.makedirs(reports_dir, exist_ok=True)

        ts = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        rid = uuid.uuid4().hex[:8]
        filename = f"proctor_report_{ts}_{rid}.json"
        out_path = os.path.join(reports_dir, filename)

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(body, f, ensure_ascii=True, indent=2)

        return JsonResponse({"ok": True, "file": filename})
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
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


# ---------------------------------------------------------------------------
# AI Mock Interview — next question endpoint
# ---------------------------------------------------------------------------

# Neutral thinking pauses — no fake enthusiasm, just natural filler
THINKING_FILLER = [
    "Mm-hm.",
    "Okay.",
    "I see.",
    "Right.",
    "Alright.",
    "Got it.",
]

import random as _random


# ── Company-specific interview intelligence ──────────────────────────────────
COMPANY_PROFILES = {
    "google": {
        "style": "Google",
        "focus": (
            "Google interviews emphasise: (1) Behavioral — Googleyness & Leadership (ambiguity, ownership, collaboration, impact); "
            "(2) Technical Concepts — explain how systems work (distributed systems, scalability, caching, load balancing), "
            "no coding, just verbal explanations; (3) Problem-Solving — hypothetical scenarios, trade-offs, design thinking; "
            "(4) Past Experience — deep dive into their resume projects, challenges faced, decisions made. "
            "Ask questions like: 'Tell me about a time you had to make a decision with incomplete information', "
            "'Explain how Google Search handles billions of queries per day', 'Walk me through your most complex project'. "
            "Reference Google products (Search, Maps, YouTube, Gmail) when relevant. Use STAR format for behavioral questions."
        ),
    },
    "meta": {
        "style": "Meta",
        "focus": (
            "Meta interviews focus on: (1) Behavioral — impact, ownership, cross-functional collaboration, "
            "moving fast, building for scale; (2) Technical Concepts — explain architectures (news feed ranking, "
            "real-time messaging, social graph, content delivery), no coding; (3) Product Thinking — user experience, "
            "growth, engagement; (4) Past Experience — projects, team dynamics, conflict resolution. "
            "Ask questions like: 'Describe a time you had to influence without authority', "
            "'How would you design a notification system for 3 billion users?', 'Tell me about a project that failed'. "
            "Reference Meta products (Facebook, Instagram, WhatsApp, Messenger, Threads)."
        ),
    },
    "microsoft": {
        "style": "Microsoft",
        "focus": (
            "Microsoft interviews cover: (1) Behavioral — growth mindset, collaboration, customer obsession, "
            "learning from failure; (2) Technical Concepts — cloud architecture (Azure), microservices, APIs, "
            "security, scalability, no coding; (3) Situational — how you'd handle ambiguous problems, prioritize features; "
            "(4) Past Experience — leadership, teamwork, technical decisions. "
            "Ask questions like: 'Tell me about a time you learned from a mistake', "
            "'Explain how you'd architect a global file storage system', 'Describe a situation where you had to prioritize competing demands'. "
            "Reference Microsoft products (Azure, Office 365, Teams, Xbox, GitHub). Use STAR format."
        ),
    },
    "amazon": {
        "style": "Amazon",
        "focus": (
            "Amazon interviews are structured around the 16 Leadership Principles: customer obsession, ownership, "
            "invent and simplify, bias for action, deliver results, dive deep, earn trust, think big, frugality, "
            "learn and be curious, hire and develop the best, insist on highest standards, have backbone, disagree and commit. "
            "Every question must tie to a Leadership Principle. Ask behavioral questions using STAR format. "
            "Also ask: (1) Technical Concepts — AWS services (S3, DynamoDB, Lambda, EC2), distributed systems, "
            "e-commerce scale, no coding; (2) Situational — trade-offs, prioritization, handling failure. "
            "Examples: 'Tell me about a time you took ownership of a problem that wasn't yours', "
            "'Explain how Amazon's recommendation engine works at scale', 'Describe a time you had to make a decision with limited data'."
        ),
    },
    "apple": {
        "style": "Apple",
        "focus": (
            "Apple interviews emphasise: (1) Behavioral — passion for craft, attention to detail, collaboration, "
            "innovation, user-centric thinking; (2) Technical Concepts — iOS/macOS architecture, hardware-software integration, "
            "performance optimization, privacy, security, no coding; (3) Product Thinking — user experience, design philosophy; "
            "(4) Past Experience — projects, challenges, technical decisions. "
            "Ask questions like: 'Tell me about a time you obsessed over a detail that others overlooked', "
            "'Explain how Face ID works from a system perspective', 'Describe a project where you balanced performance and user experience'. "
            "Reference Apple platforms (iOS, macOS, watchOS, tvOS)."
        ),
    },
    "netflix": {
        "style": "Netflix",
        "focus": (
            "Netflix interviews focus on: (1) Culture Fit — freedom and responsibility, context not control, "
            "high performance, candor, judgment; (2) Technical Concepts — streaming at scale, CDN, recommendation systems, "
            "microservices, chaos engineering, A/B testing, no coding; (3) Behavioral — autonomy, decision-making, impact; "
            "(4) Past Experience — ownership, handling ambiguity. "
            "Ask questions like: 'Tell me about a time you made a decision without approval', "
            "'Explain how Netflix delivers video to millions of users with minimal buffering', "
            "'Describe a situation where you had to operate with incomplete information'."
        ),
    },
    "uber": {
        "style": "Uber",
        "focus": (
            "Uber interviews cover: (1) Behavioral — impact, execution, collaboration, bias for action; "
            "(2) Technical Concepts — marketplace systems, geolocation, real-time data pipelines, surge pricing, "
            "distributed systems, no coding; (3) Problem-Solving — trade-offs, scalability, reliability; "
            "(4) Past Experience — projects, challenges, team dynamics. "
            "Ask questions like: 'Tell me about a time you had to move fast and break things', "
            "'Explain how Uber matches riders and drivers in real-time', 'Describe a project where you had to balance speed and quality'."
        ),
    },
}

def _get_company_profile(company: str) -> dict | None:
    """Return the company profile if the company is a known tech giant."""
    c = company.lower().strip()
    for key, profile in COMPANY_PROFILES.items():
        if key in c:
            return profile
    return None


@csrf_exempt
@require_http_methods(["POST"])
def interview_next(request):
    """
    Receive the candidate's last answer and return the next interview question.
    Body: {
        role, company,
        last_answer: str,
        question_number: int,   // 1-based, the question just answered
        total_questions: int,
        history: [{q, a}, ...]  // last <=4 pairs for context
    }
    Returns: { reaction, next_turn, thinking_phrase, is_last, question_type }
    """
    try:
        body = json.loads(request.body)
        role             = str(body.get("role", "Software Engineer"))[:80]
        company          = str(body.get("company", "the company"))[:80]
        resume_text      = str(body.get("resume_text", ""))[:3000]
        jd_text          = str(body.get("jd_text", ""))[:3000]
        jd_name          = str(body.get("jd_name", ""))[:160]
        last_answer      = str(body.get("last_answer", ""))[:1200]
        question_number  = int(body.get("question_number", 1))
        total_questions  = int(body.get("total_questions", 6))
        history          = body.get("history", [])
        if not isinstance(history, list):
            history = []

        # Use primary key first, then fallbacks
        primary_key  = os.getenv("GROQ_API_KEY",  "").strip()
        fallback_key1 = os.getenv("GROQ_API_KEY2", "").strip()
        fallback_key2 = os.getenv("GROQ_API_KEY3", "").strip()
        candidate_keys = [k for k in (primary_key, fallback_key1, fallback_key2)
                          if k and k != "gsk_your_actual_key_here"]
        if not candidate_keys:
            return JsonResponse({"error": "No valid Groq API key configured."}, status=500)

        # Build rolling context block (last 4 exchanges to save tokens)
        context_lines = []
        for ex in history[-4:]:
            q_text = str(ex.get("q", ""))[:200]
            a_text = str(ex.get("a", ""))[:400]
            if q_text:
                context_lines.append(f"Q: {q_text}\nA: {a_text}")
        context_block = "\n\n".join(context_lines)

        prep_context_parts = []
        if jd_name:
            prep_context_parts.append(f"Selected job description: {jd_name}")
        if jd_text.strip():
            prep_context_parts.append(f"JOB DESCRIPTION:\n{jd_text.strip()}")
        if resume_text.strip():
            prep_context_parts.append(f"RESUME:\n{resume_text.strip()}")
        prep_context = "\n\n".join(prep_context_parts)

        is_last = (question_number >= total_questions)

        # If frontend supplied proctoring verdict, act on it immediately.
        proctor_info = body.get("proctor") if isinstance(body.get("proctor"), dict) else None
        if proctor_info:
            try:
                cheating = bool(proctor_info.get("cheating", False))
                prob = float(proctor_info.get("cheating_probability") or 0.0)
                camera_ok = bool(proctor_info.get("camera_available", True))
            except Exception:
                cheating = False
                prob = 0.0
                camera_ok = True

            # Camera not available → ask user to enable it before continuing
            if not camera_ok:
                return JsonResponse({
                    "reaction": "Camera appears unavailable.",
                    "next_turn": "Please enable your camera and ensure it's working before continuing.",
                    "thinking_phrase": _random.choice(THINKING_FILLER),
                    "is_last": True,
                    "proctor": proctor_info,
                })

            # Strong proctor flag → pause/stop the interview and surface the verdict
            if cheating or prob >= 0.60:
                return JsonResponse({
                    "reaction": "Proctor flagged anomalies during the session.",
                    "next_turn": "The session has been paused due to proctor alerts. Please resolve the issue and retry.",
                    "thinking_phrase": _random.choice(THINKING_FILLER),
                    "is_last": True,
                    "proctor": proctor_info,
                })

        if is_last:
            next_instruction = (
                "This is the FINAL question of the interview. "
                "For NEXT: ask exactly one strong closing question — e.g. their biggest strength, "
                "proudest project, or a long-term career goal. Keep it focused."
            )
        else:
            remaining = total_questions - question_number
            next_instruction = (
                f"{remaining} question(s) remaining. "
                "For NEXT: ask exactly one new question. Choose from:\n"
                "  - A new technical or behavioral interview question relevant to the role\n"
                "  - A natural follow-up if the candidate's answer was incomplete or interesting\n"
                "Do NOT repeat anything already covered. Do NOT ask compound questions."
            )
            if prep_context:
                next_instruction += (
                    "\nUse the provided resume/job-description context to tailor the question to the actual role, "
                    "skills, tools, and responsibilities in the candidate's prep context."
                )

        # Detect weak/lazy answers so the model knows to skip encouragement
        lazy_triggers = [
            "i don't know", "i dont know", "idk", "no idea", "not sure",
            "sorry", "i'm not sure", "im not sure", "i have no idea",
            "i'm unsure", "skip", "pass", "n/a",
        ]
        answer_lower = last_answer.lower().strip()
        is_weak_answer = (
            len(answer_lower) < 20
            or any(t in answer_lower for t in lazy_triggers)
        )

        # ── Company-specific interview style ──────────────────────────────────
        company_profile = _get_company_profile(company)
        company_context = ""
        question_type_hint = ""
        if company_profile:
            company_context = (
                f"\n\nCOMPANY INTERVIEW STYLE — {company_profile['style']}:\n"
                f"{company_profile['focus']}\n"
                f"You MUST ask questions in the authentic style of a {company_profile['style']} interviewer. "
                f"This is an ORAL interview — NO coding questions, NO written DSA problems. "
                f"Rotate between: (1) Behavioral questions (STAR format), (2) Technical concept questions "
                f"(explain how systems work, no code), (3) Situational/hypothetical questions, "
                f"(4) Past experience deep-dives, (5) Aptitude/critical thinking questions."
            )
            # Question type rotation for oral interview
            # Q1=intro/behavioral, Q2=technical concept, Q3=past experience, Q4=situational, Q5=aptitude/critical thinking, Q6=closing
            type_rotation = {
                1: "behavioral (introduction, background, motivation)",
                2: "technical concept (explain a system, architecture, or technology — no coding)",
                3: "past experience (deep dive into a resume project, challenge, or decision)",
                4: "situational or hypothetical (how would you handle X, trade-offs, prioritization)",
                5: "aptitude or critical thinking (logic puzzle, problem-solving scenario, estimation)",
                6: "closing behavioral (strengths, career goals, why this company)",
            }
            q_type = type_rotation.get(question_number + 1, "technical concept or behavioral")
            question_type_hint = (
                f"\nFor question {question_number + 1}, ask a {q_type} question "
                f"in the style of {company_profile['style']}. Remember: this is an ORAL interview, "
                f"so NO coding, NO 'write a function', NO DSA implementation questions."
            )
        else:
            # Generic interview style when company is not recognized
            company_context = (
                "\n\nThis is an ORAL mock interview. Do NOT ask coding questions or DSA implementation problems. "
                "Focus on: (1) Behavioral questions (STAR format), (2) Technical concepts (explain, not code), "
                "(3) Past experience, (4) Situational questions, (5) Aptitude/critical thinking."
            )
            type_rotation = {
                1: "behavioral (introduction, background)",
                2: "technical concept (explain a technology or system)",
                3: "past experience (project deep-dive)",
                4: "situational (hypothetical scenario)",
                5: "aptitude or critical thinking",
                6: "closing behavioral",
            }
            q_type = type_rotation.get(question_number + 1, "behavioral or technical concept")
            question_type_hint = (
                f"\nFor question {question_number + 1}, ask a {q_type} question. "
                f"NO coding, NO 'write a function' questions."
            )

        system_prompt = (
            f"You are an experienced, professional interviewer conducting a realistic oral mock interview "
            f"for the {role} role{f' at {company}' if company else ''}. "
            "You are calm, direct, conversational, and human — not a chatbot. "
            "You provide constructive feedback like a real interviewer would. "
            "When an answer is weak, you say things like: 'I'd expect more detail here', "
            "'That's a start, but let me dig deeper', 'You should know this for this role', "
            "'That's a bit vague — can you be more specific?'. "
            "When an answer is good, you say: 'That's exactly what I was looking for', "
            "'Good answer, I like how you approached that', 'That's a solid explanation', "
            "'I appreciate the detail you provided'. "
            "You speak naturally, the way a senior engineer or hiring manager would in a real interview. "
            "When job description or resume context is provided, you must use it to keep the interview relevant to that opportunity."
            f" Plain text only. No markdown. No bullet points.{company_context}"
        )

        if is_weak_answer:
            reaction_rule = (
                "REACTION RULE: The candidate gave a weak, vague, or 'I don't know' answer. "
                "Provide constructive feedback like a real interviewer would. Examples: "
                "'I'd expect more detail for this role.', 'That's a bit vague — let me ask something else.', "
                "'You should be familiar with this concept.', 'That's fine, let's move on.', "
                "'I was hoping for more depth there.', 'Alright, we'll come back to that.'. "
                "One or two short sentences. Be direct but professional."
            )
        else:
            reaction_rule = (
                "REACTION RULE: The candidate gave a reasonable answer. "
                "Provide brief, constructive feedback like a real interviewer would. Examples: "
                "'That's a good answer.', 'I like how you approached that.', 'That's exactly what I was looking for.', "
                "'Good explanation.', 'That makes sense.', 'I appreciate the detail.', 'Solid answer.'. "
                "One or two short sentences. Be encouraging but not over-enthusiastic."
            )

        user_prompt = (
            f"Prep context:\n{prep_context or 'No resume or JD context provided.'}\n\n"
            f"Interview context (last {min(len(history), 4)} exchanges):\n{context_block}\n\n"
            f"The candidate just answered question {question_number} of {total_questions}:\n"
            f"\"{last_answer}\"\n\n"
            f"{reaction_rule}\n\n"
            f"NEXT QUESTION RULE: {next_instruction}{question_type_hint}\n\n"
            "OUTPUT FORMAT (exactly two lines, nothing else):\n"
            "REACTION: <your one or two sentence feedback statement>\n"
            "NEXT: <your one interview question, 1-2 sentences max>\n\n"
            "Critical rules:\n"
            "- REACTION must be a statement or brief feedback. Never a question.\n"
            "- NEXT must be exactly one question. Never two.\n"
            "- Prefer asking about skills, tools, responsibilities, and gaps visible in the JD/resume context when available.\n"
            "- NO coding questions. NO 'write a function' or 'implement X' questions.\n"
            "- No extra lines, no preamble, no sign-off."
        )

        completion = None
        last_err   = None
        for api_key in candidate_keys:
            try:
                client     = Groq(api_key=api_key)
                completion = client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    temperature=0.8,
                    max_completion_tokens=260,
                )
                break
            except Exception as err:
                last_err = err

        if completion is None:
            raise RuntimeError(f"Groq request failed: {last_err}")

        raw_response = (completion.choices[0].message.content or "").strip()

        # Parse REACTION / NEXT from structured response
        reaction   = ""
        next_turn  = ""
        for line in raw_response.splitlines():
            line = line.strip()
            if line.lower().startswith("reaction:"):
                reaction  = line[len("reaction:"):].strip()
            elif line.lower().startswith("next:"):
                next_turn = line[len("next:"):].strip()

        # Fallback: if model didn't follow format, use entire response as next_turn
        if not next_turn:
            next_turn = raw_response
            reaction  = _random.choice(THINKING_FILLER)

        # ── Sanitise REACTION: must be a short statement, never a question ──
        # If the model put a question in the reaction, split it out:
        #   "Good answer. Can you elaborate?" → reaction="Good answer.", question moves to next_turn prefix
        if reaction and "?" in reaction:
            parts = reaction.split("?")
            # Keep only the part before the first question mark as the statement
            statement_part = parts[0].strip().rstrip(".")
            question_part  = "?".join(parts[1:]).strip()
            if statement_part:
                reaction = statement_part + "."
            else:
                reaction = _random.choice(THINKING_FILLER)
            # If there was a trailing question, prepend it to next_turn
            if question_part and not question_part.endswith("?"):
                question_part += "?"
            if question_part and question_part != "?":
                next_turn = question_part + " " + next_turn if next_turn else question_part

        # Cap reaction to a single sentence (take everything up to first period)
        if reaction and ". " in reaction:
            reaction = reaction.split(". ")[0].rstrip(".") + "."

        # Final length guard — reaction should never be a paragraph
        if len(reaction) > 120:
            reaction = reaction[:117].rsplit(" ", 1)[0] + "."

        return JsonResponse({
            "reaction":        reaction,
            "next_turn":       next_turn,
            "thinking_phrase": _random.choice(THINKING_FILLER),
            "is_last":         is_last,
            "company_style":   company_profile["style"] if company_profile else None,
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON body"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_http_methods(["GET"])
def get_jobs(request):
    """
    Return scraped job listings from the MatchMyResume CSV files.
    Falls back to a curated sample list if CSVs are not found.
    Supports ?q=<search> query param to filter results.
    """
    # Paths to MatchMyResume CSV files (relative to this file's location)
    base = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..",
                     "MatchMyResume-TYPE-1-")
    )
    candidates = [
        os.path.join(base, "internships.csv"),
        os.path.join(base, "naukri_jobs.csv"),
        os.path.join(base, "api", "internships.csv"),
    ]

    jobs = []
    for path in candidates:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        title    = (row.get("title") or row.get("Title") or "").strip()
                        company  = (row.get("company") or row.get("Company") or "").strip()
                        location = (row.get("location") or row.get("Location") or "").strip()
                        desc     = (row.get("job_description") or row.get("Description") or row.get("description") or "").strip()
                        skills   = (row.get("skills") or row.get("Skills") or "").strip()
                        link     = (row.get("link") or row.get("Link") or "").strip()
                        source   = (row.get("source") or "CSV").strip()
                        if title:
                            jobs.append({
                                "title": title,
                                "company": company,
                                "location": location,
                                "description": desc,
                                "skills": skills,
                                "link": link,
                                "source": source,
                            })
            except Exception:
                continue

    # If no CSVs found, return a small hardcoded sample so the UI still works
    if not jobs:
        jobs = [
            {
                "title": "Software Engineer Intern",
                "company": "TechCorp",
                "location": "Remote",
                "description": "Work on backend services using Python and Django. Experience with REST APIs and databases required. You will design, build, and maintain efficient, reusable, and reliable code.",
                "skills": "Python, Django, REST APIs, SQL",
                "link": "",
                "source": "Sample",
            },
            {
                "title": "Frontend Developer Intern",
                "company": "StartupXYZ",
                "location": "Bangalore",
                "description": "Build modern web UIs with React and TypeScript. Strong understanding of CSS and responsive design needed. Experience with state management libraries like Redux is a plus.",
                "skills": "React, TypeScript, CSS, HTML",
                "link": "",
                "source": "Sample",
            },
            {
                "title": "Machine Learning Engineer",
                "company": "AI Labs",
                "location": "Remote",
                "description": "Train and deploy ML models for production. Familiarity with PyTorch, scikit-learn and NLP pipelines required. You will work on developing intelligent systems for real-world applications.",
                "skills": "Python, PyTorch, scikit-learn, NLP",
                "link": "",
                "source": "Sample",
            },
            {
                "title": "Data Analyst",
                "company": "FinAnalytics",
                "location": "Mumbai",
                "description": "Analyse large datasets and build dashboards using SQL and Power BI. Python scripting is a plus. You will extract actionable insights from complex business data.",
                "skills": "SQL, Power BI, Python, Excel",
                "link": "",
                "source": "Sample",
            },
            {
                "title": "Full Stack Developer",
                "company": "Webify Solutions",
                "location": "Hyderabad",
                "description": "Develop end-to-end web applications using Node.js, React and MongoDB. Docker and CI/CD experience preferred. You will own features from design to deployment.",
                "skills": "Node.js, React, MongoDB, Docker",
                "link": "",
                "source": "Sample",
            },
            {
                "title": "DevOps Engineer",
                "company": "CloudNine Tech",
                "location": "Pune",
                "description": "Manage CI/CD pipelines, cloud infrastructure, and containerized deployments. AWS, Kubernetes, and Terraform experience required.",
                "skills": "AWS, Kubernetes, Terraform, Docker, CI/CD",
                "link": "",
                "source": "Sample",
            },
            {
                "title": "Android Developer Intern",
                "company": "MobileFirst",
                "location": "Delhi",
                "description": "Build and maintain Android applications using Kotlin and Jetpack Compose. RESTful API integration and Git workflow knowledge expected.",
                "skills": "Kotlin, Android, Jetpack Compose, REST APIs",
                "link": "",
                "source": "Sample",
            },
            {
                "title": "Data Science Intern",
                "company": "Analytica",
                "location": "Chennai",
                "description": "Assist in data collection, cleaning, analysis and visualisation. Build predictive models using Python. Exposure to pandas, matplotlib and statsmodels preferred.",
                "skills": "Python, pandas, matplotlib, machine learning",
                "link": "",
                "source": "Sample",
            },
        ]

    # Optional search filter
    q = (request.GET.get("q") or "").strip().lower()
    if q:
        jobs = [
            j for j in jobs
            if q in j["title"].lower()
            or q in j["company"].lower()
            or q in j["skills"].lower()
            or q in j["description"].lower()
        ]

    return JsonResponse({"jobs": jobs[:200], "total": len(jobs)})