"""Tests for bench_env memory optimizations (Observation bytes, recorder strip, summary)."""

from __future__ import annotations

import base64
import json
import tempfile
from pathlib import Path

from bench_env.env.base import Observation
from bench_env.env.recorder import RunRecorder, _strip_image_data_from_messages


def test_observation_image_data_url_from_bytes_matches_base64_path() -> None:
    jpeg_like = b"\xff\xd8\xff\xe0" + b"\x00" * 64
    obs_bytes = Observation(screenshot_bytes=jpeg_like)
    obs_b64 = Observation(screenshot_base64=base64.b64encode(jpeg_like).decode())
    assert obs_bytes.image_data_url == obs_b64.image_data_url
    assert obs_bytes.image_data_url.startswith("data:image/jpeg;base64,")


def test_observation_image_data_url_from_base64_fallback() -> None:
    png_like_b64 = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 32).decode()
    obs = Observation(screenshot_base64=png_like_b64)
    assert obs.image_data_url.startswith("data:image/png;base64,")
    assert png_like_b64 in obs.image_data_url


def test_get_screenshot_bytes_prefers_raw_then_decodes_base64() -> None:
    raw = b"\xff\xd8\x00"
    obs = Observation(screenshot_bytes=raw)
    assert obs.get_screenshot_bytes() == raw
    b64 = base64.b64encode(raw).decode()
    obs2 = Observation(screenshot_base64=b64)
    assert obs2.get_screenshot_bytes() == raw


def test_strip_messages_does_not_mutate_original() -> None:
    url = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\x00").decode()
    original = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": url}},
                {"type": "text", "text": "hi"},
            ],
        }
    ]
    stripped = _strip_image_data_from_messages(original)
    assert stripped[0]["content"][0]["image_url"]["url"] == "[IMAGE_DATA_STRIPPED]"
    assert original[0]["content"][0]["image_url"]["url"] == url


def test_finish_run_summary_matches_memory_logic() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        rec = RunRecorder(root, save_trajectory=False)
        rec.start_run(agent="test", model_name="m")

        def _make_result(task_id: str, *, success: bool, err: bool) -> dict:
            ex = {
                "steps": 3,
                "finished": True,
                "truncated": False,
                "stop_reason": "COMPLETE",
                "agent_message": None,
                "agent_answer": None,
                "runtime_s": 1.5,
                "error": "x" if err else None,
            }
            return {
                "id": task_id,
                "task_name": task_id,
                "suite": "s",
                "trial_id": 0,
                "execution": ex,
                "judge": None,
                "is_success": success,
                "is_error": err,
                "progress": 1.0,
                "false_complete": False,
                "overdue_termination": False,
            }

        r1 = _make_result("a.T1", success=True, err=False)
        r2 = _make_result("a.T2", success=False, err=False)
        r3 = _make_result("a.T3", success=False, err=True)
        for r in (r1, r2, r3):
            rec.record_result(r)

        run_dir = rec.finish_run(repeat_n=1, pass_k=None)
        summary_path = run_dir / "summary.json"
        assert summary_path.exists()
        summary = json.loads(summary_path.read_text(encoding="utf-8"))

        results = [r1, r2, r3]

        def _exec(r: dict) -> dict:
            return r["execution"]

        def _is_error(r: dict) -> bool:
            return bool(_exec(r).get("error")) or r.get("is_error", False)

        assert summary["total_episodes"] == 3
        assert summary["success"] == 1
        assert summary["failed"] == 1
        assert summary["error"] == 1
        assert summary["success_tasks"] == [r.get("id") for r in results if r.get("is_success")]
        assert summary["failed_tasks"] == [
            r.get("id") for r in results if not r.get("is_success") and not _is_error(r)
        ]
        assert summary["error_tasks"] == [r.get("id") for r in results if _is_error(r)]
