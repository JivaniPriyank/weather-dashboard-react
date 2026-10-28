import io

from django.core.management import call_command
from django.test import TestCase

from accounts.models import AccessRequest, Classroom, User
from content.models import Level


class BaseTestCase(TestCase):
    """Starter content plus a teacher, an approved student and a waiting student."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_content", stdout=io.StringIO())
        cls.teacher = User.objects.create_superuser(email="teacher@test.de", password="pw-Lehrer-123", full_name="Frau Lehrerin")
        cls.a1, cls.a2 = Level.objects.get(code="A1"), Level.objects.get(code="A2")
        cls.classroom = Classroom.objects.create(name="Dienstag A1", level=cls.a1)
        cls.student = cls.make_student("anna@test.de", "Anna Muster", AccessRequest.Status.APPROVED, cls.classroom, level=cls.a1)
        cls.waiting = cls.make_student("ben@test.de", "Ben Wartend", AccessRequest.Status.PENDING)

    @classmethod
    def make_student(cls, email, name, status, classroom=None, level=None):
        user = User.objects.create_user(email=email, password="pw-Schueler-123", full_name=name, classroom=classroom,
                                        level=level, current_level=level)
        AccessRequest.objects.create(user=user, status=status)
        return user
