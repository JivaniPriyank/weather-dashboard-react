from django.core.management.base import BaseCommand

from content.course_a1 import install
from content.models import Lesson, Level, Section, SpeakingTask, Topic, VocabularyItem


class Command(BaseCommand):
    help = "Add the lessons of Dhruv's A1 course that aren't on the site yet (never changes existing ones)."

    def handle(self, *args, **options):
        if not Level.objects.filter(code="A1").exists():
            self.stdout.write(self.style.WARNING("There is no level A1 yet. Run seed_content first."))
            return
        added = install(Level, Section, Lesson, Topic, VocabularyItem, SpeakingTask)
        if added:
            self.stdout.write(self.style.SUCCESS("Added: " + ", ".join(added)))
        else:
            self.stdout.write("All lessons are already there; nothing changed.")
