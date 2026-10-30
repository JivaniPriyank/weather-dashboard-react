"""Dhruv's A1 course ("The German Lab by Sneha – A1 Grammar"), lesson by lesson, as sections
of the website. The source is the teacher's Google Drive (A1 / PDF / LektionNN_*.pdf).

Each lesson becomes one section with: its goals, its parts (lessons built from blocks),
its 20 new words (a word list in Words) and its homework. install() adds the lessons that
are not there yet and never changes a section that already exists, so it is safe to run
again (`python manage.py add_a1_course`).

Three mistakes in the slides are corrected here (see the project note "content-source"):
- L1: "schön" was an example of the soft ch-sound; it has none (sch). Milch is used instead.
- L1: final -e is a soft, short "uh", not "eh".
- L2: Exercise 1 no. 2, "3:15 = Es ist ___ nach drei": the answer is Viertel (fünf = 3:05).
"""

# ---------------------------------------------------------------- helpers
def text(body, heading=""):
    return {"type": "text", "heading": heading, "body": body}


def tip(body, heading="Watch out"):
    return {"type": "tip", "heading": heading, "body": body}


def table(headers, rows, heading=""):
    return {"type": "table", "heading": heading, "headers": headers, "rows": rows}


def words(items, heading=""):
    return {"type": "words", "heading": heading, "items": [{"german": g, "english": e} for g, e in items]}


def rules(rows, heading, intro=""):
    return {"type": "sounds", "heading": heading, "intro": intro,
            "rows": [{"label": label, "rule": rule, "words": ws} for label, rule, ws in rows]}


def mistakes(pairs, heading="Common mistakes"):
    return {"type": "mistakes", "heading": heading, "items": [{"wrong": w, "right": r} for w, r in pairs]}


def blanks(items, heading, intro=""):
    return {"type": "blanks", "heading": heading, "intro": intro,
            "items": [{"before": b, "after": a, "answer": ans} for b, a, ans in items]}


def choice(items, heading):
    return {"type": "choice", "heading": heading, "items": [
        {"prompt": i.get("prompt", ""), "say": i.get("say", ""), "clock": i.get("clock", ""),
         "options": i["options"], "answer": i["answer"], "explain": i.get("explain", "")} for i in items]}


# ---------------------------------------------------------------- Lektion 1
L1_LETTERS = [
    ("A", "Ah", "Apfel", "apple"), ("B", "Beh", "Banane", "banana"), ("C", "Tseh", "Café", "cafe"),
    ("D", "Deh", "Dach", "roof"), ("E", "Eh", "Elefant", "elephant"), ("F", "Ef", "Fenster", "window"),
    ("G", "Geh", "Garten", "garden"), ("H", "Ha", "Haus", "house"), ("I", "Ih", "Insel", "island"),
    ("J", "Yot", "Januar", "January"), ("K", "Kah", "Katze", "cat"), ("L", "El", "Lampe", "lamp"),
    ("M", "Em", "Mutter", "mother"), ("N", "En", "Nase", "nose"), ("O", "Oh", "Ozean", "ocean"),
    ("P", "Peh", "Party", "party"), ("Q", "Ku", "Quiz", "quiz"), ("R", "Er", "Rose", "rose"),
    ("S", "Es", "Sonne", "sun"), ("T", "Teh", "Tee", "tea"), ("U", "Uh", "Uhr", "watch/clock"),
    ("V", "Fau", "Vater", "father"), ("W", "Veh", "Wagen", "car"), ("X", "Iks", "Xylophon", "xylophone"),
    ("Y", "Ypsilon", "Yoga", "yoga"), ("Z", "Tset", "Zombie", "zombie"),
]

