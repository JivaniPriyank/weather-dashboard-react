"""Teacher-only API for editing learning content: word lists, quiz questions,
grammar topics and speaking tasks. It replaces the Django admin for everyday edits.

Every write is checked here on the server; the React screens only display
the messages that come back."""
import re

from django.db import transaction
from django.db.models import Count, Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify

from content.models import (
    GrammarExample, GrammarTopic, Level, QuizOption, QuizQuestion, SpeakingLine, SpeakingTask, Topic,
    VocabularyItem,
)
from learning.models import QuizAttempt

from .utils import body, fail, methods, ok, teacher_required

ARTICLES = {"der", "die", "das", ""}
MAX_TABLE_COLS = 8
MAX_TABLE_ROWS = 40
MAX_OPTIONS = 6
MAX_IMPORT_LINES = 200


# ---------------- small helpers ----------------
class Invalid(Exception):
    """Collects field errors so a view can answer with all of them at once."""

    def __init__(self, errors, message="Some details need fixing."):
        super().__init__(message)
        self.errors, self.message = errors, message

    def response(self):
        return fail(self.message, errors=self.errors)


def _text(data, key, label, max_len, required=True, errors=None):
    value = str(data.get(key) or "").strip()
    if required and not value:
        errors.setdefault(key, []).append(f"{label} can't be empty.")
    elif len(value) > max_len:
        errors.setdefault(key, []).append(f"{label} can be at most {max_len} characters.")
    return value


def _level(data, errors):
    code = str(data.get("level") or "").strip()
    level = Level.objects.filter(code=code).first()
    if level is None:
        errors.setdefault("level", []).append("Choose a level.")
    return level


def _unique_slug(model, level, source, exclude_pk=None):
    base = slugify(source)[:80] or "item"
    taken = set(model.objects.filter(level=level).exclude(pk=exclude_pk).values_list("slug", flat=True))
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    return slug


def _next_order(qs):
    return (qs.aggregate(m=Max("order"))["m"] or 0) + 1


def _list_of_strings(value):
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if str(v or "").strip()]


def _levels():
    return [{"code": lv.code, "name": lv.name} for lv in Level.objects.all()]


# ---------------- overview ----------------
@teacher_required
@methods("GET")
def home(request):
    level = Level.objects.filter(code=request.GET.get("level")).first() or Level.objects.first()
    if level is None:
        return ok({"levels": [], "level": None, "counts": {}, "topics": [], "questions": [], "grammar": [], "speaking": []})

    topics = level.topics.annotate(n=Count("items")).prefetch_related("items")
    questions = level.questions.select_related("grammar_topic")
    grammar = level.grammar_topics.annotate(n_q=Count("questions", distinct=True), n_ex=Count("examples", distinct=True))
    speaking = level.speaking_tasks.annotate(n=Count("lines"))
    return ok({
        "levels": _levels(),
        "level": {"code": level.code, "name": level.name},
        "counts": {
            "words": VocabularyItem.objects.filter(topic__level=level).count(),
            "quiz": questions.count(), "grammar": grammar.count(), "speaking": speaking.count(),
        },
        "topics": [{"id": t.pk, "name": t.name, "description": t.description, "count": t.n,
                    "preview": [{"article": w.article, "german": w.german} for w in list(t.items.all())[:3]]}
                   for t in topics],
        "questions": [{"id": q.pk, "kind": q.kind, "prompt": q.prompt,
                       "grammar_topic": q.grammar_topic.title if q.grammar_topic else ""} for q in questions],
        "grammar": [{"id": g.pk, "title": g.title, "questions": g.n_q, "examples": g.n_ex,
                     "has_table": bool(g.table and g.table.get("headers"))} for g in grammar],
        "speaking": [{"id": t.pk, "title": t.title, "part": t.part, "part_label": t.get_part_display(),
                      "minutes": t.minutes, "lines": t.n} for t in speaking],
    })


