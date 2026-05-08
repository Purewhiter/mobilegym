from __future__ import annotations

from bench_env.env.stopwatch import StopWatch
from bench_env.runner.base import EpisodeResult, ExecutionResult
from bench_env.task.judge import JudgeResult


def test_stopwatch_exports_tree_and_flat() -> None:
    sw = StopWatch()

    with sw.phase("setup"):
        with sw.phase("reset"):
            pass
        with sw.phase("warm"):
            pass

    with sw.phase("infer"):
        pass

    flat = sw.to_flat()
    tree = sw.to_tree()

    assert "setup" in flat
    assert "setup.reset" in flat
    assert "setup.warm" in flat
    assert "infer" in flat
    assert tree[0]["name"] == "setup"
    assert tree[0]["children"][0]["name"] == "reset"


def test_episode_result_serializes_stopwatch_fields() -> None:
    result = EpisodeResult(
        task_id="demo.task",
        task_name="demo",
        suite="demo",
        execution=ExecutionResult(
            steps=2,
            trace=[],
            runtime_s=1.5,
            finished=True,
            truncated=False,
            stopwatch_total_s=1.25,
            stopwatch_flat={"infer": 0.5, "obs.state": 0.25},
            stopwatch_tree=[
                {"name": "infer", "elapsed_s": 0.5, "children": []},
                {"name": "obs", "elapsed_s": 0.5, "children": [{"name": "state", "elapsed_s": 0.25, "children": []}]},
            ],
        ),
        judge=JudgeResult(success=True, clean=True, progress=1.0),
    )

    payload = result.to_dict()
    execution = payload["execution"]

    assert execution["stopwatch_total_s"] == 1.25
    assert execution["stopwatch_flat"]["infer"] == 0.5
    assert execution["stopwatch_tree"][0]["name"] == "infer"
