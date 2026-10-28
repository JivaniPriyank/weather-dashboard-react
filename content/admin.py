"""The teacher edits all learning content here (/admin/)."""
from django.contrib import admin

from .models import (
    GrammarExample, GrammarTopic, Level, QuizOption, QuizQuestion, SpeakingLine, SpeakingTask, Topic,
    VocabularyItem, Video,
)

admin.site.site_header = "The German Lab: content"
admin.site.site_title = "The German Lab"
admin.site.index_title = "Edit words, questions, speaking tasks, grammar and videos"


@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "order", "is_active"]
    list_editable = ["order", "is_active"]


class VocabularyInline(admin.TabularInline):
    model = VocabularyItem
    extra = 3
    fields = ["order", "article", "german", "english", "example"]


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ["name", "level", "description", "word_count", "order"]
    list_filter = ["level"]
    list_editable = ["order"]
    search_fields = ["name"]
    exclude = ["slug"]
    inlines = [VocabularyInline]

    @admin.display(description="Words")
    def word_count(self, obj):
        return obj.items.count()


@admin.register(VocabularyItem)
class VocabularyItemAdmin(admin.ModelAdmin):
    list_display = ["display", "english", "topic"]
    list_filter = ["topic__level", "topic"]
    search_fields = ["german", "english", "example"]


class QuizOptionInline(admin.TabularInline):
    model = QuizOption
    extra = 4
    fields = ["order", "text", "is_correct"]


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    list_display = ["prompt", "level", "kind", "grammar_topic"]
    list_filter = ["level", "kind", "grammar_topic"]
    search_fields = ["prompt"]
    inlines = [QuizOptionInline]
    fields = ["level", "grammar_topic", "kind", "prompt", "accepted_answers", "explanation", "order"]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        q = form.instance
        if q.kind == QuizQuestion.Kind.CHOICE and q.options.filter(is_correct=True).count() != 1:
            self.message_user(
                request, f"“{q.prompt}” should have exactly one correct option ticked.", level="warning"
            )


class SpeakingLineInline(admin.TabularInline):
    model = SpeakingLine
    extra = 2
    fields = ["kind", "order", "text"]


@admin.register(SpeakingTask)
class SpeakingTaskAdmin(admin.ModelAdmin):
    list_display = ["title", "level", "part", "minutes", "order"]
    list_filter = ["level", "part"]
    list_editable = ["order"]
    exclude = ["slug"]
    inlines = [SpeakingLineInline]


class GrammarExampleInline(admin.TabularInline):
    model = GrammarExample
    extra = 2
    fields = ["order", "german", "english"]


@admin.register(GrammarTopic)
class GrammarTopicAdmin(admin.ModelAdmin):
    list_display = ["title", "level", "order"]
    list_filter = ["level"]
    list_editable = ["order"]
    exclude = ["slug"]
    inlines = [GrammarExampleInline]


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ["title", "level", "classroom", "is_published", "created_at"]
    list_filter = ["is_published", "level", "classroom"]
    search_fields = ["title", "description"]
