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


def test_to_flat_same_name_phases_keep_only_last() -> None:
    """Documents the known defect: repeated root phases overwrite in to_flat."""
    sw = StopWatch()
    sw.record("infer", 1.0)
    sw.record("infer", 3.0)

    assert sw.to_flat()["infer"] == 3.0  # last write wins — not sum, not mean


def test_to_step_summary_aggregates_repeated_root_phases() -> None:
    sw = StopWatch()
    for elapsed in (1.0, 2.0, 3.0, 4.0):
        sw.record("infer", elapsed)
    with sw.phase("obs"):
        with sw.phase("screenshot"):  # child — must NOT appear at root level
            pass

    summary = sw.to_step_summary()

    infer = summary["infer"]
    assert infer["n"] == 4
    assert infer["sum_s"] == 10.0
    assert infer["p50_s"] == 2.0  # nearest-rank: ceil(0.5*4)=2nd of [1,2,3,4]
    assert infer["p95_s"] == 4.0  # nearest-rank: ceil(0.95*4)=4th
    assert infer["max_s"] == 4.0
    assert summary["obs"]["n"] == 1
    assert "screenshot" not in summary  # only root phases are aggregated


def test_to_step_summary_single_sample() -> None:
    sw = StopWatch()
    sw.record("eval", 0.5)

    summary = sw.to_step_summary()

    assert summary["eval"] == {
        "n": 1, "sum_s": 0.5, "p50_s": 0.5, "p95_s": 0.5, "max_s": 0.5,
    }


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
        max_steps=45,
    )

    payload = result.to_dict()
    execution = payload["execution"]

    assert payload["max_steps"] == 45
    assert execution["stopwatch_total_s"] == 1.25
    assert execution["stopwatch_flat"]["infer"] == 0.5
    assert execution["stopwatch_tree"][0]["name"] == "infer"


def test_episode_result_serializes_step_summary_and_wallclock() -> None:
    steps = {"infer": {"n": 3, "sum_s": 4.5, "p50_s": 1.5, "p95_s": 2.0, "max_s": 2.0}}
    result = EpisodeResult(
        task_id="demo.task",
        task_name="demo",
        suite="demo",
        execution=ExecutionResult(
            steps=3,
            trace=[],
            runtime_s=5.0,
            finished=True,
            truncated=False,
            stopwatch_steps=steps,
            started_at=1_755_000_000.0,
            ended_at=1_755_000_005.0,
        ),
        judge=JudgeResult(success=True, clean=True, progress=1.0),
    )

    execution = result.to_dict()["execution"]

    assert execution["stopwatch_steps"] == steps
    assert execution["started_at"] == 1_755_000_000.0
    assert execution["ended_at"] == 1_755_000_005.0
