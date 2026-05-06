from django.urls import path
from .views import register_user, get_jobs, schedule_sessions, delete_schedule_session

urlpatterns = [
    path("register/", register_user),
    path("jobs/", get_jobs),
    path("schedule-sessions/", schedule_sessions),
    path("schedule-sessions/<int:session_id>/", delete_schedule_session),
]