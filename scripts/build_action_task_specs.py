#!/usr/bin/env python3
"""
Build a JSONL spec (training-like template) from public/*_action_tasks*.json.

User intent:
- We create a JSONL "template" first.
- Then we implement deterministically judgeable tasks (state judge) from this spec.

This script does NOT modify any existing code; it only writes a new JSONL file.
"""

from __future__ import annotations

import argparse
import json
import re
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


PAREN_RE = re.compile(r"[（(]([^）)]+)[）)]")


def _read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _iter_public_action_task_files(public_dir: Path) -> list[Path]:
    # Prefer *_action_tasks_data.json (only wechat currently), then the rest.
    data_mode = sorted(public_dir.glob("*_action_tasks_data.json"))
    schema_mode = sorted(p for p in public_dir.glob("*_action_tasks.json") if p.name not in {x.name for x in data_mode})
    # Also include any *_action_tasks.jsonl if present (future-proof)
    jsonl_mode = sorted(public_dir.glob("*_action_tasks.jsonl"))
    return data_mode + schema_mode + jsonl_mode


def _iter_tasks_from_file(path: Path) -> Iterable[dict[str, Any]]:
    if path.suffix == ".jsonl":
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)
        return

    obj = _read_json(path)
    if isinstance(obj, list):
        for x in obj:
            if isinstance(x, dict):
                yield x
        return
    raise ValueError(f"Unsupported action tasks format: {path}")


