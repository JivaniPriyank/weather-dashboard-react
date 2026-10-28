from datetime import timedelta

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from content.models import QuizQuestion, SpeakingTask, VocabularyItem
from learning import services
from learning.models import CardReview, QuizAnswer, QuizAttempt, SpeakingPractice

from .test_api_accounts import ApiCase


def add_history(user, level, days):
    """Word reviews, plus quizzes and speaking practice on each of the last `days` days."""
    now = timezone.now()
    items = list(VocabularyItem.objects.filter(topic__level=level))
    CardReview.objects.bulk_create([CardReview(user=user, item=item, box=1 + i % 5, last_reviewed_at=now - timedelta(days=i % days))
                                    for i, item in enumerate(items)])
    add_quizzes(user, level, days)


def add_quizzes(user, level, days):
    now = timezone.now()
    qids = list(QuizQuestion.objects.filter(level=level).values_list("id", flat=True))[:5]
    for d in range(days):
        attempt = QuizAttempt.objects.create(user=user, level=level, question_ids=qids, finished_at=now - timedelta(days=d))
        QuizAnswer.objects.bulk_create([QuizAnswer(attempt=attempt, question_id=q, is_correct=(q + d) % 2 == 0) for q in qids])
    for task in SpeakingTask.objects.filter(level=level):
        SpeakingPractice.objects.create(user=user, task=task)


class QueryCountTests(ApiCase):
    def count_queries(self, url):
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(self.client.get(url).status_code, 200)
        return len(ctx)

    def test_pages_do_not_get_slower_as_students_practise(self):
        add_history(self.student, self.a1, days=2)
        pages = {self.teacher: ["/api/teacher/students/", f"/api/teacher/students/{self.student.pk}/", "/api/teacher/overview/"],
                 self.student: ["/api/today/", "/api/progress/", "/api/practice/"]}
        before = {}
        for user, urls in pages.items():
            self.client.force_login(user)
            before.update({url: self.count_queries(url) for url in urls})
        add_quizzes(self.student, self.a1, days=30)
        for user, urls in pages.items():
            self.client.force_login(user)
            for url in urls:
                self.assertEqual(self.count_queries(url), before[url], url)

    def test_students_list_stays_fast_with_lots_of_activity(self):
        add_history(self.student, self.a1, days=40)
        self.client.force_login(self.teacher)
        row = next(u for u in self.get("/teacher/students/").json()["students"] if u["id"] == self.student.pk)
        self.assertEqual(row["practised"], VocabularyItem.objects.filter(topic__level=self.a1).count())
        self.assertEqual(row["quizzes"], 40)
        self.assertEqual(row["learned"], CardReview.objects.filter(user=self.student, box__gte=4).count())
        self.assertIsNotNone(row["last_active"])


class SummaryTests(ApiCase):
    def test_quiz_lists_are_newest_first_with_scores(self):
        add_history(self.student, self.a1, days=12)
        self.client.force_login(self.student)
        attempts = self.get("/progress/").json()["attempts"]
        started = [a["started_at"] for a in attempts]
        self.assertEqual(len(started), 10)
        self.assertEqual(started, sorted(started, reverse=True))
        for a in attempts:
            self.assertEqual(a["score"], QuizAttempt.objects.get(pk=a["id"]).answers.filter(is_correct=True).count())

    def test_streak_longer_than_two_months(self):
        now = timezone.now()
        task = SpeakingTask.objects.first()
        for d in range(90):
            p = SpeakingPractice.objects.create(user=self.student, task=task)
            SpeakingPractice.objects.filter(pk=p.pk).update(practised_at=now - timedelta(days=d))
        self.assertEqual(services.streak(self.student), 90)

    def test_last_active_finds_old_practice(self):
        task = SpeakingTask.objects.first()
        p = SpeakingPractice.objects.create(user=self.student, task=task)
        long_ago = timezone.now() - timedelta(days=700)
        SpeakingPractice.objects.filter(pk=p.pk).update(practised_at=long_ago)
        summary = services.student_summary(self.student)
        self.assertEqual(summary["last_active"], timezone.localtime(long_ago).date())
        self.assertEqual(summary["streak"], 0)
