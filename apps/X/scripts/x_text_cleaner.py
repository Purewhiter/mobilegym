from __future__ import annotations

import re

MEDIA_TCO_SUFFIX_RE = re.compile(r"(?:\s*)https://t\.co/[A-Za-z0-9]+\s*$")


def strip_trailing_media_tco(content: str | None, has_media: bool) -> str:
    text = str(content or "")
    if not has_media or "https://t.co/" not in text:
        return text
    return MEDIA_TCO_SUFFIX_RE.sub("", text).rstrip()


def clean_post_content(content: str | None, image: str | None = None, video: str | None = None) -> str:
    return strip_trailing_media_tco(content, has_media=bool(image or video))
