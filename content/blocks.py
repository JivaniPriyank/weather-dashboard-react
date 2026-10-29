"""The building blocks of a lesson in one of the teacher's sections.

A lesson stores its content as a list of blocks, e.g.
    [{"type": "text", "heading": "", "body": "There are 30 letters…"},
     {"type": "table", "headers": ["Letter", "Said"], "rows": [["A", "ah"]]},
     {"type": "choice", "items": [{"say": "E", "options": ["E", "I", "A"], "answer": 0}]}]

clean_blocks() checks every block on the server before it is saved, trims the text and
drops keys it doesn't know, so the student page only ever gets well-formed blocks.
"""

MAX_BLOCKS = 40
MAX_ITEMS = 60
TEXT = 300
LONG_TEXT = 5000

LABELS = {
    "text": "Text", "tip": "Tip box", "table": "Table", "words": "Word list", "tiles": "Sound tiles",
    "sounds": "Sound rules", "spell_demo": "Spelling example", "choice": "Choose the answer",
    "spell_word": "Hear the spelling, write the word", "gap": "Fill the gap", "video": "Video",
    "speaking": "Speaking task", "spell_name": "Spell your name",
}
# Blocks whose items the student answers: they make up the lesson's score.
EXERCISES = {"choice", "spell_word", "gap"}


class BlockError(Exception):
    pass


def _s(value, label, limit=TEXT, required=False):
    text = str(value if value is not None else "").strip()
    if required and not text:
        raise BlockError(f"{label} can't be empty.")
    if len(text) > limit:
        raise BlockError(f"{label} can be at most {limit} characters.")
    return text


def _list(value, label, required=True, limit=MAX_ITEMS):
    if not isinstance(value, list):
        value = []
    if required and not value:
        raise BlockError(f"Add at least one {label}.")
    if len(value) > limit:
        raise BlockError(f"At most {limit} {label}s in one block.")
    return value


def _strings(value, label, required=True, limit=MAX_ITEMS):
    items = [_s(v, label) for v in _list(value, label, required=False, limit=limit)]
    items = [v for v in items if v]
    if required and not items:
        raise BlockError(f"Add at least one {label}.")
    return items


def _dicts(value, label):
    return [v for v in _list(value, label) if isinstance(v, dict)] or _list([], label)


def _text(b):
    return {"body": _s(b.get("body"), "The text", LONG_TEXT, required=True)}


def _table(b):
    headers = [_s(h, "A column title", 80) for h in _list(b.get("headers"), "column", limit=8)]
    if not any(headers):
        raise BlockError("Give the table at least one column title.")
    rows = []
    for row in _list(b.get("rows"), "row"):
        cells = [_s(c, "A cell", 200) for c in (row if isinstance(row, list) else [])]
        cells = (cells + [""] * len(headers))[:len(headers)]
        if any(cells):
            rows.append(cells)
    if not rows:
        raise BlockError("Fill in at least one row.")
    return {"headers": headers, "rows": rows}


def _words(b):
    items = []
    for it in _dicts(b.get("items"), "word"):
        german = _s(it.get("german"), "A German word", 120)
        if german:
            items.append({"german": german, "english": _s(it.get("english"), "A meaning", 160)})
    if not items:
        raise BlockError("Add at least one word.")
    return {"items": items}


def _tiles(b):
    items = []
    for it in _dicts(b.get("items"), "tile"):
        big = _s(it.get("big"), "A tile's letter", 12)
        if big:
            items.append({"big": big, "small": _s(it.get("small"), "A tile's sound", 40),
                          "say": _s(it.get("say"), "What a tile says aloud", 120) or big,
                          "note": _s(it.get("note"), "A tile's example", 60)})
    if not items:
        raise BlockError("Add at least one tile.")
    return {"intro": _s(b.get("intro"), "The introduction", 600), "items": items}


def _sounds(b):
    rows = []
    for it in _dicts(b.get("rows"), "rule"):
        label = _s(it.get("label"), "A rule's letters", 20)
        rule = _s(it.get("rule"), "A rule", 200)
        if label or rule:
            if not label or not rule:
                raise BlockError("Every rule needs its letters and an explanation.")
            rows.append({"label": label, "rule": rule, "words": _strings(it.get("words"), "example word", required=False, limit=6)})
    if not rows:
        raise BlockError("Add at least one rule.")
    return {"intro": _s(b.get("intro"), "The introduction", 600), "rows": rows}


