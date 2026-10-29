"""Ready-made lessons the website installs for the teacher, based on the course book
"A Concrete Guide to German A1" (Decode German, used with permission).

install_alphabet() adds the section "Basics of A1" with three lessons (the alphabet, the
sounds, practice) and the speaking task "Wie schreibt man das?". It runs once from a
migration and can be run again with `python manage.py add_alphabet_lessons`; it never
changes or duplicates a section that already exists.
"""

SECTION_TITLE = "Basics of A1"
TASK_SLUG = "wie-schreibt-man-das"

LETTERS = [
    ("A", "ah"), ("B", "beh"), ("C", "tseh"), ("D", "deh"), ("E", "eh"), ("F", "eff"), ("G", "geh"),
    ("H", "hah"), ("I", "ih"), ("J", "yott"), ("K", "kah"), ("L", "ell"), ("M", "emm"), ("N", "enn"),
    ("O", "oh"), ("P", "peh"), ("Q", "kuh"), ("R", "err"), ("S", "ess"), ("T", "teh"), ("U", "uh"),
    ("V", "fau"), ("W", "weh"), ("X", "iks"), ("Y", "ypsilon"), ("Z", "tsett"),
]


def _rows(rows):
    return [{"label": label, "rule": rule, "words": words} for label, rule, words in rows]


LESSON_ALPHABET = [
    {"type": "text", "heading": "",
     "body": "There are 30 letters in German: the 26 letters you already know, three umlaut letters "
             "(**ä, ö, ü**) and the special letter **ß**. Tap a letter to hear it."},
    {"type": "tiles", "heading": "The 26 letters", "intro": "",
     "items": [{"big": u, "small": said, "say": u, "note": ""} for u, said in LETTERS]},
    {"type": "tiles", "heading": "Umlaut letters and ß",
     "intro": "The two dots change the sound. ß only comes after a long vowel or ei, au, eu.",
     "items": [
         {"big": "Ä", "small": "eh-umlaut", "say": "ä. spät", "note": "spät"},
         {"big": "Ö", "small": "oh-umlaut", "say": "ö. hören", "note": "hören"},
         {"big": "Ü", "small": "uh-umlaut", "say": "ü. über", "note": "über"},
         {"big": "ß", "small": "ess-tsett", "say": "ß. heißen", "note": "heißen"},
     ]},
    {"type": "tip", "heading": "Watch out",
     "body": "**B, C, D, E, G, P, T** end in an “ee” sound in English, but an “ay” sound in German: "
             "B = beh, E = eh, G = geh.\n\nEnglish speakers often mix up **E** (eh) and **I** (ih), "
             "**J** (yott) and **Y** (ypsilon), **V** (fau) and **W** (weh)."},
    {"type": "spell_demo", "heading": "Spelling: das Buchstabieren",
     "intro": "On the phone, at a hotel or at the doctor's, people will ask: **„Wie schreibt man das?“** "
              "(How do you write that?). Then you say each letter. Try it with your own name.",
     "word": "MARIA"},
]

LESSON_SOUNDS = [
    {"type": "text", "heading": "",
     "body": "German is read almost exactly as it is written. Learn these rules once and you can read "
             "any new word aloud. Tap a word to hear it."},
    {"type": "sounds", "heading": "Long and short vowels",
     "intro": "Before one consonant a vowel is usually long; before two consonants it is short. "
              "A vowel followed by h, or a double vowel (ee, aa), is long too.",
     "rows": _rows([
         ("a", "long like “father” · short and quick", ["tragen", "alt"]),
         ("e", "long like “hey” · short like “bed” · at the end a soft “uh”", ["sehr", "essen", "Name"]),
         ("i", "long like “see” · short like “it”", ["gib", "Kind"]),
         ("o", "long like “go” · short like “pot”", ["oder", "soll"]),
         ("u", "long like “food” · short like “put”", ["gut", "Fluss"]),
     ])},
    {"type": "sounds", "heading": "Vowel pairs",
     "intro": "Two vowels together make one sound. ei and ie are the pair everyone mixes up: say the second letter.",
     "rows": _rows([
         ("ei", "like English “eye”", ["heißen", "drei"]),
         ("ie", "like English “see” (vier sounds like “fee-a”)", ["spielen", "vier"]),
         ("eu · äu", "like English “boy”", ["Leute", "Häuser"]),
         ("au", "like English “how”", ["August", "Haus"]),
     ])},
    {"type": "sounds", "heading": "Consonants that sound different",
     "intro": "These letters don't sound the way an English speaker expects.",
     "rows": _rows([
         ("w", "like English “v”", ["Wasser", "wohnen"]),
         ("v", "like English “f”", ["Vater", "Volkswagen"]),
         ("j", "like English “y”", ["Japan", "ja"]),
         ("z", "always “ts”, at the start too", ["zehn", "dreizehn"]),
         ("s", "before a vowel like English “z”", ["soll", "Sonne"]),
         ("y", "like ü", ["Typ"]),
         ("h", "spoken at the start · silent after a vowel", ["hören", "gehen"]),
     ])},
    {"type": "sounds", "heading": "Hard at the end",
     "intro": "At the end of a word or syllable, b, d and g lose their voice.",
     "rows": _rows([
         ("b", "sounds like p", ["gib", "halb"]),
         ("d", "sounds like t", ["Mund", "Kind"]),
         ("g", "sounds like k", ["klug", "Tag"]),
         ("-ig", "sounds like the ch in ich", ["richtig", "zwanzig"]),
     ])},
    {"type": "sounds", "heading": "r, ch and sch",
     "intro": "The German r is made at the back of the throat; ch has a soft and a rough version.",
     "rows": _rows([
         ("r", "at the start or after a consonant: a throaty r", ["rot", "Frau"]),
         ("-r", "after a vowel at the end: a soft “uh”", ["Wasser", "Bar"]),
         ("ch", "after e, i, ä, ö, ü or a consonant: soft, like a whispered “h” in “huge”", ["ich", "Milch", "Bücher"]),
         ("ch", "after a, o, u, au: rough, at the back of the throat", ["machen", "Buch", "Koch"]),
         ("chs", "sounds like ks", ["sechs", "wachsen"]),
         ("sch", "like English “sh”", ["Schule", "schön"]),
         ("sp · st", "at the start of a word: “shp”, “sht”", ["Sport", "Straße"]),
     ])},
]


