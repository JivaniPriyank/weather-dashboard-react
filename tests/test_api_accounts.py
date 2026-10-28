from django.test import Client

from accounts.models import AccessRequest, Classroom, User

from .helpers import BaseTestCase


class ApiCase(BaseTestCase):
    def post(self, url, data=None, **kw):
        return self.client.post(f"/api{url}", data or {}, content_type="application/json", **kw)

    def patch(self, url, data):
        return self.client.patch(f"/api{url}", data, content_type="application/json")

    def get(self, url):
        return self.client.get(f"/api{url}")


class SessionAndSignInTests(ApiCase):
    def test_session_for_guest_sets_csrf_cookie(self):
        r = self.get("/session/")
        self.assertEqual(r.json()["user"], None)
        self.assertEqual([lv["code"] for lv in r.json()["levels"]], ["A1", "A2"])
        self.assertIn("csrftoken", r.cookies)

    def test_sign_in_case_insensitive_and_wrong_password(self):
        r = self.post("/sign-in/", {"email": "ANNA@test.de", "password": "pw-Schueler-123"})
        self.assertEqual(r.json()["user"]["email"], "anna@test.de")
        self.assertEqual(r.json()["user"]["status"], "approved")
        self.client.logout()
        r = self.post("/sign-in/", {"email": "anna@test.de", "password": "nope"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("don't match", r.json()["error"])

    def test_switched_off_account_gets_clear_message(self):
        self.student.is_active = False
        self.student.save()
        r = self.post("/sign-in/", {"email": "anna@test.de", "password": "pw-Schueler-123"})
        self.assertIn("switched off", r.json()["error"])

    def test_csrf_is_enforced(self):
        c = Client(enforce_csrf_checks=True)
        r = c.post("/api/sign-in/", {"email": "anna@test.de", "password": "pw-Schueler-123"}, content_type="application/json")
        self.assertEqual(r.status_code, 403)
        token = c.get("/api/session/").cookies["csrftoken"].value
        r = c.post("/api/sign-in/", {"email": "anna@test.de", "password": "pw-Schueler-123"},
                   content_type="application/json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(r.status_code, 200)

    def test_sign_out(self):
        self.client.force_login(self.student)
        self.assertEqual(self.post("/sign-out/").json()["user"], None)
        self.assertEqual(self.get("/today/").status_code, 401)


class RegisterTests(ApiCase):
    def test_register_creates_pending_request_and_signs_in(self):
        r = self.post("/register/", {"full_name": "Maria Santos", "email": "Maria@Example.com",
                                     "password1": "gutenmorgen77", "password2": "gutenmorgen77", "note": "Dienstag",
                                     "level": "A2"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.json()["user"]["status"], r.json()["user"]["level"]["code"]), ("pending", "A2"))
        user = User.objects.get(email="maria@example.com")
        self.assertEqual((user.level.code, user.current_level.code), ("A2", "A2"))
        self.assertEqual(user.access_request.note, "Dienstag")
        self.assertTrue(user.check_password("gutenmorgen77"))

    def test_register_errors_by_field(self):
        r = self.post("/register/", {"full_name": "X", "email": "x@x.de", "password1": "gutenmorgen77", "password2": "other"})
        self.assertIn("password2", r.json()["errors"])
        r = self.post("/register/", {"full_name": "X", "email": "x@x.de", "password1": "12345678", "password2": "12345678"})
        self.assertIn("password1", r.json()["errors"])
        self.assertIn("Choose your level.", r.json()["errors"]["level"])
        r = self.post("/register/", {"full_name": "A", "email": "ANNA@test.de", "password1": "gutenmorgen77", "password2": "gutenmorgen77"})
        self.assertIn("already an account", r.json()["errors"]["email"][0])
        self.assertFalse(User.objects.filter(email="x@x.de").exists())


class AccessTests(ApiCase):
    STUDENT_URLS = ["/today/", "/decks/", "/practice/", "/speaking/", "/grammar/", "/videos/", "/progress/"]
    TEACHER_URLS = ["/teacher/overview/", "/teacher/requests/", "/teacher/students/", "/teacher/classes/",
                    "/teacher/videos/", "/teacher/videos/options/", "/teacher/speaking/"]

    def test_guest_gets_401(self):
        for url in self.STUDENT_URLS + self.TEACHER_URLS:
            r = self.get(url)
            self.assertEqual(r.status_code, 401, url)
            self.assertEqual(r.json()["code"], "not_signed_in")

    def test_waiting_student_gets_403(self):
        self.client.force_login(self.waiting)
        for url in self.STUDENT_URLS:
            r = self.get(url)
            self.assertEqual((r.status_code, r.json()["code"]), (403, "not_approved"), url)

    def test_student_cannot_use_teacher_api(self):
        self.client.force_login(self.student)
        for url in self.TEACHER_URLS:
            self.assertEqual(self.get(url).status_code, 403, url)
        r = self.post(f"/teacher/requests/{self.waiting.access_request.pk}/decide/", {"decision": "approved"})
        self.assertEqual(r.status_code, 403)

    def test_every_page_loads_for_student_and_teacher(self):
        self.client.force_login(self.student)
        for url in self.STUDENT_URLS:
            self.assertEqual(self.get(url).status_code, 200, url)
        self.client.force_login(self.teacher)
        for url in self.TEACHER_URLS + ["/decks/", f"/teacher/students/{self.student.pk}/", f"/teacher/classes/{self.classroom.pk}/"]:
            self.assertEqual(self.get(url).status_code, 200, url)

    def test_teacher_approves_into_class_and_counts_update(self):
        self.client.force_login(self.teacher)
        self.assertEqual(self.get("/session/").json()["counts"]["pending_requests"], 1)
        url = f"/teacher/requests/{self.waiting.access_request.pk}/decide/"
        self.assertIn("level", self.post(url, {"decision": "approved"}).json()["errors"])  # Ben chose no level
        self.assertIn("A1 class", self.post(url, {"decision": "approved", "level": "A2", "classroom": self.classroom.pk}).json()["error"])
        r = self.post(url, {"decision": "approved", "level": "A1", "classroom": self.classroom.pk})
        self.assertEqual(r.json()["message"], "Ben Wartend is approved.")
        self.waiting.refresh_from_db()
        self.assertEqual((self.waiting.access_status, self.waiting.classroom), ("approved", self.classroom))
        self.assertEqual(self.get("/session/").json()["counts"]["pending_requests"], 0)
        self.client.force_login(self.waiting)
        self.assertEqual(self.get("/decks/").status_code, 200)

    def test_remove_access(self):
        self.client.force_login(self.teacher)
        self.post(f"/teacher/requests/{self.student.access_request.pk}/decide/", {"decision": "rejected"})
        self.client.force_login(self.student)
        self.assertEqual(self.get("/decks/").status_code, 403)


class AccountTests(ApiCase):
    def test_change_name_and_password(self):
        self.client.force_login(self.student)
        self.assertEqual(self.patch("/me/", {"full_name": "Anna Neu"}).json()["user"]["full_name"], "Anna Neu")
        r = self.post("/password/change/", {"old_password": "wrong", "new_password1": "neuesPasswort9", "new_password2": "neuesPasswort9"})
        self.assertIn("old_password", r.json()["errors"])
        r = self.post("/password/change/", {"old_password": "pw-Schueler-123", "new_password1": "neuesPasswort9", "new_password2": "neuesPasswort9"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.get("/today/").status_code, 200)  # still signed in

    def test_password_reset_flow(self):
        from django.core import mail
        self.post("/password/reset/", {"email": "anna@test.de"})
        self.assertEqual(len(mail.outbox), 1)
        link = [line for line in mail.outbox[0].body.splitlines() if "/password-reset/" in line][0]
        uid, token = link.rstrip("/").split("/")[-2:]
        self.assertTrue(self.get(f"/password/reset/{uid}/{token}/").json()["valid"])
        r = self.post(f"/password/reset/{uid}/{token}/", {"new_password1": "frischesPW77", "new_password2": "frischesPW77"})
        self.assertEqual(r.status_code, 200)
        self.assertFalse(self.get(f"/password/reset/{uid}/{token}/").json()["valid"])  # one use only
        self.assertEqual(self.post("/sign-in/", {"email": "anna@test.de", "password": "frischesPW77"}).status_code, 200)

    def test_unknown_email_reset_gives_same_answer(self):
        self.assertEqual(self.post("/password/reset/", {"email": "nobody@test.de"}).status_code, 200)

    def test_level_switch(self):
        # Anna is an A1 student: A2 isn't open for her
        self.client.force_login(self.student)
        self.assertEqual(self.post("/level/", {"level": "A2"}).status_code, 403)
        self.assertEqual(self.post("/level/", {"level": "Z9"}).status_code, 404)
        # an A2 student may go back to A1 to revise
        self.student.level = self.a2
        self.student.save()
        self.assertEqual(self.post("/level/", {"level": "A1"}).json()["current_level"]["code"], "A1")
        self.assertEqual(self.get("/decks/").json()["level"]["code"], "A1")


class ClassTests(ApiCase):
    def test_create_edit_delete_keeps_students(self):
        self.client.force_login(self.teacher)
        self.assertIn("level", self.post("/teacher/classes/", {"name": "Donnerstag A2"}).json()["errors"])
        self.assertEqual(self.post("/teacher/classes/", {"name": "Donnerstag A2", "level": "A2"}).status_code, 201)
        self.assertIn("name", self.post("/teacher/classes/", {"name": "Donnerstag A2", "level": "A2"}).json()["errors"])
        r = self.patch(f"/teacher/classes/{self.classroom.pk}/", {"name": "Dienstag", "level": "A2", "description": ""})
        self.assertIn("Move them to another class first", str(r.json()["errors"]))  # Anna (A1) is in it
        self.patch(f"/teacher/classes/{self.classroom.pk}/", {"name": "Dienstag A1 neu", "level": "A1", "description": ""})
        self.assertEqual(Classroom.objects.get(pk=self.classroom.pk).name, "Dienstag A1 neu")
        self.client.delete(f"/api/teacher/classes/{self.classroom.pk}/")
        self.student.refresh_from_db()
        self.assertIsNone(self.student.classroom)

    def test_edit_student(self):
        self.client.force_login(self.teacher)
        r = self.patch(f"/teacher/students/{self.student.pk}/", {"full_name": "Anna M.", "classroom": None, "is_active": False})
        self.assertEqual(r.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual((self.student.full_name, self.student.classroom, self.student.is_active), ("Anna M.", None, False))

    def test_student_search(self):
        self.client.force_login(self.teacher)
        self.assertEqual(len(self.get("/teacher/students/?q=anna").json()["students"]), 1)
        self.assertEqual(len(self.get("/teacher/students/?q=zzz").json()["students"]), 0)
        self.assertEqual(len(self.get("/teacher/students/?class=none").json()["students"]), 0)


class SpaTests(ApiCase):
    def test_pages_serve_the_react_app_and_unknown_api_is_json(self):
        for url in ["/", "/today/", "/teacher/speaking/3/", "/words/A1/familie/study"]:
            r = self.client.get(url)
            self.assertIn(r.status_code, (200, 503), url)  # 503 only if the frontend isn't built
        r = self.client.get("/api/nothing-here/")
        self.assertEqual((r.status_code, r.json()["error"]), (404, "Not found."))
        self.assertEqual(self.client.get("/manifest.webmanifest").status_code, 200)
