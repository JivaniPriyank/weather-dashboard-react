"""Limits on sign-in, registration and password-reset attempts, so passwords
can't be guessed and the reset email can't be used to flood someone's inbox.

Counters live in Django's cache. The default cache is per process, which is
enough for runserver and a single gunicorn worker; with several workers, set
up a shared cache (e.g. the database cache) so the limits are counted together."""
from django.conf import settings
from django.core.cache import cache


def client_ip(request):
    return request.META.get("REMOTE_ADDR", "") or "unknown"


def _key(scope, value):
    return f"throttle:{scope}:{str(value).lower()}"


def count(scope, value):
    return cache.get(_key(scope, value), 0)


def over(scope, value, limit):
    return count(scope, value) >= limit


def hit(scope, value, window=None):
    """Count one attempt. The counter starts its window with the first attempt."""
    key = _key(scope, value)
    if cache.add(key, 1, window or settings.THROTTLE_WINDOW_SECONDS):
        return 1
    try:
        return cache.incr(key)
    except ValueError:  # expired between add() and incr()
        cache.add(key, 1, window or settings.THROTTLE_WINDOW_SECONDS)
        return 1


def reset(scope, value):
    cache.delete(_key(scope, value))


def wait_message(action):
    minutes = max(1, settings.THROTTLE_WINDOW_SECONDS // 60)
    return f"Too many {action}. Wait {minutes} minutes and try again."
