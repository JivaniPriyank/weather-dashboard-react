"""Serve a private file (video or audio) with support for seeking (HTTP Range requests)."""
import mimetypes
import os
import re

from django.http import FileResponse, Http404, HttpResponse, StreamingHttpResponse

_RANGE = re.compile(r"bytes=(\d*)-(\d*)$")


def _chunks(handle, remaining, size=64 * 1024):
    with handle:
        while remaining > 0:
            chunk = handle.read(min(size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def ranged_file_response(request, field_file, content_type=None):
    try:
        path = field_file.path
        size = os.path.getsize(path)
    except (FileNotFoundError, NotImplementedError, ValueError):
        raise Http404("The file is missing.")
    content_type = content_type or mimetypes.guess_type(path)[0] or "application/octet-stream"
    match = _RANGE.match(request.headers.get("Range", "").strip())
    if not match or match.groups() == ("", ""):
        response = FileResponse(open(path, "rb"), content_type=content_type)
    else:
        start_s, end_s = match.groups()
        if start_s:
            start, end = int(start_s), min(int(end_s) if end_s else size - 1, size - 1)
        else:  # suffix range: the last N bytes
            start, end = max(size - int(end_s), 0), size - 1
        if start > end or start >= size:
            response = HttpResponse(status=416)
            response["Content-Range"] = f"bytes */{size}"
            return response
        handle = open(path, "rb")
        handle.seek(start)
        length = end - start + 1
        response = StreamingHttpResponse(_chunks(handle, length), status=206, content_type=content_type)
        response["Content-Length"] = str(length)
        response["Content-Range"] = f"bytes {start}-{end}/{size}"
    response["Accept-Ranges"] = "bytes"
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
