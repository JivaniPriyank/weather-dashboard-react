"""Local development: debug on, SQLite, console email."""
from .base import *  # noqa: F401,F403
from .base import env, env_list

DEBUG = True
# A dev-only key is allowed so the project starts without setup. Production refuses it.
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,[::1]")