# ---------------- word lists ----------------
def _word(w):
    return {"id": w.pk, "article": w.article, "german": w.german, "english": w.english, "example": w.example}


def _topic(t):
    return {"id": t.pk, "level": t.level.code, "name": t.name, "description": t.description, "slug": t.slug,
            "words": [_word(w) for w in t.items.all()]}


def _topic_fields(data, errors):
    return {
        "level": _level(data, errors),
        "name": _text(data, "name", "The topic name", 80, errors=errors),
        "description": _text(data, "description", "The description", 200, required=False, errors=errors),
    }


@teacher_required
@methods("POST")
def topic_create(request):
    errors = {}
    fields = _topic_fields(body(request), errors)
    if errors:
        return Invalid(errors).response()
    t = Topic(**fields, order=_next_order(Topic.objects.filter(level=fields["level"])))
    t.slug = _unique_slug(Topic, t.level, t.name)
    t.save()
    return ok({"topic": _topic(t), "message": f"Topic “{t.name}” created. Now add its words."}, status=201)


@teacher_required
@methods("GET", "PATCH", "DELETE")
def topic_detail(request, pk):
    t = get_object_or_404(Topic.objects.select_related("level"), pk=pk)
    if request.method == "DELETE":
        name, n = t.name, t.items.count()
        t.delete()
        return ok({"message": f"Topic “{name}” and its {n} word{'s' if n != 1 else ''} deleted."})
    if request.method == "PATCH":
        errors = {}
        fields = _topic_fields(body(request), errors)
        if errors:
            return Invalid(errors).response()
        if fields["level"] != t.level:
            t.slug = _unique_slug(Topic, fields["level"], t.slug, exclude_pk=t.pk)
        for k, v in fields.items():
            setattr(t, k, v)
        t.save()
    return ok({"topic": _topic(t), "levels": _levels()})


def _word_fields(data, errors):
    article = str(data.get("article") or "").strip().lower()
    if article not in ARTICLES:
        errors.setdefault("article", []).append("Choose der, die, das or no article.")
    return {
        "article": article if article in ARTICLES else "",
        "german": _text(data, "german", "The German word", 120, errors=errors),
        "english": _text(data, "english", "The English meaning", 160, errors=errors),
        "example": _text(data, "example", "The example sentence", 240, required=False, errors=errors),
    }


def _duplicate(topic, article, german, exclude_pk=None):
    return topic.items.filter(article=article, german__iexact=german).exclude(pk=exclude_pk).exists()


@teacher_required
@methods("POST")
def word_create(request, pk):
    topic = get_object_or_404(Topic, pk=pk)
    errors = {}
    fields = _word_fields(body(request), errors)
    if not errors and _duplicate(topic, fields["article"], fields["german"]):
        errors["german"] = ["This word is already in the list."]
    if errors:
        return Invalid(errors).response()
    w = VocabularyItem.objects.create(topic=topic, order=_next_order(topic.items), **fields)
    return ok({"word": _word(w)}, status=201)


@teacher_required
@methods("PATCH", "DELETE")
def word_detail(request, pk):
    w = get_object_or_404(VocabularyItem.objects.select_related("topic"), pk=pk)
    if request.method == "DELETE":
        w.delete()
        return ok({"message": f"“{w.display}” deleted."})
    errors = {}
    fields = _word_fields(body(request), errors)
    if not errors and _duplicate(w.topic, fields["article"], fields["german"], exclude_pk=w.pk):
        errors["german"] = ["This word is already in the list."]
    if errors:
        return Invalid(errors).response()
    for k, v in fields.items():
        setattr(w, k, v)
    w.save()
    return ok({"word": _word(w)})