def _lesson_practice(task_id):
    blocks = [
        {"type": "choice", "heading": "Which letter do you hear?", "items": [
            {"prompt": "", "say": "E", "options": ["E", "I", "A"], "answer": 0, "explain": "E is said “eh”, I is said “ih”."},
            {"prompt": "", "say": "W", "options": ["V", "W", "F"], "answer": 1, "explain": "W is said “weh”, V is said “fau”."},
            {"prompt": "", "say": "J", "options": ["Y", "G", "J"], "answer": 2, "explain": "J is said “yott”, G is said “geh”."},
            {"prompt": "", "say": "Z", "options": ["C", "S", "Z"], "answer": 2, "explain": "Z is said “tsett”, C is said “tseh”."},
            {"prompt": "", "say": "I", "options": ["E", "I", "Ü"], "answer": 1, "explain": "I is said “ih”, like the i in “see”."},
        ]},
        {"type": "spell_word", "heading": "Listen to the spelling, write the word",
         "items": [{"word": w} for w in ["Haus", "Buch", "Vater", "Zug"]]},
        {"type": "gap", "heading": "ei or ie?", "intro": "Listen, then choose the missing letters. Remember: say the second letter.",
         "choices": ["ei", "ie"], "items": [
             {"text": "sp_len", "answer": "ie"}, {"text": "h_ßen", "answer": "ei"}, {"text": "v_r", "answer": "ie"},
             {"text": "dr_", "answer": "ei"}, {"text": "L_be", "answer": "ie"}, {"text": "Z_t", "answer": "ei"},
         ]},
        {"type": "spell_name", "heading": "Spell your own name"},
    ]
    if task_id:
        blocks.append({"type": "speaking", "heading": "Now say it to your teacher", "task_id": task_id})
    return blocks


def install_alphabet(Level, Section, Lesson, SpeakingTask, SpeakingLine):
    """Pass the models (from a migration's `apps` or the real ones). Returns True if it added anything."""
    level = Level.objects.filter(code="A1").first()
    if level is None or Section.objects.filter(level=level, title=SECTION_TITLE).exists():
        return False

    task = SpeakingTask.objects.filter(level=level, slug=TASK_SLUG).first()
    if task is None:
        task = SpeakingTask.objects.create(
            level=level, part="teil1", slug=TASK_SLUG, title="Wie schreibt man das?",
            brief="Say your name, then spell it letter by letter.",
            prompt="Stellen Sie sich vor. Sagen Sie Ihren Namen und buchstabieren Sie ihn.",
            minutes=1,
            model_answer="Guten Tag! Ich heiße Maria Lopez. Ich buchstabiere: M – A – R – I – A, "
                         "L – O – P – E – Z.",
            order=0,
        )
        for n, text in enumerate(["Wie heißen Sie?", "Wie schreibt man das?"], 1):
            SpeakingLine.objects.create(task=task, kind="question", text=text, order=n)
        for n, text in enumerate(["Ich heiße …", "Ich buchstabiere: …", "Mein Vorname ist … Mein Nachname ist …"], 1):
            SpeakingLine.objects.create(task=task, kind="phrase", text=text, order=n)

    order = (max(Section.objects.filter(level=level).values_list("order", flat=True), default=0) or 0) + 1
    section = Section.objects.create(level=level, title=SECTION_TITLE, icon="star", order=order,
                                     description="The first things every beginner needs.")
    for n, (title, blocks) in enumerate([
        ("Das Alphabet", LESSON_ALPHABET),
        ("Die Klänge", LESSON_SOUNDS),
        ("Practise the alphabet", _lesson_practice(task.pk)),
    ], 1):
        Lesson.objects.create(section=section, title=title, blocks=blocks, is_published=True, order=n)
    return True
