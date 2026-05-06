from django.core.management.base import BaseCommand

from api.reminders import send_due_reminders


class Command(BaseCommand):
    help = "Send 1-day reminder emails for scheduled sessions."

    def handle(self, *args, **options):
        sent = send_due_reminders()
        self.stdout.write(self.style.SUCCESS(f"Reminder run complete. Sent: {sent}"))
