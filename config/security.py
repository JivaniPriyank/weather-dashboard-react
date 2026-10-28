"""Extra security headers for production (see config/settings/prod.py)."""
from django.conf import settings


class SecurityHeadersMiddleware:
    """Content-Security-Policy: the browser only runs scripts, fonts and media from
    this website, and only embeds YouTube (no-cookie) and Vimeo videos.
    Permissions-Policy: the microphone (speaking answers) is the only device the site uses."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if settings.CONTENT_SECURITY_POLICY:
            response.headers.setdefault("Content-Security-Policy", settings.CONTENT_SECURITY_POLICY)
        response.headers.setdefault("Permissions-Policy", "microphone=(self), camera=(), geolocation=(), payment=()")
        return response