def _safe_class_name(s: str) -> str:
    # Convert "wechat:settings.x.y.toggle" -> "Wechat__settings_x_y_toggle"
    s = str(s or "")
    s = s.replace(":", "__").replace("/", "_").replace("-", "_").replace(".", "_")
    s = re.sub(r"[^0-9A-Za-z_]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        s = "Task"
    if s[0].isdigit():
        s = f"T_{s}"
    # Cap to keep import time manageable / avoid extremely long identifiers
    return s[:180]


def _extract_expected_from_label(label: str) -> str | None:
    """
    Try to extract the value inside Chinese parentheses, e.g.
    '朋友圈可见范围：选择（最近半年）' -> '最近半年'
    """
    if not label:
        return None
    matches = PAREN_RE.findall(label)
    if not matches:
        return None
    # Use the last parenthesis group (most labels put the payload at the end).
    return matches[-1].strip() or None


def _wechat_infer_judge(action_id: str, behavior: str, label: str, params_schema: dict | None) -> dict[str, Any] | None:
    """
    Best-effort deterministic state judge mapping for WeChat.
    Returns a judge spec dict or None (fallback to generic state-diff judge).
    """
    action_id = str(action_id or "")
    behavior = str(behavior or "")

    if behavior == "toggle":
        # Chat toggles
        if action_id.startswith("chatInfo.item.") and action_id.endswith(".toggle"):
            # chatInfo.item.muted.toggle -> chats[].isMuted
            key = action_id[len("chatInfo.item.") : -len(".toggle")]
            field_map = {"muted": "isMuted", "sticky": "isSticky", "alert": "isAlert"}
            field = field_map.get(key)
            if field:
                return {"kind": "toggle_chat_field", "id_param": "id", "field": field}

        # Contact toggles
        if action_id.startswith("friendSettings.item.") and action_id.endswith(".toggle"):
            key = action_id[len("friendSettings.item.") : -len(".toggle")]
            field_map = {"star": "isStarred", "blacklist": "isBlacklisted"}
            field = field_map.get(key)
            if field:
                return {"kind": "toggle_contact_field", "id_param": "id", "field": field}

        # WeChat Sports toggles
        if action_id.startswith("wechatSports.") and action_id.endswith(".toggle"):
            # wechatSports.privacy.joinLeaderboard.toggle -> user.settings.accessibility.wechatSports.joinLeaderboard
            rest = action_id[len("wechatSports.") : -len(".toggle")]
            # e.g. "privacy.joinLeaderboard"
            parts = [p for p in rest.split(".") if p]
            if parts and parts[0] == "privacy":
                parts = parts[1:]
            if parts:
                path = "user.settings.accessibility.wechatSports." + ".".join(parts)
                return {"kind": "toggle_field", "path": path}

        # Settings toggles
        if action_id.startswith("settings.") and action_id.endswith(".toggle"):
            core = action_id[len("settings.") : -len(".toggle")]  # e.g. "privacy.friendConfirmation"
            parts = [p for p in core.split(".") if p]
            if not parts:
                return None

            section = parts[0]
            tail = parts[1:]

            # modes
            if section == "careMode":
                return {"kind": "toggle_field", "path": "user.settings.modes.care"}
            if section == "minorMode":
                # agreement toggle isn't in user.settings by default; keep fallback for agreement
                if tail and tail[0] == "agreement":
                    return {"kind": "state_diff", "prefix": "user.settings.modes"}
                return {"kind": "toggle_field", "path": "user.settings.modes.minor"}

            # privacy.* and privacy.addMe.*
            if section == "privacy":
                # privacy.addMe.searchByWxid.toggle -> user.settings.privacy.addMeMethods.searchByWxid
                if tail[:1] == ["addMe"] and len(tail) >= 2:
                    key = tail[1]
                    return {"kind": "toggle_field", "path": f"user.settings.privacy.addMeMethods.{key}"}
                # privacy.moments.strangerTen.toggle -> momentsStrangerTen
                if tail == ["moments", "strangerTen"]:
                    return {"kind": "toggle_field", "path": "user.settings.privacy.momentsStrangerTen"}
                if tail:
                    return {"kind": "toggle_field", "path": "user.settings.privacy." + ".".join(tail)}

            # general.* (has UI grouping like media/audio/darkMode/translation)
            if section == "general" and tail:
                # general.darkMode.followSystem.toggle -> followSystem
                if tail[:2] == ["darkMode", "followSystem"]:
                    return {"kind": "toggle_field", "path": "user.settings.general.followSystem"}
                # general.translation.autoTranslate.toggle -> autoTranslate
                if tail[:2] == ["translation", "autoTranslate"]:
                    return {"kind": "toggle_field", "path": "user.settings.general.autoTranslate"}
                # general.media.X.toggle -> general.X
                if tail[:1] in (["media"], ["audio"]):
                    if len(tail) >= 2:
                        return {"kind": "toggle_field", "path": "user.settings.general." + ".".join(tail[1:])}
                return {"kind": "toggle_field", "path": "user.settings.general." + ".".join(tail)}

            # chat.*
            if section == "chat" and tail:
                return {"kind": "toggle_field", "path": "user.settings.chat." + ".".join(tail)}

            # notifications.*
            if section == "notifications" and tail:
                return {"kind": "toggle_field", "path": "user.settings.notifications." + ".".join(tail)}

            # discover.item.{field}.toggle (scope item, needs id)
            if section == "discover" and tail[:1] == ["item"] and len(tail) >= 3:
                field = tail[1]  # visible/notify/showNearbyPeople
                return {"kind": "toggle_discover_item_field", "id_param": "id", "field": field}

    if behavior == "select":
        expected = _extract_expected_from_label(label) or None
        if action_id.startswith("settings.notifications.sound.select."):
            # user.settings.notifications.notificationSound
            if expected:
                return {"kind": "set_field", "path": "user.settings.notifications.notificationSound", "expected": expected}
        if action_id.startswith("settings.notifications.incomingRingtone.select."):
            if expected:
                return {"kind": "set_field", "path": "user.settings.notifications.incomingRingtone", "expected": expected}
        if action_id.startswith("settings.notifications.displayMode.select."):
            # Labels are like "通知显示：选择（横幅）" etc; state is enum string
            if expected:
                # In data it's 'full'/'brief' maybe; label might be Chinese, so this could be mismatched.
                # Keep generic "state diff" if we can't guarantee mapping.
                return {"kind": "state_diff", "prefix": "user.settings.notifications"}
        if action_id.startswith("settings.privacy.moments.range.select.") and expected:
            return {"kind": "set_field", "path": "user.settings.privacy.momentsRange", "expected": expected}
        if action_id.startswith("settings.general.darkMode.mode.select."):
            # Expect followSystem=false plus darkMode True/False.
            if "深色" in (label or ""):
                return {
                    "kind": "multi_set",
                    "checks": [
                        {"path": "user.settings.general.followSystem", "expected": False},
                        {"path": "user.settings.general.darkMode", "expected": True},
                    ],
                }
            if "普通" in (label or ""):
                return {
                    "kind": "multi_set",
                    "checks": [
                        {"path": "user.settings.general.followSystem", "expected": False},
                        {"path": "user.settings.general.darkMode", "expected": False},
                    ],
                }
        # Default for selects: require some state change in user.settings (still state-based)
        return {"kind": "state_diff", "prefix": "user.settings"}

    # submit/input/other: hard to infer; fallback to generic app state diff
    return None


def _infer_judge(app: str, action: dict[str, Any]) -> dict[str, Any]:
    behavior = str((action or {}).get("behavior") or "")
    action_id = str((action or {}).get("id") or "")
    label = str((action or {}).get("label") or "")
    params_schema = action.get("paramsSchema") if isinstance(action, dict) else None

    if app == "wechat":
        j = _wechat_infer_judge(action_id, behavior, label, params_schema if isinstance(params_schema, dict) else None)
        if j:
            return j

    # Generic fallback: any state diff under target app
    return {"kind": "app_state_diff"}


def _build_params(app: str, action: dict[str, Any]) -> dict[str, Any]:
    """
    Build bench_env-style parameters schema (for sampling).
    We only include parameters that we can sample deterministically from env_state.
    """
    params: dict[str, Any] = {}
    params_schema = action.get("paramsSchema") if isinstance(action, dict) else None
    if not isinstance(params_schema, dict):
        return params

    # WeChat common item key is "id" (chat/contact)
    if app == "wechat":
        if "id" in params_schema:
            # This is ambiguous (chat id or contact wxid), but sampling from chats is "good enough"
            params["id"] = {
                "type": "string",
                "source": "apps.wechat.chats[id]",
                "default": "wxid_blank_001",
                "description": "通用实体 id（chat/contact wxid）",
            }
        if "range" in params_schema:
            params["range"] = {"type": "string", "default": "最近三天", "description": "选择项参数（范围）"}

    return params


def build_specs(public_dir: Path) -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    files = _iter_public_action_task_files(public_dir)
    for f in files:
        for t in _iter_tasks_from_file(f):
            app = str(t.get("app") or "").strip()
            action = t.get("action") if isinstance(t.get("action"), dict) else {}
            action_id = str(action.get("id") or "")
            label = str(action.get("label") or action_id)
            behavior = str(action.get("behavior") or "")

            # Build an "optimal_paths"-like hint: transitions + final action
            shortest = t.get("trajectory") if isinstance(t.get("trajectory"), dict) else None
            transitions = (shortest or {}).get("transitions") if shortest else None
            if not isinstance(transitions, list):
                transitions = []

            # Append action as the final step (bench_env optimal_paths supports dict step)
            path_steps: list[Any] = list(transitions)
            path_steps.append({"id": action_id, "params": {}})

            # Task/class identifiers
            task_uid = str(t.get("taskId") or f"{app}:{action_id}")
            # IMPORTANT: spec.jsonl is per "target node" in nav/data graph, so task_uid alone is NOT unique.
            # Make class_name stable AND unique per line using (task_uid, target.nodeId, source file) hash.
            target_node = ""
            if isinstance(t.get("target"), dict):
                target_node = str((t.get("target") or {}).get("nodeId") or "")
            uniq_basis = f"{task_uid}|{target_node}|{f.name}"
            uniq = zlib.crc32(uniq_basis.encode("utf-8")) & 0xFFFFFFFF
            class_name = _safe_class_name(f"{task_uid}__{target_node}__h{uniq:08x}")

            params = _build_params(app, action)
            judge = _infer_judge(app, action)

            specs.append(
                {
                    "version": 1,
                    "task_uid": task_uid,
                    "class_name": class_name,
                    "target_app": app,
                    "action": {
                        "id": action_id,
                        "label": label,
                        "behavior": behavior,
                        "paramsSchema": action.get("paramsSchema"),
                    },
                    "target": t.get("target"),
                    "shortestLength": t.get("shortestLength"),
                    "shortest_transitions": list(transitions),
                    "optimal_paths": [path_steps],
                    "parameters": params,
                    "judge": judge,
                    "source": {
                        "graphFile": t.get("graphFile"),
                        "public_file": str(f.name),
                    },
                }
            )
    return specs


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--public", default="public", help="public directory (default: public)")
    ap.add_argument(
        "--out",
        default="bench_env/generated_task/action_tasks/spec.jsonl",
        help="output jsonl path",
    )
    ap.add_argument("--limit", type=int, default=0, help="limit number of specs (0 = no limit)")
    args = ap.parse_args()

    public_dir = Path(args.public).resolve()
    out_path = Path(args.out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    specs = build_specs(public_dir)
    if args.limit and args.limit > 0:
        specs = specs[: args.limit]

    with out_path.open("w", encoding="utf-8") as f:
        for rec in specs:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(f"[OK] wrote {len(specs)} lines to {out_path}")


if __name__ == "__main__":
    main()

