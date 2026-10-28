from content.models import GrammarTopic, QuizQuestion, SpeakingTask, Topic, VocabularyItem
from learning.models import QuizAttempt

from .test_api_accounts import ApiCase


class ContentCase(ApiCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(self.teacher)

    def put(self, url, data):
        return self.client.put(f"/api{url}", data, content_type="application/json")

    def delete(self, url):
        return self.client.delete(f"/api{url}")


class AccessTests(ContentCase):
    def test_students_cannot_edit(self):
        self.client.force_login(self.student)
        self.assertEqual(self.get("/teacher/content/").status_code, 403)
        self.assertEqual(self.post("/teacher/content/topics/", {"level": "A1", "name": "X"}).status_code, 403)
        self.client.logout()
        self.assertEqual(self.get("/teacher/content/").status_code, 401)

    def test_home_lists_everything_per_level(self):
        d = self.get("/teacher/content/?level=A2").json()
        self.assertEqual(d["level"]["code"], "A2")
        self.assertEqual(d["counts"]["quiz"], len(d["questions"]))
        self.assertTrue(all(t["count"] >= len(t["preview"]) for t in d["topics"]))
        a1 = self.get("/teacher/content/").json()
        self.assertEqual(a1["level"]["code"], "A1")
        familie = next(t for t in a1["topics"] if t["name"] == "Familie")
        self.assertEqual(familie["preview"][0], {"article": "die", "german": "Mutter"})


class WordTests(ContentCase):
    def setUp(self):
        super().setUp()
        self.topic = Topic.objects.get(name="Familie")

    def test_topic_create_update_delete(self):
        r = self.post("/teacher/content/topics/", {"level": "A1", "name": "Familie", "description": "Again"})
        self.assertEqual(r.status_code, 201)
        t = r.json()["topic"]
        self.assertEqual(t["slug"], "familie-2")  # never clashes with the existing deck
        self.assertIn("name", self.patch(f"/teacher/content/topics/{t['id']}/", {"level": "A1", "name": ""}).json()["errors"])
        r = self.patch(f"/teacher/content/topics/{t['id']}/", {"level": "A2", "name": "Verwandte", "description": ""})
        self.assertEqual(r.json()["topic"]["level"], "A2")
        self.delete(f"/teacher/content/topics/{t['id']}/")
        self.assertFalse(Topic.objects.filter(pk=t["id"]).exists())

    def test_word_add_edit_delete(self):
        url = f"/teacher/content/topics/{self.topic.pk}/words/"
        r = self.post(url, {"article": "die", "german": "Tante", "english": "the aunt"})
        self.assertEqual(r.status_code, 201)
        wid = r.json()["word"]["id"]
        self.assertIn("already", str(self.post(url, {"article": "die", "german": "tante", "english": "x"}).json()))
        self.assertIn("article", self.post(url, {"article": "den", "german": "Onkel", "english": "x"}).json()["errors"])
        r = self.patch(f"/teacher/content/words/{wid}/", {"article": "die", "german": "Tante", "english": "the aunt",
                                                          "example": "Meine Tante wohnt in Köln."})
        self.assertEqual(r.json()["word"]["example"], "Meine Tante wohnt in Köln.")
        self.assertIn("already", str(self.patch(f"/teacher/content/words/{wid}/",
                                                {"article": "die", "german": "Mutter", "english": "x"}).json()))
        self.delete(f"/teacher/content/words/{wid}/")
        self.assertFalse(VocabularyItem.objects.filter(pk=wid).exists())

    def test_import_all_or_nothing(self):
        url = f"/teacher/content/topics/{self.topic.pk}/import/"
        bad = "die; Tante; the aunt\nder Onkel\ndie; Mutter; the mother"
        r = self.post(url, {"text": bad})
        self.assertEqual([e["line"] for e in r.json()["lines"]], [2, 3])
        self.assertEqual(self.topic.items.count(), 6)
        good = "die; Tante; the aunt; Meine Tante wohnt in Köln.\nder Onkel\tthe uncle\nGeschwister; siblings"
        r = self.post(url, {"text": good})
        self.assertEqual(r.status_code, 201)
        added = {(w.article, w.german, w.english) for w in self.topic.items.all()}
        self.assertTrue({("die", "Tante", "the aunt"), ("der", "Onkel", "the uncle"), ("", "Geschwister", "siblings")} <= added)
        self.assertEqual(self.post(url, {"text": "  "}).status_code, 400)


class QuestionTests(ContentCase):
    def choice(self, **extra):
        return {"level": "A1", "kind": "choice", "prompt": "Ich ___ müde.", "explanation": "sein",
                "options": [{"text": "bin", "is_correct": True}, {"text": "bist", "is_correct": False}], **extra}

    def test_choice_rules(self):
        url = "/teacher/content/questions/"
        two_right = self.choice(options=[{"text": "a", "is_correct": True}, {"text": "b", "is_correct": True}])
        self.assertIn("exactly one", str(self.post(url, two_right).json()))
        self.assertIn("two answers", str(self.post(url, self.choice(options=[{"text": "a", "is_correct": True}])).json()))
        a2 = GrammarTopic.objects.filter(level__code="A2").first()
        self.assertIn("grammar_topic", self.post(url, self.choice(grammar_topic=a2.pk)).json()["errors"])
        r = self.post(url, self.choice())
        self.assertEqual(r.status_code, 201)
        q = r.json()["question"]
        keep = q["options"][0]
        r = self.put(f"{url}{q['id']}/", self.choice(options=[{"id": keep["id"], "text": "bin", "is_correct": True},
                                                            {"text": "ist", "is_correct": False},
                                                            {"text": "sind", "is_correct": False}]))
        opts = r.json()["question"]["options"]
        self.assertEqual([o["text"] for o in opts], ["bin", "ist", "sind"])
        self.assertEqual(opts[0]["id"], keep["id"])  # existing answers are updated, not replaced

    def test_typed_and_switching_kind(self):
        r = self.post("/teacher/content/questions/", self.choice())
        qid = r.json()["question"]["id"]
        self.assertIn("answers", self.put(f"/teacher/content/questions/{qid}/",
                                          {"level": "A1", "kind": "typed", "prompt": "x", "answers": []}).json()["errors"])
        r = self.put(f"/teacher/content/questions/{qid}/",
                     {"level": "A1", "kind": "typed", "prompt": "Ich ___ müde.", "answers": ["bin", " "]})
        self.assertEqual(r.json()["question"]["answers"], ["bin"])
        q = QuizQuestion.objects.get(pk=qid)
        self.assertEqual((q.options.count(), q.accepted_answers), (0, "bin"))

    def test_delete_keeps_running_quizzes_working(self):
        self.client.force_login(self.student)
        aid = self.post("/practice/start/", {"level": "A1"}).json()["attempt"]
        first = self.get(f"/attempts/{aid}/").json()["question"]["id"]
        total = QuizAttempt.objects.get(pk=aid).total
        self.client.force_login(self.teacher)
        self.delete(f"/teacher/content/questions/{first}/")
        self.client.force_login(self.student)
        d = self.get(f"/attempts/{aid}/").json()
        self.assertEqual(d["attempt"]["total"], total - 1)
        self.assertNotEqual(d["question"]["id"], first)


class GrammarAndSpeakingTests(ContentCase):
    def test_grammar_table_and_examples(self):
        data = {"level": "A1", "title": "Modalverben", "rule": "können, müssen …",
                "table": {"headers": ["Person", "können"], "rows": [["ich", "kann"], ["", ""], ["du", "kannst"]]},
                "examples": [{"german": "Ich kann schwimmen.", "english": "I can swim."}, {"german": "", "english": ""}]}
        r = self.post("/teacher/content/grammar/", data)
        self.assertEqual(r.status_code, 201)
        g = r.json()["topic"]
        self.assertEqual(g["table"]["rows"], [["ich", "kann"], ["du", "kannst"]])
        self.assertEqual(len(g["examples"]), 1)
        bad = {**data, "table": {"headers": ["a", "b"], "rows": [["1"]]}}
        self.assertIn("table", self.put(f"/teacher/content/grammar/{g['id']}/", bad).json()["errors"])
        no_table = {**data, "table": {"headers": [], "rows": []}}
        self.put(f"/teacher/content/grammar/{g['id']}/", no_table)
        self.assertEqual(GrammarTopic.objects.get(pk=g["id"]).table, {})
        self.client.force_login(self.student)
        self.assertEqual(self.get(f"/grammar/A1/{g['slug']}/").json()["topic"]["title"], "Modalverben")

    def test_speaking_task(self):
        data = {"level": "A1", "part": "teil1", "title": "Sich vorstellen", "brief": "Introduce yourself.",
                "prompt": "Stellen Sie sich vor.", "minutes": 3, "model_answer": "Ich heiße …",
                "questions": ["Wie heißen Sie?", ""], "phrases": ["Ich heiße …"]}
        r = self.post("/teacher/content/speaking/", data)
        t = r.json()["task"]
        self.assertEqual((t["slug"], t["questions"], t["phrases"]), ("sich-vorstellen-2", ["Wie heißen Sie?"], ["Ich heiße …"]))
        self.assertIn("minutes", self.put(f"/teacher/content/speaking/{t['id']}/", {**data, "minutes": 40}).json()["errors"])
        r = self.put(f"/teacher/content/speaking/{t['id']}/", {**data, "minutes": 5, "phrases": []})
        self.assertEqual((r.json()["task"]["minutes"], r.json()["task"]["phrases"]), (5, []))
        self.delete(f"/teacher/content/speaking/{t['id']}/")
        self.assertFalse(SpeakingTask.objects.filter(pk=t["id"]).exists())


class StudentActivityTests(ContentCase):
    def test_teacher_sees_practice_right_away(self):
        from content.models import Topic
        topic = Topic.objects.get(name="Familie")
        self.client.force_login(self.student)
        for item in topic.items.all()[:2]:
            self.post("/review/", {"item": item.pk, "knew": True})
        self.client.force_login(self.teacher)
        d = self.get(f"/teacher/students/{self.student.pk}/").json()
        self.assertEqual((d["summary"]["words_seen"], d["summary"]["words_learned"]), (2, 0))
        self.assertEqual(d["decks"][0]["name"], "Familie")
        self.assertEqual((d["decks"][0]["practised"], d["decks"][0]["total"]), (2, 6))
        self.assertEqual(d["activity"][0]["title"], "Practised words: Familie")
        row = next(u for u in self.get("/teacher/students/").json()["students"] if u["id"] == self.student.pk)
        self.assertEqual(row["practised"], 2)
        self.assertIsNotNone(row["last_active"])

    def test_levels_are_kept_apart(self):
        from content.models import Topic
        self.client.force_login(self.student)
        for item in Topic.objects.get(name="Familie").items.all()[:3]:  # A1 deck
            self.post("/review/", {"item": item.pk, "knew": True})
        self.client.force_login(self.teacher)
        a1 = self.get(f"/teacher/students/{self.student.pk}/?level=A1").json()
        a2 = self.get(f"/teacher/students/{self.student.pk}/?level=A2").json()
        self.assertEqual((a1["level"]["code"], a1["summary"]["words_seen"], len(a1["decks"]), len(a1["activity"])), ("A1", 3, 1, 1))
        self.assertEqual((a2["level"]["code"], a2["summary"]["words_seen"], a2["decks"], a2["activity"]), ("A2", 0, [], []))
        self.assertEqual(a1["summary"]["words_total"] + a2["summary"]["words_total"], 84)
        row = next(u for u in self.get("/teacher/students/").json()["students"] if u["id"] == self.student.pk)
        self.assertEqual([(w["code"], w["practised"]) for w in row["words_by_level"]], [("A1", 3), ("A2", 0)])
