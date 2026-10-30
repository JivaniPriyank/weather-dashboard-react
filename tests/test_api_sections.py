"""The teacher's own sections: building lessons from blocks, and students working through them."""
import io

from django.core.management import call_command

from content.blocks import clean_blocks, exercise_count
from content.lesson_library import SECTION_TITLE
from content.models import Lesson, Section, SpeakingTask, Topic
from learning.models import LessonProgress

from .test_api_accounts import ApiCase

CHOICE = {"type": "choice", "items": [{"say": "E", "options": ["E", "I"], "answer": 0},
                                       {"prompt": "Wir ___ aus Indien.", "options": ["sind", "seid", "ist"], "answer": 0}]}


class BlockTests(ApiCase):
    def test_good_blocks_are_cleaned(self):
        blocks, errors = clean_blocks([
            {"type": "text", "body": "  Hallo  ", "junk": 1},
            {"type": "table", "headers": ["ich", "bin"], "rows": [["du", "bist", "extra"], ["", ""]]},
            CHOICE,
            {"type": "gap", "choices": ["ei", "ie"], "items": [{"text": "sp_len", "answer": "ie"}]},
            {"type": "spell_word", "items": [{"word": "Haus"}, "Buch"]},
        ])
        self.assertEqual(errors, {})
        self.assertEqual(blocks[0], {"type": "text", "heading": "", "body": "Hallo"})
        self.assertEqual(blocks[1]["rows"], [["du", "bist"]])  # extra cell cut, empty row dropped
        self.assertEqual(exercise_count(blocks), 2 + 1 + 2)

    def test_bad_blocks_get_one_message_each(self):
        _, errors = clean_blocks([
            {"type": "text", "body": ""},
            {"type": "choice", "items": [{"prompt": "?", "options": ["a", "b"], "answer": 5}]},
            {"type": "gap", "choices": ["ei", "ie"], "items": [{"text": "spielen", "answer": "ie"}]},
            {"type": "virus"},
        ])
        self.assertEqual(set(errors), {"block-0", "block-1", "block-2", "block-3"})
        self.assertIn("right answer", errors["block-1"][0])
        self.assertIn("exactly one _", errors["block-2"][0])


class TeacherSectionTests(ApiCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.teacher)

    def make(self):
        sec = self.post("/teacher/content/sections/", {"level": "A1", "title": "Exam tips", "icon": "flag"}).json()["section"]
        lesson = self.post(f"/teacher/content/sections/{sec['id']}/lessons/", {"title": "Teil 1"}).json()["lesson"]
        return sec, lesson

    def test_build_and_publish_a_lesson(self):
        sec, lesson = self.make()
        self.assertFalse(lesson["is_published"])
        r = self.patch(f"/teacher/content/lessons/{lesson['id']}/",
                       {"blocks": [{"type": "text", "body": "Hallo"}, CHOICE], "is_published": True})
        self.assertEqual(r.status_code, 200, r.json())
        self.assertIn("Students can see it", r.json()["message"])
        d = self.get(f"/teacher/content/sections/{sec['id']}/").json()["section"]
        self.assertEqual(d["lessons"][0]["summary"], "Text · Choose the answer")
        self.assertEqual(self.get("/teacher/content/?level=A1").json()["counts"]["sections"], 1)

    def test_bad_block_saves_nothing(self):
        _, lesson = self.make()
        r = self.patch(f"/teacher/content/lessons/{lesson['id']}/",
                       {"title": "Neu", "blocks": [{"type": "text", "body": "ok"}, {"type": "table", "headers": []}]})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(list(r.json()["errors"]), ["block-1"])
        self.assertEqual(Lesson.objects.get(pk=lesson["id"]).title, "Teil 1")

    def test_speaking_block_must_match_the_level(self):
        _, lesson = self.make()
        a2_task = SpeakingTask.objects.filter(level=self.a2).first()
        r = self.patch(f"/teacher/content/lessons/{lesson['id']}/", {"blocks": [{"type": "speaking", "task_id": a2_task.pk}]})
        self.assertIn("A1 speaking tasks", r.json()["errors"]["block-0"][0])

    def test_reorder_and_delete(self):
        sec, first = self.make()
        second = self.post(f"/teacher/content/sections/{sec['id']}/lessons/", {"title": "Teil 2"}).json()["lesson"]
        self.assertEqual(self.post(f"/teacher/content/sections/{sec['id']}/order/", {"lessons": [first["id"]]}).status_code, 400)
        r = self.post(f"/teacher/content/sections/{sec['id']}/order/", {"lessons": [second["id"], first["id"]]})
        self.assertEqual([x["title"] for x in r.json()["section"]["lessons"]], ["Teil 2", "Teil 1"])
        r = self.client.delete(f"/api/teacher/content/sections/{sec['id']}/")
        self.assertIn("2 lessons deleted", r.json()["message"])

    def test_students_cannot_edit(self):
        self.client.force_login(self.student)
        self.assertEqual(self.get("/teacher/content/sections/").status_code, 403)


