"""The teacher's own sections (e.g. 'Basics of A1'): lessons built from blocks.

Teacher: create sections, add and order lessons, edit a lesson's blocks, publish it.
Student: see the visible sections of their level in the menu, open a lesson, mark it done.
"""
from django.db import transaction
from django.db.models import Count, Max, Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from content import blocks as B
from content.models import Lesson, Level, Section, SpeakingTask, Topic, Video
from learning import services
from learning.models import LessonProgress

from . import serializers as s
from .utils import approved_required, body, fail, methods, ok, teacher_required

ICONS = [{"value": v, "label": label} for v, label in Section.IconChoice.choices]


def _levels():
    return [{"code": lv.code, "name": lv.name} for lv in Level.objects.all()]


def _text(data, key, label, max_len, errors, required=True):
    value = str(data.get(key) or "").strip()
    if required and not value:
        errors.setdefault(key, []).append(f"{label} can't be empty.")
    elif len(value) > max_len:
        errors.setdefault(key, []).append(f"{label} can be at most {max_len} characters.")
    return value


def _next_order(qs):
    return (qs.aggregate(m=Max("order"))["m"] or 0) + 1


# ---------------- shapes sent to the browser ----------------
def _section_card(sec):
    return {"id": sec.pk, "title": sec.title, "description": sec.description, "icon": sec.icon,
            "level": sec.level.code, "is_visible": sec.is_visible,
            "lessons": getattr(sec, "n_lessons", None), "published": getattr(sec, "n_published", None)}


def _topic_link(topic):
    if topic is None:
        return None
    return {"id": topic.pk, "name": topic.name, "level": topic.level.code, "slug": topic.slug, "count": topic.items.count()}


def _section_extras(sec):
    """Goals, word list and homework: what the section page shows around its lessons."""
    return {"goals": sec.goals or [], "homework": sec.homework, "topic": _topic_link(sec.topic)}


def _lesson_row(lesson):
    return {"id": lesson.pk, "title": lesson.title, "is_published": lesson.is_published,
            "summary": B.summary(lesson.blocks), "exercises": B.exercise_count(lesson.blocks)}


def sections_for_level(level):
    """The section cards of one level, for the teacher's Content page."""
    qs = (Section.objects.filter(level=level).select_related("level")
          .annotate(n_lessons=Count("lessons"), n_published=Count("lessons", filter=Q(lessons__is_published=True))))
    return [_section_card(x) for x in qs]


def menu_sections(user):
    """Sections a student sees in the menu: visible, at the level they're studying, with at
    least one published lesson."""
    level = services.current_level(user)
    if level is None:
        return []
    qs = (Section.objects.filter(level=level, is_visible=True)
          .annotate(n=Count("lessons", filter=Q(lessons__is_published=True))).filter(n__gt=0))
    return [{"id": x.pk, "title": x.title, "icon": x.icon} for x in qs]


# ---------------- teacher: sections ----------------
def _section_fields(data, errors):
    code = str(data.get("level") or "").strip()
    level = Level.objects.filter(code=code).first()
    if level is None:
        errors.setdefault("level", []).append("Choose a level.")
    icon = str(data.get("icon") or Section.IconChoice.STAR)
    if icon not in Section.IconChoice.values:
        errors.setdefault("icon", []).append("Choose one of the icons.")
    goals = []
    raw_goals = data.get("goals") if isinstance(data.get("goals"), list) else []
    for g in raw_goals[:8]:
        if isinstance(g, dict) and (str(g.get("title") or "").strip() or str(g.get("text") or "").strip()):
            title, text = str(g.get("title") or "").strip()[:80], str(g.get("text") or "").strip()[:200]
            if not title:
                errors.setdefault("goals", []).append("Every goal needs a short title.")
                break
            goals.append({"title": title, "text": text})
    topic = None
    topic_id = data.get("topic")
    if topic_id not in (None, ""):
        topic = Topic.objects.filter(pk=topic_id).select_related("level").first()
        if topic is None or (level and topic.level_id != level.pk):
            errors.setdefault("topic", []).append(f"Choose a word list of level {level.code if level else ''}.".replace("  ", " "))
            topic = None
    return {
        "level": level,
        "title": _text(data, "title", "The name", 80, errors),
        "description": _text(data, "description", "The description", 200, errors, required=False),
        "icon": icon,
        "is_visible": bool(data.get("is_visible", True)),
        "goals": goals,
        "topic": topic,
        "homework": _text(data, "homework", "The homework", 2000, errors, required=False),
    }


def _section_detail(sec):
    return {**_section_card(sec), **_section_extras(sec), "lessons": [_lesson_row(x) for x in sec.lessons.all()]}


def _topics(level):
    return [{"id": t.pk, "name": t.name} for t in Topic.objects.filter(level=level)]


