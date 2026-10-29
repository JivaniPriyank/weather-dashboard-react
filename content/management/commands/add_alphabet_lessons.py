from django.core.management.base import BaseCommand

from content.lesson_library import SECTION_TITLE, install_alphabet
from content.models import Lesson, Level, Section, SpeakingLine, SpeakingTask


class Command(BaseCommand):
    help = f"Add the section “{SECTION_TITLE}” (alphabet, sounds, practice) to level A1, if it isn't there yet."

    def handle(self, *args, **options):
        if install_alphabet(Level, Section, Lesson, SpeakingTask, SpeakingLine):
            self.stdout.write(self.style.SUCCESS(f"Added “{SECTION_TITLE}” with 3 lessons and the speaking task."))
        elif not Level.objects.filter(code="A1").exists():
            self.stdout.write(self.style.WARNING("There is no level A1 yet. Add it first (seed_content does)."))
        else:
            self.stdout.write(f"“{SECTION_TITLE}” is already there; nothing changed.")
