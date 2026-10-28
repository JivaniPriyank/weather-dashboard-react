from django import forms

from content.models import Video
from learning.models import SpeakingSubmission


class VideoForm(forms.ModelForm):
    source = forms.ChoiceField(
        choices=[("file", "Upload a video file"), ("link", "Paste a YouTube or Vimeo link")],
        widget=forms.RadioSelect, initial="file", label="Where is the video?",
    )

    class Meta:
        model = Video
        fields = ["title", "description", "source", "file", "external_url", "level", "grammar_topic", "classroom", "is_published"]
        labels = {
            "external_url": "Video link", "grammar_topic": "Grammar topic (optional)", "level": "Level",
            "classroom": "Only for this class", "is_published": "Students can see this video",
            "description": "What's in the video (optional)",
        }
        help_texts = {"file": "MP4 or WebM works in every browser."}
        widgets = {"description": forms.Textarea(attrs={"rows": 3})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._old_file = self.instance.file.name if self.instance.pk and self.instance.file else ""
        if self.instance.pk:
            self.fields["source"].initial = "link" if self.instance.external_url else "file"
        self.fields["file"].widget.attrs["accept"] = "video/mp4,video/webm,video/quicktime,.m4v"
        self.fields["classroom"].empty_label = "Every student"
        self.fields["level"].empty_label = "Choose a level"
        self.fields["level"].required = True  # students only see videos of their own level
        self.fields["level"].error_messages["required"] = "Choose the level of this video."
        self.fields["grammar_topic"].empty_label = "None"

    def clean(self):
        data = super().clean()
        level, classroom = data.get("level"), data.get("classroom")
        if level and classroom and classroom.level_id != level.pk:
            self.add_error("classroom", f"“{classroom.name}” is {classroom.level.code if classroom.level_id else 'without a level'}, "
                                        f"but this video is {level.code}. Choose an {level.code} class.")
        grammar = data.get("grammar_topic")
        if level and grammar and grammar.level_id != level.pk:
            self.add_error("grammar_topic", f"Choose a grammar topic from {level.code}.")
        if data.get("source") == "link":
            data["file"] = None
            self.instance.file = ""  # switching from an upload to a link; old file removed on save
            if not data.get("external_url"):
                self.add_error("external_url", "Paste the YouTube or Vimeo link.")
        else:
            data["external_url"] = ""
            if not data.get("file") and not self.instance.file:
                self.add_error("file", "Choose a video file to upload.")
        return data

    def save(self, commit=True):
        video = super().save(commit=False)
        if self.cleaned_data.get("source") == "link":
            video.file = ""
        if commit:
            video.save()
            # A replaced or removed upload would otherwise stay on disk.
            if self._old_file and self._old_file != video.file.name:
                video.file.storage.delete(self._old_file)
        return video


class FeedbackForm(forms.ModelForm):
    """The teacher's scores (1–5 for each area) and written feedback on a speaking answer."""

    SCORE_CHOICES = [(i, str(i)) for i in range(1, 6)]

    class Meta:
        model = SpeakingSubmission
        fields = ["score_task", "score_vocabulary", "score_grammar", "score_pronunciation", "feedback"]
        widgets = {"feedback": forms.Textarea(attrs={"rows": 5})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name, label in SpeakingSubmission.CRITERIA:
            self.fields[name] = forms.TypedChoiceField(
                label=label, choices=self.SCORE_CHOICES, coerce=int, widget=forms.RadioSelect,
                error_messages={"required": f"Give a score for {label.lower()}."},
            )
            if self.instance and getattr(self.instance, name) is not None:
                self.initial[name] = getattr(self.instance, name)
        self.fields["feedback"].required = True
        self.fields["feedback"].label = f"Feedback for {self.instance.user.first_name_display}"
        self.fields["feedback"].error_messages["required"] = "Write a few words of feedback."