LEKTION_1 = {
    "title": "Lektion 1: Alphabet & Aussprache",
    "description": "The German alphabet, umlauts & pronunciation rules",
    "icon": "chat",
    "goals": [
        {"title": "The alphabet", "text": "Confidently name all 26 letters and their German pronunciation"},
        {"title": "Umlauts & ß", "text": "Correctly pronounce and recognize ä, ö, ü and ß"},
        {"title": "Pronunciation rules", "text": "Apply core rules for ei/ie, ch, s, e/en and g/ig"},
        {"title": "Reading words", "text": "Read common German words independently and correctly"},
    ],
    "words_topic": "Lektion 1 – Neue Wörter",
    "words": [
        ("der", "Apfel", "apple"), ("die", "Banane", "banana"), ("das", "Haus", "house"), ("das", "Buch", "book"),
        ("das", "Wasser", "water"), ("das", "Brot", "bread"), ("die", "Schule", "school"), ("der", "Freund", "friend"),
        ("die", "Familie", "family"), ("das", "Auto", "car"), ("die", "Straße", "street"), ("die", "Stadt", "city"),
        ("das", "Land", "country"), ("der", "Tag", "day"), ("die", "Nacht", "night"), ("die", "Woche", "week"),
        ("das", "Jahr", "year"), ("das", "Kind", "child"), ("die", "Frau", "woman"), ("der", "Mann", "man"),
    ],
    "homework": "1. Practice the alphabet: write out all 26 letters with their German pronunciation from memory.\n\n"
                "2. Apply the vocabulary: form 5 simple sentences using at least 5 of the new words "
                "(e.g. Apfel, Haus, Buch, Freund, Familie).",
    "lessons": [
        ("Das Alphabet", [
            text("Tap a letter to hear it. Under each letter: how it is said, and a word that starts with it."),
            {"type": "tiles", "heading": "A–Z", "intro": "",
             "items": [{"big": l, "small": said, "say": l, "note": f"{ex} – {en}"} for l, said, ex, en in L1_LETTERS]},
            rules([
                ("ä", "like 'e' in 'bed' (English)", ["Mädchen"]),
                ("ö", "say 'e', round your lips", ["schön"]),
                ("ü", "say 'i', round your lips", ["über"]),
                ("ß", "Eszett: a sharp, long 's' sound", ["groß", "Spaß"]),
            ], "Umlauts & ß", "Special characters in the German alphabet."),
            {"type": "spell_demo", "heading": "Spelling a word",
             "intro": "This is how you spell in German: say the name of each letter.", "word": "Haus"},
        ]),
        ("Aussprache-Regeln", [
            rules([
                ("ei · ai", "sounds like 'eye': a glide sound, like English 'eye'", ["vielleicht", "Ei"]),
                ("ie", "long 'ee' sound, like English 'see'", ["Liebe", "Sie"]),
                ("äu · eu", "sounds like 'oy', like English 'boy'", ["Häuser", "neu"]),
                ("au", "sounds like 'ow', like English 'how'", ["Bauch", "Haus"]),
            ], "Rule: diphthongs", "Double vowel sounds: how to pronounce letter combinations."),
            rules([
                ("ch", "soft 'ch' (Ich-sound) after i, e, ä, ö, ü or a consonant", ["ich", "echt", "Milch"]),
                ("ch", "hard 'ch' (Ach-sound) after a, o, u, au: deep in the throat", ["Buch", "machen", "Bauch"]),
            ], "Rule: 'ch'", "Two different pronunciations depending on context."),
            rules([
                ("s", "before a vowel (a, e, i, o, u, ä, ö, ü) it sounds like 'z'", ["sehen", "sagen", "Sonne"]),
                ("s", "otherwise a normal, sharp 's': at the end of a word or before a consonant", ["Haus", "ist"]),
            ], "Rule: 's'", "Pronunciation depends on position."),
            rules([
                ("-e", "a soft, short 'uh' sound at the end", ["Lage", "Name"]),
                ("-en", "unstressed 'en': about 80% of infinitive verbs end this way", ["spielen", "machen"]),
            ], "Rule: word endings '-e' / '-en'", "Very common in infinitive verbs."),
            rules([
                ("-g", "at the end: a soft 'k'", ["genug"]),
                ("-ig", "at the end: sounds like '-ich', don't say '-igg'", ["zwanzig", "langweilig", "traurig"]),
            ], "Rule: word endings '-g' / '-ig'", "They sound different at the end of a word than at the start."),
            words([
                ("Apfel", "apple · vowel start"), ("schön", "beautiful · umlaut ö"), ("vielleicht", "perhaps, maybe · ei sound"),
                ("Buch", "book · hard ch"), ("sehen", "to see · s like z"), ("zwanzig", "twenty · -ig like -ich"),
                ("spielen", "to play · -en ending"), ("Häuser", "houses · äu like oy"), ("groß", "big, tall · ß sharp s"),
                ("Haus", "house · au like ow"),
            ], "Examples: listen and say them out loud"),
        ]),
        ("Häufige Fehler", [
            mistakes([
                ("ich → a hard 'ick'", "ich → a soft 'ch', like the start of English 'hue'"),
                ("'-ig' pronounced like '-igg'", "'-ig' sounds like '-ich' (zwanzig)"),
                ("ü/ö pronounced like a plain u/o", "consciously round your lips for ü and ö"),
                ("'ei' as two separate sounds 'e-i'", "'ei' is a glide sound, like English 'eye'"),
            ], "Typical beginner mistakes in pronunciation"),
        ]),
        ("Übungen", [
            blanks([
                ("Schön has the umlaut", ".", "ö"),
                ("Infinitive verbs mostly end in", ".", "-en|en"),
                ("'Ei' sounds like the English word", ".", "eye"),
                ("When 's' is before a vowel, it sounds like", ".", "z"),
                ("'-ig' at the end of a word sounds like", ".", "-ich|ich"),
            ], "Exercise 1: fill in the blanks", "Fill in the blanks with the correct pronunciation term."),
            choice([
                {"prompt": "Haus", "say": "Haus", "options": ["au like 'ow'", "soft ch", "s like z", "-ig like -ich"], "answer": 0},
                {"prompt": "ich", "say": "ich", "options": ["hard ch", "soft ch", "-en ending", "au like 'ow'"], "answer": 1},
                {"prompt": "sehen", "say": "sehen", "options": ["s like z", "sharp s", "soft ch", "-ig like -ich"], "answer": 0},
                {"prompt": "spielen", "say": "spielen", "options": ["ei like 'eye'", "-en ending", "hard ch", "s like z"], "answer": 1},
                {"prompt": "zwanzig", "say": "zwanzig", "options": ["soft 'k'", "s like z", "-ig like -ich", "au like 'ow'"], "answer": 2},
            ], "Exercise 2: match each word to its rule"),
            choice([
                {"say": "E", "options": ["E", "I", "A"], "answer": 0, "explain": "E is said 'Eh', I is said 'Ih'."},
                {"say": "W", "options": ["V", "W", "F"], "answer": 1, "explain": "W is said 'Veh', V is said 'Fau'."},
                {"say": "J", "options": ["Y", "G", "J"], "answer": 2, "explain": "J is said 'Yot', G is said 'Geh'."},
                {"say": "Z", "options": ["C", "S", "Z"], "answer": 2, "explain": "Z is said 'Tset', C is said 'Tseh'."},
            ], "Which letter do you hear?"),
            {"type": "spell_word", "heading": "Hear the spelling, write the word",
             "items": [{"word": w} for w in ["Haus", "Buch", "Vater", "Katze"]]},
            {"type": "spell_name", "heading": "Spell your name in German"},
        ]),
    ],
}

