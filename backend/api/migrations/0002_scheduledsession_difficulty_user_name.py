from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="scheduledsession",
            name="difficulty",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="scheduledsession",
            name="user_name",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
    ]
