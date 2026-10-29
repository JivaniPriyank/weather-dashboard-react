"""The teacher's area: approvals, students, classes, videos and speaking feedback."""
from django.contrib.auth import get_user_model
from django.core.paginator import Paginator
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from accounts.forms import ClassroomForm, DecisionForm, StudentForm
from accounts.models import AccessRequest, Classroom
from content.models import GrammarTopic, Level, QuizQuestion, SpeakingTask, Video, VocabularyItem
from dashboard.forms import FeedbackForm, VideoForm
from learning import services
from learning.models import CardReview, QuizAttempt, SpeakingPractice, SpeakingSubmission, VideoView

from . import serializers as s
from .utils import body, fail, form_errors, methods, ok, page_info, teacher_required

User = get_user_model()


def _students():
    return User.objects.filter(role=User.Role.STUDENT).select_related("classroom", "access_request", "level")


def _request(r):
    return {"id": r.pk, "status": r.status, "status_label": r.get_status_display(), "note": r.note,
            "created_at": s.dt(r.created_at), "reviewed_at": s.dt(r.reviewed_at),
            "student": {"id": r.user_id, "full_name": r.user.full_name, "email": r.user.email,
                        "classroom_id": r.user.classroom_id, "level": r.user.level.code if r.user.level_id else None}}


def _classrooms():
    return [{"id": c.pk, "name": c.name, "level": c.level.code if c.level_id else None}
            for c in Classroom.objects.select_related("level")]


@teacher_required
@methods("GET")
def overview(request):
    pending = AccessRequest.objects.filter(status=AccessRequest.Status.PENDING).select_related("user", "user__level")
    approved = _students().filter(access_request__status=AccessRequest.Status.APPROVED)
    recent = QuizAttempt.objects.filter(finished_at__isnull=False).with_score().select_related("user", "grammar_topic", "level")[:8]
    return ok({
        "pending": [_request(r) for r in pending[:5]], "pending_count": pending.count(),
        "student_count": approved.count(), "class_count": Classroom.objects.count(),
        "video_count": Video.objects.count(),
        "speaking_waiting": SpeakingSubmission.objects.filter(reviewed_at__isnull=True).count(),
        "content": {"words": VocabularyItem.objects.count(), "questions": QuizQuestion.objects.count(),
                    "speaking": SpeakingTask.objects.count()},
        "recent": [{**s.attempt_summary(a), "student": {"id": a.user_id, "full_name": a.user.full_name}} for a in recent],
        "classrooms": _classrooms(),
    })


# ---------------- access requests ----------------
@teacher_required
@methods("GET")
def requests(request):
    status = request.GET.get("status", AccessRequest.Status.PENDING)
    if status not in AccessRequest.Status.values:
        status = AccessRequest.Status.PENDING
    counts = dict(AccessRequest.objects.values_list("status").annotate(n=Count("id")))
    rows = AccessRequest.objects.filter(status=status).select_related("user", "user__level")
    return ok({"status": status, "requests": [_request(r) for r in rows], "classrooms": _classrooms(),
               "statuses": [{"value": v, "label": label, "count": counts.get(v, 0)} for v, label in AccessRequest.Status.choices]})


@teacher_required
@methods("POST")
def decide(request, pk):
    access = get_object_or_404(AccessRequest.objects.select_related("user"), pk=pk)
    data = body(request)
    form = DecisionForm({"decision": data.get("decision", ""), "classroom": data.get("classroom") or "",
                         "level": data.get("level") or ""}, student=access.user)
    if not form.is_valid():
        first = next(iter(form.errors.values()))[0]
        return form_errors(form, first)
    d = form.cleaned_data
    access.decide(d["decision"], request.user, d["classroom"], d["level"] if d["decision"] == "approved" else None)
    verb = "approved" if access.status == AccessRequest.Status.APPROVED else "declined"
    return ok({"message": f"{access.user.full_name} is {verb}.", "request": _request(access)})


