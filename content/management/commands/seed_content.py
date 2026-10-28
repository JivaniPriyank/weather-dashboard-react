"""Load the starter content (merged from the original German Lab app).

Safe to run more than once: existing items are updated, nothing is duplicated,
and nothing the teacher added later is deleted.
"""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from content.models import (
    GrammarExample, GrammarTopic, Level, QuizOption, QuizQuestion, SpeakingLine, SpeakingTask, Topic,
    VocabularyItem,
)


class Command(BaseCommand):
    help = "Load or refresh the starter vocabulary, quiz, speaking and grammar content."

    def add_arguments(self, parser):
        parser.add_argument("--file", default=str(Path(settings.BASE_DIR) / "fixtures" / "content.json"))

    @transaction.atomic
    def handle(self, *args, file, **options):
        data = json.loads(Path(file).read_text(encoding="utf-8"))
        levels = {}
        for lv in data["levels"]:
            levels[lv["code"]], _ = Level.objects.update_or_create(
                code=lv["code"], defaults={"name": lv["name"], "order": lv["order"]}
            )

        words = 0
        for t in data["topics"]:
            topic, _ = Topic.objects.update_or_create(
                level=levels[t["level"]], name=t["name"],
                defaults={"description": t["description"], "order": t["order"]},
            )
            for i, w in enumerate(t["items"], start=1):
                VocabularyItem.objects.update_or_create(
                    topic=topic, article=w["article"], german=w["german"],
                    defaults={"english": w["english"], "example": w["example"], "order": i},
                )
                words += 1

        grammar = {}
        for g in data["grammar"]:
            topic, _ = GrammarTopic.objects.update_or_create(
                level=levels[g["level"]], title=g["title"],
                defaults={"rule": g["rule"], "table": g["table"], "order": g["order"]},
            )
            grammar[g["title"]] = topic
            topic.examples.all().delete()
            GrammarExample.objects.bulk_create(
                GrammarExample(topic=topic, german=e["de"], english=e["en"], order=i)
                for i, e in enumerate(g["examples"], start=1)
            )

        for q in data["questions"]:
            question, _ = QuizQuestion.objects.update_or_create(
                level=levels[q["level"]], prompt=q["prompt"],
                defaults={
                    "kind": q["kind"], "explanation": q["explanation"], "order": q["order"],
                    "grammar_topic": grammar.get(q["grammar_topic"]),
                    "accepted_answers": q.get("accepted_answers", ""),
                },
            )
            question.options.all().delete()
            QuizOption.objects.bulk_create(
                QuizOption(question=question, text=o["text"], is_correct=o["is_correct"], order=i)
                for i, o in enumerate(q.get("options", []), start=1)
            )

        for s in data["speaking"]:
            task, _ = SpeakingTask.objects.update_or_create(
                level=levels[s["level"]], title=s["title"],
                defaults={k: s[k] for k in ("part", "brief", "prompt", "minutes", "model_answer", "order")},
            )
            task.lines.all().delete()
            SpeakingLine.objects.bulk_create(
                [SpeakingLine(task=task, kind="question", text=t, order=i) for i, t in enumerate(s["questions"], 1)]
                + [SpeakingLine(task=task, kind="phrase", text=t, order=i) for i, t in enumerate(s["phrases"], 1)]
            )

        self.stdout.write(self.style.SUCCESS(
            f"Loaded {len(levels)} levels, {len(data['topics'])} word decks ({words} words), "
            f"{len(data['grammar'])} grammar topics, {len(data['questions'])} quiz questions, "
            f"{len(data['speaking'])} speaking tasks."
        ))
