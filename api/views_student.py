"""Everything a student does: Today, words, quizzes, speaking, grammar, videos, progress."""
from django.conf import settings
from django.db.models import Count
from django.http import Http404
from django.shortcuts import get_object_or_404

from content.models import GrammarTopic, Level, QuizOption, QuizQuestion, SpeakingTask, Topic, VocabularyItem
from learning import services
from learning.files import ranged_file_response
from learning.models import QuizAttempt, SpeakingPractice, SpeakingSubmission, VideoView

from . import serializers as s
from .utils import approved_required, body, fail, methods, ok


def _level(request, code=None):
    if code:
        return _allowed(request, get_object_or_404(Level, code=code, is_active=True))
    level = services.current_level(request.user)
    if level is None:
        raise Http404("No levels have been set up yet.")
    return level


def _allowed(request, level):
    """A student never gets anything above their course level: it simply doesn't exist for them."""
    if not request.user.can_see_level(level):
        raise Http404
    return level


def _decks_with_stats(user, level):
    topics = list(level.topics.select_related("level").annotate(n=Count("items")).filter(n__gt=0))
    return topics, services.deck_stats(user, topics)


# ---------------- Today & progress ----------------
@approved_required
@methods("GET")
def today(request):
    user = request.user
    level = _level(request)
    topics, stats = _decks_with_stats(user, level)
    ready = sum(st["due"] for st in stats.values())
    next_deck = max(topics, key=lambda t: (stats[t.id]["due"] > 0, stats[t.id]["seen"] > 0, stats[t.id]["due"]), default=None)
    if next_deck and stats[next_deck.id]["due"] == 0:
        next_deck = None
    unfinished = QuizAttempt.objects.filter(user=user, finished_at__isnull=True, level=level).first()
    watched = VideoView.objects.filter(user=user, watched_at__isnull=False).values_list("video_id", flat=True)
    new_videos = services.visible_videos(user).filter(level=level).exclude(pk__in=list(watched))[:3]
    return ok({
        "level": s.level(level), "summary": services.student_summary(user, level), "ready": ready,
        "next_deck": s.topic(next_deck, stats[next_deck.id]) if next_deck else None,
        "unfinished": s.attempt_summary(unfinished) if unfinished else None,
        "new_videos": [s.video(v) for v in new_videos],
    })


@approved_required
@methods("GET")
def progress(request):
    # One level at a time: A1 and A2 are separate courses.
    user = request.user
    lv = _level(request)
    topics, stats = _decks_with_stats(user, lv)
    summary = services.student_summary(user, lv)
    levels = [{"level": s.level(lv), "summary": summary, "decks": [s.topic(t, stats[t.id]) for t in topics]}]
    attempts = user.quiz_attempts.filter(finished_at__isnull=False, level=lv).select_related("grammar_topic", "level")[:10]
    return ok({"level": s.level(lv), "summary": summary, "levels": levels,
               "attempts": [s.attempt_summary(a) for a in attempts]})


# ---------------- words ----------------
@approved_required
@methods("GET")
def decks(request):
    level = _level(request)
    topics, stats = _decks_with_stats(request.user, level)
    return ok({"level": s.level(level), "decks": [s.topic(t, stats[t.id]) for t in topics]})


@approved_required
@methods("GET")
def deck(request, level, slug):
    topic = get_object_or_404(Topic.objects.select_related("level"), level__code=level, slug=slug)
    _allowed(request, topic.level)
    reviews = {r.item_id: r for r in request.user.card_reviews.filter(item__topic=topic)}
    stats = services.deck_stats(request.user, [topic])[topic.id]
    return ok({"deck": s.topic(topic, stats), "words": [s.word(i, reviews.get(i.id)) for i in topic.items.all()]})


@approved_required
@methods("GET")
def study_session(request, level, slug):
    topic = get_object_or_404(Topic.objects.select_related("level"), level__code=level, slug=slug)
    _allowed(request, topic.level)
    session, reviews = services.build_session(request.user, topic)
    cards = [{**s.word(i), "is_new": i.id not in reviews} for i in session]
    return ok({"deck": s.topic(topic), "cards": cards})


@approved_required
@methods("POST")
def review(request):
    data = body(request)
    try:
        item = VocabularyItem.objects.select_related("topic__level").get(pk=int(data["item"]))
        knew = data["knew"]
        if not isinstance(knew, bool):
            raise ValueError
    except (ValueError, KeyError, TypeError, VocabularyItem.DoesNotExist):
        return fail("Send a valid word id and true or false.")
    _allowed(request, item.topic.level)
    r = services.record_review(request.user, item, knew)
    return ok({"box": r.box, "due": s.dt(r.due_at)})


