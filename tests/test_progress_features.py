from datetime import timedelta

from django.utils import timezone

from content.models import QuizQuestion, SpeakingTask
from learning import services
from learning.models import QuizAnswer, QuizAttempt, SpeakingPractice

from .test_api_accounts import ApiCase


class MistakesQuizTests(ApiCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.student)
        self.qs = list(QuizQuestion.objects.filter(level=self.a1)[:4])

    def answer(self, question, right):
        attempt = QuizAttempt.objects.create(user=self.student, level=self.a1, question_ids=[question.pk],
                                             finished_at=timezone.now())
        QuizAnswer.objects.create(attempt=attempt, question=question, is_correct=right)

    def test_only_questions_whose_latest_answer_was_wrong(self):
        q1, q2, q3, q4 = self.qs
        self.answer(q1, False)
        self.answer(q2, False)
        self.answer(q2, True)   # put right since
        self.answer(q3, True)
        self.answer(q3, False)  # got wrong again
        self.assertCountEqual(services.mistake_question_ids(self.student, self.a1), [q1.pk, q3.pk])
        self.assertEqual(self.get("/practice/").json()["mistakes"], 2)

        r = self.post("/practice/start/", {"level": "A1", "mode": "mistakes"})
        self.assertEqual(r.status_code, 201)
        attempt = QuizAttempt.objects.get(pk=r.json()["attempt"])
        self.assertCountEqual(attempt.question_ids, [q1.pk, q3.pk])
        self.assertEqual(attempt.kind, QuizAttempt.Kind.MISTAKES)
        self.assertEqual(self.get(f"/attempts/{attempt.pk}/").json()["attempt"]["title"], "A1 mistakes")

    def test_no_mistakes_gives_a_clear_message(self):
        self.answer(self.qs[0], True)
        r = self.post("/practice/start/", {"level": "A1", "mode": "mistakes"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("No mistakes", r.json()["error"])
        self.assertFalse(QuizAttempt.objects.filter(kind=QuizAttempt.Kind.MISTAKES).exists())

    def test_other_students_and_levels_dont_count(self):
        other = self.make_student("c@test.de", "Carla", "approved", level=self.a1)
        attempt = QuizAttempt.objects.create(user=other, level=self.a1, question_ids=[self.qs[0].pk])
        QuizAnswer.objects.create(attempt=attempt, question=self.qs[0], is_correct=False)
        a2_question = QuizQuestion.objects.filter(level=self.a2).first()
        self.answer(a2_question, False)
        self.assertEqual(services.mistake_question_ids(self.student, self.a1), [])

    def test_existing_quizzes_keep_their_titles(self):
        attempt = QuizAttempt.objects.create(user=self.student, level=self.a1, question_ids=[])
        self.assertEqual(attempt.kind, QuizAttempt.Kind.PRACTICE)
        self.assertEqual(attempt.title, "A1 mixed practice")


class ProgressPageTests(ApiCase):
    def test_calendar_and_topic_accuracy(self):
        now = timezone.now()
        task = SpeakingTask.objects.filter(level=self.a1).first()
        for days_ago in (0, 0, 3, 100):
            p = SpeakingPractice.objects.create(user=self.student, task=task)
            SpeakingPractice.objects.filter(pk=p.pk).update(practised_at=now - timedelta(days=days_ago))
        topical = list(QuizQuestion.objects.filter(level=self.a1, grammar_topic__isnull=False).select_related("grammar_topic"))
        weak, strong = topical[0], next(q for q in topical if q.grammar_topic_id != topical[0].grammar_topic_id)
        attempt = QuizAttempt.objects.create(user=self.student, level=self.a1, question_ids=[weak.pk, strong.pk],
                                             finished_at=now)
        QuizAnswer.objects.create(attempt=attempt, question=weak, is_correct=False)
        QuizAnswer.objects.create(attempt=attempt, question=strong, is_correct=True)

        self.client.force_login(self.student)
        data = self.get("/progress/").json()
        calendar = data["calendar"]
        self.assertEqual(len(calendar), 84)
        self.assertEqual(calendar[-1]["date"], timezone.localdate().isoformat())
        self.assertEqual(calendar[-1]["count"], 2 + 2)  # two practices + two quiz answers today
        self.assertEqual(calendar[-4]["count"], 1)
        self.assertEqual(sum(d["count"] for d in calendar), 5)  # 100 days ago is outside the calendar

        topics = data["topics"]
        self.assertEqual([t["title"] for t in topics], [weak.grammar_topic.title, strong.grammar_topic.title])
        self.assertEqual((topics[0]["percent"], topics[0]["answered"]), (0, 1))
        self.assertEqual(topics[1]["percent"], 100)
