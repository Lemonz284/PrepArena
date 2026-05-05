"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from api.views import generate_mock_test, generate_mock_test_review, start_proctoring, push_proctoring_frame, stop_proctoring, upload_proctor_report, interview_next, generate_interview_review
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/generate-mock-test/",   generate_mock_test,      name="generate_mock_test"),
    path("api/mock-test-review/",     generate_mock_test_review, name="generate_mock_test_review"),
    path("api/proctoring/start/",     start_proctoring,        name="start_proctoring"),
    path("api/proctoring/frame/",     push_proctoring_frame,   name="push_proctoring_frame"),
    path("api/proctoring/stop/",      stop_proctoring,         name="stop_proctoring"),
    path("api/proctoring/report/",    upload_proctor_report,   name="upload_proctor_report"),
    path("api/interview/next/",        interview_next,           name="interview_next"),
    path("api/interview/review/",      generate_interview_review, name="generate_interview_review"),
    path('api/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path("api/", include("api.urls")),
    path("api/register/", include("api.urls")),
]
     