@teacher_required
@methods("GET", "POST")
def sections(request):
    if request.method == "POST":
        errors = {}
        fields = _section_fields(body(request), errors)
        if errors:
            return fail("Some details need fixing.", errors=errors)
        sec = Section.objects.create(**fields, order=_next_order(Section.objects.filter(level=fields["level"])))
        return ok({"section": _section_detail(sec), "message": f"Section “{sec.title}” created. Now add its first lesson."}, status=201)
    level = Level.objects.filter(code=request.GET.get("level")).first() or Level.objects.first()
    return ok({"levels": _levels(), "icons": ICONS, "level": level.code if level else None,
               "sections": sections_for_level(level) if level else []})


@teacher_required
@methods("GET", "PATCH", "DELETE")
def section_detail(request, pk):
    sec = get_object_or_404(Section.objects.select_related("level"), pk=pk)
    if request.method == "DELETE":
        title, n = sec.title, sec.lessons.count()
        sec.delete()
        return ok({"message": f"Section “{title}” and its {n} lesson{'s' if n != 1 else ''} deleted."})
    if request.method == "PATCH":
        data = body(request)
        errors = {}
        current = {**_section_card(sec), **_section_extras(sec)}
        current["topic"] = sec.topic_id
        fields = _section_fields({**current, **data}, errors)
        if errors:
            return fail("Some details need fixing.", errors=errors)
        for k, v in fields.items():
            setattr(sec, k, v)
        sec.save()
    return ok({"section": _section_detail(sec), "levels": _levels(), "icons": ICONS, "topics": _topics(sec.level)})


@teacher_required
@methods("POST")
def lesson_create(request, pk):
    sec = get_object_or_404(Section, pk=pk)
    errors = {}
    title = _text(body(request), "title", "The lesson title", 120, errors)
    if errors:
        return fail("Some details need fixing.", errors=errors)
    lesson = Lesson.objects.create(section=sec, title=title, order=_next_order(sec.lessons.all()),
                                   blocks=[{"type": "text", "heading": "", "body": ""}])
    return ok({"lesson": _lesson_row(lesson), "message": f"Lesson “{title}” added as a draft."}, status=201)


@teacher_required
@methods("POST")
def lessons_order(request, pk):
    sec = get_object_or_404(Section, pk=pk)
    ids = body(request).get("lessons")
    current = list(sec.lessons.values_list("pk", flat=True))
    if not isinstance(ids, list) or sorted(map(str, ids)) != sorted(map(str, current)):
        return fail("Send every lesson of this section once, in the new order.")
    with transaction.atomic():
        for n, lesson_id in enumerate(ids, 1):
            Lesson.objects.filter(pk=lesson_id, section=sec).update(order=n)
    return ok({"section": _section_detail(sec)})


# ---------------- teacher: one lesson ----------------
def _options(level):
    return {
        "videos": [{"id": v.pk, "title": v.title} for v in Video.objects.filter(level=level)],
        "speaking": [{"id": t.pk, "title": t.title} for t in SpeakingTask.objects.filter(level=level)],
    }


def _check_refs(blocks, level, errors):
    """A video or speaking block must point at one of the same level."""
    videos = set(Video.objects.filter(level=level).values_list("pk", flat=True))
    tasks = set(SpeakingTask.objects.filter(level=level).values_list("pk", flat=True))
    for n, b in enumerate(blocks):
        if b["type"] == "video" and b["video_id"] not in videos:
            errors[f"block-{n}"] = [f"Choose one of your {level.code} videos."]
        if b["type"] == "speaking" and b["task_id"] not in tasks:
            errors[f"block-{n}"] = [f"Choose one of the {level.code} speaking tasks."]


def _lesson_full(lesson):
    sec = lesson.section
    siblings = list(sec.lessons.values_list("pk", flat=True))
    return {"id": lesson.pk, "title": lesson.title, "is_published": lesson.is_published, "blocks": lesson.blocks,
            "position": siblings.index(lesson.pk) + 1, "count": len(siblings),
            "section": {"id": sec.pk, "title": sec.title, "level": sec.level.code}}


@teacher_required
@methods("GET", "PATCH", "DELETE")
def lesson_detail(request, pk):
    lesson = get_object_or_404(Lesson.objects.select_related("section", "section__level"), pk=pk)
    level = lesson.section.level
    if request.method == "DELETE":
        title = lesson.title
        lesson.delete()
        return ok({"message": f"Lesson “{title}” deleted."})
    if request.method == "PATCH":
        data = body(request)
        errors = {}
        if "title" in data:
            lesson.title = _text(data, "title", "The lesson title", 120, errors)
        if "blocks" in data:
            blocks, block_errors = B.clean_blocks(data.get("blocks"))
            errors.update(block_errors)
            if not block_errors:
                _check_refs(blocks, level, errors)
            lesson.blocks = blocks
        if "is_published" in data:
            lesson.is_published = bool(data.get("is_published"))
        if lesson.is_published and not lesson.blocks:
            errors.setdefault("blocks", []).append("Add at least one block before you publish the lesson.")
        if errors:
            return fail("Some blocks need fixing. Nothing was saved.", errors=errors)
        lesson.save()
        message = "Lesson saved." + (" Students can see it now." if lesson.is_published else " It's still a draft.")
        return ok({"lesson": _lesson_full(lesson), "options": _options(level), "labels": B.LABELS, "message": message})
    return ok({"lesson": _lesson_full(lesson), "options": _options(level), "labels": B.LABELS})


