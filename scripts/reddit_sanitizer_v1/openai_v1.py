#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any


OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "http://localhost:8000/v1").rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "EMPTY")
OPENAI_TIMEOUT = float(os.environ.get("OPENAI_TIMEOUT", "240"))


class OpenAIV1Error(RuntimeError):
    pass


def _env_float(name: str) -> float | None:
    value = os.environ.get(name)
    return None if value is None else float(value)


def _env_int(name: str) -> int | None:
    value = os.environ.get(name)
    return None if value is None else int(value)


def _sampling_payload(temperature: float | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    values: dict[str, float | int | None] = {
        "temperature": _env_float("OPENAI_TEMPERATURE") if temperature is None else temperature,
        "top_p": _env_float("OPENAI_TOP_P"),
        "top_k": _env_int("OPENAI_TOP_K"),
        "min_p": _env_float("OPENAI_MIN_P"),
        "presence_penalty": _env_float("OPENAI_PRESENCE_PENALTY"),
        "repetition_penalty": _env_float("OPENAI_REPETITION_PENALTY"),
    }
    for key, value in values.items():
        if value is not None:
            payload[key] = value
    return payload


def _headers() -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "mobile-gym-bilibili-sanitizer/1.0",
    }
    if OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {OPENAI_API_KEY}"
    return headers


def post_json(endpoint: str, payload: dict[str, Any], retries: int = 4) -> dict[str, Any]:
    url = f"{OPENAI_BASE_URL}/{endpoint.lstrip('/')}"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, headers=_headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=OPENAI_TIMEOUT) as resp:
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


def _coerce_to_schema(value: Any, schema: dict[str, Any], path: str = "$") -> Any:
    schema_type = schema.get("type")
    if schema_type == "object" and isinstance(value, dict):
        props = schema.get("properties", {})
        out: dict[str, Any] = {}
        for key in schema.get("required", []):
            if key not in value:
                raise OpenAIV1Error(f"model JSON missing required field {path}.{key}")
            out[key] = _coerce_to_schema(value[key], props.get(key, {}), f"{path}.{key}")
        for key, child_schema in props.items():
            if key in value and key not in out:
                out[key] = _coerce_to_schema(value[key], child_schema, f"{path}.{key}")
        return out
    if schema_type == "array" and isinstance(value, list):
        item_schema = schema.get("items", {})
        return [_coerce_to_schema(item, item_schema, f"{path}[{index}]") for index, item in enumerate(value)]
    return value


def chat_json(
    *,
    model: str,
    system: str,
    user_content: str,
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
                    + "\n不要进行长推理，不要输出思考过程。直接完成任务，只输出一个合法 JSON 对象，不要输出 Markdown。/no_think"
                    + f"\n输出必须严格符合这个 JSON Schema（名称：{schema_name}）：\n"
                    + json.dumps(schema, ensure_ascii=False)
                ),
            },
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
        "reasoning_effort": os.environ.get("OPENAI_REASONING_EFFORT", "none"),
        "reasoning": {"effort": os.environ.get("OPENAI_REASONING_EFFORT", "none")},
        "enable_thinking": False,
        "chat_template_kwargs": {"enable_thinking": False},
        **_sampling_payload(temperature),
    }

    response = post_json("/chat/completions", payload)
    choices = response.get("choices") or []
    if not choices:
        raise OpenAIV1Error("chat completion did not contain choices")
    content = choices[0].get("message", {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise OpenAIV1Error("chat completion did not contain text content")
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise OpenAIV1Error(f"model returned non-JSON output: {content[:500]}") from exc
    return _coerce_to_schema(parsed, schema)


def chat_text(
    *,
    model: str,
    system: str,
    user_content: str,
    temperature: float | None = None,
) -> str:
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    system
                    + "\n不要进行长推理，不要输出思考过程。直接输出结果，不要输出 Markdown。/no_think"
                ),
            },
            {"role": "user", "content": user_content},
        ],
        "reasoning_effort": os.environ.get("OPENAI_REASONING_EFFORT", "none"),
        "reasoning": {"effort": os.environ.get("OPENAI_REASONING_EFFORT", "none")},
        "enable_thinking": False,
        "chat_template_kwargs": {"enable_thinking": False},
        **_sampling_payload(temperature),
    }

    response = post_json("/chat/completions", payload)
    choices = response.get("choices") or []
    if not choices:
        raise OpenAIV1Error("chat completion did not contain choices")
    content = choices[0].get("message", {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise OpenAIV1Error("chat completion did not contain text content")
    return content.strip()
