"""Learning logic kept out of the views so it can be tested on its own."""
import random
import re
import unicodedata
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Max, Q
from django.db.models.functions import TruncDate
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


def mistake_question_ids(user, level):
    """Questions at this level whose latest answer by the student was wrong."""
    latest = dict(QuizAnswer.objects.filter(attempt__user=user, question__level=level)
                  .order_by("answered_at", "pk").values_list("question_id", "is_correct"))
    return [qid for qid, right in latest.items() if not right]


def start_attempt(user, level, grammar_topic=None, size=10, mistakes=False):
    if mistakes:
        ids = mistake_question_ids(user, level)
        kind = QuizAttempt.Kind.MISTAKES
    else:
        qs = QuizQuestion.objects.filter(level=level)
        if grammar_topic:
            qs = qs.filter(grammar_topic=grammar_topic)
        ids = list(qs.values_list("id", flat=True))
        kind = QuizAttempt.Kind.PRACTICE
    random.shuffle(ids)
    return QuizAttempt.objects.create(user=user, level=level, grammar_topic=grammar_topic, kind=kind,
                                      question_ids=ids[:size])


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
def _activity(user):
    """Every kind of practice a student does, as (queryset, time field)."""
    return (
        (CardReview.objects.filter(user=user), "last_reviewed_at"),
        (QuizAnswer.objects.filter(attempt__user=user), "answered_at"),
        (SpeakingPractice.objects.filter(user=user), "practised_at"),
        (VideoView.objects.filter(user=user), "watched_at"),
    )


def activity_dates(user, days=400):
    """The local dates with any practice. The database groups by day, so only one
    row per day comes back however much the student practised."""
    since = timezone.now() - timedelta(days=days)
    tz = timezone.get_current_timezone()
    dates = set()
    for qs, field in _activity(user):
        dates.update(qs.filter(**{f"{field}__gte": since})
                     .annotate(day=TruncDate(field, tzinfo=tz)).order_by().values_list("day", flat=True).distinct())
    return dates


def activity_by_day(user, days=84):
    """{local date: number of things practised} for the last `days` days. Word reviews count
    on the day a word was last reviewed (only the latest review of each word is stored)."""
    since = timezone.now() - timedelta(days=days)
    tz = timezone.get_current_timezone()
    counts = {}
    for qs, field in _activity(user):
        rows = (qs.filter(**{f"{field}__gte": since}).annotate(day=TruncDate(field, tzinfo=tz))
                .order_by().values("day").annotate(n=Count("pk")).values_list("day", "n"))
        for day, n in rows:
            counts[day] = counts.get(day, 0) + n
    return counts


def topic_accuracy(user, level):
    """How often the student answered each grammar topic's questions right, weakest first."""
    from content.models import GrammarTopic

    rows = (QuizAnswer.objects.filter(attempt__user=user, question__level=level, question__grammar_topic__isnull=False)
            .values("question__grammar_topic").annotate(n=Count("id"), right=Count("id", filter=Q(is_correct=True))))
    by_topic = {r["question__grammar_topic"]: r for r in rows}
    topics = GrammarTopic.objects.filter(pk__in=by_topic).select_related("level")
    result = [{"topic": t, "answered": by_topic[t.pk]["n"], "right": by_topic[t.pk]["right"],
               "percent": round(by_topic[t.pk]["right"] / by_topic[t.pk]["n"] * 100)} for t in topics]
    return sorted(result, key=lambda r: (r["percent"], -r["answered"], r["topic"].title))


def streak(user, dates=None):
    """Consecutive days with any practice, counting today or yesterday as the start."""
    dates = activity_dates(user) if dates is None else dates
    day = timezone.localdate()
    if day not in dates:
        day -= timedelta(days=1)
    count = 0
    while day in dates:
        count += 1
        day -= timedelta(days=1)
    return count


def last_active(user):
    """The local date of the student's latest practice, or None."""
    times = [qs.aggregate(m=Max(field))["m"] for qs, field in _activity(user)]
    latest = max((t for t in times if t), default=None)
    return timezone.localtime(latest).date() if latest else None


def student_summary(user, level=None):
    """What the student has done (at one level, or all levels). The streak and the last
    active day count practice at every level."""
    reviews = CardReview.objects.filter(user=user)
    attempts = QuizAttempt.objects.filter(user=user, finished_at__isnull=False)
    words_total = VocabularyItem.objects.all()
    speaking = SpeakingPractice.objects.filter(user=user)
    videos = VideoView.objects.filter(user=user, watched_at__isnull=False)
    if level:
        reviews = reviews.filter(item__topic__level=level)
        attempts = attempts.filter(level=level)
        words_total = words_total.filter(topic__level=level)
        speaking = speaking.filter(task__level=level)
        videos = videos.filter(video__level=level)
    words = reviews.aggregate(seen=Count("id"), learned=Count("id", filter=Q(box__gte=4)))
    answers = QuizAnswer.objects.filter(attempt__in=attempts).aggregate(
        n=Count("id"), right=Count("id", filter=Q(is_correct=True)))
    dates = activity_dates(user)
    return {
        "words_total": words_total.count(),
        "words_seen": words["seen"],
        "words_learned": words["learned"],
        "quizzes_done": attempts.count(),
        "quiz_accuracy": round(answers["right"] / answers["n"] * 100) if answers["n"] else None,
        "speaking_done": speaking.values("task").distinct().count(),
        "videos_watched": videos.count(),
        "streak": streak(user, dates),
        # The latest practice day is usually among the recent dates; only look further back if not.
        "last_active": max(dates) if dates else last_active(user),
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
    for a in at_level(QuizAttempt.objects.filter(user=user, finished_at__isnull=False), "level").with_score().select_related("level", "grammar_topic")[:limit]:
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