# ---------------------------------------------------------------- Lektion 2
NUMBERS = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf",
           "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig"]

LEKTION_2 = {
    "title": "Lektion 2: Zahlen, Zeit, Tage, Monate",
    "description": "Cardinal & ordinal numbers, clock time, weekdays & months",
    "icon": "book",
    "goals": [
        {"title": "Numbers 0–100", "text": "Count and combine German numbers using the correct pattern"},
        {"title": "Ordinal numbers", "text": "Form ordinals like 'first', 'third', 'twentieth' correctly"},
        {"title": "Days & months", "text": "Name all weekdays and months confidently"},
        {"title": "Telling time", "text": "Tell time in both formal (Uhr) and informal (nach/vor/halb) styles"},
    ],
    "words_topic": "Lektion 2 – Neue Wörter",
    "words": [
        ("der", "Montag", "Monday"), ("der", "Dienstag", "Tuesday"), ("der", "Mittwoch", "Wednesday"),
        ("der", "Donnerstag", "Thursday"), ("der", "Freitag", "Friday"), ("der", "Samstag", "Saturday"),
        ("der", "Sonntag", "Sunday"), ("der", "Januar", "January"), ("der", "Juni", "June"), ("der", "Dezember", "December"),
        ("die", "Uhr", "clock / o'clock"), ("die", "Minute", "minute"), ("die", "Stunde", "hour"), ("", "heute", "today"),
        ("", "morgen", "tomorrow"), ("", "gestern", "yesterday"), ("das", "Datum", "date"), ("der", "Kalender", "calendar"),
        ("der", "Mittag", "noon"), ("die", "Mitternacht", "midnight"),
    ],
    "homework": "1. Practice numbers & time: write the numbers 10, 20, 30 … 100 in German, then practice saying "
                "5 random clock times out loud.\n\n"
                "2. Apply the vocabulary: write your weekly schedule (Monday–Sunday) with one activity per day, "
                "using at least 5 new words.",
    "lessons": [
        ("Zahlen 0–100", [
            text("The basic counting numbers: learn 0–20 first. Tap a number to hear it."),
            {"type": "tiles", "heading": "0–20", "intro": "",
             "items": [{"big": str(n), "small": w, "say": w, "note": ""} for n, w in enumerate(NUMBERS)]},
            text("**Rule:** ones + und + tens. 21 = ein + und + zwanzig = **einundzwanzig**. "
                 "Note that 'eins' drops the 's'.", "21–100: tens + ones, joined by 'und'"),
            table(["Tens", "", "Examples", ""], [
                ["20", "zwanzig", "21", "einundzwanzig"], ["30", "dreißig", "25", "fünfundzwanzig"],
                ["40", "vierzig", "34", "vierunddreißig"], ["50", "fünfzig", "47", "siebenundvierzig"],
                ["60", "sechzig", "58", "achtundfünfzig"], ["70", "siebzig", "69", "neunundsechzig"],
                ["80", "achtzig", "72", "zweiundsiebzig"], ["90", "neunzig", "83", "dreiundachtzig"],
                ["100", "hundert", "96", "sechsundneunzig"],
            ]),
            {"type": "number_builder", "heading": "Build a number"},
        ]),
        ("Ordinalzahlen", [
            text("1st, 2nd, 3rd … expressed in German.\n\n**Rule:** add **-te** for 1–19 (irregular: erste, "
                 "dritte, siebte, achte), add **-ste** for 20 and above."),
            table(["", "German", "", "German"], [
                ["1st", "erste", "9th", "neunte"], ["2nd", "zweite", "10th", "zehnte"],
                ["3rd", "dritte", "11th", "elfte"], ["4th", "vierte", "12th", "zwölfte"],
                ["5th", "fünfte", "20th", "zwanzigste"], ["6th", "sechste", "21st", "einundzwanzigste"],
                ["7th", "siebte", "30th", "dreißigste"], ["8th", "achte", "", ""],
            ], "Ordinal numbers"),
            words([("der dritte Mai", "the third of May"), ("der erste Januar", "the first of January")], "Dates"),
        ]),
        ("Wochentage und Monate", [
            words([("Montag", "Monday"), ("Dienstag", "Tuesday"), ("Mittwoch", "Wednesday"), ("Donnerstag", "Thursday"),
                   ("Freitag", "Friday"), ("Samstag", "Saturday"), ("Sonntag", "Sunday")], "Wochentage (days)"),
            words([("Januar", "January"), ("Februar", "February"), ("März", "March"), ("April", "April"),
                   ("Mai", "May"), ("Juni", "June"), ("Juli", "July"), ("August", "August"),
                   ("September", "September"), ("Oktober", "October"), ("November", "November"),
                   ("Dezember", "December")], "Monate (months)"),
        ]),
        ("Die Uhrzeit", [
            text("There are two ways to say the time: **formal** (Uhr, 24-hour clock) and **informal** "
                 "(nach, vor, Viertel, halb). Move the clock and listen to both."),
            {"type": "clock", "heading": "Try it"},
            words([("Es ist drei Uhr.", "It is 3:00."), ("Es ist zwölf Uhr (Mittag).", "It is 12:00 (noon)."),
                   ("Es ist vierzehn Uhr dreißig.", "It is 14:30."), ("Es ist Mitternacht.", "It is midnight.")],
                  "Formal: Es ist … Uhr"),
            table(["", "Meaning", "Example", ""], [
                ["nach", "after: minutes after the hour", "Es ist fünf nach drei.", "3:05"],
                ["vor", "before: minutes before the next hour", "Es ist zehn vor fünf.", "4:50"],
                ["Viertel", "quarter past / quarter to", "Es ist Viertel nach zwei.", "2:15"],
                ["", "", "Es ist Viertel vor sieben.", "6:45"],
                ["halb", "half (to the NEXT hour)", "Es ist halb sechs.", "5:30"],
            ], "Informal: the everyday way"),
            tip("**halb sechs** means half-way TO six: 5:30, not 6:30!"),
        ]),
        ("Häufige Fehler", [
            mistakes([
                ("Saying 'zwanzigeins' for 21", "einundzwanzig: the ones come first, joined by 'und'"),
                ("Keeping the 's' in 'einsundzwanzig'", "'ein' drops the 's' when combined: einundzwanzig"),
                ("Thinking 'halb sechs' means 6:30", "'halb sechs' means 5:30: half TO six"),
                ("Mixing up the '-te' and '-ste' endings", "1–19 use '-te', 20 and above use '-ste'"),
            ], "Typical beginner mistakes with numbers and time"),
            words([("einunddreißig", "thirty-one · tens + ones"), ("der dritte Mai", "the third of May · ordinal date"),
                   ("Es ist halb acht.", "It's 7:30 · informal time"), ("zweiundsiebzig", "seventy-two · tens + ones"),
                   ("Es ist Viertel vor neun.", "It's 8:45 · informal time"), ("vierzehn Uhr", "2:00 PM (14:00) · formal time")],
                  "Examples: listen and say them out loud"),
        ]),
        ("Übungen", [
            blanks([
                ("21 =", ".", "einundzwanzig"),
                ("3:15 = Es ist", "nach drei.", "Viertel"),
                ("The ordinal for '5th' is", ".", "fünfte"),
                ("Saturday in German is", ".", "Samstag"),
                ("5:30 = Es ist", "sechs.", "halb"),
            ], "Exercise 1: fill in the blanks", "Fill in the blanks with the correct German word."),
            {"type": "listen_type", "heading": "Hear the number, write it in digits", "intro": "",
             "items": [{"say": w, "answer": str(n)} for n, w in [(21, "einundzwanzig"), (34, "vierunddreißig"),
                       (47, "siebenundvierzig"), (72, "zweiundsiebzig"), (96, "sechsundneunzig")]]},
            choice([
                {"clock": "07:30", "options": ["Es ist halb sieben.", "Es ist halb acht.", "Es ist sieben Uhr halb."], "answer": 1},
                {"clock": "08:45", "options": ["Es ist Viertel nach neun.", "Es ist Viertel vor acht.", "Es ist Viertel vor neun."], "answer": 2},
                {"clock": "02:15", "options": ["Es ist Viertel nach zwei.", "Es ist Viertel vor zwei.", "Es ist halb drei."], "answer": 0},
                {"clock": "04:50", "options": ["Es ist zehn nach fünf.", "Es ist zehn vor fünf.", "Es ist zehn vor vier."], "answer": 1},
            ], "Wie spät ist es?"),
        ]),
    ],
}

