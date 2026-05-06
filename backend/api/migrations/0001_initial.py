from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ScheduledSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254)),
                ("scheduled_date", models.DateField()),
                ("session_type", models.CharField(choices=[("mock", "Mock Test"), ("interview", "AI Interview")], max_length=20)),
                ("topic", models.CharField(blank=True, default="", max_length=120)),
                ("confirmation_sent", models.BooleanField(default=False)),
                ("reminder_sent", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["scheduled_date", "-created_at"],
            },
        ),
    ]
