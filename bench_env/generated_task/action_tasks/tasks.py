"""
ActionTasks (state-judgeable) - generated from a JSONL spec.

Constraints (per user request):
- Do NOT modify any existing code.
- Implement judgeable tasks (state-based judge, not VLM-based) in "tasks form".

How it works:
- Run `python scripts/bench/generate/build_action_task_specs.py` to generate:
  bench_env/task/action_tasks/spec.jsonl
- This module loads spec.jsonl and dynamically creates BaseTask subclasses.
- TaskRegistry will discover them under app="action_tasks".
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, ClassVar

from bench_env.task.base import BaseTask, BaseApp
from bench_env.task.judge import JudgeInput, StateComparator


_HERE = Path(__file__).resolve().parent
_SPEC_PATH = _HERE / "spec.jsonl"

_COMPLEXITY_TO_DIFFICULTY = {1: "L1", 2: "L2", 3: "L3", 4: "L4", 5: "L4", 6: "L4"}

def _complexity_to_difficulty(c: int) -> str:
    return _COMPLEXITY_TO_DIFFICULTY.get(c, "L4")


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = (line or "").strip()
        if not line:
            continue
        obj = json.loads(line)
        if isinstance(obj, dict):
            out.append(obj)
    return out


def _safe_task_id(s: str) -> str:
    s = str(s or "").strip()
    return s if s else "unknown"


def _pick(d: Any, *keys: str, default: Any = None) -> Any:
    if not isinstance(d, dict):
        return default
    for k in keys:
        if k in d:
            return d.get(k)
    return default


def _find_by_id(items: Any, id_field: str, wanted: str) -> dict[str, Any] | None:
    if not wanted or not isinstance(items, list):
        return None
    for x in items:
        if isinstance(x, dict) and str(x.get(id_field) or "") == str(wanted):
            return x
    return None


def _normalize_class_name(name: str) -> str:
    # Should already be safe from the builder, but keep defensive.
    import re

    s = str(name or "").strip() or "Task"
    s = re.sub(r"[^0-9A-Za-z_]+", "_", s)
    if s and s[0].isdigit():
        s = f"T_{s}"
    return s[:180]


class _GeneratedActionTask(BaseTask):
    """
    Base class for generated action tasks.
    
    Name starts with _ to exclude it from TaskRegistry discovery.
    Subclasses override setup() to open the actual target app.
    """

    apps: ClassVar[list[str]] = []
    templates: ClassVar[list[str]] = []
    difficulty: ClassVar[str] = "L1"
    note: ClassVar[str] = ""
    optimal_paths: ClassVar[list[list[Any]]] = []
    parameters: ClassVar[dict[str, dict[str, Any]]] = {}
    sample_max: ClassVar[int | None] = None

    # Spec payload
    _spec: ClassVar[dict[str, Any]] = {}
    _target_app: ClassVar[str] = ""
    _judge: ClassVar[dict[str, Any]] = {}

    async def setup(self, env: Any):  # type: ignore[override]
        """
        Similar to BaseTask.setup, but opens self._target_app instead of self.app.
        """
        # 1) Allow subclasses/spec to prepare environment before sampling.
        await self._prepare(env)

        # 2) Sample parameters from env_state.
        state = await env.get_state()
        if self.sampler:
            result = self.sampler.sample(state, task=self)
            for key, value in result.params.items():
                if key in self._user_params:
                    continue
                self.params[key] = value

        # 3) Open the target app when the task maps to a concrete app.
        target_app = str(getattr(self, "_target_app", "") or "")
        if target_app:
            await env.open_app(target_app, wait_stable=True)

        return await env.get_observation()

    # ---------------------------
    # Custom samplers (needed because TaskSampler can't sample object keys)
    # ---------------------------

    def _sample_wechat_discover_id(self, env_state: dict) -> str | None:
        """
        Sample a discover item id from apps.wechat.user.settings.discover keys.
        """
        try:
            discover = (
                (env_state.get("apps") or {}).get("wechat") or {}
            ).get("user", {}).get("settings", {}).get("discover", {})
            if isinstance(discover, dict) and discover:
                keys = list(discover.keys())
                return self.sampler.rng.choice(keys) if self.sampler else keys[0]
        except Exception:
            return None
        return None

    # ---------------------------
    # Judge helpers
    # ---------------------------

    def _app_init(self, input: JudgeInput, app: str) -> dict[str, Any]:
        return (input.apps_init or {}).get(app, {}) or {}

    def _app_curr(self, input: JudgeInput, app: str) -> dict[str, Any]:
        return (input.apps or {}).get(app, {}) or {}

    def _diff_app(self, input: JudgeInput, app: str) -> list[dict[str, Any]]:
        init = self._app_init(input, app)
        curr = self._app_curr(input, app)
        if not isinstance(init, dict) or not isinstance(curr, dict):
            return []
        return StateComparator.diff_states(init, curr, prefix="")

    def _has_diff_prefix(self, diffs: list[dict[str, Any]], prefix: str) -> bool:
        prefix = str(prefix or "").strip()
        if not prefix:
            return bool(diffs)
        for d in diffs:
            p = str(d.get("path") or "")
            if p == prefix or p.startswith(prefix + "."):
                return True
        return False

    def _get_field(self, app_state: dict[str, Any], path: str) -> Any:
        return BaseApp.get_by_path(app_state, path, None)

    # ---------------------------
    # Main judge
    # ---------------------------

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        target_app = str(getattr(self, "_target_app", "") or "")
        judge = dict(getattr(self, "_judge", {}) or {})
        kind = str(judge.get("kind") or "").strip()

        if not target_app:
            return [{
                "field": "target_app",
                "expected": "non-empty target_app",
                "actual": target_app,
                "passed": False,
            }]

        init_app = self._app_init(input, target_app)
        curr_app = self._app_curr(input, target_app)

        # 0) Generic fallback: any app state diff
        if kind == "app_state_diff" or not kind:
            diffs = self._diff_app(input, target_app)
            passed = len(diffs) > 0
            return [{
                "field": f"{target_app}.state_changed",
                "expected": "app state changed (diffs>0)",
                "actual": f"diffs={len(diffs)}",
                "passed": passed,
            }]

        # 1) Diff under a prefix (relative to app root)
        if kind == "state_diff":
            prefix = str(judge.get("prefix") or "")
            diffs = self._diff_app(input, target_app)
            passed = self._has_diff_prefix(diffs, prefix)
            return [{
                "field": f"{target_app}.{prefix or '<any>'}",
                "expected": "diff under prefix",
                "actual": f"diffs={len(diffs)}",
                "passed": passed,
            }]

        # 2) Toggle a boolean field at a specific path (relative to app root)
        if kind == "toggle_field":
            path = str(judge.get("path") or "")
            before = self._get_field(init_app, path)
            after = self._get_field(curr_app, path)
            passed = before is not None and after is not None and before != after
            return [{
                "field": f"{target_app}.{path}",
                "expected": "toggled (init != curr)",
                "actual": {"init": before, "curr": after},
                "passed": passed,
            }]

        # 3) Set a field to a specific expected value
        if kind == "set_field":
            path = str(judge.get("path") or "")
            expected = judge.get("expected")
            actual = self._get_field(curr_app, path)
            passed = actual == expected
            return [{
                "field": f"{target_app}.{path}",
                "expected": expected,
                "actual": actual,
                "passed": passed,
            }]

        # 4) Multiple set checks
        if kind == "multi_set":
            checks = judge.get("checks")
            if not isinstance(checks, list):
                checks = []
            out = []
            all_passed = True
            for c in checks:
                if not isinstance(c, dict):
                    continue
                path = str(c.get("path") or "")
                expected = c.get("expected")
                actual = self._get_field(curr_app, path)
                passed = actual == expected
                all_passed = all_passed and passed
                out.append({
                    "field": f"{target_app}.{path}",
                    "expected": expected,
                    "actual": actual,
                    "passed": passed,
                })
            if not out:
                return [{
                    "field": "multi_set",
                    "expected": "non-empty checks",
                    "actual": checks,
                    "passed": False,
                }]
            return out

        # 5) Chat item field toggle (wechat-like)
        if kind == "toggle_chat_field":
            field = str(judge.get("field") or "")
            id_param = str(judge.get("id_param") or "id")
            chat_id = str(getattr(self.p, id_param, "") or "")
            before_chat = _find_by_id(_pick(init_app, "chats", default=[]), "id", chat_id)
            after_chat = _find_by_id(_pick(curr_app, "chats", default=[]), "id", chat_id)
            before = (before_chat or {}).get(field)
            after = (after_chat or {}).get(field)
            passed = (before_chat is not None) and (after_chat is not None) and (before != after)
            return [{
                "field": f"{target_app}.chats[{chat_id}].{field}",
                "expected": "toggled (init != curr)",
                "actual": {"init": before, "curr": after},
                "passed": passed,
            }]

        # 6) Contact item field toggle (wechat-like)
        if kind == "toggle_contact_field":
            field = str(judge.get("field") or "")
            id_param = str(judge.get("id_param") or "id")
            wxid = str(getattr(self.p, id_param, "") or "")
            before_c = _find_by_id(_pick(init_app, "contacts", default=[]), "wxid", wxid)
            after_c = _find_by_id(_pick(curr_app, "contacts", default=[]), "wxid", wxid)
            before = (before_c or {}).get(field)
            after = (after_c or {}).get(field)
            passed = (before_c is not None) and (after_c is not None) and (before != after)
            return [{
                "field": f"{target_app}.contacts[{wxid}].{field}",
                "expected": "toggled (init != curr)",
                "actual": {"init": before, "curr": after},
                "passed": passed,
            }]

        # 7) Discover item field toggle (wechat-like)
        if kind == "toggle_discover_item_field":
            field = str(judge.get("field") or "")
            id_param = str(judge.get("id_param") or "id")
            item_id = str(getattr(self.p, id_param, "") or "")
            before = BaseApp.get_by_path(init_app, f"user.settings.discover.{item_id}.{field}", None)
            after = BaseApp.get_by_path(curr_app, f"user.settings.discover.{item_id}.{field}", None)
            passed = before is not None and after is not None and before != after
            return [{
                "field": f"{target_app}.user.settings.discover[{item_id}].{field}",
                "expected": "toggled (init != curr)",
                "actual": {"init": before, "curr": after},
                "passed": passed,
            }]

        # Unknown judge kind -> fallback to app_state_diff
        diffs = self._diff_app(input, target_app)
        return [{
            "field": f"{target_app}.state_changed(fallback:{kind})",
            "expected": "app state changed (diffs>0)",
            "actual": f"diffs={len(diffs)}",
            "passed": len(diffs) > 0,
        }]


def _create_task_classes_from_spec(specs: list[dict[str, Any]]) -> dict[str, type[BaseTask]]:
    out: dict[str, type[BaseTask]] = {}
    for spec in specs:
        if not isinstance(spec, dict):
            continue

        class_name = _normalize_class_name(str(spec.get("class_name") or "Task"))
        task_uid = _safe_task_id(str(spec.get("task_uid") or class_name))
        target_app = str(spec.get("target_app") or "")
        action = spec.get("action") if isinstance(spec.get("action"), dict) else {}
        action_label = str(action.get("label") or action.get("id") or "")

        # Build a human task instruction (template)
        if target_app and action_label:
            template = f"在{target_app}中执行动作「{action_label}」"
        elif target_app:
            template = f"在{target_app}中执行一个原地动作"
        else:
            template = f"执行 action task：{task_uid}"

        params = spec.get("parameters") if isinstance(spec.get("parameters"), dict) else {}
        judge = spec.get("judge") if isinstance(spec.get("judge"), dict) else {"kind": "app_state_diff"}

        # Special: improve sampling for wechat discover item toggles
        if target_app == "wechat" and isinstance(judge, dict) and judge.get("kind") == "toggle_discover_item_field":
            # Ensure parameter id is sampled from discover keys, not chats.
            params = dict(params)
            params["id"] = {
                "type": "string",
                "sampler": "_sample_wechat_discover_id",
                "default": "moments",
                "description": "发现页条目 id（discover object key）",
            }

        attrs: dict[str, Any] = {
            "__module__": __name__,
            "__doc__": f"Generated from {spec.get('source', {})}",
            "templates": [template],
            "apps": ["action_tasks"],
            "difficulty": _complexity_to_difficulty(int(spec.get("shortestLength") or 1) if isinstance(spec.get("shortestLength"), (int, float)) else 1),
            "optimal_paths": spec.get("optimal_paths") if isinstance(spec.get("optimal_paths"), list) else [],
            "parameters": params,
            "_spec": spec,
            "_target_app": target_app,
            "_judge": judge,
            # Make task_id stable for debugging even though BaseTask.id is app.ClassName
            "note": f"uid={task_uid} action={action.get('id')} behavior={action.get('behavior')}",
        }

        cls = type(class_name, (_GeneratedActionTask,), attrs)
        out[class_name] = cls
    return out


# Load spec and populate module globals for TaskRegistry discovery.
_SPECS = _read_jsonl(_SPEC_PATH)
_TASK_CLASSES = _create_task_classes_from_spec(_SPECS)
globals().update(_TASK_CLASSES)

# Expose for debugging
TASK_SPECS: list[dict[str, Any]] = _SPECS
TASK_COUNT: int = len(_TASK_CLASSES)