# ---------------- practice (quiz) ----------------
@approved_required
@methods("GET")
def practice(request):
    level = _level(request)
    topics = level.grammar_topics.select_related("level").annotate(n=Count("questions")).filter(n__gt=0)
    recent = request.user.quiz_attempts.filter(finished_at__isnull=False, level=level).select_related("grammar_topic", "level")[:5]
    unfinished = request.user.quiz_attempts.filter(finished_at__isnull=True, level=level).first()
    return ok({
        "level": s.level(level), "total": QuizQuestion.objects.filter(level=level).count(),
        "topics": [{**s.grammar_topic(t), "id": t.pk, "questions": t.n} for t in topics],
        "recent": [s.attempt_summary(a) for a in recent],
        "unfinished": s.attempt_summary(unfinished) if unfinished else None,
    })


@approved_required
@methods("POST")
def practice_start(request):
    data = body(request)
    level = _level(request, data.get("level") or None)
    topic = None
    if data.get("topic"):
        topic = get_object_or_404(GrammarTopic, pk=data["topic"], level=level)
    attempt = services.start_attempt(request.user, level, topic)
    if not attempt.question_ids:
        attempt.delete()
        return fail("There are no questions for that choice yet.")
    return ok({"attempt": attempt.pk}, status=201)


def _question_payload(q):
    data = {"id": q.pk, "kind": q.kind, "prompt": q.prompt}
    if q.kind == QuizQuestion.Kind.CHOICE:
        data["options"] = [{"id": o.pk, "text": o.text} for o in q.options.all()]
    return data


@approved_required
@methods("GET")
def attempt(request, pk):
    att = get_object_or_404(QuizAttempt.objects.select_related("grammar_topic", "level"), pk=pk, user=request.user)
    _allowed(request, att.level)
    next_id = att.next_question_id()
    data = {"attempt": s.attempt_summary(att), "finished": next_id is None}
    if next_id is not None:
        q = QuizQuestion.objects.get(pk=next_id)
        data.update({"position": att.question_ids.index(next_id) + 1, "question": _question_payload(q)})
    return ok(data)


@approved_required
@methods("POST")
def attempt_answer(request, pk):
    att = get_object_or_404(QuizAttempt.objects.select_related("level"), pk=pk, user=request.user)
    _allowed(request, att.level)
    data = body(request)
    question = get_object_or_404(QuizQuestion, pk=data.get("question") or 0)
    if question.id != att.next_question_id():
        return fail("That question was already answered. Reload to continue.", code="out_of_order", status=409)
    option = None
    if question.kind == QuizQuestion.Kind.CHOICE:
        option = QuizOption.objects.filter(pk=data.get("option") or 0, question=question).first()
        if option is None:
            return fail("Pick one of the answers first.")
    typed = str(data.get("typed", "")).strip()
    if question.kind == QuizQuestion.Kind.TYPED and not typed:
        return fail("Type your answer first.")
    answer = services.answer_question(att, question, option, typed)
    correct_option = question.options.filter(is_correct=True).first()
    att.refresh_from_db()
    return ok({
        "is_correct": answer.is_correct, "explanation": question.explanation,
        "correct_answer": question.correct_answer_display,
        "correct_option": correct_option.pk if correct_option else None,
        "selected_option": option.pk if option else None, "typed": answer.typed_answer,
        "finished": att.finished_at is not None, "score": att.score,
    })


@approved_required
@methods("GET")
def attempt_results(request, pk):
    att = get_object_or_404(QuizAttempt.objects.select_related("grammar_topic", "level"), pk=pk, user=request.user,
                            finished_at__isnull=False)
    _allowed(request, att.level)
    missed = att.answers.select_related("question", "selected_option").filter(is_correct=False)
    return ok({
        "attempt": s.attempt_summary(att),
        "topic": s.grammar_topic(att.grammar_topic) if att.grammar_topic else None,
        "missed": [{"prompt": a.question.prompt, "given": a.given_display,
                    "correct": a.question.correct_answer_display, "explanation": a.question.explanation} for a in missed],
    })


# ---------------- speaking ----------------
@approved_required
@methods("GET")
def speaking(request):
    level = _level(request)
    tasks = level.speaking_tasks.select_related("level")
    done = set(SpeakingPractice.objects.filter(user=request.user).values_list("task_id", flat=True))
    subs = {x.task_id: x for x in SpeakingSubmission.objects.filter(user=request.user)}
    parts = [{"value": p, "label": label} for p, label in SpeakingTask.Part.choices if tasks.filter(part=p).exists()]
    return ok({"level": s.level(level), "parts": parts,
               "tasks": [s.speaking_task(t, subs.get(t.pk), t.pk in done) for t in tasks]})