# ---------------- students ----------------
def _visible_section(request, pk):
    sec = get_object_or_404(Section.objects.select_related("level"), pk=pk)
    user = request.user
    if not user.is_teacher and (not sec.is_visible or not user.can_see_level(sec.level)):
        raise Http404
    return sec


def _student_lessons(request, sec):
    qs = sec.lessons.all()
    return qs if request.user.is_teacher else qs.filter(is_published=True)


def _resolve(blocks, user):
    """Swap video and speaking ids for what the page shows; drop blocks the student can't open."""
    video_ids = [b["video_id"] for b in blocks if b["type"] == "video"]
    task_ids = [b["task_id"] for b in blocks if b["type"] == "speaking"]
    videos = {v.pk: v for v in services.visible_videos(user).filter(pk__in=video_ids)} if video_ids else {}
    tasks = {t.pk: t for t in SpeakingTask.objects.filter(pk__in=task_ids).select_related("level")} if task_ids else {}
    out = []
    for b in blocks:
        if b["type"] == "video":
            v = videos.get(b["video_id"])
            if v:
                out.append({**b, "video": s.video(v)})
        elif b["type"] == "speaking":
            t = tasks.get(b["task_id"])
            if t and user.can_see_level(t.level):
                out.append({**b, "task": {"title": t.title, "brief": t.brief, "level": t.level.code, "slug": t.slug,
                                          "part": t.get_part_display(), "minutes": t.minutes}})
        else:
            out.append(b)
    return out


@approved_required
@methods("GET")
def student_section(request, pk):
    sec = _visible_section(request, pk)
    lessons = list(_student_lessons(request, sec))
    done = {p.lesson_id: p for p in LessonProgress.objects.filter(user=request.user, lesson__in=lessons)}
    rows = [{**_lesson_row(x), "done": x.pk in done,
             "score": done[x.pk].score if x.pk in done else None,
             "total": done[x.pk].total if x.pk in done else None} for x in lessons]
    return ok({"section": {"id": sec.pk, "title": sec.title, "description": sec.description, "icon": sec.icon,
                           "level": sec.level.code, **_section_extras(sec)}, "lessons": rows, "done": len(done)})


def _student_lesson(request, pk):
    lesson = get_object_or_404(Lesson.objects.select_related("section", "section__level"), pk=pk)
    _visible_section(request, lesson.section_id)
    if not lesson.is_published and not request.user.is_teacher:
        raise Http404
    return lesson


@approved_required
@methods("GET")
def student_lesson(request, pk):
    lesson = _student_lesson(request, pk)
    siblings = list(_student_lessons(request, lesson.section).only("pk", "title"))
    ids = [x.pk for x in siblings]
    i = ids.index(lesson.pk)
    progress = LessonProgress.objects.filter(user=request.user, lesson=lesson).first()
    return ok({
        "lesson": {"id": lesson.pk, "title": lesson.title, "is_published": lesson.is_published,
                   "blocks": _resolve(lesson.blocks, request.user), "exercises": B.exercise_count(lesson.blocks),
                   "position": i + 1, "count": len(ids)},
        "section": {"id": lesson.section.pk, "title": lesson.section.title, "level": lesson.section.level.code},
        "previous": {"id": siblings[i - 1].pk, "title": siblings[i - 1].title} if i > 0 else None,
        "next": {"id": siblings[i + 1].pk, "title": siblings[i + 1].title} if i + 1 < len(ids) else None,
        "progress": {"done_at": progress.done_at, "score": progress.score, "total": progress.total} if progress else None,
    })


@approved_required
@methods("POST", "DELETE")
def lesson_done(request, pk):
    """POST {score}: mark the lesson done, keeping the best score. DELETE: not done after all."""
    lesson = _student_lesson(request, pk)
    if request.method == "DELETE":
        LessonProgress.objects.filter(user=request.user, lesson=lesson).delete()
        return ok({"progress": None, "message": "Marked as not done."})
    total = B.exercise_count(lesson.blocks)
    try:
        score = max(0, min(int(body(request).get("score") or 0), total))
    except (TypeError, ValueError):
        return fail("The score must be a number.")
    progress, created = LessonProgress.objects.get_or_create(
        user=request.user, lesson=lesson, defaults={"score": score, "total": total})
    if not created:
        progress.score = max(progress.score, score) if progress.total == total else score
        progress.total, progress.done_at = total, timezone.now()
        progress.save()
    return ok({"progress": {"done_at": progress.done_at, "score": progress.score, "total": progress.total},
               "message": "Lesson done. Well done!"})
