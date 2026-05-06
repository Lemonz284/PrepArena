import json
import os
import urllib.request
from datetime import timedelta
from pathlib import Path

from django.utils import timezone

from .models import ScheduledSession


def _session_label(session_type: str) -> str:
    return "Mock Test" if session_type == "mock" else "AI Interview"


def _read_template(filename: str) -> str:
    backend_root = Path(__file__).resolve().parents[1]
    project_root = backend_root.parent
    tpl_path = project_root / "frontend" / filename
    return tpl_path.read_text(encoding="utf-8")


def _drop_difficulty_row_if_needed(html: str, session: ScheduledSession) -> str:
    if session.session_type == "mock":
        return html
    start_marker = "<!-- Remove this row for AI Interview (no difficulty) -->"
    start = html.find(start_marker)
    if start == -1:
        return html
    tr_start = html.find("<tr>", start)
    tr_end = html.find("</tr>", tr_start)
    if tr_start == -1 or tr_end == -1:
        return html
    return html[:tr_start] + html[tr_end + len("</tr>"):]


def _render_template(base_html: str, session: ScheduledSession) -> str:
    dashboard_url = os.getenv("DASHBOARD_URL", "http://localhost:5173/dashboard")
    session_topic = session.topic or "General Preparation"
    difficulty = session.difficulty or "Medium"
    user_name = session.user_name or "Learner"
    formatted_date = session.scheduled_date.strftime("%A, %d %B %Y")

    html = base_html.replace("{{USER_NAME}}", user_name)
    html = html.replace("{{SESSION_TYPE}}", _session_label(session.session_type))
    html = html.replace("{{SESSION_TOPIC}}", session_topic)
    html = html.replace("{{SESSION_DIFFICULTY}}", difficulty)
    html = html.replace("{{SESSION_DATE}}", formatted_date)
    html = html.replace("{{DASHBOARD_URL}}", dashboard_url)
    return _drop_difficulty_row_if_needed(html, session)


def _send_via_resend(to_email: str, subject: str, html_body: str) -> None:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    from_email = os.getenv("RESEND_FROM_EMAIL", "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not configured")
    if not from_email:
        raise RuntimeError("RESEND_FROM_EMAIL is not configured")

    payload = json.dumps(
        {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "PrepArena/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        if resp.status >= 300:
            raise RuntimeError(f"Resend API error: HTTP {resp.status}")


def send_confirmation_email(session: ScheduledSession) -> None:
    html = _render_template(_read_template("email_confirmation.html"), session)
    subject = f"PrepArena: {_session_label(session.session_type)} scheduled"
    _send_via_resend(session.email, subject, html)


def send_reminder_email(session: ScheduledSession) -> None:
    html = _render_template(_read_template("email_reminder.html"), session)
    subject = f"Reminder: {_session_label(session.session_type)} is tomorrow"
    _send_via_resend(session.email, subject, html)


def send_due_reminders() -> int:
    today = timezone.localdate()
    target_date = today + timedelta(days=1)
    sent_count = 0
    due_sessions = ScheduledSession.objects.filter(
        scheduled_date=target_date,
        reminder_sent=False,
    )
    for session in due_sessions:
        send_reminder_email(session)
        session.reminder_sent = True
        session.save(update_fields=["reminder_sent"])
        sent_count += 1
    return sent_count