# ---------------- students ----------------
@teacher_required
@methods("GET")
def students(request):
    qs = _students().filter(access_request__status=AccessRequest.Status.APPROVED)
    q = request.GET.get("q", "").strip()
    classroom = request.GET.get("class", "")
    if q:
        qs = qs.filter(Q(full_name__icontains=q) | Q(email__icontains=q))
    if classroom == "none":
        qs = qs.filter(classroom__isnull=True)
    elif classroom.isdigit():
        qs = qs.filter(classroom_id=int(classroom))
    page = Paginator(qs.order_by("full_name", "pk"), 25).get_page(request.GET.get("page"))
    rows = list(page.object_list)
    # One grouped query per kind of activity. (Counting them all in one query joins every
    # review with every quiz, practice and video of a student: millions of rows.)
    ids = [u.pk for u in rows]
    words = {r["user"]: r for r in CardReview.objects.filter(user__in=ids).values("user").annotate(
        practised=Count("id"), learned=Count("id", filter=Q(box__gte=4)), last=Max("last_reviewed_at"))}
    quizzes = {r["user"]: r for r in QuizAttempt.objects.filter(user__in=ids, finished_at__isnull=False)
               .values("user").annotate(n=Count("id"), last=Max("finished_at"))}
    last_speaking = dict(SpeakingPractice.objects.filter(user__in=ids).values("user")
                         .annotate(last=Max("practised_at")).values_list("user", "last"))
    last_video = dict(VideoView.objects.filter(user__in=ids, watched_at__isnull=False).values("user")
                      .annotate(last=Max("watched_at")).values_list("user", "last"))
    levels = list(Level.objects.filter(is_active=True).annotate(total=Count("topics__items")))
    per_level = {}
    for row in (CardReview.objects.filter(user__in=ids)
                .values("user", "item__topic__level").annotate(n=Count("id"))):
        per_level[(row["user"], row["item__topic__level"])] = row["n"]

    def student_row(u):
        w, q = words.get(u.pk, {}), quizzes.get(u.pk, {})
        last = [d for d in (w.get("last"), q.get("last"), last_speaking.get(u.pk), last_video.get(u.pk)) if d]
        return {**s.user(u), "practised": w.get("practised", 0), "learned": w.get("learned", 0), "quizzes": q.get("n", 0),
                "words_by_level": [{"code": lv.code, "practised": per_level.get((u.pk, lv.pk), 0), "total": lv.total}
                                   for lv in levels],
                "is_active": u.is_active, "last_login": s.dt(u.last_login), "last_active": s.dt(max(last, default=None))}

    return ok({"students": [student_row(u) for u in rows], "page": page_info(page), "classrooms": _classrooms()})


@teacher_required
@methods("GET", "PATCH", "POST")
def student_detail(request, pk):
    student = get_object_or_404(_students(), pk=pk)
    if request.method != "GET":
        data = body(request)
        form = StudentForm({"full_name": data.get("full_name", student.full_name),
                            "level": data.get("level", student.level.code if student.level_id else "") or "",
                            "classroom": data.get("classroom") or "",
                            "is_active": bool(data.get("is_active", student.is_active))}, instance=student)
        if not form.is_valid():
            first = next(iter(form.errors.values()))[0]
            return form_errors(form, first)
        form.save()
        student.refresh_from_db()
    # A1 and A2 are separate courses: everything below is for one level.
    level = Level.objects.filter(code=request.GET.get("level")).first() or services.current_level(student)
    attempts = student.quiz_attempts.filter(finished_at__isnull=False, level=level).with_score().select_related("grammar_topic", "level")[:10]
    views = VideoView.objects.filter(user=student, video__level=level).select_related("video")
    speaking = SpeakingSubmission.objects.filter(user=student, task__level=level).select_related("task", "task__level")
    access = getattr(student, "access_request", None)
    active_levels = list(Level.objects.filter(is_active=True))
    seen_by_level = dict(CardReview.objects.filter(user=student).values("item__topic__level")
                         .annotate(n=Count("id")).values_list("item__topic__level", "n"))
    return ok({
        "student": {**s.user(student), "is_active": student.is_active, "date_joined": s.dt(student.date_joined)},
        "all_levels": [s.level(lv) for lv in active_levels],
        "access_request": access.pk if access else None,
        "level": s.level(level),
        "studying": s.level(services.current_level(student)),
        "levels": [{**s.level(lv), "practised": seen_by_level.get(lv.pk, 0)} for lv in active_levels],
        "summary": services.student_summary(student, level),
        "decks": [{**d, "last_studied": s.dt(d["last_studied"])} for d in services.student_decks(student, level)],
        "activity": [{**e, "at": s.dt(e["at"])} for e in services.student_activity(student, level)],
        "attempts": [s.attempt_summary(a) for a in attempts],
        "speaking": [{"id": x.pk, "task": s.speaking_task(x.task), "submitted_at": s.dt(x.submitted_at),
                      "reviewed": x.is_reviewed, "total_score": x.total_score, "max_score": x.max_score} for x in speaking],
        "videos": [{"title": v.video.title, "watched_at": s.dt(v.watched_at)} for v in views],
        "sections": _section_progress(student, level),
        "classrooms": _classrooms(),
    })


