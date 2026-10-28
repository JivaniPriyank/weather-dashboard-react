"""Settings shared by every environment.

Secrets and machine-specific values come from environment variables
(loaded from a local .env file if present). Never put real secrets here.
"""
import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def env(name, default=None, required=False):
    """Read a setting. An empty value (e.g. 'KEY=' in .env) counts as not set."""
    value = os.environ.get(name) or default
    if required and not value:
        raise ImproperlyConfigured(f"Set the {name} environment variable (see .env.example).")
    return value


def env_bool(name, default=False):
    return str(os.environ.get(name) or default).lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    return [item.strip() for item in (os.environ.get(name) or default).split(",") if item.strip()]


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts",
    "content",
    "learning",
    "dashboard",
    "api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Database: SQLite unless POSTGRES_DB is set.
if env("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB"),
            "USER": env("POSTGRES_USER", ""),
            "PASSWORD": env("POSTGRES_PASSWORD", ""),
            "HOST": env("POSTGRES_HOST", "localhost"),
            "PORT": env("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / env("SQLITE_NAME", "db.sqlite3"),
        }
    }

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LOGIN_URL = "/sign-in/"  # the React sign-in page (used by the admin's "view site" links)

LANGUAGE_CODE = "en"
TIME_ZONE = env("TIME_ZONE", "Europe/Berlin")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

# Uploaded videos. They are NOT served publicly: content.views.video_stream
# checks that the viewer is an approved student or the teacher first.
MEDIA_ROOT = Path(env("MEDIA_ROOT", BASE_DIR / "media"))
VIDEO_MAX_UPLOAD_MB = int(env("VIDEO_MAX_UPLOAD_MB", "500"))
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # bigger files stream to a temp file

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# No real email yet: messages (e.g. password reset links) are printed to the console.
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "The German Lab <noreply@localhost>")
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = int(env("EMAIL_PORT", "25"))
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "{asctime} {levelname} {name}: {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
    "loggers": {"django.server": {"level": "WARNING"}},
}

# Spaced repetition: days until a card is shown again, by box (1–5).
SRS_INTERVAL_DAYS = {1: 1, 2: 2, 3: 4, 4: 8, 5: 16}
SRS_NEW_CARDS_PER_SESSION = 10
SRS_SESSION_SIZE = 20

# Speaking answers: students send one recording per task; the teacher gives feedback.
SPEAKING_MAX_UPLOAD_MB = int(env("SPEAKING_MAX_UPLOAD_MB", "20"))
SPEAKING_MAX_RECORD_MINUTES = int(env("SPEAKING_MAX_RECORD_MINUTES", "10"))
# Recordings are deleted this many days after the teacher gives feedback (scores and text stay).
SPEAKING_KEEP_DAYS_AFTER_FEEDBACK = int(env("SPEAKING_KEEP_DAYS_AFTER_FEEDBACK", "3"))

# Set in prod.py; empty means no Content-Security-Policy header.
CONTENT_SECURITY_POLICY = ""

# Limits against password guessing and email flooding (see api/throttle.py).
# Counted per email address and per IP address within the window.
THROTTLE_WINDOW_SECONDS = int(env("THROTTLE_WINDOW_SECONDS", "900"))
SIGN_IN_MAX_FAILURES_PER_EMAIL = 5
SIGN_IN_MAX_FAILURES_PER_IP = 20
REGISTER_MAX_PER_IP = 10
PASSWORD_RESET_MAX_PER_EMAIL = 3
PASSWORD_RESET_MAX_PER_IP = 10
