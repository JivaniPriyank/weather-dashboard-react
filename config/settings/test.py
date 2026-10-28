"""Settings for the automated test suite."""
import tempfile

from .dev import *  # noqa: F401,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # fast, tests only
MEDIA_ROOT = tempfile.mkdtemp(prefix="germanlab-test-media-")
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
LOGGING = {"version": 1, "disable_existing_loggers": True}