def _section_progress(student, level):
    """Each of the teacher's sections at this level: which published lessons the student finished."""
    from content.models import Section
    from learning.models import LessonProgress

    done = {p.lesson_id: p for p in LessonProgress.objects.filter(user=student, lesson__section__level=level)}
    rows = []
    for sec in Section.objects.filter(level=level).prefetch_related("lessons"):
        lessons = [x for x in sec.lessons.all() if x.is_published]
        if not lessons:
            continue
        rows.append({"id": sec.pk, "title": sec.title, "is_visible": sec.is_visible,
                     "done": sum(1 for x in lessons if x.pk in done), "count": len(lessons),
                     "lessons": [{"id": x.pk, "title": x.title,
                                  "done_at": s.dt(done[x.pk].done_at) if x.pk in done else None,
                                  "score": done[x.pk].score if x.pk in done else None,
                                  "total": done[x.pk].total if x.pk in done else None} for x in lessons]})
    return rows


# ---------------- classes ----------------
def _classroom(c, students=False):
    data = {"id": c.pk, "name": c.name, "description": c.description, "level": c.level.code if c.level_id else None}
    if students:
        data["students"] = [{"id": u.pk, "full_name": u.full_name, "email": u.email} for u in c.students.all()]
    return data


@teacher_required
@methods("GET", "POST")
def classes(request):
    if request.method == "POST":
        form = ClassroomForm(body(request))
        if not form.is_valid():
            return form_errors(form)
        c = form.save()
        return ok({"classroom": _classroom(c), "message": f"Class “{c.name}” created."}, status=201)
    rows = Classroom.objects.select_related("level").annotate(n=Count("students", distinct=True), v=Count("videos", distinct=True))
    return ok({"classes": [{**_classroom(c), "students": c.n, "videos": c.v} for c in rows]})


@teacher_required
@methods("GET", "PATCH", "POST", "DELETE")
def class_detail(request, pk):
    c = get_object_or_404(Classroom, pk=pk)
    if request.method == "DELETE":
        name = c.name
        c.delete()
        return ok({"message": f"Class “{name}” deleted. Its students are kept, without a class."})
    if request.method in ("PATCH", "POST"):
        form = ClassroomForm(body(request), instance=c)
        if not form.is_valid():
            return form_errors(form)
        form.save()
    return ok({"classroom": _classroom(c, students=True)})


# ---------------- videos ----------------
@teacher_required
@methods("GET")
def videos(request):
    rows = Video.objects.select_related("level", "classroom", "grammar_topic", "grammar_topic__level").annotate(
        n_watched=Count("views", filter=Q(views__watched_at__isnull=False))
    )
    return ok({"videos": [{**s.video(v), "watched_by": v.n_watched} for v in rows]})


