"""Small helpers shared by all API views: JSON in/out, errors and access rules."""
import json
from functools import wraps

from django.http import JsonResponse


def ok(data=None, status=200):
    return JsonResponse(data if data is not None else {"ok": True}, status=status, safe=False)


def fail(message, status=400, **extra):
    return JsonResponse({"error": message, **extra}, status=status)


def form_errors(form, message="Some details need fixing."):
    errors = {field: [str(e) for e in errs] for field, errs in form.errors.items()}
    return JsonResponse({"error": message, "errors": errors}, status=400)


def body(request):
    """The request data, whether sent as JSON or as a form (file uploads)."""
    if request.content_type and request.content_type.startswith("application/json"):
        try:
            data = json.loads(request.body or b"{}")
        except ValueError:
            return {}
        return data if isinstance(data, dict) else {}
    return request.POST


def methods(*allowed):
    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in allowed:
                return fail(f"Use {' or '.join(allowed)} for this address.", status=405)
            return view(request, *args, **kwargs)

        return wrapper

    return decorator


def login_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return fail("Sign in first.", status=401, code="not_signed_in")
        return view(request, *args, **kwargs)

    return wrapper


def approved_required(view):
    """Signed in and approved by the teacher (the teacher always passes)."""

    @login_required
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_approved:
            return fail("Your teacher hasn't approved your account yet.", status=403, code="not_approved")
        return view(request, *args, **kwargs)

    return wrapper


def teacher_required(view):
    @login_required
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_teacher:
            return fail("This is for the teacher only.", status=403, code="not_teacher")
        return view(request, *args, **kwargs)

    return wrapper


def page_info(page):
    return {"number": page.number, "pages": page.paginator.num_pages, "count": page.paginator.count,
            "has_next": page.has_next(), "has_previous": page.has_previous()}
