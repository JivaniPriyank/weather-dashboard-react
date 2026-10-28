import importlib
import os
from unittest import mock

from django.contrib.contenttypes.models import ContentType
from django.core import mail
from django.test import override_settings

from content.models import GrammarTopic, QuizQuestion, SpeakingTask, Topic, Video
from learning.models import QuizAttempt, SpeakingPractice

from .test_api_accounts import ApiCase


class SignInLimitTests(ApiCase):
    def wrong(self, email="anna@test.de", **kw):
        return self.post("/sign-in/", {"email": email, "password": "falsch"}, **kw)

    def test_five_wrong_passwords_lock_the_email_for_a_while(self):
        for _ in range(5):
            self.assertEqual(self.wrong().status_code, 400)
        r = self.wrong()
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json()["code"], "throttled")
        # Even the right password waits: otherwise guessing could simply carry on.
        r = self.post("/sign-in/", {"email": "anna@test.de", "password": "pw-Schueler-123"})
        self.assertEqual(r.status_code, 429)
        # Another account is not affected.
        r = self.post("/sign-in/", {"email": "teacher@test.de", "password": "pw-Lehrer-123"})
        self.assertEqual(r.status_code, 200)

    def test_email_is_counted_case_insensitively(self):
        for i in range(5):
            self.wrong("ANNA@test.de" if i % 2 else "anna@test.de")
        self.assertEqual(self.wrong().status_code, 429)

    def test_success_clears_the_failures(self):
        for _ in range(4):
            self.wrong()
        self.assertEqual(self.post("/sign-in/", {"email": "anna@test.de", "password": "pw-Schueler-123"}).status_code, 200)
        self.client.logout()
        for _ in range(4):
            self.assertEqual(self.wrong().status_code, 400)

    def test_one_address_trying_many_accounts_is_limited(self):
        for i in range(20):
            self.wrong(f"person{i}@test.de")
        self.assertEqual(self.wrong("someone-else@test.de").status_code, 429)
        # A different connection can still sign in.
        r = self.post("/sign-in/", {"email": "anna@test.de", "password": "pw-Schueler-123"}, REMOTE_ADDR="10.0.0.9")
        self.assertEqual(r.status_code, 200)


class RegisterAndResetLimitTests(ApiCase):
    def test_register_is_limited_per_connection(self):
        for i in range(10):
            r = self.post("/register/", {"full_name": "X", "email": f"x{i}@x.de", "password1": "a", "password2": "b"})
            self.assertEqual(r.status_code, 400)
        r = self.post("/register/", {"full_name": "Y", "email": "y@x.de", "password1": "gutenmorgen77",
                                     "password2": "gutenmorgen77", "level": "A1"})
        self.assertEqual(r.status_code, 429)

    def test_reset_emails_to_one_address_are_capped_without_revealing_it(self):
        for _ in range(5):
            self.assertEqual(self.post("/password/reset/", {"email": "anna@test.de"}).status_code, 200)
        self.assertEqual(len(mail.outbox), 3)

    def test_reset_requests_are_limited_per_connection(self):
        for i in range(10):
            self.post("/password/reset/", {"email": f"n{i}@test.de"})
        self.assertEqual(self.post("/password/reset/", {"email": "anna@test.de"}).status_code, 429)


class DeletedQuestionTests(ApiCase):
    def test_quiz_carries_on_when_a_question_is_deleted_in_the_admin(self):
        self.client.force_login(self.student)
        att = self.post("/practice/start/", {"level": "A1"}).json()["attempt"]
        first = self.get(f"/attempts/{att}/").json()["question"]["id"]
        QuizQuestion.objects.get(pk=first).delete()  # not through the content editor
        r = self.get(f"/attempts/{att}/")
        self.assertEqual(r.status_code, 200)
        self.assertNotEqual(r.json()["question"]["id"], first)
        self.assertNotIn(first, QuizAttempt.objects.get(pk=att).question_ids)

    def test_quiz_is_removed_when_its_only_question_is_deleted(self):
        self.client.force_login(self.student)
        q = QuizQuestion.objects.filter(level=self.a1).first()
        att = QuizAttempt.objects.create(user=self.student, level=self.a1, question_ids=[q.pk])
        q.delete()
        self.assertFalse(QuizAttempt.objects.filter(pk=att.pk).exists())


class AdminViewOnSiteTests(ApiCase):
    def test_view_on_site_opens_the_page_in_the_app(self):
        self.client.force_login(self.teacher)
        topic = Topic.objects.select_related("level").first()
        grammar = GrammarTopic.objects.select_related("level").first()
        task = SpeakingTask.objects.select_related("level").first()
        video = Video.objects.create(title="Test", level=self.a1, external_url="https://youtu.be/dQw4w9WgXcQ")
        for obj, url in ((topic, f"/words/A1/{topic.slug}"), (grammar, f"/grammar/{grammar.level.code}/{grammar.slug}"),
                         (task, f"/speaking/{task.level.code}/{task.slug}"), (video, f"/videos/{video.pk}")):
            ct = ContentType.objects.get_for_model(obj)
            r = self.client.get(f"/admin/r/{ct.pk}/{obj.pk}/")
            self.assertEqual(r.status_code, 302)
            self.assertTrue(r["Location"].endswith(url), r["Location"])


class SpeakingPractisedTests(ApiCase):
    def test_pressing_twice_counts_once(self):
        self.client.force_login(self.student)
        task = SpeakingTask.objects.filter(level=self.a1).first()
        for _ in range(5):
            r = self.post(f"/speaking/A1/{task.slug}/practised/")
        self.assertEqual(r.json()["practised"], 1)
        self.assertEqual(SpeakingPractice.objects.filter(user=self.student, task=task).count(), 1)


class SecurityHeaderTests(ApiCase):
    @override_settings(CONTENT_SECURITY_POLICY="default-src 'self'")
    def test_headers_are_added(self):
        from config.security import SecurityHeadersMiddleware

        response = SecurityHeadersMiddleware(lambda request: self.client.get("/api/session/"))(None)
        self.assertEqual(response["Content-Security-Policy"], "default-src 'self'")
        self.assertIn("microphone=(self)", response["Permissions-Policy"])

    def test_production_policy_allows_what_the_app_needs(self):
        with mock.patch.dict(os.environ, {"DJANGO_SECRET_KEY": "test-only"}):
            prod = importlib.import_module("config.settings.prod")
        csp = prod.CONTENT_SECURITY_POLICY
        self.assertIn("frame-src https://www.youtube-nocookie.com https://player.vimeo.com", csp)
        self.assertIn("media-src 'self' blob:", csp)
        self.assertIn("script-src 'self'", csp)
        self.assertNotIn("googleapis", csp)
