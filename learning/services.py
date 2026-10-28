"""Learning logic kept out of the views so it can be tested on its own."""
import random
import re
import unicodedata
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone

from content.models import Level, QuizQuestion, Video, VocabularyItem

from .models import CardReview, QuizAnswer, QuizAttempt, SpeakingPractice, VideoView


# ---------- levels ----------
def current_level(user):
    """The level being shown: the chosen one if allowed, else the student's course level."""
    if user.current_level_id and user.can_see_level(user.current_level):
        return user.current_level
    if not user.is_teacher and user.level_id and user.level.is_active:
        return user.level
    return user.allowed_levels().first()


# ---------- flashcards ----------
def build_session(user, topic):
    """Words to study now: due reviews first, then a few new words."""
    now = timezone.now()
    reviews = {r.item_id: r for r in CardReview.objects.filter(user=user, item__topic=topic)}
    items = list(topic.items.all())
    due = sorted((i for i in items if i.id in reviews and reviews[i.id].due_at <= now),
                 key=lambda i: reviews[i.id].due_at)
    new = [i for i in items if i.id not in reviews][: settings.SRS_NEW_CARDS_PER_SESSION]
    session = (due + new)[: settings.SRS_SESSION_SIZE]
    random.shuffle(session)
    return session, reviews


def record_review(user, item, knew_it):
    review, _ = CardReview.objects.get_or_create(user=user, item=item)
    review.record(knew_it)
    return review


def deck_stats(user, topics):
    """{topic_id: {"total", "learned", "due", "seen"}} for a list of topics."""
    now = timezone.now()
    totals = dict(VocabularyItem.objects.filter(topic__in=topics).values_list("topic").annotate(n=Count("id")))
    rows = (CardReview.objects.filter(user=user, item__topic__in=topics).values("item__topic")
            .annotate(seen=Count("id"), learned=Count("id", filter=Q(box__gte=4)),
                      due=Count("id", filter=Q(due_at__lte=now))))
    by_topic = {r["item__topic"]: r for r in rows}
    stats = {}
    for t in topics:
        r = by_topic.get(t.id, {})
        total = totals.get(t.id, 0)
        seen = r.get("seen", 0)
        stats[t.id] = {
            "total": total, "learned": r.get("learned", 0), "seen": seen,
            "due": r.get("due", 0) + min(total - seen, settings.SRS_NEW_CARDS_PER_SESSION),
            "percent": round(r.get("learned", 0) / total * 100) if total else 0,
            "practised_percent": round(seen / total * 100) if total else 0,
        }
    return stats


# ---------- quiz ----------
def _normalise(text):
    text = unicodedata.normalize("NFC", text).casefold()
    text = re.sub(r"[.,!?;:'\"„“”…]", " ", text)
    return " ".join(text.split())


def check_typed_answer(question, given):
    given = _normalise(given)
    return bool(given) and any(given == _normalise(a) for a in question.answers_list())


def start_attempt(user, level, grammar_topic=None, size=10):
    qs = QuizQuestion.objects.filter(level=level)
    if grammar_topic:
        qs = qs.filter(grammar_topic=grammar_topic)
    ids = list(qs.values_list("id", flat=True))
    random.shuffle(ids)
    return QuizAttempt.objects.create(user=user, level=level, grammar_topic=grammar_topic, question_ids=ids[:size])


def answer_question(attempt, question, option=None, typed=""):
    if question.kind == QuizQuestion.Kind.CHOICE:
        correct = bool(option and option.is_correct and option.question_id == question.id)
    else:
        correct = check_typed_answer(question, typed)
    answer = QuizAnswer.objects.create(
        attempt=attempt, question=question, selected_option=option, typed_answer=typed[:200], is_correct=correct
    )
    if attempt.next_question_id() is None:
        attempt.finished_at = timezone.now()
        attempt.save(update_fields=["finished_at"])
    return answer


# ---------- videos ----------
def visible_videos(user):
    qs = Video.objects.select_related("level", "grammar_topic", "classroom")
    if user.is_teacher:
        return qs
    # Every video needs a level: one without a level isn't shown to students.
    return (qs.filter(is_published=True, level__in=user.allowed_levels())
            .filter(Q(classroom__isnull=True) | Q(classroom_id=user.classroom_id)))


