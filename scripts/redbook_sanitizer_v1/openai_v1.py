#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


class OpenAIV1Error(RuntimeError):
    pass


def _headers() -> dict[str, str]:
    if not OPENAI_API_KEY:
        raise OpenAIV1Error("OPENAI_API_KEY is not set")
    return {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "User-Agent": "curl/8.5.0",
    }


def post_json(endpoint: str, payload: dict[str, Any], retries: int = 4) -> dict[str, Any]:
    url = f"{OPENAI_BASE_URL}/{endpoint.lstrip('/')}"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=_headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            last_error = OpenAIV1Error(f"HTTP {exc.code} from {url}: {body}")
            if exc.code not in {408, 409, 429, 500, 502, 503, 504}:
                raise last_error
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc

        if attempt < retries:
            time.sleep(min(2**attempt, 20))

    raise OpenAIV1Error(str(last_error))


def image_data_url(path: Path) -> str:
    suffix = path.suffix.lower()
    mime = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(suffix, "application/octet-stream")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def extract_output_text(response: dict[str, Any]) -> str:
    chunks: list[str] = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") in {"output_text", "text"}:
                text = content.get("text")
                if isinstance(text, str):
                    chunks.append(text)
    if chunks:
        return "".join(chunks).strip()
    text = response.get("output_text")
    if isinstance(text, str):
        return text.strip()
    raise OpenAIV1Error("response did not contain output text")


def parse_json_response(response: dict[str, Any]) -> Any:
    text = extract_output_text(response)
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise OpenAIV1Error(f"model returned non-JSON output: {text[:500]}") from exc


def _coerce_to_schema(value: Any, schema: dict[str, Any]) -> Any:
    schema_type = schema.get("type")
    if schema_type == "object" and isinstance(value, dict):
        props = schema.get("properties", {})
        out: dict[str, Any] = {}
        for key in schema.get("required", []):
            if key in value:
                out[key] = _coerce_to_schema(value[key], props.get(key, {}))
        for key, child_schema in props.items():
            if key in value and key not in out:
                out[key] = _coerce_to_schema(value[key], child_schema)
        return out
    if schema_type == "array" and isinstance(value, list):
        item_schema = schema.get("items", {})
        return [_coerce_to_schema(item, item_schema) for item in value]
    return value


def _chat_content_from_responses_content(content: list[dict[str, Any]] | str) -> Any:
    if isinstance(content, str):
        return content
    chat_parts: list[dict[str, Any]] = []
    for part in content:
        part_type = part.get("type")
        if part_type == "input_text":
            chat_parts.append({"type": "text", "text": part.get("text", "")})
        elif part_type == "input_image":
            chat_parts.append({"type": "image_url", "image_url": {"url": part.get("image_url", "")}})
    if len(chat_parts) == 1 and chat_parts[0].get("type") == "text":
        return chat_parts[0].get("text", "")
    return chat_parts


def post_chat_stream_json(payload: dict[str, Any], retries: int = 8) -> dict[str, Any]:
    url = f"{OPENAI_BASE_URL}/chat/completions"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last_error: Exception | None = None
    last_was_rate_limit = False

    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=_headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                chunks: list[str] = []
                for raw_line in resp:
                    line = raw_line.decode("utf-8", errors="replace").strip()
                    if not line.startswith("data: "):
                        continue
                    data_line = line[len("data: "):]
                    if data_line == "[DONE]":
                        break
                    event = json.loads(data_line)
                    for choice in event.get("choices", []):
                        delta = choice.get("delta") or {}
                        text = delta.get("content")
                        if isinstance(text, str):
                            chunks.append(text)
                text = "".join(chunks).strip()
                if not text:
                    raise OpenAIV1Error("streaming chat response did not contain content")
                return json.loads(text)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            last_error = OpenAIV1Error(f"HTTP {exc.code} from {url}: {body}")
            last_was_rate_limit = exc.code == 429
            if exc.code not in {408, 409, 429, 500, 502, 503, 504}:
                raise last_error
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OpenAIV1Error) as exc:
            last_error = exc
            last_was_rate_limit = False

        if attempt < retries:
            if last_was_rate_limit:
                # TPM windows reset on minute boundaries; back off long enough to clear it.
                time.sleep(min(15 * (attempt + 1), 60))
            else:
                time.sleep(min(2**attempt, 20))

    raise OpenAIV1Error(str(last_error))


def chat_stream_json(
    *,
    model: str,
    system: str,
    user_content: list[dict[str, Any]] | str,
    schema_name: str,
    schema: dict[str, Any],
    temperature: float | None = None,
) -> Any:
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    system
                    + "\n不要进行长推理，不要输出思考过程。直接完成任务，只输出一个合法 JSON 对象，不要输出 Markdown。"
                    + f"\n输出必须严格符合这个 JSON Schema（名称：{schema_name}）：\n"
                    + json.dumps(schema, ensure_ascii=False)
                ),
            },
            {"role": "user", "content": _chat_content_from_responses_content(user_content)},
        ],
        "response_format": {"type": "json_object"},
        "stream": True,
        "reasoning_effort": os.environ.get("OPENAI_REASONING_EFFORT", "none"),
        "reasoning": {"effort": os.environ.get("OPENAI_REASONING_EFFORT", "none")},
        "enable_thinking": False,
    }
    if temperature is not None:
        payload["temperature"] = temperature
    return _coerce_to_schema(post_chat_stream_json(payload), schema)


def responses_json(
    *,
    model: str,
    system: str,
    user_content: list[dict[str, Any]] | str,
    schema_name: str,
    schema: dict[str, Any],
    temperature: float | None = None,
) -> Any:
    content = user_content
    if isinstance(user_content, str):
        content = [{"type": "input_text", "text": user_content}]

    payload: dict[str, Any] = {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": system}]},
            {"role": "user", "content": content},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": schema_name,
                "strict": True,
                "schema": schema,
            }
        },
    }
    if temperature is not None:
        payload["temperature"] = temperature

    if os.environ.get("OPENAI_USE_CHAT_STREAM") == "1":
        return chat_stream_json(
            model=model,
            system=system,
            user_content=user_content,
            schema_name=schema_name,
            schema=schema,
            temperature=temperature,
        )

    try:
        return parse_json_response(post_json("/responses", payload))
    except OpenAIV1Error:
        if os.environ.get("OPENAI_FORCE_RESPONSES_API") == "1":
            raise
        return chat_stream_json(
            model=model,
            system=system,
            user_content=user_content,
            schema_name=schema_name,
            schema=schema,
            temperature=temperature,
        )


def generate_image_b64(
    *,
    model: str,
    prompt: str,
    size: str = "1024x1536",
    quality: str = "high",
) -> bytes:
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "n": 1,
    }
    if quality:
        payload["quality"] = quality
    response = post_json("/images/generations", payload)
    data = response.get("data") or []
    if not data:
        raise OpenAIV1Error("image generation returned no data")
    item = data[0]
    b64 = item.get("b64_json")
    if isinstance(b64, str):
        return base64.b64decode(b64)
    file_path = item.get("file_path")
    if isinstance(file_path, str) and Path(file_path).exists():
        return Path(file_path).read_bytes()
    url = item.get("url")
    if isinstance(url, str):
        if url.startswith("http"):
            full_url = url
        else:
            from urllib.parse import urlsplit
            parts = urlsplit(OPENAI_BASE_URL)
            full_url = f"{parts.scheme}://{parts.netloc}{url if url.startswith('/') else '/' + url}"
        with urllib.request.urlopen(full_url, timeout=60) as r:
            return r.read()
    raise OpenAIV1Error(f"image generation returned no usable content: {item}")
