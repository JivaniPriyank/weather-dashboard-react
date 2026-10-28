"""Production: every secret must come from the environment."""
from .base import *  # noqa: F401,F403
from .base import MIDDLEWARE, env, env_bool, env_list

DEBUG = False
SECRET_KEY = env("DJANGO_SECRET_KEY", required=True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

# Security headers on every response (config/security.py), including static files.
# WhiteNoise serves CSS/JS without a separate web server.
MIDDLEWARE = [MIDDLEWARE[0], "config.security.SecurityHeadersMiddleware",
              "whitenoise.middleware.WhiteNoiseMiddleware", *MIDDLEWARE[1:]]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

SESSION_COOKIE_SECURE = env_bool("DJANGO_SECURE_COOKIES", True)
CSRF_COOKIE_SECURE = env_bool("DJANGO_SECURE_COOKIES", True)
SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = int(env("DJANGO_HSTS_SECONDS", "0"))
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# Where the browser may load things from. Styles allow 'unsafe-inline' for the
# Django admin's inline style attributes; scripts never run inline.
CONTENT_SECURITY_POLICY = env("DJANGO_CONTENT_SECURITY_POLICY", "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
]))
