#!/usr/bin/env python3
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"https?://[^\s\"'<>]+|www\.[^\s\"'<>]+")
PHONE_RE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")
HANDLE_RE = re.compile(r"(?i)(?:微信|vx|v信|小红书号|邮箱|email|ins|instagram|weibo|微博|qq)[:：\s]*[A-Za-z0-9_.@-]{3,}")
LATIN_TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_.-]{2,}")
LATIN_STOPLIST = {
    "http",
    "https",
    "www",
    "com",
    "cn",
    "user",
    "profile",
    "explore",
    "feed",
    "source",
    "xsec",
    "token",
    "pc",
    "imageview",
    "format",
    "webp",
    "jpg",
    "png",
}


def compact_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def unique(items: list[str], limit: int = 80) -> list[str]:
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


def split_searchable_phrases(text: str, max_items: int = 12) -> list[str]:
    text = compact_text(text)
    if not text:
        return []
    pieces = re.split(r"[，。！？；、,.!?;\n\r]+", text)
    phrases = [p.strip() for p in pieces if len(p.strip()) >= 6]
    if len(text) >= 10:
        phrases.insert(0, text[:36])
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
    intro = compact_text(user.get("intro", ""))
    forbidden = [name]
    forbidden.extend(split_searchable_phrases(intro))
    forbidden.extend(extract_sensitive_candidates(name, intro, user.get("userUrl", "")))
    return {
        "originalName": name,
        "originalIntro": intro,
        "forbiddenTerms": unique(forbidden),
        "contactCandidates": extract_sensitive_candidates(intro, user.get("userUrl", "")),
    }


def note_risk_context(note: dict[str, Any], users_by_id: dict[str, dict[str, Any]]) -> dict[str, Any]:
    title = compact_text(note.get("title", ""))
    content = compact_text(note.get("content", ""))
    tags = [compact_text(t) for t in note.get("tags", []) if compact_text(t)]
    author = users_by_id.get(str(note.get("authorId", "")), {})
    texts = [title, content, " ".join(tags), note.get("url", "")]
    forbidden: list[str] = []
    forbidden.extend(split_searchable_phrases(title, 8))
    forbidden.extend(split_searchable_phrases(content, 16))
    forbidden.extend(tags)
    if author:
        forbidden.append(compact_text(author.get("name", "")))
        forbidden.extend(split_searchable_phrases(compact_text(author.get("intro", "")), 8))
        texts.append(compact_text(author.get("name", "")))
        texts.append(compact_text(author.get("intro", "")))
    for comment in note.get("commentList", []) or []:
        username = compact_text(comment.get("username", ""))
        comment_text = compact_text(comment.get("content", ""))
        forbidden.append(username)
        forbidden.extend(split_searchable_phrases(comment_text, 3))
        texts.extend([username, comment_text])
    forbidden.extend(extract_sensitive_candidates(*texts))
    return {
        "originalTitle": title,
        "originalTags": tags,
        "originalAuthorName": compact_text(author.get("name", "")),
        "forbiddenTerms": unique(forbidden, 140),
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
    return unique(hits, 40)
