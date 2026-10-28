from django import forms
from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.forms import AuthenticationForm

from content.models import Level

from .models import AccessRequest, Classroom

User = get_user_model()


class EmailLoginForm(AuthenticationForm):
    username = forms.EmailField(label="Email", widget=forms.EmailInput(attrs={"autocomplete": "email", "autofocus": True}))
    error_messages = {
        "invalid_login": "That email and password don't match an account. Check both and try again.",
        "inactive": "This account has been switched off. Ask your teacher.",
    }

    def clean_username(self):
        return self.cleaned_data["username"].strip().lower()


class RegisterForm(forms.Form):
    full_name = forms.CharField(label="Your name", max_length=120, widget=forms.TextInput(attrs={"autocomplete": "name"}))
    email = forms.EmailField(label="Email", widget=forms.EmailInput(attrs={"autocomplete": "email"}))
    password1 = forms.CharField(
        label="Password", strip=False, widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        help_text="At least 8 characters, not only numbers.",
    )
    password2 = forms.CharField(
        label="Password again", strip=False, widget=forms.PasswordInput(attrs={"autocomplete": "new-password"})
    )
    level = forms.ModelChoiceField(
        label="Your German level", queryset=Level.objects.filter(is_active=True), to_field_name="code",
        error_messages={"required": "Choose your level.", "invalid_choice": "Choose your level."},
    )
    note = forms.CharField(
        label="Message to your teacher (optional)", max_length=300, required=False,
        widget=forms.TextInput(attrs={"placeholder": "e.g. I'm in the Tuesday A1 class"}),
    )

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("There's already an account with this email. Sign in instead.")
        return email

    def clean(self):
        data = super().clean()
        p1, p2 = data.get("password1"), data.get("password2")
        if p1 and p2 and p1 != p2:
            self.add_error("password2", "The two passwords don't match.")
        elif p1:
            try:
                password_validation.validate_password(p1, User(email=data.get("email", ""), full_name=data.get("full_name", "")))
            except forms.ValidationError as exc:
                self.add_error("password1", exc)
        return data

    def save(self):
        d = self.cleaned_data
        user = User.objects.create_user(email=d["email"], password=d["password1"], full_name=d["full_name"].strip(),
                                        level=d["level"], current_level=d["level"])
        AccessRequest.objects.create(user=user, note=d["note"].strip())
        return user


class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["full_name"]
        labels = {"full_name": "Your name"}


def check_class_level(form, level, classroom):
    """A student can only be in a class of their own level."""
    if not classroom:
        return
    if not classroom.level_id:
        form.add_error("classroom", f"“{classroom.name}” has no level yet. Give the class a level first.")
    elif level is None:
        form.add_error("classroom", "Choose the student's level first, then a class of that level.")
    elif classroom.level_id != level.pk:
        form.add_error("classroom", f"“{classroom.name}” is a {classroom.level.code} class, but the student is {level.code}.")


class DecisionForm(forms.Form):
    decision = forms.ChoiceField(choices=[("approved", "Approve"), ("rejected", "Decline")])
    level = forms.ModelChoiceField(queryset=Level.objects.filter(is_active=True), required=False, to_field_name="code")
    classroom = forms.ModelChoiceField(queryset=Classroom.objects.select_related("level"), required=False, empty_label="No class")

    def __init__(self, *args, student=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.student = student

    def clean(self):
        data = super().clean()
        if data.get("decision") == "approved":
            level = data.get("level") or (self.student.level if self.student else None)
            if level is None:
                self.add_error("level", "Choose the student's level before approving.")
            data["level"] = level
            check_class_level(self, level, data.get("classroom"))
        return data


class ClassroomForm(forms.ModelForm):
    class Meta:
        model = Classroom
        fields = ["name", "level", "description"]
        labels = {"name": "Class name", "level": "Level", "description": "Description (optional)"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["level"].required = True
        self.fields["level"].queryset = Level.objects.filter(is_active=True)
        self.fields["level"].to_field_name = "code"
        self.fields["level"].error_messages["required"] = "Choose the level of this class."

    def clean_level(self):
        level = self.cleaned_data["level"]
        if self.instance.pk and level:
            others = self.instance.students.exclude(level=level).count()
            if others:
                raise forms.ValidationError(
                    f"{others} student{'s' if others != 1 else ''} in this class {'are' if others != 1 else 'is'} not {level.code}. "
                    "Move them to another class first.")
        return level


class StudentForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["full_name", "level", "classroom", "is_active"]
        labels = {"full_name": "Name", "level": "Level", "is_active": "Account can sign in"}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["level"].queryset = Level.objects.filter(is_active=True)
        self.fields["level"].to_field_name = "code"
        self.fields["classroom"].queryset = Classroom.objects.select_related("level")

    def clean(self):
        data = super().clean()
        check_class_level(self, data.get("level"), data.get("classroom"))
        return data

    def save(self, commit=True):
        user = super().save(commit=False)
        if "level" in self.changed_data and user.level_id:
            user.current_level = user.level  # moved to a new course: open it straight away
        if commit:
            user.save()
        return user
