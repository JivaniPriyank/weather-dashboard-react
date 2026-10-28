"""Turn a YouTube or Vimeo page link into a privacy-friendly embed URL."""
import re
from urllib.parse import parse_qs, urlparse

_YT_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")


def embed_url(url):
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return ""
    host = (parsed.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    video_id = ""
    if host in {"youtube.com", "youtube-nocookie.com"}:
        if parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [""])[0]
        elif parsed.path.startswith(("/embed/", "/shorts/", "/live/")):
            video_id = parsed.path.split("/")[2]
    elif host == "youtu.be":
        video_id = parsed.path.lstrip("/").split("/")[0]
    if video_id:
        return f"https://www.youtube-nocookie.com/embed/{video_id}" if _YT_ID.match(video_id) else ""
    if host in {"vimeo.com", "player.vimeo.com"}:
        numbers = [part for part in parsed.path.split("/") if part.isdigit()]
        if numbers:
            return f"https://player.vimeo.com/video/{numbers[0]}"
    return ""
