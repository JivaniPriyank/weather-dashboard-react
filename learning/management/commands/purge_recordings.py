"""Delete speaking recordings older than the keep period after feedback.

The website also does this by itself whenever a speaking page is opened, so you
only need this command if you want to run it on a schedule (e.g. on a host).
"""
from django.core.management.base import BaseCommand

from learning.services import purge_old_recordings


class Command(BaseCommand):
    help = "Delete speaking recordings whose feedback is older than SPEAKING_KEEP_DAYS_AFTER_FEEDBACK."

    def handle(self, *args, **options):
        count = purge_old_recordings()
        self.stdout.write(self.style.SUCCESS(f"Deleted {count} recording{'s' if count != 1 else ''}."))
