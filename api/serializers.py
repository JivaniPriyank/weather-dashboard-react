"""Turn database objects into plain dictionaries for the React frontend.

Quiz answers are never included here: correctness is only revealed after a
student answers (see api.views_student.attempt_answer).
"""
from django.conf import settings
from django.urls import reverse


def dt(value):
    return value.isoformat() if value else None


def level(lv):
    return {"code": lv.code, "name": lv.name} if lv else None


def user(u):
    return {
        "id": u.pk, "email": u.email, "full_name": u.full_name, "first_name": u.first_name_display,
        "role": u.role, "is_teacher": u.is_teacher, "status": u.access_status,
        "classroom": {"id": u.classroom_id, "name": u.classroom.name} if u.classroom_id else None,
        "is_admin": u.is_staff,
        "level": level(u.level) if u.level_id else None,
    }


def topic(t, stats=None):
    data = {"level": t.level.code, "slug": t.slug, "name": t.name, "description": t.description}
    if stats is not None:
        data["stats"] = stats
    return data


def word(item, review=None):
    return {
        "id": item.pk, "article": item.article, "german": item.german, "english": item.english,
        "example": item.example, "display": item.display,
        "box": review.box if review else None,
    }


def grammar_topic(g, full=False):
    data = {"level": g.level.code, "slug": g.slug, "title": g.title, "summary": g.rule[:140]}
    if full:
        data.update({
            "rule": g.rule, "table": g.table or None,
            "examples": [{"german": e.german, "english": e.english} for e in g.examples.all()],
        })
    return data


def attempt_summary(a):
    return {
        "id": a.pk, "title": a.title, "level": a.level.code, "topic_id": a.grammar_topic_id, "kind": a.kind,
        "score": a.score, "total": a.total, "percent": a.percent,
        "finished_at": dt(a.finished_at), "started_at": dt(a.started_at),
    }


def speaking_task(t, submission=None, practised=False):
    data = {
        "level": t.level.code, "slug": t.slug, "title": t.title, "part": t.part, "part_label": t.get_part_display(),
        "brief": t.brief, "minutes": t.minutes, "practised": practised,
    }
    if submission is not None:
        data["submission"] = {
            "sent": True, "reviewed": submission.is_reviewed,
            "total_score": submission.total_score, "max_score": submission.max_score,
        }
    return data


def submission(s, for_teacher=False):
    data = {
        "id": s.pk, "submitted_at": dt(s.submitted_at), "reviewed": s.is_reviewed, "reviewed_at": dt(s.reviewed_at),
        "has_audio": s.has_audio,
        "audio_url": reverse("api:speaking_audio", args=[s.pk]) if s.has_audio else None,
        "audio_deleted_at": dt(s.audio_deleted_at), "audio_delete_on": dt(s.audio_delete_on),
        "total_score": s.total_score, "max_score": s.max_score,
        "scores": [{"field": f, "label": label, "value": getattr(s, f)} for f, label in s.CRITERIA],
        "feedback": s.feedback if (s.is_reviewed or for_teacher) else "",
        "keep_days": settings.SPEAKING_KEEP_DAYS_AFTER_FEEDBACK,
    }
    if for_teacher:
        data["student"] = {"id": s.user_id, "full_name": s.user.full_name, "first_name": s.user.first_name_display,
                           "classroom": s.user.classroom.name if s.user.classroom_id else None}
        data["task"] = speaking_task(s.task)
    return data


def video(v, watched=False, full=False):
    data = {
        "id": v.pk, "title": v.title, "level": v.level.code if v.level_id else None,
        "grammar_topic": {"level": v.grammar_topic.level.code, "slug": v.grammar_topic.slug, "title": v.grammar_topic.title}
        if v.grammar_topic_id else None,
        "classroom": v.classroom.name if v.classroom_id else None,
        "is_published": v.is_published, "kind": "file" if v.file else "link", "watched": watched,
        "created_at": dt(v.created_at),
    }
    if full:
        data.update({
            "description": v.description,
            "stream_url": reverse("api:video_stream", args=[v.pk]) if v.file else None,
            "embed_url": v.embed_url or None,
        })
    return data
