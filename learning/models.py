"""Each student's own learning history."""
from datetime import timedelta

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.functions import Coalesce
from django.utils import timezone

USER = settings.AUTH_USER_MODEL


class CardReview(models.Model):
    """Spaced-repetition state of one word for one student (Leitner boxes 1–5)."""

    MAX_BOX = 5
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="card_reviews")
    item = models.ForeignKey("content.VocabularyItem", on_delete=models.CASCADE, related_name="reviews")
    box = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(5)])
    due_at = models.DateTimeField(default=timezone.now, db_index=True)
    times_seen = models.PositiveIntegerField(default=0)
    times_correct = models.PositiveIntegerField(default=0)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "item"], name="one_review_per_user_word")]

    def __str__(self):
        return f"{self.user} – {self.item} (box {self.box})"

    def record(self, knew_it, now=None):
        now = now or timezone.now()
        self.times_seen += 1
        if knew_it:
            self.times_correct += 1
            self.box = min(self.box + 1, self.MAX_BOX)
            self.due_at = now + timedelta(days=settings.SRS_INTERVAL_DAYS[self.box])
        else:
            self.box = 1
            self.due_at = now  # comes back in the next session
        self.last_reviewed_at = now
        self.save()

    @property
    def is_learned(self):
        return self.box >= 4


class QuizAttemptQuerySet(models.QuerySet):
    def with_score(self):
        """Count the right answers in the same query, for lists of attempts. A subquery, not
        a GROUP BY: Django drops Meta.ordering (newest first) from grouped queries."""
        right = (QuizAnswer.objects.filter(attempt=models.OuterRef("pk"), is_correct=True)
                 .order_by().values("attempt").annotate(n=models.Count("id")).values("n"))
        return self.annotate(right_answers=Coalesce(models.Subquery(right), 0))


class QuizAttempt(models.Model):
    class Kind(models.TextChoices):
        PRACTICE = "practice", "Practice (mixed or one grammar topic)"
        MISTAKES = "mistakes", "My mistakes"

    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="quiz_attempts")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.PRACTICE)
    level = models.ForeignKey("content.Level", on_delete=models.CASCADE, related_name="+")
    grammar_topic = models.ForeignKey(
        "content.GrammarTopic", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    question_ids = models.JSONField(default=list, help_text="The questions in this attempt, in order.")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    objects = QuizAttemptQuerySet.as_manager()

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user} – {self.title}"

    @property
    def title(self):
        if self.kind == self.Kind.MISTAKES:
            return f"{self.level} mistakes"
        return self.grammar_topic.title if self.grammar_topic else f"{self.level} mixed practice"

    @property
    def total(self):
        return len(self.question_ids)

    @property
    def score(self):
        if hasattr(self, "right_answers"):  # from QuizAttempt.objects.with_score()
            return self.right_answers
        return self.answers.filter(is_correct=True).count()

    @property
    def percent(self):
        return round(self.score / self.total * 100) if self.total else 0

    def next_question_id(self):
        answered = set(self.answers.values_list("question_id", flat=True))
        return next((qid for qid in self.question_ids if qid not in answered), None)


class QuizAnswer(models.Model):
    attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey("content.QuizQuestion", on_delete=models.CASCADE, related_name="+")
    selected_option = models.ForeignKey(
        "content.QuizOption", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    typed_answer = models.CharField(max_length=200, blank=True)
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["answered_at"]
        constraints = [
            models.UniqueConstraint(fields=["attempt", "question"], name="one_answer_per_question_per_attempt")
        ]

    @property
    def given_display(self):
        return self.selected_option.text if self.selected_option else self.typed_answer


class SpeakingPractice(models.Model):
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="speaking_practice")
    task = models.ForeignKey("content.SpeakingTask", on_delete=models.CASCADE, related_name="+")
    practised_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-practised_at"]


class VideoView(models.Model):
    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="video_views")
    video = models.ForeignKey("content.Video", on_delete=models.CASCADE, related_name="views")
    first_opened_at = models.DateTimeField(auto_now_add=True)
    watched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "video"], name="one_view_per_user_video")]


def speaking_upload_path(instance, filename):
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "webm").lower()[:5]
    # Random name: the student's name or email never appears in the file path.
    import uuid

    return f"speaking/{timezone.now():%Y/%m}/{uuid.uuid4().hex}.{ext}"


class SpeakingSubmission(models.Model):
    """One recorded answer per student per speaking task, with the teacher's feedback."""

    CRITERIA = [
        ("score_task", "Task completion"),
        ("score_vocabulary", "Vocabulary"),
        ("score_grammar", "Grammar"),
        ("score_pronunciation", "Pronunciation"),
    ]
    MAX_PER_CRITERION = 5

    user = models.ForeignKey(USER, on_delete=models.CASCADE, related_name="speaking_submissions")
    task = models.ForeignKey("content.SpeakingTask", on_delete=models.CASCADE, related_name="submissions")
    audio = models.FileField(upload_to=speaking_upload_path, blank=True)
    audio_type = models.CharField(max_length=60, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    score_task = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    score_vocabulary = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    score_grammar = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    score_pronunciation = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    reviewed_by = models.ForeignKey(USER, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    audio_deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-submitted_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "task"], name="one_speaking_submission_per_task"),
        ]

    def __str__(self):
        return f"{self.user} – {self.task}"

    @property
    def is_reviewed(self):
        return self.reviewed_at is not None

    @property
    def total_score(self):
        scores = [getattr(self, f) for f, _ in self.CRITERIA]
        return sum(scores) if all(s is not None for s in scores) else None

    @property
    def max_score(self):
        return self.MAX_PER_CRITERION * len(self.CRITERIA)

    @property
    def score_rows(self):
        return [(label, getattr(self, f)) for f, label in self.CRITERIA]

    @property
    def has_audio(self):
        return bool(self.audio) and self.audio_deleted_at is None

    @property
    def audio_delete_on(self):
        if not self.reviewed_at:
            return None
        return self.reviewed_at + timedelta(days=settings.SPEAKING_KEEP_DAYS_AFTER_FEEDBACK)

    def delete_audio(self):
        if self.audio:
            self.audio.delete(save=False)
        self.audio = ""
        self.audio_deleted_at = timezone.now()
        self.save(update_fields=["audio", "audio_deleted_at"])
