from django.db import models


class ScheduledSession(models.Model):
    SESSION_TYPE_CHOICES = (
        ("mock", "Mock Test"),
        ("interview", "AI Interview"),
    )

    email = models.EmailField()
    scheduled_date = models.DateField()
    session_type = models.CharField(max_length=20, choices=SESSION_TYPE_CHOICES)
    topic = models.CharField(max_length=120, blank=True, default="")
    difficulty = models.CharField(max_length=20, blank=True, default="")
    user_name = models.CharField(max_length=80, blank=True, default="")

    confirmation_sent = models.BooleanField(default=False)
    reminder_sent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["scheduled_date", "-created_at"]

    def __str__(self):
        return f"{self.email} - {self.session_type} on {self.scheduled_date}"