def parse_word_lines(text):
    """Turn pasted lines into words. Each line: article; word; meaning; example
    (semicolons or tabs). The article may be left out or written in front of the word."""
    words, errors = [], []
    lines = [ln for ln in str(text or "").splitlines()]
    if len([ln for ln in lines if ln.strip()]) > MAX_IMPORT_LINES:
        return [], [{"line": 0, "message": f"Add at most {MAX_IMPORT_LINES} words at a time."}]
    for number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        parts = [p.strip() for p in re.split(r"[;\t]", line)]
        article = ""
        if parts and parts[0].lower() in {"der", "die", "das", "-", "–"}:
            article = parts.pop(0).lower().strip("-–")
        elif parts:
            m = re.match(r"^(der|die|das)\s+(.+)$", parts[0], flags=re.I)
            if m:
                article, parts[0] = m.group(1).lower(), m.group(2).strip()
        parts += [""] * (3 - len(parts))
        german, english, example = parts[0], parts[1], "; ".join(p for p in parts[2:] if p)
        if not german or not english:
            errors.append({"line": number, "message": "Needs at least the German word and its meaning."})
        elif len(german) > 120 or len(english) > 160 or len(example) > 240:
            errors.append({"line": number, "message": "Too long. Keep the word short and the example to one sentence."})
        else:
            words.append({"line": number, "article": article, "german": german, "english": english, "example": example})
    return words, errors


@teacher_required
@methods("POST")
def words_import(request, pk):
    topic = get_object_or_404(Topic, pk=pk)
    words, errors = parse_word_lines(body(request).get("text"))
    seen = set()
    for w in words:
        key = (w["article"], w["german"].lower())
        if key in seen or _duplicate(topic, w["article"], w["german"]):
            errors.append({"line": w["line"], "message": f"“{(w['article'] + ' ' + w['german']).strip()}” is already in the list."})
        seen.add(key)
    if not words and not errors:
        return fail("Paste at least one word first.")
    if errors:
        errors.sort(key=lambda e: e["line"])
        return fail("Nothing was added yet. Fix these lines and try again.", lines=errors)
    order = _next_order(topic.items)
    with transaction.atomic():
        for i, w in enumerate(words):
            VocabularyItem.objects.create(topic=topic, order=order + i, article=w["article"], german=w["german"],
                                          english=w["english"], example=w["example"])
    n = len(words)
    return ok({"topic": _topic(topic), "message": f"{n} word{'s' if n != 1 else ''} added."}, status=201)


# ---------------- quiz questions ----------------
def _question(q):
    return {
        "id": q.pk, "level": q.level.code, "grammar_topic": q.grammar_topic_id, "kind": q.kind,
        "prompt": q.prompt, "explanation": q.explanation,
        "options": [{"id": o.pk, "text": o.text, "is_correct": o.is_correct} for o in q.options.all()],
        "answers": q.answers_list(),
    }


@teacher_required
@methods("GET")
def question_options(request):
    return ok({
        "levels": _levels(),
        "grammar_topics": [{"id": g.pk, "title": g.title, "level": g.level.code}
                           for g in GrammarTopic.objects.select_related("level")],
    })