@teacher_required
@methods("GET")
def video_options(request):
    return ok({
        "levels": [{"id": lv.pk, "code": lv.code} for lv in Level.objects.all()],
        "grammar_topics": [{"id": g.pk, "title": g.title, "level": g.level.code}
                           for g in GrammarTopic.objects.select_related("level")],
        "classrooms": _classrooms(),
    })


def _video_form_data(request, video=None):
    """The video form as sent by the browser (FormData)."""
    data = request.POST.copy()
    # checkboxes: only present when ticked
    if "is_published" in data and data.get("is_published") in ("false", "0", ""):
        data.pop("is_published")
    return data


def _video_edit_payload(v):
    return {**s.video(v, full=True), "level_id": v.level_id, "grammar_topic_id": v.grammar_topic_id,
            "classroom_id": v.classroom_id, "external_url": v.external_url,
            "file_name": v.file.name.split("/")[-1] if v.file else None}


@teacher_required
@methods("POST")
def video_create(request):
    form = VideoForm(_video_form_data(request), request.FILES)
    if not form.is_valid():
        return form_errors(form)
    v = form.save()
    return ok({"video": _video_edit_payload(v),
               "message": f"Video “{v.title}” {'published' if v.is_published else 'saved as hidden'}."}, status=201)


@teacher_required
@methods("GET", "POST", "DELETE")
def video_detail(request, pk):
    v = get_object_or_404(Video, pk=pk)
    if request.method == "DELETE":
        title = v.title
        if v.file:
            v.file.delete(save=False)
        v.delete()
        return ok({"message": f"Video “{title}” deleted."})
    if request.method == "POST":  # multipart update (PATCH can't carry files in Django)
        form = VideoForm(_video_form_data(request, v), request.FILES, instance=v)
        if not form.is_valid():
            return form_errors(form)
        v = form.save()
        return ok({"video": _video_edit_payload(v), "message": f"Video “{v.title}” saved."})
    return ok({"video": _video_edit_payload(v)})


# ---------------- speaking feedback ----------------
@teacher_required
@methods("GET")
def speaking_inbox(request):
    services.purge_old_recordings()
    show = "reviewed" if request.GET.get("show") == "reviewed" else "waiting"
    qs = SpeakingSubmission.objects.select_related("user", "user__classroom", "task", "task__level")
    waiting = qs.filter(reviewed_at__isnull=True)
    reviewed = qs.filter(reviewed_at__isnull=False).order_by("-reviewed_at")
    rows = reviewed if show == "reviewed" else waiting.order_by("submitted_at")
    page = Paginator(rows, 30).get_page(request.GET.get("page"))
    return ok({"show": show, "waiting_count": waiting.count(), "reviewed_count": reviewed.count(),
               "answers": [s.submission(x, for_teacher=True) for x in page.object_list], "page": page_info(page)})


@teacher_required
@methods("GET", "POST")
def speaking_review(request, pk):
    sub = get_object_or_404(SpeakingSubmission.objects.select_related("user", "user__classroom", "task", "task__level"), pk=pk)
    next_id = None
    if request.method == "POST":
        form = FeedbackForm(body(request), instance=sub)
        if not form.is_valid():
            return form_errors(form, "Give all four scores and write your feedback.")
        saved = form.save(commit=False)
        if saved.reviewed_at is None:
            saved.reviewed_at = timezone.now()
        saved.reviewed_by = request.user
        saved.save()
        sub = saved
        nxt = SpeakingSubmission.objects.filter(reviewed_at__isnull=True).order_by("submitted_at").first()
        next_id = nxt.pk if nxt else None
    lines = list(sub.task.lines.all())
    return ok({
        "answer": s.submission(sub, for_teacher=True),
        "task": {**s.speaking_task(sub.task), "prompt": sub.task.prompt, "model_answer": sub.task.model_answer,
                 "questions": [x.text for x in lines if x.kind == "question"]},
        "waiting_after": SpeakingSubmission.objects.filter(reviewed_at__isnull=True).exclude(pk=pk).count(),
        "next_id": next_id,
        "message": f"Feedback sent to {sub.user.full_name} ({sub.total_score}/{sub.max_score})." if request.method == "POST" else None,
    })
