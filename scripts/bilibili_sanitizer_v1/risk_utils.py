#!/usr/bin/env python3
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"https?://[^\s\"'<>]+|www\.[^\s\"'<>]+")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
HANDLE_RE = re.compile(r"(?i)(?:微信|vx|v信|商务|合作|邮箱|email|qq|微博|公众号|B站|b站|UID|uid)[:：\s]*[A-Za-z0-9_.@-]{3,}")
LATIN_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_.-]{2,}")
LATIN_STOPLIST = {
    "http",
    "https",
    "www",
    "com",
    "cn",
    "bfs",
    "face",
    "archive",
    "jpg",
    "png",
    "webp",
    "bilibili",
}


def compact_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def unique(items: list[str], limit: int = 100) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        item = compact_text(item)
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
        if len(out) >= limit:
            break
    return out


def split_searchable_phrases(text: str, max_items: int = 16) -> list[str]:
    text = compact_text(text)
    if not text:
        return []
    pieces = re.split(r"[，。！？；、,.!?;\n\r]+", text)
    phrases = [p.strip() for p in pieces if len(p.strip()) >= 6]
    if len(text) >= 10:
        phrases.insert(0, text[:40])
    return unique(phrases, max_items)


def extract_sensitive_candidates(*texts: str) -> list[str]:
    candidates: list[str] = []
    for text in texts:
        text = compact_text(text)
        if not text:
            continue
        for regex in (EMAIL_RE, URL_RE, PHONE_RE, HANDLE_RE):
            candidates.extend(match.group(0) for match in regex.finditer(text))
        scrubbed = EMAIL_RE.sub(" ", URL_RE.sub(" ", text))
        for match in LATIN_TOKEN_RE.finditer(scrubbed):
            token = match.group(0)
            if token.lower() not in LATIN_STOPLIST:
                candidates.append(token)
    return unique(candidates)


def user_risk_context(user: dict[str, Any]) -> dict[str, Any]:
    name = compact_text(user.get("name", ""))
    sign = compact_text(user.get("sign", ""))
    official = user.get("official") or {}
    title = compact_text(official.get("title", ""))
    live_room = user.get("live_room") or {}
    texts = [name, sign, title, compact_text(live_room.get("title", "")), compact_text(live_room.get("url", ""))]
    forbidden = [name, title]
    forbidden.extend(split_searchable_phrases(sign, 12))
    forbidden.extend(split_searchable_phrases(live_room.get("title", ""), 4))
    forbidden.extend(extract_sensitive_candidates(*texts))
    return {
        "originalName": name,
        "originalSign": sign,
        "originalOfficialTitle": title,
        "forbiddenTerms": unique(forbidden, 80),
        "contactCandidates": extract_sensitive_candidates(*texts),
    }


def video_risk_context(video: dict[str, Any], tags: list[str] | None = None) -> dict[str, Any]:
    title = compact_text(video.get("title", ""))
    author = compact_text(video.get("author", ""))
    tags = [compact_text(t) for t in (tags or []) if compact_text(t)]
    forbidden = [author]
    forbidden.extend(split_searchable_phrases(title, 12))
    forbidden.extend(tags)
    forbidden.extend(extract_sensitive_candidates(title, author, " ".join(tags)))
    return {
        "originalTitle": title,
        "originalAuthor": author,
        "originalTags": tags,
        "forbiddenTerms": unique(forbidden, 120),
        "contactCandidates": extract_sensitive_candidates(title, author, " ".join(tags)),
    }


def comment_risk_context(video_title: str, comments: list[dict[str, Any]]) -> dict[str, Any]:
    forbidden: list[str] = []
    texts = [video_title]
    for comment in comments:
        uname = compact_text(comment.get("uname", ""))
        message = compact_text(comment.get("message", ""))
        forbidden.append(uname)
        forbidden.extend(split_searchable_phrases(message, 4))
        texts.extend([uname, message])
    forbidden.extend(extract_sensitive_candidates(*texts))
    return {
        "videoTitle": compact_text(video_title),
        "forbiddenTerms": unique(forbidden, 160),
        "contactCandidates": extract_sensitive_candidates(*texts),
    }


def similarity(a: str, b: str) -> float:
    a = compact_text(a)
    b = compact_text(b)
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def contained_forbidden_terms(text: str, forbidden_terms: list[str]) -> list[str]:
    text = compact_text(text).lower()
    hits: list[str] = []
    for term in forbidden_terms:
        term = compact_text(term)
        if len(term) < 3:
            continue
        if term.lower() in text:
            hits.append(term)
    return unique(hits, 50)