def mark_video_watched(user, video):
    view, _ = VideoView.objects.get_or_create(user=user, video=video)
    if not view.watched_at:
        view.watched_at = timezone.now()
        view.save(update_fields=["watched_at"])
    return view


# ---------- progress ----------
def activity_dates(user, days=60):
    since = timezone.now() - timedelta(days=days)
    dates = set()
    for qs, field in (
        (CardReview.objects.filter(user=user, last_reviewed_at__gte=since), "last_reviewed_at"),
        (QuizAnswer.objects.filter(attempt__user=user, answered_at__gte=since), "answered_at"),
        (SpeakingPractice.objects.filter(user=user, practised_at__gte=since), "practised_at"),
        (VideoView.objects.filter(user=user, watched_at__gte=since), "watched_at"),
    ):
        dates.update(timezone.localtime(v).date() for v in qs.values_list(field, flat=True))
    return dates


def streak(user):
    """Consecutive days with any practice, counting today or yesterday as the start."""
    dates = activity_dates(user)
    day = timezone.localdate()
    if day not in dates:
        day -= timedelta(days=1)
    count = 0
    while day in dates:
        count += 1
        day -= timedelta(days=1)
    return count


def student_summary(user, level=None):
    reviews = CardReview.objects.filter(user=user)
    attempts = QuizAttempt.objects.filter(user=user, finished_at__isnull=False)
    words_total = VocabularyItem.objects.all()
    speaking = SpeakingPractice.objects.filter(user=user)
    videos = VideoView.objects.filter(user=user)
    if level:
        reviews = reviews.filter(item__topic__level=level)
        attempts = attempts.filter(level=level)
        words_total = words_total.filter(topic__level=level)
        speaking = speaking.filter(task__level=level)
        videos = videos.filter(video__level=level)
    answers = QuizAnswer.objects.filter(attempt__in=attempts)
    answered = answers.count()
    return {
        "words_total": words_total.count(),
        "words_seen": reviews.count(),
        "words_learned": reviews.filter(box__gte=4).count(),
        "quizzes_done": attempts.count(),
        "quiz_accuracy": round(answers.filter(is_correct=True).count() / answered * 100) if answered else None,
        "speaking_done": speaking.values("task").distinct().count(),
        "videos_watched": videos.filter(watched_at__isnull=False).count(),
        "streak": streak(user),
        "last_active": max(activity_dates(user, days=3650), default=None),
    }


# ---------- speaking submissions ----------
AUDIO_EXTENSIONS = {"webm", "ogg", "oga", "opus", "mp3", "m4a", "mp4", "aac", "wav"}
AUDIO_TYPES = {
    "webm": "audio/webm", "ogg": "audio/ogg", "oga": "audio/ogg", "opus": "audio/ogg", "mp3": "audio/mpeg",
    "m4a": "audio/mp4", "mp4": "audio/mp4", "aac": "audio/aac", "wav": "audio/wav",
}


class SubmissionError(Exception):
    """A student-facing reason why an answer could not be sent."""


def validate_audio(upload):
    if upload is None:
        raise SubmissionError("Record your answer or choose an audio file first.")
    ext = upload.name.rsplit(".", 1)[-1].lower() if "." in upload.name else ""
    if ext not in AUDIO_EXTENSIONS:
        raise SubmissionError("That file isn't an audio recording. Use MP3, M4A, WAV, OGG or WebM.")
    if upload.size == 0:
        raise SubmissionError("The recording is empty. Record again and check that your microphone works.")
    if upload.size > settings.SPEAKING_MAX_UPLOAD_MB * 1024 * 1024:
        raise SubmissionError(f"The recording is too big. The limit is {settings.SPEAKING_MAX_UPLOAD_MB} MB.")
    return AUDIO_TYPES[ext]


def submit_speaking(user, task, upload):
    """Save the student's one answer for this task. Raises SubmissionError with a readable reason."""
    from django.db import IntegrityError, transaction

    from .models import SpeakingSubmission

    if SpeakingSubmission.objects.filter(user=user, task=task).exists():
        raise SubmissionError("You've already sent your answer for this task.")
    audio_type = validate_audio(upload)
    try:
        with transaction.atomic():
            submission = SpeakingSubmission.objects.create(user=user, task=task, audio=upload, audio_type=audio_type)
    except IntegrityError:  # two sends at the same moment
        raise SubmissionError("You've already sent your answer for this task.")
    SpeakingPractice.objects.create(user=user, task=task)
    return submission


