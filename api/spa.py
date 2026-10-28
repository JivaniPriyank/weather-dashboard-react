"""Serve the built React app for every page address that isn't the API or admin."""
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie

INDEX = Path(settings.BASE_DIR) / "static" / "app" / "index.html"


@ensure_csrf_cookie
def index(request, *args, **kwargs):
    try:
        html = INDEX.read_text(encoding="utf-8")
    except FileNotFoundError:
        return HttpResponse(
            "<h1>The German Lab: frontend not built yet</h1>"
            "<p>In the <code>frontend</code> folder run <code>npm install</code> and <code>npm run build</code>, "
            "then reload this page. (While developing you can also use <code>npm run dev</code> and open "
            "<a href='http://localhost:5173'>http://localhost:5173</a>.)</p>",
            status=503,
        )
    response = HttpResponse(html)
    response["Cache-Control"] = "no-cache"
    return response


def api_not_found(request, exception=None):
    if request.path.startswith("/api/"):
        return JsonResponse({"error": "Not found."}, status=404)
    return index(request)


def api_server_error(request):
    return JsonResponse({"error": "Something went wrong on our side. Try again in a moment."}, status=500)
