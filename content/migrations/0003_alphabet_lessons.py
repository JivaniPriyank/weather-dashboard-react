"""Adds the section "Basics of A1" (alphabet, sounds, practice) if level A1 exists.
On a brand-new database without levels it does nothing: run
`python manage.py add_alphabet_lessons` after adding the levels."""
from django.db import migrations


def add(apps, schema_editor):
    from content.lesson_library import install_alphabet

    install_alphabet(apps.get_model("content", "Level"), apps.get_model("content", "Section"),
                     apps.get_model("content", "Lesson"), apps.get_model("content", "SpeakingTask"),
                     apps.get_model("content", "SpeakingLine"))


class Migration(migrations.Migration):
    dependencies = [("content", "0002_sections_and_lessons")]

    operations = [migrations.RunPython(add, migrations.RunPython.noop)]
