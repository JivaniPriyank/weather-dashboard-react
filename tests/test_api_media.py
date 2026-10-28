import io
from datetime import timedelta
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone

from accounts.models import Classroom
from content.models import GrammarTopic, Level, QuizQuestion, SpeakingTask, Video, VocabularyItem
from content.video_links import embed_url
from learning.models import SpeakingSubmission, VideoView
from learning.services import purge_old_recordings

from .test_api_accounts import ApiCase

FAKE_MP4 = b"\x00\x00\x00\x18ftypmp42" + bytes(range(256)) * 8
AUDIO = b"OggS" + bytes(range(256)) * 20


class VideoTests(ApiCase):
    def upload(self, **extra):
        self.client.force_login(self.teacher)
        data = {"title": "Der, die, das", "source": "file", "is_published": "on", "level": self.a1.pk,
                "file": SimpleUploadedFile("lesson.mp4", FAKE_MP4, content_type="video/mp4"), **extra}
        return self.client.post("/api/teacher/videos/new/", data)

    def test_upload_stream_and_seek(self):
        self.assertEqual(self.upload().status_code, 201)
        v = Video.objects.get()
        self.client.force_login(self.student)
        detail = self.get(f"/videos/{v.pk}/").json()["video"]
        self.assertEqual(detail["stream_url"], f"/api/videos/{v.pk}/stream/")
        full = self.client.get(detail["stream_url"])
        self.assertEqual(b"".join(full.streaming_content), FAKE_MP4)
        part = self.client.get(detail["stream_url"], HTTP_RANGE="bytes=10-19")
        self.assertEqual((part.status_code, b"".join(part.streaming_content)), (206, FAKE_MP4[10:20]))
        self.client.logout()
        self.assertEqual(self.client.get(detail["stream_url"]).status_code, 401)

    def test_class_only_and_hidden(self):
        other = Classroom.objects.create(name="Donnerstag", level=self.a1)
        self.upload(classroom=other.pk)
        self.upload(title="Hidden", is_published="")
        self.client.force_login(self.student)
        self.assertEqual(self.get("/videos/").json()["videos"], [])
        for v in Video.objects.all():
            self.assertEqual(self.get(f"/videos/{v.pk}/").status_code, 404)

    def test_link_validation_and_switch(self):
        self.client.force_login(self.teacher)
        r = self.client.post("/api/teacher/videos/new/", {"title": "L", "source": "link", "external_url": "https://example.com/x", "level": self.a1.pk})
        self.assertIn("YouTube or Vimeo", str(r.json()["errors"]))
        r = self.client.post("/api/teacher/videos/new/", {"title": "U", "source": "file", "level": self.a1.pk})
        self.assertIn("Choose a video file", str(r.json()["errors"]))
        self.upload()
        v = Video.objects.get()
        path = Path(v.file.path)
        r = self.client.post(f"/api/teacher/videos/{v.pk}/", {"title": "Now a link", "source": "link",
                                                              "external_url": "https://youtu.be/dQw4w9WgXcQ", "is_published": "on",
                                                              "level": self.a1.pk})
        self.assertEqual(r.status_code, 200)
        v.refresh_from_db()
        self.assertEqual((bool(v.file), path.exists()), (False, False))
        self.assertEqual(v.embed_url, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")

    def test_watched_and_delete(self):
        self.upload()
        v = Video.objects.get()
        path = Path(v.file.path)
        self.client.force_login(self.student)
        self.get(f"/videos/{v.pk}/")
        self.post(f"/videos/{v.pk}/watched/")
        self.post(f"/videos/{v.pk}/watched/")
        self.assertEqual(VideoView.objects.filter(user=self.student, watched_at__isnull=False).count(), 1)
        self.client.force_login(self.teacher)
        self.assertEqual(self.get("/teacher/videos/").json()["videos"][0]["watched_by"], 1)
        self.client.delete(f"/api/teacher/videos/{v.pk}/")
        self.assertFalse(path.exists())

    def test_embed_links(self):
        self.assertEqual(embed_url("https://vimeo.com/76979871"), "https://player.vimeo.com/video/76979871")
        self.assertEqual(embed_url("https://evil.example/watch?v=dQw4w9WgXcQ"), "")


class SpeakingTests(ApiCase):
    def setUp(self):
        super().setUp()
        self.task = SpeakingTask.objects.get(title="Sich vorstellen")
        self.url = f"/api/speaking/A1/{self.task.slug}/send/"
        self.client.force_login(self.student)

    def send(self, name="answer.webm", data=AUDIO):
        return self.client.post(self.url, {"audio": SimpleUploadedFile(name, data, content_type="audio/webm")})

    def scores(self, **extra):
        return {"score_task": 5, "score_vocabulary": 4, "score_grammar": 3, "score_pronunciation": 4,
                "feedback": "Sehr gut!", **extra}

    def test_send_once_and_privacy(self):
        r = self.send()
        self.assertEqual(r.status_code, 201)
        audio_url = r.json()["submission"]["audio_url"]
        self.assertIn("already sent", self.send().json()["error"])
        self.assertEqual(self.client.get(audio_url).status_code, 200)
        self.client.force_login(self.make_student("o@test.de", "Other", "approved"))
        self.assertEqual(self.client.get(audio_url).status_code, 404)
        self.client.force_login(self.teacher)
        self.assertEqual(self.client.get(audio_url).status_code, 200)
        self.assertEqual(self.get("/session/").json()["counts"]["speaking_waiting"], 1)

    def test_bad_files(self):
        for name, data, reason in [("virus.exe", AUDIO, "isn't an audio"), ("empty.mp3", b"", "empty")]:
            self.assertIn(reason, self.send(name, data).json()["error"])
        self.assertIn("Record your answer", self.client.post(self.url, {}).json()["error"])

    @override_settings(SPEAKING_MAX_UPLOAD_MB=0)
    def test_too_big(self):
        self.assertIn("too big", self.send().json()["error"])

    def test_review_flow_and_feedback_hidden_until_reviewed(self):
        self.send()
        sub = SpeakingSubmission.objects.get()
        self.client.force_login(self.teacher)
        r = self.post(f"/teacher/speaking/{sub.pk}/", self.scores(score_grammar="", feedback=""))
        self.assertEqual(set(r.json()["errors"]), {"score_grammar", "feedback"})
        r = self.post(f"/teacher/speaking/{sub.pk}/", self.scores())
        self.assertEqual(r.json()["answer"]["total_score"], 16)
        self.client.force_login(self.student)
        d = self.get(f"/speaking/A1/{self.task.slug}/").json()["submission"]
        self.assertEqual((d["reviewed"], d["total_score"], d["feedback"]), (True, 16, "Sehr gut!"))
        listed = next(t for t in self.get("/speaking/").json()["tasks"] if t["slug"] == self.task.slug)
        self.assertEqual(listed["submission"]["total_score"], 16)

    def test_send_and_next(self):
        self.send()
        other = SpeakingTask.objects.filter(level__code="A1").exclude(pk=self.task.pk).first()
        self.client.post(f"/api/speaking/A1/{other.slug}/send/", {"audio": SimpleUploadedFile("a.webm", AUDIO)})
        first, second = SpeakingSubmission.objects.order_by("submitted_at")
        self.client.force_login(self.teacher)
        self.assertEqual(self.post(f"/teacher/speaking/{first.pk}/", self.scores()).json()["next_id"], second.pk)

    def test_deleted_three_days_after_feedback(self):
        self.send()
        sub = SpeakingSubmission.objects.get()
        path = Path(sub.audio.path)
        self.client.force_login(self.teacher)
        self.post(f"/teacher/speaking/{sub.pk}/", self.scores())
        sub.refresh_from_db()
        self.assertEqual(purge_old_recordings(now=sub.reviewed_at + timedelta(days=2, hours=23)), 0)
        self.assertEqual(purge_old_recordings(now=sub.reviewed_at + timedelta(days=3, minutes=1)), 1)
        self.assertFalse(path.exists())
        sub.refresh_from_db()
        self.assertEqual(sub.total_score, 16)
        self.assertEqual(purge_old_recordings(now=timezone.now() + timedelta(days=60)), 0)

    def test_teacher_cannot_send(self):
        self.client.force_login(self.teacher)
        self.assertEqual(self.send().status_code, 403)


class ContentTests(ApiCase):
    def test_seed_is_complete_and_idempotent(self):
        call_command("seed_content", stdout=io.StringIO())
        self.assertEqual(VocabularyItem.objects.count(), 84)
        self.assertEqual(QuizQuestion.objects.count(), 30)
        for q in QuizQuestion.objects.filter(kind="choice"):
            self.assertEqual(q.options.filter(is_correct=True).count(), 1, q.prompt)

    def test_grammar_topic_without_table_in_admin(self):
        self.client.force_login(self.teacher)
        r = self.client.post("/admin/content/grammartopic/add/", {
            "order": "1", "level": Level.objects.get(code="A1").pk, "title": "Modalverben", "rule": "können …", "table": "",
            "examples-TOTAL_FORMS": "0", "examples-INITIAL_FORMS": "0", "examples-MIN_NUM_FORMS": "0", "examples-MAX_NUM_FORMS": "1000",
        })
        self.assertEqual(r.status_code, 302)
        self.assertEqual(GrammarTopic.objects.get(title="Modalverben").table, {})
