"""Learning content that the teacher manages: levels, word decks, quiz questions,
speaking tasks, grammar topics and videos."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils.text import slugify


class Level(models.Model):
    code = models.CharField(max_length=4, unique=True, help_text="e.g. A1, A2, B1")
    name = models.CharField(max_length=60, help_text="e.g. Beginner")
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True, help_text="Hide a level until its content is ready.")

    class Meta:
        ordering = ["order", "code"]

    def __str__(self):
        return self.code


class OrderedSlugModel(models.Model):
    order = models.PositiveSmallIntegerField(default=0)
    slug = models.SlugField(max_length=90, blank=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.slug_source())[:90] or "item"
        super().save(*args, **kwargs)


class Topic(OrderedSlugModel):
    """A vocabulary deck, e.g. 'Familie' at A1."""

    level = models.ForeignKey(Level, on_delete=models.PROTECT, related_name="topics")
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["level__order", "order", "name"]
        constraints = [models.UniqueConstraint(fields=["level", "slug"], name="unique_topic_slug_per_level")]

    def __str__(self):
        return f"{self.name} ({self.level})"

    def slug_source(self):
        return self.name

    def get_absolute_url(self):
        return f"/words/{self.level.code}/{self.slug}"


class VocabularyItem(models.Model):
    class Article(models.TextChoices):
        NONE = "", "—"
        DER = "der", "der"
        DIE = "die", "die"
        DAS = "das", "das"

    topic = models.ForeignKey(Topic, on_delete=models.CASCADE, related_name="items")
    article = models.CharField(max_length=3, choices=Article.choices, blank=True)
    german = models.CharField(max_length=120, help_text="The word without its article, e.g. 'Mutter'.")
    english = models.CharField(max_length=160)
    example = models.CharField(max_length=240, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["topic", "order", "german"]
        constraints = [
            models.UniqueConstraint(fields=["topic", "article", "german"], name="unique_word_per_topic")
        ]

    def __str__(self):
        return self.display

    @property
    def display(self):
        return f"{self.article} {self.german}".strip()


class GrammarTopic(OrderedSlugModel):
    level = models.ForeignKey(Level, on_delete=models.PROTECT, related_name="grammar_topics")
    title = models.CharField(max_length=120)
    rule = models.TextField(help_text="The explanation, in plain language.")
    table = models.JSONField(
        default=dict, blank=True,
        help_text='Optional table: {"headers": ["Person", "Ending"], "rows": [["ich", "-e"], ...]}',
    )

    class Meta:
        ordering = ["level__order", "order", "title"]
        constraints = [models.UniqueConstraint(fields=["level", "slug"], name="unique_grammar_slug_per_level")]

    def __str__(self):
        return f"{self.title} ({self.level})"

    def slug_source(self):
        return self.title

    def save(self, *args, **kwargs):
        # The admin sends an empty Table box as None; store "no table" as {}.
        if not self.table:
            self.table = {}
        super().save(*args, **kwargs)

    def clean(self):
        if not self.table:
            self.table = {}
            return
        headers, rows = self.table.get("headers"), self.table.get("rows")
        if not isinstance(headers, list) or not isinstance(rows, list):
            raise ValidationError({"table": 'Use {"headers": [...], "rows": [[...], ...]}.'})
        if any(not isinstance(r, list) or len(r) != len(headers) for r in rows):
            raise ValidationError({"table": "Every row needs exactly one cell per header."})

    def get_absolute_url(self):
        return f"/grammar/{self.level.code}/{self.slug}"


class GrammarExample(models.Model):
    topic = models.ForeignKey(GrammarTopic, on_delete=models.CASCADE, related_name="examples")
    german = models.CharField(max_length=240)
    english = models.CharField(max_length=240)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.german


class QuizQuestion(models.Model):
    class Kind(models.TextChoices):
        CHOICE = "choice", "Multiple choice"
        TYPED = "typed", "Type the answer"

    level = models.ForeignKey(Level, on_delete=models.PROTECT, related_name="questions")
    grammar_topic = models.ForeignKey(
        GrammarTopic, null=True, blank=True, on_delete=models.SET_NULL, related_name="questions",
        help_text="Leave empty for general vocabulary questions.",
    )
    kind = models.CharField(max_length=6, choices=Kind.choices, default=Kind.CHOICE)
    prompt = models.CharField(max_length=300)
    accepted_answers = models.CharField(
        max_length=300, blank=True,
        help_text="Typed questions only. Separate alternative correct answers with |",
    )
    explanation = models.CharField(max_length=300, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["level__order", "order", "id"]

    def __str__(self):
        return self.prompt

    def answers_list(self):
        return [a.strip() for a in self.accepted_answers.split("|") if a.strip()]

    @property
    def correct_answer_display(self):
        if self.kind == self.Kind.TYPED:
            answers = self.answers_list()
            return answers[0] if answers else ""
        option = self.options.filter(is_correct=True).first()
        return option.text if option else ""

    def clean(self):
        if self.kind == self.Kind.TYPED and not self.answers_list():
            raise ValidationError({"accepted_answers": "Typed questions need at least one accepted answer."})


class QuizOption(models.Model):
    question = models.ForeignKey(QuizQuestion, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=200)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text


class SpeakingTask(OrderedSlugModel):
    class Part(models.TextChoices):
        TEIL_1 = "teil1", "Teil 1"
        TEIL_2 = "teil2", "Teil 2"
        TEIL_3 = "teil3", "Teil 3"
        ROLE_PLAY = "rolle", "Rollenspiel"
        DISCUSSION = "diskussion", "Diskussion"

    level = models.ForeignKey(Level, on_delete=models.PROTECT, related_name="speaking_tasks")
    part = models.CharField(max_length=10, choices=Part.choices)
    title = models.CharField(max_length=120)
    brief = models.CharField(max_length=240, help_text="What the student has to do, in English.")
    prompt = models.TextField(help_text="The exam-style task, in German.")
    minutes = models.PositiveSmallIntegerField(default=4, help_text="Suggested speaking time.")
    model_answer = models.TextField()

    class Meta:
        ordering = ["level__order", "order", "title"]
        constraints = [models.UniqueConstraint(fields=["level", "slug"], name="unique_speaking_slug_per_level")]

    def __str__(self):
        return f"{self.title} ({self.level})"

    def slug_source(self):
        return self.title

    def get_absolute_url(self):
        return f"/speaking/{self.level.code}/{self.slug}"


class SpeakingLine(models.Model):
    class Kind(models.TextChoices):
        QUESTION = "question", "Question to answer"
        PHRASE = "phrase", "Useful phrase"

    task = models.ForeignKey(SpeakingTask, on_delete=models.CASCADE, related_name="lines")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    text = models.CharField(max_length=200)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["kind", "order", "id"]

    def __str__(self):
        return self.text


ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "m4v", "mov"]


def validate_video_size(file):
    limit = settings.VIDEO_MAX_UPLOAD_MB * 1024 * 1024
    if file.size > limit:
        raise ValidationError(f"Videos can be at most {settings.VIDEO_MAX_UPLOAD_MB} MB.")


class Video(models.Model):
    title = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    level = models.ForeignKey(Level, null=True, blank=True, on_delete=models.SET_NULL, related_name="videos")
    grammar_topic = models.ForeignKey(
        GrammarTopic, null=True, blank=True, on_delete=models.SET_NULL, related_name="videos"
    )
    classroom = models.ForeignKey(
        "accounts.Classroom", null=True, blank=True, on_delete=models.SET_NULL, related_name="videos",
        help_text="Leave empty to show the video to every student.",
    )
    file = models.FileField(
        upload_to="videos/%Y/%m/", blank=True,
        validators=[FileExtensionValidator(ALLOWED_VIDEO_EXTENSIONS), validate_video_size],
    )
    external_url = models.URLField(blank=True, help_text="A YouTube or Vimeo link instead of a file.")
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(models.Q(file="") & ~models.Q(external_url=""))
                | (~models.Q(file="") & models.Q(external_url="")),
                name="video_has_file_xor_link",
            )
        ]

    def __str__(self):
        return self.title

    def clean(self):
        if bool(self.file) == bool(self.external_url):
            raise ValidationError("Upload a video file or paste a link — exactly one of the two.")
        if self.external_url and not self.embed_url:
            raise ValidationError({"external_url": "Use a YouTube or Vimeo link."})

    @property
    def embed_url(self):
        from .video_links import embed_url

        return embed_url(self.external_url) if self.external_url else ""

    def get_absolute_url(self):
        return f"/videos/{self.pk}"