COURSE = [LEKTION_1, LEKTION_2]


def install(Level, Section, Lesson, Topic, VocabularyItem, SpeakingTask=None):
    """Add the lessons of COURSE that aren't on the site yet. Returns the titles added."""
    from django.utils.text import slugify

    level = Level.objects.filter(code="A1").first()
    if level is None:
        return []
    added = []
    for n, data in enumerate(COURSE, 1):
        if Section.objects.filter(level=level, title=data["title"]).exists():
            continue
        topic = Topic.objects.filter(level=level, name=data["words_topic"]).first()
        if topic is None:
            slug, i = slugify(data["words_topic"])[:80], 2
            base = slug
            while Topic.objects.filter(level=level, slug=slug).exists():
                slug, i = f"{base}-{i}", i + 1
            topic = Topic.objects.create(level=level, name=data["words_topic"], slug=slug, order=100 + n,
                                         description=data["title"].split(": ", 1)[-1])
            for i, (article, german, english) in enumerate(data["words"], 1):
                VocabularyItem.objects.create(topic=topic, article=article, german=german, english=english, order=i)
        section = Section.objects.create(level=level, title=data["title"], description=data["description"],
                                         icon=data["icon"], goals=data["goals"], homework=data["homework"],
                                         topic=topic, order=n)
        for i, (title, blocks) in enumerate(data["lessons"], 1):
            blocks = [dict(b) for b in blocks]
            if SpeakingTask is not None and title == "Übungen" and n == 1:
                task = SpeakingTask.objects.filter(level=level, slug="wie-schreibt-man-das").first()
                if task:
                    blocks.append({"type": "speaking", "heading": "Now say it to your teacher", "task_id": task.pk})
            Lesson.objects.create(section=section, title=title, blocks=blocks, is_published=True, order=i)
        added.append(data["title"])
    # The earlier "Basics of A1" (from another book) is replaced by Lektion 1: hidden, not deleted.
    if added:
        Section.objects.filter(level=level, title="Basics of A1").update(is_visible=False, order=99)
    return added
