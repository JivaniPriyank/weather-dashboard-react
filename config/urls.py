from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import TemplateView

from api import spa

admin.site.site_url = "/"

urlpatterns = [
    path("api/", include("api.urls")),
    path("admin/", admin.site.urls),
    path("manifest.webmanifest", TemplateView.as_view(template_name="pwa/manifest.webmanifest",
                                                      content_type="application/manifest+json"), name="manifest"),
    path("sw.js", TemplateView.as_view(template_name="pwa/sw.js", content_type="text/javascript"), name="sw"),
    # Every other address is a page of the React app.
    re_path(r"^(?!api/|admin/|static/|media/).*$", spa.index, name="spa"),
]

handler404 = "api.spa.api_not_found"
handler500 = "api.spa.api_server_error"