def _question_fields(data, errors):
    level = _level(data, errors)
    kind = data.get("kind")
    if kind not in QuizQuestion.Kind.values:
        errors.setdefault("kind", []).append("Choose the kind of question.")
    topic = None
    if data.get("grammar_topic"):
        topic = GrammarTopic.objects.filter(pk=data.get("grammar_topic")).first()
        if topic is None or (level and topic.level_id != level.pk):
            errors.setdefault("grammar_topic", []).append("Choose a grammar topic from the same level.")
    fields = {
        "level": level, "kind": kind, "grammar_topic": topic,
        "prompt": _text(data, "prompt", "The question", 300, errors=errors),
        "explanation": _text(data, "explanation", "The explanation", 300, required=False, errors=errors),
    }
    options, answers = [], []
    if kind == QuizQuestion.Kind.CHOICE:
        raw = data.get("options") if isinstance(data.get("options"), list) else []
        for o in raw:
            if isinstance(o, dict) and str(o.get("text") or "").strip():
                options.append({"id": o.get("id"), "text": str(o["text"]).strip(), "is_correct": bool(o.get("is_correct"))})
        if len(options) < 2:
            errors.setdefault("options", []).append("Give at least two answers.")
        elif len(options) > MAX_OPTIONS:
            errors.setdefault("options", []).append(f"Give at most {MAX_OPTIONS} answers.")
        elif sum(o["is_correct"] for o in options) != 1:
            errors.setdefault("options", []).append("Mark exactly one answer as right.")
        elif any(len(o["text"]) > 200 for o in options):
            errors.setdefault("options", []).append("Each answer can be at most 200 characters.")
        elif len({o["text"].lower() for o in options}) != len(options):
            errors.setdefault("options", []).append("Two answers are the same.")
    elif kind == QuizQuestion.Kind.TYPED:
        answers = _list_of_strings(data.get("answers"))
        if not answers:
            errors.setdefault("answers", []).append("Add at least one accepted answer.")
        elif any("|" in a for a in answers):
            errors.setdefault("answers", []).append("Answers can't contain the | character.")
        elif len("|".join(answers)) > 300:
            errors.setdefault("answers", []).append("The accepted answers are too long together.")
    return fields, options, answers


@transaction.atomic
def _save_question(q, fields, options, answers):
    for k, v in fields.items():
        setattr(q, k, v)
    q.accepted_answers = "|".join(answers) if q.kind == QuizQuestion.Kind.TYPED else ""
    if q.pk is None:
        q.order = _next_order(QuizQuestion.objects.filter(level=q.level))
    q.save()
    if q.kind == QuizQuestion.Kind.TYPED:
        q.options.all().delete()
        return
    existing = {o.pk: o for o in q.options.all()}
    keep = set()
    for i, o in enumerate(options):
        opt = existing.get(o["id"]) if isinstance(o["id"], int) else None
        if opt is None:
            opt = QuizOption(question=q)
        opt.text, opt.is_correct, opt.order = o["text"], o["is_correct"], i
        opt.save()
        keep.add(opt.pk)
    q.options.exclude(pk__in=keep).delete()


@teacher_required
@methods("POST")
def question_create(request):
    errors = {}
    fields, options, answers = _question_fields(body(request), errors)
    if errors:
        return Invalid(errors).response()
    q = QuizQuestion()
    _save_question(q, fields, options, answers)
    return ok({"question": _question(q), "message": "Question saved."}, status=201)


@teacher_required
@methods("GET", "PUT", "DELETE")
def question_detail(request, pk):
    q = get_object_or_404(QuizQuestion.objects.select_related("level"), pk=pk)
    if request.method == "DELETE":
        # Take it out of quizzes students are still in the middle of, so they can carry on.
        for att in QuizAttempt.objects.filter(finished_at__isnull=True):
            if q.pk in att.question_ids:
                att.question_ids = [i for i in att.question_ids if i != q.pk]
                if not att.question_ids:
                    att.delete()
                    continue
                if att.next_question_id() is None:
                    att.finished_at = timezone.now()
                att.save(update_fields=["question_ids", "finished_at"])
        q.delete()
        return ok({"message": "Question deleted."})
    if request.method == "PUT":
        errors = {}
        fields, options, answers = _question_fields(body(request), errors)
        if errors:
            return Invalid(errors).response()
        _save_question(q, fields, options, answers)
        return ok({"question": _question(q), "message": "Question saved."})
    return ok({"question": _question(q)})


# ---------------- grammar topics ----------------
def _grammar(g):
    table = g.table if g.table and g.table.get("headers") else {"headers": [], "rows": []}
    return {"id": g.pk, "level": g.level.code, "slug": g.slug, "title": g.title, "rule": g.rule, "table": table,
            "examples": [{"german": e.german, "english": e.english} for e in g.examples.all()],
            "questions": g.questions.count()}