class StudentSectionTests(ApiCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        call_command("add_alphabet_lessons", stdout=io.StringIO())  # levels exist now
        cls.section = Section.objects.get(title=SECTION_TITLE)
        cls.practice = cls.section.lessons.get(title="Practise the alphabet")

    def setUp(self):
        super().setUp()
        self.client.force_login(self.student)

    def test_alphabet_lessons_installed_once(self):
        out = io.StringIO()
        call_command("add_alphabet_lessons", stdout=out)
        self.assertIn("already there", out.getvalue())
        self.assertEqual(self.section.lessons.filter(is_published=True).count(), 3)
        self.assertEqual(exercise_count(self.practice.blocks), 15)

    def test_menu_lesson_and_score(self):
        menu = self.get("/session/").json()["sections"]
        self.assertEqual([x["title"] for x in menu], [SECTION_TITLE])
        d = self.get(f"/lessons/{self.practice.pk}/").json()
        self.assertEqual(d["lesson"]["exercises"], 15)
        speaking = [b for b in d["lesson"]["blocks"] if b["type"] == "speaking"][0]
        self.assertEqual(speaking["task"]["slug"], "wie-schreibt-man-das")
        r = self.post(f"/lessons/{self.practice.pk}/done/", {"score": 99})
        self.assertEqual((r.json()["progress"]["score"], r.json()["progress"]["total"]), (15, 15))  # capped
        self.post(f"/lessons/{self.practice.pk}/done/", {"score": 3})
        self.assertEqual(LessonProgress.objects.get(user=self.student).score, 15)  # best score kept
        self.assertEqual(self.get(f"/sections/{self.section.pk}/").json()["done"], 1)
        # the teacher sees it straight away
        self.client.force_login(self.teacher)
        d = self.get(f"/teacher/students/{self.student.pk}/?level=A1").json()
        self.assertEqual(d["sections"][0]["done"], 1)
        self.assertEqual(d["summary"]["lessons_done"], 1)
        self.assertEqual(d["activity"][0]["kind"], "lesson")

    def test_drafts_hidden_sections_and_other_levels(self):
        draft = Lesson.objects.create(section=self.section, title="Entwurf", blocks=[{"type": "text", "heading": "", "body": "x"}])
        self.assertEqual(self.get(f"/lessons/{draft.pk}/").status_code, 404)
        a2 = Section.objects.create(level=self.a2, title="A2 extra")
        a2_lesson = Lesson.objects.create(section=a2, title="x", is_published=True, blocks=[])
        self.assertEqual(self.get(f"/sections/{a2.pk}/").status_code, 404)
        self.assertEqual(self.get(f"/lessons/{a2_lesson.pk}/").status_code, 404)
        Section.objects.filter(pk=self.section.pk).update(is_visible=False)
        self.assertEqual(self.get("/session/").json()["sections"], [])
        self.assertEqual(self.get(f"/lessons/{self.practice.pk}/").status_code, 404)
        self.client.force_login(self.teacher)  # the teacher can preview anything
        self.assertEqual(self.get(f"/lessons/{draft.pk}/").status_code, 200)


class A1CourseTests(ApiCase):
    """Dhruv's Lektion 1 and 2, the new blocks, and the section's goals, word list and homework."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        call_command("add_alphabet_lessons", stdout=io.StringIO())
        call_command("add_a1_course", stdout=io.StringIO())

    def test_installed_once_with_words_and_basics_hidden(self):
        out = io.StringIO()
        call_command("add_a1_course", stdout=out)
        self.assertIn("nothing changed", out.getvalue())
        l1 = Section.objects.get(title__startswith="Lektion 1")
        l2 = Section.objects.get(title__startswith="Lektion 2")
        self.assertEqual((l1.topic.items.count(), l2.topic.items.count()), (20, 20))
        self.assertEqual(len(l2.goals), 4)
        self.assertFalse(Section.objects.get(title=SECTION_TITLE).is_visible)
        for lesson in Lesson.objects.filter(section__in=[l1, l2]):
            blocks, errors = clean_blocks(lesson.blocks)
            self.assertEqual(errors, {}, lesson.title)
            self.assertEqual(blocks, lesson.blocks, lesson.title)
        uebungen = l2.lessons.get(title="Übungen")
        self.assertEqual(exercise_count(uebungen.blocks), 14)
        blank = uebungen.blocks[0]["items"][1]
        self.assertEqual(blank["answer"], "Viertel")  # the slide's answer key says "fünf" (3:05)

    def test_student_sees_goals_words_and_homework(self):
        self.client.force_login(self.student)
        l2 = Section.objects.get(title__startswith="Lektion 2")
        self.assertIn(l2.title, [x["title"] for x in self.get("/session/").json()["sections"]])
        d = self.get(f"/sections/{l2.pk}/").json()["section"]
        self.assertEqual(d["topic"]["count"], 20)
        self.assertIn("weekly schedule", d["homework"])
        self.assertEqual(d["goals"][3]["title"], "Telling time")

    def test_teacher_edits_goals_words_homework(self):
        self.client.force_login(self.teacher)
        sec = Section.objects.get(title__startswith="Lektion 1")
        a2_topic = Topic.objects.filter(level=self.a2).first()
        r = self.patch(f"/teacher/content/sections/{sec.pk}/", {"topic": a2_topic.pk})
        self.assertIn("topic", r.json()["errors"])
        r = self.patch(f"/teacher/content/sections/{sec.pk}/", {"goals": [{"title": "", "text": "x"}]})
        self.assertIn("goals", r.json()["errors"])
        r = self.patch(f"/teacher/content/sections/{sec.pk}/", {"homework": "Neu", "topic": "", "goals": []})
        self.assertEqual(r.status_code, 200)
        sec.refresh_from_db()
        self.assertEqual((sec.homework, sec.topic, sec.goals), ("Neu", None, []))
        self.assertEqual(sec.title, "Lektion 1: Alphabet & Aussprache")  # untouched fields stay

    def test_new_blocks_are_checked(self):
        blocks, errors = clean_blocks([
            {"type": "blanks", "items": [{"before": "21 =", "after": ".", "answer": "einundzwanzig"}]},
            {"type": "listen_type", "items": [{"say": "zwölf", "answer": "12"}]},
            {"type": "choice", "items": [{"clock": "07:30", "options": ["halb acht", "halb sieben"], "answer": 0}]},
            {"type": "mistakes", "items": [{"wrong": "zwanzigeins", "right": "einundzwanzig"}]},
            {"type": "clock"}, {"type": "number_builder"},
        ])
        self.assertEqual(errors, {})
        self.assertEqual(exercise_count(blocks), 3)
        _, errors = clean_blocks([
            {"type": "blanks", "items": [{"before": "21 =", "answer": ""}]},
            {"type": "listen_type", "items": [{"say": "zwölf"}]},
            {"type": "choice", "items": [{"clock": "7.30", "options": ["a", "b"], "answer": 0}]},
            {"type": "mistakes", "items": [{"wrong": "x"}]},
        ])
        self.assertEqual(set(errors), {"block-0", "block-1", "block-2", "block-3"})
        self.assertIn("HH:MM", errors["block-2"][0])