@approved_required
@methods("GET")
def speaking_detail(request, level, slug):
    task = get_object_or_404(SpeakingTask.objects.select_related("level"), level__code=level, slug=slug)
    _allowed(request, task.level)
    services.purge_old_recordings()
    lines = list(task.lines.all())
    sub = None if request.user.is_teacher else SpeakingSubmission.objects.filter(user=request.user, task=task).first()
    return ok({
        "task": {**s.speaking_task(task), "prompt": task.prompt, "model_answer": task.model_answer,
                 "questions": [x.text for x in lines if x.kind == "question"],
                 "phrases": [x.text for x in lines if x.kind == "phrase"]},
        "submission": s.submission(sub) if sub else None,
        "can_submit": not request.user.is_teacher,
        "practised": SpeakingPractice.objects.filter(user=request.user, task=task).count(),
        "limits": {"max_upload_mb": settings.SPEAKING_MAX_UPLOAD_MB,
                   "max_record_minutes": settings.SPEAKING_MAX_RECORD_MINUTES},
    })


@approved_required
@methods("POST")
def speaking_submit(request, level, slug):
    task = get_object_or_404(SpeakingTask.objects.select_related("level"), level__code=level, slug=slug)
    _allowed(request, task.level)
    if request.user.is_teacher:
        return fail("Only students send answers.", status=403)
    try:
        sub = services.submit_speaking(request.user, task, request.FILES.get("audio"))
    except services.SubmissionError as exc:
        return fail(str(exc))
    return ok({"submission": s.submission(sub)}, status=201)


@approved_required
@methods("POST")
def speaking_practised(request, level, slug):
    task = get_object_or_404(SpeakingTask.objects.select_related("level"), level__code=level, slug=slug)
    _allowed(request, task.level)
    SpeakingPractice.objects.create(user=request.user, task=task)
    return ok({"practised": SpeakingPractice.objects.filter(user=request.user, task=task).count()})


@approved_required
@methods("GET")
def speaking_audio(request, pk):
    """Only the student who recorded it and the teacher can play a recording."""
    sub = get_object_or_404(SpeakingSubmission, pk=pk)
    if sub.user_id != request.user.id and not request.user.is_teacher:
        raise Http404
    if not sub.has_audio:
        raise Http404("This recording has been deleted.")
    return ranged_file_response(request, sub.audio, sub.audio_type or None)


# ---------------- grammar ----------------
@approved_required
@methods("GET")
def grammar(request):
    level = _level(request)
    topics = level.grammar_topics.select_related("level").annotate(n=Count("questions"))
    return ok({"level": s.level(level), "topics": [{**s.grammar_topic(t), "questions": t.n} for t in topics]})


@approved_required
@methods("GET")
def grammar_detail(request, level, slug):
    topic = get_object_or_404(GrammarTopic.objects.select_related("level"), level__code=level, slug=slug)
    _allowed(request, topic.level)
    videos = services.visible_videos(request.user).filter(grammar_topic=topic)
    return ok({"topic": {**s.grammar_topic(topic, full=True), "id": topic.pk, "questions": topic.questions.count()},
               "videos": [s.video(v) for v in videos]})


# ---------------- videos ----------------
@approved_required
@methods("GET")
def videos(request):
    qs = services.visible_videos(request.user)
    if request.GET.get("level"):
        qs = qs.filter(level__code=request.GET["level"])
    watched = set(VideoView.objects.filter(user=request.user, watched_at__isnull=False).values_list("video_id", flat=True))
    return ok({"videos": [s.video(v, v.pk in watched) for v in qs]})


@approved_required
@methods("GET")
def video_detail(request, pk):
    video = get_object_or_404(services.visible_videos(request.user), pk=pk)
    view = VideoView.objects.filter(user=request.user, video=video).first()
    if view is None and not request.user.is_teacher:
        view = VideoView.objects.create(user=request.user, video=video)
    return ok({"video": s.video(video, bool(view and view.watched_at), full=True)})


@approved_required
@methods("POST")
def video_watched(request, pk):
    video = get_object_or_404(services.visible_videos(request.user), pk=pk)
    services.mark_video_watched(request.user, video)
    return ok({"watched": True})


@approved_required
@methods("GET")
def video_stream(request, pk):
    video = get_object_or_404(services.visible_videos(request.user), pk=pk)
    if not video.file:
        raise Http404
    return ranged_file_response(request, video.file)
