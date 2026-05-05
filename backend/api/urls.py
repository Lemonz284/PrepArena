from django.urls import path
from .views import register_user, get_jobs

urlpatterns = [
    path("register/", register_user),
    path("jobs/", get_jobs),
]