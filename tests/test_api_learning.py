from datetime import timedelta

from django.utils import timezone

from content.models import GrammarTopic, Level, QuizQuestion, SpeakingTask, Topic, VocabularyItem
from learning import services
from learning.models import CardReview, QuizAttempt, SpeakingPractice

from .test_api_accounts import ApiCase


class FlashcardTests(ApiCase):
    def setUp(self):
        self.client.force_login(self.student)
        self.topic = Topic.objects.get(name="Familie")

    def test_decks_deck_and_session(self):
        decks = self.get("/decks/").json()["decks"]
        familie = next(d for d in decks if d["name"] == "Familie")
        self.assertEqual(familie["stats"]["total"], 6)
        deck = self.get(f"/decks/A1/{self.topic.slug}/").json()
        self.assertEqual({w["article"] for w in deck["words"] if w["german"] == "Mutter"}, {"die"})
        cards = self.get(f"/decks/A1/{self.topic.slug}/session/").json()["cards"]
        self.assertEqual(len(cards), 6)
        self.assertTrue(all(c["is_new"] for c in cards))

    def test_review_rules(self):
        item = self.topic.items.first()
        self.assertEqual(self.post("/review/", {"item": item.pk, "knew": True}).json()["box"], 2)
        review = CardReview.objects.get(user=self.student, item=item)
        self.assertGreater(review.due_at, timezone.now() + timedelta(hours=40))
        self.post("/review/", {"item": item.pk, "knew": False})
        review.refresh_from_db()
        self.assertEqual((review.box, review.times_seen, review.times_correct), (1, 2, 1))
        for bad in [{"item": 999999, "knew": True}, {"item": item.pk, "knew": "yes"}, {}]:
            self.assertEqual(self.post("/review/", bad).status_code, 400)

    def test_box_never_exceeds_five(self):
        review = CardReview.objects.create(user=self.student, item=VocabularyItem.objects.first())
        for _ in range(8):
            review.record(True)
        self.assertEqual(review.box, 5)


class QuizTests(ApiCase):
    def setUp(self):
        self.client.force_login(self.student)

    def start(self, **data):
        return self.post("/practice/start/", {"level": "A1", **data}).json()["attempt"]

    def test_questions_never_reveal_the_answer(self):
        aid = self.start()
        q = self.get(f"/attempts/{aid}/").json()["question"]
        self.assertNotIn("is_correct", str(q))
        self.assertNotIn("accepted_answers", str(q))
        self.assertNotIn("explanation", q)

    def test_full_quiz_flow(self):
        aid = self.start()
        attempt = QuizAttempt.objects.get(pk=aid)
        right = 0
        for i in range(attempt.total):
            data = self.get(f"/attempts/{aid}/").json()
            self.assertEqual(data["position"], i + 1)
            q = QuizQuestion.objects.get(pk=data["question"]["id"])
            body = {"question": q.pk}
            if q.kind == "choice":
                opt = q.options.filter(is_correct=(i % 2 == 0)).first()
                body["option"] = opt.pk
                right += opt.is_correct
            else:
                body["typed"] = q.answers_list()[0] if i % 2 == 0 else "falsch"
                right += i % 2 == 0
            fb = self.post(f"/attempts/{aid}/answer/", body).json()
            self.assertIn("explanation", fb)
            self.assertEqual(fb["finished"], i == attempt.total - 1)
        self.assertTrue(self.get(f"/attempts/{aid}/").json()["finished"])
        res = self.get(f"/attempts/{aid}/results/").json()
        self.assertEqual((res["attempt"]["score"], len(res["missed"])), (right, attempt.total - right))

    def test_out_of_order_and_missing_answers(self):
        aid = self.start()
        attempt = QuizAttempt.objects.get(pk=aid)
        self.assertEqual(self.post(f"/attempts/{aid}/answer/", {"question": attempt.question_ids[1], "typed": "x"}).status_code, 409)
        first = QuizQuestion.objects.get(pk=attempt.question_ids[0])
        r = self.post(f"/attempts/{aid}/answer/", {"question": first.pk})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(attempt.answers.count(), 0)

    def test_topic_quiz_and_privacy(self):
        topic = GrammarTopic.objects.get(title__startswith="Präsens")
        aid = self.start(topic=topic.pk)
        ids = QuizAttempt.objects.get(pk=aid).question_ids
        self.assertEqual(set(QuizQuestion.objects.filter(pk__in=ids).values_list("grammar_topic", flat=True)), {topic.pk})
        self.client.force_login(self.make_student("o@test.de", "Other", "approved"))
        self.assertEqual(self.get(f"/attempts/{aid}/").status_code, 404)

    def test_typed_answers(self):
        q = QuizQuestion.objects.get(accepted_answers="bin gegangen")
        self.assertTrue(services.check_typed_answer(q, "Bin  gegangen."))
        self.assertFalse(services.check_typed_answer(q, "bin gegangen sein"))
        self.assertFalse(services.check_typed_answer(QuizQuestion(kind="typed", accepted_answers="größer"), "groser"))


class OtherStudentTests(ApiCase):
    def setUp(self):
        self.client.force_login(self.student)

    def test_grammar_and_speaking_pages(self):
        g = GrammarTopic.objects.get(title__startswith="Präsens")
        topic = self.get(f"/grammar/A1/{g.slug}/").json()["topic"]
        self.assertIn(["ihr", "-t", "lernt"], topic["table"]["rows"])
        task = SpeakingTask.objects.get(title="Sich vorstellen")
        d = self.get(f"/speaking/A1/{task.slug}/").json()
        self.assertTrue(d["can_submit"])
        self.assertEqual(d["task"]["minutes"], 4)
        self.assertIn("Wie heißen Sie?", d["task"]["questions"])

    def test_practised_and_today(self):
        task = SpeakingTask.objects.first()
        self.assertEqual(self.post(f"/speaking/{task.level.code}/{task.slug}/practised/").json()["practised"], 1)
        self.assertEqual(SpeakingPractice.objects.filter(user=self.student).count(), 1)
        today = self.get("/today/").json()
        self.assertEqual(today["summary"]["streak"], 1)
        self.assertIsNotNone(today["next_deck"])

    def test_teacher_today_and_landing(self):
        self.assertEqual(self.client.get("/api/landing/").json()["words"], 84)
        self.client.force_login(self.teacher)
        self.assertEqual(self.get("/speaking/A1/sich-vorstellen/").json()["can_submit"], False)
