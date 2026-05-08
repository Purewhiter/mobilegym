import json
from pathlib import Path

from bench_env.task.registry import TaskRegistry


ROOT = Path(__file__).resolve().parents[1]
SPLITS_DIR = ROOT / "splits"
RETAINED_SPLITS = ("test", "train", "payment", "high_risk")


def _read_split(name: str) -> set[str]:
    path = SPLITS_DIR / f"{name}.txt"
    return {
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def _registered_task_ids() -> set[str]:
    registry = TaskRegistry()
    generated = getattr(registry, "_generated", set())
    suites = sorted(
        (set(registry._tasks_modules) | set(registry._defs_modules)) - generated
    )
    ids: set[str] = set()
    for suite in suites:
        ids.update(f"{suite}.{name}" for name in registry._load_suite_tasks(suite))
    return ids


def test_task_registry_contains_only_retained_tasks():
    retained_splits = set().union(*(_read_split(name) for name in RETAINED_SPLITS))
    sim2real = json.loads(
        (SPLITS_DIR / "sim2real_instructions.json").read_text(encoding="utf-8")
    )
    retained = retained_splits | set(sim2real)

    registered = _registered_task_ids()

    assert registered <= retained
    assert retained_splits <= registered
    assert set(sim2real) <= registered
