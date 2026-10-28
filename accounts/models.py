from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Users sign in with their email address instead of a username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        extra.setdefault("role", User.Role.STUDENT)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.TEACHER)
        return self._create_user(email, password, **extra)


class Classroom(models.Model):
    name = models.CharField(max_length=80, unique=True)
    description = models.CharField(max_length=200, blank=True)
    level = models.ForeignKey(
        "content.Level", null=True, blank=True, on_delete=models.SET_NULL, related_name="classrooms",
        help_text="Only students of this level can be in the class.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        TEACHER = "teacher", "Teacher"

    username = None
    email = models.EmailField("email address", unique=True)
    full_name = models.CharField(max_length=120)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STUDENT)
    classroom = models.ForeignKey(
        Classroom, null=True, blank=True, on_delete=models.SET_NULL, related_name="students"
    )
    # The course the teacher put the student in. They can see this level and the
    # levels below it (to revise), never a higher one. Empty = not set yet: all levels.
    level = models.ForeignKey(
        "content.Level", null=True, blank=True, on_delete=models.SET_NULL, related_name="students",
        verbose_name="course level",
    )
    # The level the student is looking at right now (one of the allowed ones).
    current_level = models.ForeignKey(
        "content.Level", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]
    objects = UserManager()

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name or self.email

    @property
    def is_teacher(self):
        return self.role == self.Role.TEACHER

    @property
    def first_name_display(self):
        return (self.full_name or self.email).split()[0]

    @property
    def access_status(self):
        """'approved', 'pending', 'rejected' — teachers are always approved."""
        if self.is_teacher:
            return AccessRequest.Status.APPROVED
        request = getattr(self, "access_request", None)
        return request.status if request else AccessRequest.Status.PENDING

    @property
    def is_approved(self):
        return self.access_status == AccessRequest.Status.APPROVED

    def allowed_levels(self):
        """Levels this person may open: the teacher all, a student their course level and below."""
        from content.models import Level

        levels = Level.objects.filter(is_active=True)
        if not self.is_teacher and self.level_id:
            levels = levels.filter(order__lte=self.level.order)
        return levels

    def can_see_level(self, level):
        if level is None:
            return False
        if self.is_teacher:
            return True
        if not level.is_active:
            return False
        return not self.level_id or level.order <= self.level.order


class AccessRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Waiting for approval"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Not approved"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="access_request")
    note = models.CharField("message to the teacher", max_length=300, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} ({self.get_status_display()})"

    def decide(self, status, teacher, classroom=None, level=None):
        self.status = status
        self.reviewed_at = timezone.now()
        self.reviewed_by = teacher
        self.save(update_fields=["status", "reviewed_at", "reviewed_by"])
        fields = []
        if level is not None and self.user.level_id != level.pk:
            self.user.level = self.user.current_level = level
            fields += ["level", "current_level"]
        if classroom is not None:
            self.user.classroom = classroom
            fields.append("classroom")
        if fields:
            self.user.save(update_fields=fields)