def purge_old_recordings(now=None):
    """Delete recordings whose feedback is older than the keep period. Scores and feedback stay."""
    from .models import SpeakingSubmission

    now = now or timezone.now()
    cutoff = now - timedelta(days=settings.SPEAKING_KEEP_DAYS_AFTER_FEEDBACK)
    old = SpeakingSubmission.objects.filter(reviewed_at__lte=cutoff, audio_deleted_at__isnull=True)
    count = 0
    for submission in old:
        submission.delete_audio()
        count += 1
    return count


# ---------- what a student has done (for the teacher) ----------
def student_decks(user, level=None):
    """Every word deck the student has practised: words practised and learned, last studied."""
    from django.db.models import Max

    from content.models import Topic

    reviews = CardReview.objects.filter(user=user)
    if level:
        reviews = reviews.filter(item__topic__level=level)
    rows = (reviews
            .values("item__topic").annotate(practised=Count("id"), learned=Count("id", filter=Q(box__gte=4)),
                                            last=Max("last_reviewed_at")))
    by_topic = {r["item__topic"]: r for r in rows}
    topics = Topic.objects.filter(pk__in=by_topic).select_related("level").annotate(total=Count("items"))
    decks = [{"id": t.pk, "name": t.name, "level": t.level.code, "slug": t.slug, "total": t.total,
              "practised": by_topic[t.pk]["practised"], "learned": by_topic[t.pk]["learned"],
              "last_studied": by_topic[t.pk]["last"]} for t in topics]
    return sorted(decks, key=lambda d: d["last_studied"] or timezone.now() - timedelta(days=9999), reverse=True)


def student_activity(user, level=None, limit=15):
    """The student's most recent actions at one level (or all levels), newest first."""
    from django.db.models import Max

    from .models import SpeakingSubmission

    events = []
    # Flashcards keep only the latest review per word, so one entry per deck and day.
    def at_level(qs, field):
        return qs.filter(**{field: level}) if level else qs

    sessions = (at_level(CardReview.objects.filter(user=user, last_reviewed_at__isnull=False), "item__topic__level")
                .values("item__topic__name", "item__topic__level__code", "last_reviewed_at__date")
                .annotate(n=Count("id"), at=Max("last_reviewed_at")))
    for x in sessions:
        events.append({"kind": "words", "at": x["at"], "title": f"Practised words: {x['item__topic__name']}",
                       "sub": f"{x['item__topic__level__code']} · {x['n']} word{'s' if x['n'] != 1 else ''}"})
    for a in at_level(QuizAttempt.objects.filter(user=user, finished_at__isnull=False), "level").select_related("level", "grammar_topic")[:limit]:
        events.append({"kind": "quiz", "at": a.finished_at, "title": f"Finished quiz: {a.title}",
                       "sub": f"{a.score} of {a.total} right", "score": a.score, "total": a.total})
    for p in at_level(SpeakingPractice.objects.filter(user=user), "task__level").select_related("task", "task__level")[:limit]:
        events.append({"kind": "speaking", "at": p.practised_at, "title": f"Practised speaking: {p.task.title}",
                       "sub": f"{p.task.level.code} {p.task.get_part_display()}"})
    for x in at_level(SpeakingSubmission.objects.filter(user=user), "task__level").select_related("task", "task__level")[:limit]:
        events.append({"kind": "answer", "at": x.submitted_at, "title": f"Sent a speaking answer: {x.task.title}",
                       "sub": "Feedback given" if x.is_reviewed else "Waiting for your feedback", "answer_id": x.pk})
    views = VideoView.objects.filter(user=user)
    if level:
        views = views.filter(video__level=level)
    for v in views.select_related("video")[:limit]:
        if v.watched_at:
            events.append({"kind": "video", "at": v.watched_at, "title": f"Watched video: {v.video.title}", "sub": ""})
        else:
            events.append({"kind": "video", "at": v.first_opened_at, "title": f"Opened video: {v.video.title}", "sub": "Not finished"})
    events.sort(key=lambda e: e["at"], reverse=True)
    return events[:limit]