def _spell_demo(b):
    word = _s(b.get("word"), "The word to spell", 40, required=True)
    return {"word": word, "intro": _s(b.get("intro"), "The introduction", 600)}


def _choice(b):
    items = []
    for n, it in enumerate(_dicts(b.get("items"), "question"), 1):
        prompt = _s(it.get("prompt"), f"Question {n}", 300)
        say = _s(it.get("say"), f"What question {n} plays aloud", 120)
        if not prompt and not say:
            raise BlockError(f"Question {n} needs a question, something to play aloud, or both.")
        raw = _list(it.get("options"), "answer option", limit=6)
        options = [_s(o, "An answer", 200) for o in raw]
        if not all(options):
            raise BlockError(f"Question {n}: fill in every answer or remove the empty ones.")
        if len(options) < 2:
            raise BlockError(f"Question {n} needs at least two answers to choose from.")
        try:
            answer = int(it.get("answer"))
        except (TypeError, ValueError):
            answer = -1
        if not 0 <= answer < len(options):
            raise BlockError(f"Mark the right answer of question {n}.")
        items.append({"prompt": prompt, "say": say, "options": options, "answer": answer,
                      "explain": _s(it.get("explain"), f"The explanation of question {n}", 300)})
    return {"items": items}


def _spell_word(b):
    words = _strings([it.get("word") if isinstance(it, dict) else it for it in _list(b.get("items"), "word")], "word")
    for w in words:
        if len(w) > 30 or " " in w:
            raise BlockError(f"“{w}”: use single words of at most 30 letters.")
    return {"items": [{"word": w} for w in words]}


def _gap(b):
    choices = _strings(b.get("choices"), "choice", limit=4)
    if len(choices) < 2:
        raise BlockError("Give at least two choices, e.g. ei and ie.")
    items = []
    for it in _dicts(b.get("items"), "word"):
        text = _s(it.get("text"), "A word with a gap", 80)
        if not text:
            continue
        if text.count("_") != 1:
            raise BlockError(f"“{text}”: mark the gap with exactly one _ (e.g. sp_len).")
        answer = _s(it.get("answer"), "The right choice", 20)
        if answer not in choices:
            raise BlockError(f"“{text}”: choose which of {', '.join(choices)} is right.")
        items.append({"text": text, "answer": answer})
    if not items:
        raise BlockError("Add at least one word with a gap.")
    return {"intro": _s(b.get("intro"), "The introduction", 600), "choices": choices, "items": items}


def _ref(name):
    def clean(b):
        try:
            pk = int(b.get(name))
        except (TypeError, ValueError):
            raise BlockError(f"Choose a {LABELS['video' if name == 'video_id' else 'speaking'].lower()}.")
        return {name: pk}
    return clean


def _nothing(b):
    return {}


CLEANERS = {
    "text": _text, "tip": _text, "table": _table, "words": _words, "tiles": _tiles, "sounds": _sounds,
    "spell_demo": _spell_demo, "choice": _choice, "spell_word": _spell_word, "gap": _gap,
    "video": _ref("video_id"), "speaking": _ref("task_id"), "spell_name": _nothing,
}


def clean_blocks(raw):
    """Returns (blocks, errors). errors maps "block-<n>" (0-based) to a list of messages."""
    if not isinstance(raw, list):
        return [], {"blocks": ["The lesson content has the wrong shape."]}
    if len(raw) > MAX_BLOCKS:
        return [], {"blocks": [f"A lesson can have at most {MAX_BLOCKS} blocks. Split it into two lessons."]}
    blocks, errors = [], {}
    for n, b in enumerate(raw):
        kind = b.get("type") if isinstance(b, dict) else None
        if kind not in CLEANERS:
            errors[f"block-{n}"] = ["This kind of block doesn't exist."]
            continue
        try:
            heading = _s(b.get("heading"), "The heading", 120)
            blocks.append({"type": kind, "heading": heading, **CLEANERS[kind](b)})
        except BlockError as e:
            errors[f"block-{n}"] = [str(e)]
    return blocks, errors


def exercise_count(blocks):
    """How many answers the student gives in this lesson: the most they can score."""
    return sum(len(b.get("items", [])) for b in blocks if b.get("type") in EXERCISES)


def summary(blocks):
    """'Text · Table · Choose the answer': the kinds of blocks, for lists."""
    seen = []
    for b in blocks:
        label = LABELS.get(b.get("type"))
        if label and label not in seen:
            seen.append(label)
    return " · ".join(seen)
