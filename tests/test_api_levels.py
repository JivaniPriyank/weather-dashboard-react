"""A student only ever gets their own level and the levels below it."""
from django.core.files.uploadedfile import SimpleUploadedFile

from accounts.models import AccessRequest, Classroom
from content.models import GrammarTopic, QuizQuestion, SpeakingTask, Topic, Video

from .test_api_accounts import ApiCase


class A1StudentTests(ApiCase):
    def setUp(self):
        self.client.force_login(self.student)  # Anna, A1
        self.a2_topic = Topic.objects.filter(level=self.a2).first()
        self.a2_task = SpeakingTask.objects.filter(level=self.a2).first()
        self.a2_grammar = GrammarTopic.objects.filter(level=self.a2).first()

    def test_only_a1_is_offered(self):
        d = self.get("/session/").json()
        self.assertEqual([lv["code"] for lv in d["levels"]], ["A1"])
        self.assertEqual((d["current_level"]["code"], d["user"]["level"]["code"]), ("A1", "A1"))

    def test_a2_links_do_not_exist_for_her(self):
        for url in [f"/decks/A2/{self.a2_topic.slug}/", f"/decks/A2/{self.a2_topic.slug}/session/",
                    f"/speaking/A2/{self.a2_task.slug}/", f"/grammar/A2/{self.a2_grammar.slug}/"]:
            self.assertEqual(self.get(url).status_code, 404, url)
        for url, data in [(f"/speaking/A2/{self.a2_task.slug}/practised/", {}),
                          ("/practice/start/", {"level": "A2"}),
                          ("/review/", {"item": self.a2_topic.items.first().pk, "knew": True})]:
            self.assertEqual(self.post(url, data).status_code, 404, url)
        self.assertEqual(self.get(f"/decks/A1/{Topic.objects.filter(level=self.a1).first().slug}/").status_code, 200)

    def test_old_a2_quiz_closed_after_moving_down(self):
        self.student.level = self.a2
        self.student.save()
        aid = self.post("/practice/start/", {"level": "A2"}).json()["attempt"]
        self.student.level = self.a1
        self.student.save()
        self.assertEqual(self.get(f"/attempts/{aid}/").status_code, 404)

    def test_videos_by_level(self):
        a1 = Video.objects.create(title="A1 video", external_url="https://youtu.be/dQw4w9WgXcQ", level=self.a1)
        a2 = Video.objects.create(title="A2 video", external_url="https://youtu.be/dQw4w9WgXcQ", level=self.a2)
        none = Video.objects.create(title="No level", external_url="https://youtu.be/dQw4w9WgXcQ")
        self.assertEqual([v["title"] for v in self.get("/videos/").json()["videos"]], ["A1 video"])
        for v in (a2, none):
            self.assertEqual(self.get(f"/videos/{v.pk}/").status_code, 404)
        self.assertEqual(self.get(f"/videos/{a1.pk}/").status_code, 200)


class OtherStudentsTests(ApiCase):
    def test_a2_student_can_revise_a1(self):
        u = self.make_student("c@test.de", "Cem", AccessRequest.Status.APPROVED, level=self.a2)
        self.client.force_login(u)
        d = self.get("/session/").json()
        self.assertEqual(([lv["code"] for lv in d["levels"]], d["current_level"]["code"]), (["A1", "A2"], "A2"))
        self.assertEqual(self.post("/level/", {"level": "A1"}).status_code, 200)
        self.assertEqual(self.get(f"/speaking/A1/{SpeakingTask.objects.filter(level=self.a1).first().slug}/").status_code, 200)

    def test_student_without_level_keeps_everything(self):
        u = self.make_student("d@test.de", "Dora", AccessRequest.Status.APPROVED)
        self.client.force_login(u)
        self.assertEqual([lv["code"] for lv in self.get("/session/").json()["levels"]], ["A1", "A2"])


class TeacherLevelTests(ApiCase):
    def setUp(self):
        self.client.force_login(self.teacher)
        self.url = f"/teacher/students/{self.student.pk}/"

    def test_move_up_needs_matching_class(self):
        r = self.patch(self.url, {"level": "A2", "classroom": self.classroom.pk})
        self.assertIn("A1 class", r.json()["error"])
        r = self.patch(self.url, {"level": "A2", "classroom": None})
        self.assertEqual(r.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual((self.student.level.code, self.student.current_level.code, self.student.classroom), ("A2", "A2", None))
        self.assertEqual(r.json()["level"]["code"], "A2")
        a2_class = Classroom.objects.create(name="Donnerstag", level=self.a2)
        self.assertEqual(self.patch(self.url, {"level": "A2", "classroom": a2_class.pk}).status_code, 200)

    def test_class_without_level_cannot_take_students(self):
        old = Classroom.objects.create(name="Alt")
        self.assertIn("no level yet", self.patch(self.url, {"classroom": old.pk}).json()["error"])

    def test_video_rules(self):
        new = "/api/teacher/videos/new/"
        r = self.client.post(new, {"title": "x", "source": "link", "external_url": "https://youtu.be/dQw4w9WgXcQ"})
        self.assertIn("level", r.json()["errors"])
        r = self.client.post(new, {"title": "x", "source": "link", "external_url": "https://youtu.be/dQw4w9WgXcQ",
                                   "level": self.a2.pk, "classroom": self.classroom.pk})
        self.assertIn("Choose an A2 class", str(r.json()["errors"]))
        g = GrammarTopic.objects.filter(level=self.a1).first()
        r = self.client.post(new, {"title": "x", "source": "link", "external_url": "https://youtu.be/dQw4w9WgXcQ",
                                   "level": self.a2.pk, "grammar_topic": g.pk})
        self.assertIn("grammar_topic", r.json()["errors"])

    def test_requests_and_classes_show_levels(self):
        waiting = self.get("/teacher/requests/").json()
        self.assertIn("level", waiting["requests"][0]["student"])
        self.assertEqual(waiting["classrooms"][0]["level"], "A1")
        self.assertEqual(QuizQuestion.objects.filter(level=self.a2).exists(), True)
