"""Sign in, sign out, request access, password reset and account settings."""
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm, PasswordResetForm, SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from django.views.decorators.csrf import ensure_csrf_cookie

from django.conf import settings

from accounts.forms import ProfileForm, RegisterForm
from accounts.models import AccessRequest
from content.models import Level, QuizQuestion, SpeakingTask, VocabularyItem
from learning.models import SpeakingSubmission
from learning.services import current_level

from . import serializers as s
from . import throttle
from .utils import body, fail, form_errors, login_required, methods, ok

User = get_user_model()


def session_payload(request):
    u = request.user
    levels = [s.level(lv) for lv in Level.objects.filter(is_active=True)]
    if not u.is_authenticated:
        return {"user": None, "levels": levels, "current_level": None, "counts": {}}
    levels = [s.level(lv) for lv in u.allowed_levels()]  # a student only gets the levels they may open
    counts = {}
    if u.is_teacher:
        counts = {
            "pending_requests": AccessRequest.objects.filter(status=AccessRequest.Status.PENDING).count(),
            "speaking_waiting": SpeakingSubmission.objects.filter(reviewed_at__isnull=True).count(),
        }
    from .views_sections import menu_sections

    return {"user": s.user(u), "levels": levels, "current_level": s.level(current_level(u)), "counts": counts,
            "sections": menu_sections(u) if u.is_approved else []}


@ensure_csrf_cookie
@methods("GET")
def session(request):
    """Who is signed in. Also sets the CSRF cookie the frontend sends back on every change."""
    return ok(session_payload(request))


@methods("GET")
def landing(request):
    return ok({
        "words": VocabularyItem.objects.count(), "questions": QuizQuestion.objects.count(),
        "speaking": SpeakingTask.objects.count(),
        "levels": [s.level(lv) for lv in Level.objects.filter(is_active=True)],
    })


@methods("POST")
def sign_in(request):
    data = body(request)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not email or not password:
        return fail("Enter your email and password.")
    ip = throttle.client_ip(request)
    if (throttle.over("sign-in-email", email, settings.SIGN_IN_MAX_FAILURES_PER_EMAIL)
            or throttle.over("sign-in-ip", ip, settings.SIGN_IN_MAX_FAILURES_PER_IP)):
        return fail(throttle.wait_message("sign-in attempts") + " Forgot it? Reset your password.",
                    status=429, code="throttled")
    user = authenticate(request, username=email, password=password)
    if user is None:
        throttle.hit("sign-in-email", email)
        throttle.hit("sign-in-ip", ip)
        inactive = User.objects.filter(email__iexact=email, is_active=False).first()
        if inactive and inactive.check_password(password):
            return fail("This account has been switched off. Ask your teacher.")
        return fail("That email and password don't match an account. Check both and try again.")
    throttle.reset("sign-in-email", email)
    login(request, user)
    return ok(session_payload(request))


@methods("POST")
def sign_out(request):
    logout(request)
    return ok(session_payload(request))


@methods("POST")
def register(request):
    if request.user.is_authenticated:
        return fail("You're already signed in.")
    ip = throttle.client_ip(request)
    if throttle.over("register-ip", ip, settings.REGISTER_MAX_PER_IP):
        return fail(throttle.wait_message("accounts requested from this connection"), status=429, code="throttled")
    throttle.hit("register-ip", ip)
    form = RegisterForm(body(request))
    if not form.is_valid():
        return form_errors(form)
    user = form.save()
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return ok(session_payload(request), status=201)


@login_required
@methods("PATCH", "POST")
def me(request):
    form = ProfileForm(body(request), instance=request.user)
    if not form.is_valid():
        return form_errors(form)
    form.save()
    return ok(session_payload(request))


@login_required
@methods("POST")
def password_change(request):
    data = body(request)
    form = PasswordChangeForm(request.user, {
        "old_password": data.get("old_password", ""), "new_password1": data.get("new_password1", ""),
        "new_password2": data.get("new_password2", ""),
    })
    if not form.is_valid():
        return form_errors(form)
    form.save()
    update_session_auth_hash(request, form.user)
    return ok()


@methods("POST")
def password_reset(request):
    form = PasswordResetForm({"email": body(request).get("email", "")})
    if not form.is_valid():
        return form_errors(form)
    ip = throttle.client_ip(request)
    if throttle.over("reset-ip", ip, settings.PASSWORD_RESET_MAX_PER_IP):
        return fail(throttle.wait_message("password reset requests"), status=429, code="throttled")
    throttle.hit("reset-ip", ip)
    email = form.cleaned_data["email"].strip().lower()
    if throttle.hit("reset-email", email) > settings.PASSWORD_RESET_MAX_PER_EMAIL:
        return ok()  # enough emails sent to this address for now; same answer as always
    form.save(
        request=request, use_https=request.is_secure(),
        subject_template_name="accounts/email/password_reset_subject.txt",
        email_template_name="accounts/email/password_reset.txt",
    )
    return ok()  # the same answer whether or not the email exists


def _reset_user(uidb64, token):
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)))
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None
    return user if default_token_generator.check_token(user, token) else None


@methods("GET", "POST")
def password_reset_confirm(request, uidb64, token):
    user = _reset_user(uidb64, token)
    if request.method == "GET":
        return ok({"valid": user is not None})
    if user is None:
        return fail("This link has expired. Ask for a new one.", code="expired")
    data = body(request)
    form = SetPasswordForm(user, {"new_password1": data.get("new_password1", ""), "new_password2": data.get("new_password2", "")})
    if not form.is_valid():
        return form_errors(form)
    form.save()
    return ok()


@login_required
@methods("POST")
def set_level(request):
    lv = get_object_or_404(Level, code=body(request).get("level", ""), is_active=True)
    if not request.user.can_see_level(lv):
        return fail(f"{lv.code} isn't open for you yet. Your teacher decides when you move up.", status=403)
    request.user.current_level = lv
    request.user.save(update_fields=["current_level"])
    return ok(session_payload(request))