def _grammar_fields(data, errors):
    fields = {
        "level": _level(data, errors),
        "title": _text(data, "title", "The title", 120, errors=errors),
        "rule": _text(data, "rule", "The rule", 4000, errors=errors),
    }
    raw = data.get("table") if isinstance(data.get("table"), dict) else {}
    headers = [str(h or "").strip()[:60] for h in raw.get("headers", [])] if isinstance(raw.get("headers"), list) else []
    rows = raw.get("rows") if isinstance(raw.get("rows"), list) else []
    rows = [[str(c or "").strip()[:80] for c in r] for r in rows if isinstance(r, list)]
    rows = [r for r in rows if any(r)]  # drop rows left completely empty
    if headers and not any(headers):
        headers = []
    if len(headers) > MAX_TABLE_COLS:
        errors.setdefault("table", []).append(f"A table can have at most {MAX_TABLE_COLS} columns.")
    elif len(rows) > MAX_TABLE_ROWS:
        errors.setdefault("table", []).append(f"A table can have at most {MAX_TABLE_ROWS} rows.")
    elif rows and not headers:
        errors.setdefault("table", []).append("Give the table a heading row.")
    elif any(len(r) != len(headers) for r in rows):
        errors.setdefault("table", []).append("Every row needs one cell per column.")
    fields["table"] = {"headers": headers, "rows": rows} if headers else {}

    examples = []
    for e in data.get("examples") if isinstance(data.get("examples"), list) else []:
        if not isinstance(e, dict):
            continue
        de, en = str(e.get("german") or "").strip(), str(e.get("english") or "").strip()
        if not de and not en:
            continue
        if not de or not en:
            errors.setdefault("examples", []).append("Each example needs the German sentence and its translation.")
            break
        if len(de) > 240 or len(en) > 240:
            errors.setdefault("examples", []).append("Examples can be at most 240 characters.")
            break
        examples.append((de, en))
    return fields, examples


@transaction.atomic
def _save_grammar(g, fields, examples):
    if g.pk is None or fields["level"] != g.level:
        g.slug = _unique_slug(GrammarTopic, fields["level"], fields["title"] if g.pk is None else g.slug, exclude_pk=g.pk)
    if g.pk is None:
        g.order = _next_order(GrammarTopic.objects.filter(level=fields["level"]))
    for k, v in fields.items():
        setattr(g, k, v)
    g.save()
    g.examples.all().delete()
    GrammarExample.objects.bulk_create([GrammarExample(topic=g, german=de, english=en, order=i)
                                        for i, (de, en) in enumerate(examples)])


@teacher_required
@methods("POST")
def grammar_create(request):
    errors = {}
    fields, examples = _grammar_fields(body(request), errors)
    if errors:
        return Invalid(errors).response()
    g = GrammarTopic()
    _save_grammar(g, fields, examples)
    return ok({"topic": _grammar(g), "message": "Grammar topic saved."}, status=201)


@teacher_required
@methods("GET", "PUT", "DELETE")
def grammar_detail(request, pk):
    g = get_object_or_404(GrammarTopic.objects.select_related("level"), pk=pk)
    if request.method == "DELETE":
        title = g.title
        g.delete()
        return ok({"message": f"“{title}” deleted. Its quiz questions are kept, without a grammar topic."})
    if request.method == "PUT":
        errors = {}
        fields, examples = _grammar_fields(body(request), errors)
        if errors:
            return Invalid(errors).response()
        _save_grammar(g, fields, examples)
        return ok({"topic": _grammar(g), "message": "Grammar topic saved."})
    return ok({"topic": _grammar(g)})


