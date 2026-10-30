"""Adds Lektion 1 and 2 of Dhruv's A1 course as sections (with their word lists) if level A1
exists, and hides the earlier "Basics of A1" section. On a new database without levels it
does nothing: run `python manage.py add_a1_course` after `seed_content`."""
from django.db import migrations


def add(apps, schema_editor):
    from content.course_a1 import install

    m = lambda name: apps.get_model("content", name)
    install(m("Level"), m("Section"), m("Lesson"), m("Topic"), m("VocabularyItem"), m("SpeakingTask"))


class Migration(migrations.Migration):
    dependencies = [("content", "0004_section_goals_words_homework")]

    operations = [migrations.RunPython(add, migrations.RunPython.noop)]
