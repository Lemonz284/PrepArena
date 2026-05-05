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
        fallback_key = os.getenv("GROQ_API_KEY2", "").strip()

        candidate_keys = []
        for k in (primary_key, fallback_key):
            if k and k != "gsk_your_actual_key_here" and k not in candidate_keys:
                candidate_keys.append(k)

        if not candidate_keys:
            return JsonResponse({"error": "No valid Groq API key configured. Add GROQ_API_KEY or GROQ_API_KEY2 in backend/.env"}, status=500)

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
        fallback_key = os.getenv("GROQ_API_KEY2", "").strip()
        if not fallback_key:
            return JsonResponse({"error": "GROQ_API_KEY2 is not configured"}, status=500)

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

        client = Groq(api_key=fallback_key)
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_completion_tokens=1200,
        )

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
THINKING_FILLER = [
    "Hmm, interesting.",
    "Okay, got it.",
    "Let me think about that.",
    "That's a fair point.",
    "Alright.",
    "Good to know.",
]

import random as _random

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
    Returns: { next_question, thinking_phrase, is_last }
    """
    try:
        body = json.loads(request.body)
        role             = str(body.get("role", "Software Engineer"))[:80]
        company          = str(body.get("company", "the company"))[:80]
        last_answer      = str(body.get("last_answer", ""))[:1200]
        question_number  = int(body.get("question_number", 1))
        total_questions  = int(body.get("total_questions", 6))
        history          = body.get("history", [])
        if not isinstance(history, list):
            history = []

        # Use primary key first, fallback second
        primary_key  = os.getenv("GROQ_API_KEY",  "").strip()
        fallback_key = os.getenv("GROQ_API_KEY2", "").strip()
        candidate_keys = [k for k in (primary_key, fallback_key)
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

        is_last = (question_number >= total_questions)

        if is_last:
            next_instruction = (
                "This is the FINAL exchange of the interview. "
                "After this, the interview ends. "
                "For NEXT: ask one strong closing question about their biggest strength, "
                "proudest project, or future goals."
            )
        else:
            remaining = total_questions - question_number
            next_instruction = (
                f"There are {remaining} more exchanges left. "
                "For NEXT: you have two options — pick whichever feels more natural:\n"
                "  Option A) Ask a new interview question (behavioral OR technical, mix them up). "
                "  Option B) Follow up conversationally on what the candidate just said "
                "  (e.g. 'So what happened after that?', 'How did the team react?', "
                "  'Did you consider doing X instead?', 'What would you do differently now?'). "
                "Choose Option B if the candidate's answer was interesting or incomplete. "
                "Do NOT repeat anything already discussed."
            )

        system_prompt = (
            f"You are a sharp, friendly professional interviewer conducting a mock interview "
            f"for the role of {role} at {company}. "
            "You speak naturally, like a real human interviewer — not a chatbot. "
            "Keep every response SHORT. No markdown. Plain text only."
        )

        user_prompt = (
            f"Recent interview exchanges:\n{context_block}\n\n"
            f"The candidate just said (answering exchange {question_number} of {total_questions}):\n"
            f"\"{last_answer}\"\n\n"
            f"{next_instruction}\n\n"
            "Respond in EXACTLY this format (two lines, nothing else):\n"
            "REACTION: <one natural sentence acknowledging/reacting to their answer — "
            "e.g. 'That's a great example.' / 'Interesting approach.' / "
            "'Nice, sounds like a challenging situation.' / 'Good thinking.'>"
            "\n"
            "NEXT: <the follow-up or next question — conversational OR formal, your choice>"
            "\n\n"
            "Rules: REACTION must be exactly 1 sentence. NEXT must be 1-2 sentences max. "
            "No numbering. No extra text outside the two lines."
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

        return JsonResponse({
            "reaction":        reaction,
            "next_turn":       next_turn,
            "thinking_phrase": _random.choice(THINKING_FILLER),
            "is_last":         is_last,
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