# ---------------- speaking tasks ----------------
def _speaking(t):
    lines = list(t.lines.all())
    return {
        "id": t.pk, "level": t.level.code, "slug": t.slug, "part": t.part, "title": t.title, "brief": t.brief,
        "prompt": t.prompt, "minutes": t.minutes, "model_answer": t.model_answer,
        "questions": [ln.text for ln in lines if ln.kind == SpeakingLine.Kind.QUESTION],
        "phrases": [ln.text for ln in lines if ln.kind == SpeakingLine.Kind.PHRASE],
        "submissions": t.submissions.count(),
    }


def _speaking_fields(data, errors):
    part = data.get("part")
    if part not in SpeakingTask.Part.values:
        errors.setdefault("part", []).append("Choose the exam part.")
    try:
        minutes = int(data.get("minutes"))
    except (TypeError, ValueError):
        minutes = 0
    if not 1 <= minutes <= 15:
        errors.setdefault("minutes", []).append("Choose between 1 and 15 minutes.")
    lines = {}
    for key, label in (("questions", "Questions"), ("phrases", "Phrases")):
        lines[key] = _list_of_strings(data.get(key))
        if any(len(x) > 200 for x in lines[key]):
            errors.setdefault(key, []).append(f"{label} can be at most 200 characters each.")
        if len(lines[key]) > 30:
            errors.setdefault(key, []).append(f"Add at most 30 {label.lower()}.")
    fields = {
        "level": _level(data, errors), "part": part, "minutes": minutes,
        "title": _text(data, "title", "The title", 120, errors=errors),
        "brief": _text(data, "brief", "What the student has to do", 240, errors=errors),
        "prompt": _text(data, "prompt", "The exam task", 4000, errors=errors),
        "model_answer": _text(data, "model_answer", "The model answer", 6000, errors=errors),
    }
    return fields, lines


@transaction.atomic
def _save_speaking(t, fields, lines):
    if t.pk is None or fields["level"] != t.level:
        t.slug = _unique_slug(SpeakingTask, fields["level"], fields["title"] if t.pk is None else t.slug, exclude_pk=t.pk)
    if t.pk is None:
        t.order = _next_order(SpeakingTask.objects.filter(level=fields["level"]))
    for k, v in fields.items():
        setattr(t, k, v)
    t.save()
    t.lines.all().delete()
    SpeakingLine.objects.bulk_create(
        [SpeakingLine(task=t, kind=SpeakingLine.Kind.QUESTION, text=x, order=i) for i, x in enumerate(lines["questions"])]
        + [SpeakingLine(task=t, kind=SpeakingLine.Kind.PHRASE, text=x, order=i) for i, x in enumerate(lines["phrases"])]
    )


@teacher_required
@methods("POST")
def speaking_create(request):
    errors = {}
    fields, lines = _speaking_fields(body(request), errors)
    if errors:
        return Invalid(errors).response()
    t = SpeakingTask()
    _save_speaking(t, fields, lines)
    return ok({"task": _speaking(t), "message": "Speaking task saved."}, status=201)


@teacher_required
@methods("GET", "PUT", "DELETE")
def speaking_detail(request, pk):
    t = get_object_or_404(SpeakingTask.objects.select_related("level"), pk=pk)
    if request.method == "DELETE":
        title, n = t.title, t.submissions.count()
        t.delete()  # recordings are removed from disk by the post_delete signal
        extra = f" {n} student answer{'s' if n != 1 else ''} deleted with it." if n else ""
        return ok({"message": f"“{title}” deleted.{extra}"})
    if request.method == "PUT":
        errors = {}
        fields, lines = _speaking_fields(body(request), errors)
        if errors:
            return Invalid(errors).response()
        _save_speaking(t, fields, lines)
        return ok({"task": _speaking(t), "message": "Speaking task saved."})
    return ok({"task": _speaking(t)})


@teacher_required
@methods("GET")
def speaking_options(request):
    return ok({"levels": _levels(), "parts": [{"value": v, "label": label} for v, label in SpeakingTask.Part.choices]})
