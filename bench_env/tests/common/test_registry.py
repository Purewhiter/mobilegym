"""Unit tests for :mod:`bench_env.task.registry`.

Covers discovery/loading of the two suite layouts:

- legacy: ``<suite>/tasks.py`` with many classes
- new:    ``<suite>/defs/<TaskName>.py`` one class per file

Uses a temporary directory as a synthetic discovery root so the tests don't
depend on (or mutate) the real suites shipped under ``bench_env/task/``.
"""

from __future__ import annotations

import sys
import textwrap
import zlib
from pathlib import Path

import pytest

from bench_env.task.registry import TaskRegistry, _discover_suite_modules, load_tasks


_LEGACY_TASKS_PY = textwrap.dedent(
    '''
    """Legacy suite — one file, multiple classes."""
    from bench_env.task.base import BaseTask
    from bench_env.task.common_tasks import CriteriaTask


    class LegacyAlpha(CriteriaTask):
        apps = ["fake"]
        templates = ["legacy alpha"]
        scope = "S1"
        objective = "operate"
        composition = "sequential"
        difficulty = "L1"
        capabilities = ["nav"]
        criteria = {"x": 1}


    class LegacyBeta(CriteriaTask):
        apps = ["fake"]
        templates = ["legacy beta"]
        scope = "S1"
        objective = "operate"
        composition = "sequential"
        difficulty = "L1"
        capabilities = ["nav"]
        criteria = {"x": 2}
    '''
)

_DEFS_TASK_PY = textwrap.dedent(
    '''
    """Single-task definition file."""
    from bench_env.task.common_tasks import CriteriaTask


    class DefsGamma(CriteriaTask):
        apps = ["fake"]
        templates = ["defs gamma"]
        scope = "S1"
        objective = "operate"
        composition = "sequential"
        difficulty = "L1"
        capabilities = ["nav"]
        criteria = {"x": 3}
    '''
)

_PARAM_TASKS_PY = textwrap.dedent(
    '''
    """Suite with parameterized task."""
    from bench_env.task.common_tasks import CriteriaTask


    class ParamTask(CriteriaTask):
        apps = ["fake"]
        templates = ["param {value}"]
        scope = "S1"
        objective = "operate"
        composition = "atomic"
        difficulty = "L1"
        capabilities = ["query"]
        parameters = {"value": {"type": "int", "min": 1, "max": 10}}
        criteria = {"x": 1}
    '''
)


@pytest.fixture()
def synthetic_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Create a fake discovery root on ``sys.path`` and yield ``(prefix, root)``."""
    root_pkg = tmp_path / "fake_tasks_pkg"
    root_pkg.mkdir()
    # Make it importable under a unique prefix so we don't clash with real modules.
    (root_pkg / "__init__.py").write_text("")
    monkeypatch.syspath_prepend(str(tmp_path))

    prefix = "fake_tasks_pkg"
    yield prefix, root_pkg

    # Purge any modules we imported so tests stay isolated.
    for mod_name in list(sys.modules):
        if mod_name == prefix or mod_name.startswith(prefix + "."):
            sys.modules.pop(mod_name, None)


def _make_suite(
    root: Path,
    name: str,
    *,
    tasks_py: str | None = None,
    defs: dict[str, str] | None = None,
) -> None:
    suite_dir = root / name
    suite_dir.mkdir()
    (suite_dir / "__init__.py").write_text("")
    if tasks_py is not None:
        (suite_dir / "tasks.py").write_text(tasks_py)
    if defs:
        defs_dir = suite_dir / "defs"
        defs_dir.mkdir()
        (defs_dir / "__init__.py").write_text("")
        for fname, body in defs.items():
            (defs_dir / f"{fname}.py").write_text(body)


def _registry_for(prefix: str, root: Path) -> TaskRegistry:
    """Build a TaskRegistry whose class maps point at the synthetic root."""
    tasks, defs, generated = _discover_suite_modules(roots=[(prefix, root)])
    reg = TaskRegistry()
    reg._tasks_modules = tasks
    reg._defs_modules = defs
    reg._all_suites = sorted(set(tasks) | set(defs))
    reg._generated = generated
    reg._cache = {}
    return reg


class TestDiscovery:
    def test_legacy_only(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(root, "legacy_suite", tasks_py=_LEGACY_TASKS_PY)

        tasks, defs, gen = _discover_suite_modules(roots=[(prefix, root)])
        assert tasks == {"legacy_suite": f"{prefix}.legacy_suite.tasks"}
        assert defs == {}
        assert gen == set()

    def test_defs_only(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(root, "new_suite", defs={"gamma": _DEFS_TASK_PY})

        tasks, defs, gen = _discover_suite_modules(roots=[(prefix, root)])
        assert tasks == {}
        assert defs == {"new_suite": [f"{prefix}.new_suite.defs.gamma"]}

    def test_hybrid(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(
            root,
            "hybrid_suite",
            tasks_py=_LEGACY_TASKS_PY,
            defs={"gamma": _DEFS_TASK_PY},
        )

        tasks, defs, _ = _discover_suite_modules(roots=[(prefix, root)])
        assert "hybrid_suite" in tasks
        assert defs["hybrid_suite"] == [f"{prefix}.hybrid_suite.defs.gamma"]

    def test_empty_suite_ignored(self, synthetic_root):
        prefix, root = synthetic_root
        empty = root / "empty_suite"
        empty.mkdir()
        (empty / "__init__.py").write_text("")

        tasks, defs, _ = _discover_suite_modules(roots=[(prefix, root)])
        assert "empty_suite" not in tasks
        assert "empty_suite" not in defs

    def test_defs_skips_dunder_files(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(
            root,
            "suite_with_helpers",
            defs={"gamma": _DEFS_TASK_PY, "_helper": "HELPERS = 1\n"},
        )

        _, defs, _ = _discover_suite_modules(roots=[(prefix, root)])
        paths = defs["suite_with_helpers"]
        assert paths == [f"{prefix}.suite_with_helpers.defs.gamma"]

    def test_duplicate_suite_across_roots_raises_even_when_layouts_differ(
        self,
        tmp_path: Path,
    ):
        runtime_root = tmp_path / "runtime_tasks"
        generated_root = tmp_path / "generated_tasks"
        runtime_root.mkdir()
        generated_root.mkdir()
        _make_suite(runtime_root, "dup_suite", tasks_py=_LEGACY_TASKS_PY)
        _make_suite(generated_root, "dup_suite", defs={"gamma": _DEFS_TASK_PY})

        with pytest.raises(RuntimeError, match="Duplicate task suite 'dup_suite'"):
            _discover_suite_modules(
                roots=[
                    ("fake_runtime_tasks", runtime_root),
                    ("bench_env.generated_task.fake", generated_root),
                ]
            )


class TestLoading:
    def test_legacy_loads_all_classes(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(root, "legacy_suite", tasks_py=_LEGACY_TASKS_PY)

        reg = _registry_for(prefix, root)
        names = reg.list_tasks("legacy_suite")
        assert names == ["LegacyAlpha", "LegacyBeta"]
        # _suite is injected.
        assert reg.get("legacy_suite", "LegacyAlpha")._suite == "legacy_suite"

    def test_defs_only_loads_single_class(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(root, "new_suite", defs={"gamma": _DEFS_TASK_PY})

        reg = _registry_for(prefix, root)
        assert reg.list_tasks("new_suite") == ["DefsGamma"]

    def test_hybrid_merges_both_layouts(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(
            root,
            "hybrid_suite",
            tasks_py=_LEGACY_TASKS_PY,
            defs={"gamma": _DEFS_TASK_PY},
        )

        reg = _registry_for(prefix, root)
        assert reg.list_tasks("hybrid_suite") == [
            "DefsGamma",
            "LegacyAlpha",
            "LegacyBeta",
        ]

    def test_duplicate_across_layouts_raises(self, synthetic_root):
        prefix, root = synthetic_root
        dup_def = _DEFS_TASK_PY.replace("DefsGamma", "LegacyAlpha")
        _make_suite(
            root,
            "dup_suite",
            tasks_py=_LEGACY_TASKS_PY,
            defs={"alpha": dup_def},
        )

        reg = _registry_for(prefix, root)
        with pytest.raises(RuntimeError, match="Duplicate task class 'LegacyAlpha'"):
            reg._load_suite_tasks("dup_suite")

    def test_reexport_is_ignored(self, synthetic_root):
        """A defs file that re-imports a task from elsewhere must not re-register it."""
        prefix, root = synthetic_root
        reexport = textwrap.dedent(
            f'''
            from {prefix}.legacy_suite.tasks import LegacyAlpha  # noqa: F401
            from bench_env.task.common_tasks import CriteriaTask


            class Sibling(CriteriaTask):
                apps = ["fake"]
                templates = ["sibling"]
                scope = "S1"
                objective = "operate"
                composition = "sequential"
                difficulty = "L1"
                capabilities = ["nav"]
                criteria = {{"x": 9}}
            '''
        )
        _make_suite(root, "legacy_suite", tasks_py=_LEGACY_TASKS_PY)
        _make_suite(root, "reexport_suite", defs={"sibling": reexport})

        reg = _registry_for(prefix, root)
        # LegacyAlpha is imported inside reexport_suite but must not be
        # registered there — __module__ check filters it out.
        names = reg.list_tasks("reexport_suite")
        assert names == ["Sibling"]

    def test_unknown_suite_raises(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(root, "legacy_suite", tasks_py=_LEGACY_TASKS_PY)

        reg = _registry_for(prefix, root)
        with pytest.raises(ValueError, match="Unknown task suite 'no_such'"):
            reg._load_suite_tasks("no_such")

    def test_seed_reaches_single_instance_tasks_without_sample_n(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(root, "param_suite", tasks_py=_PARAM_TASKS_PY)

        reg = _registry_for(prefix, root)
        tasks = load_tasks("param_suite", registry=reg, sample_n=None, seed=123)

        assert len(tasks) == 1
        assert tasks[0].id == "param_suite.ParamTask"
        assert not hasattr(tasks[0], "_instance_id")
        expected_seed = (123 ^ zlib.crc32(b"param_suite.ParamTask:0")) & 0xFFFFFFFF
        assert tasks[0]._seed == expected_seed

    def test_missing_seed_keeps_legacy_single_instance_behavior(self, synthetic_root):
        prefix, root = synthetic_root
        _make_suite(root, "param_suite", tasks_py=_PARAM_TASKS_PY)

        reg = _registry_for(prefix, root)
        tasks = load_tasks("param_suite", registry=reg, sample_n=None, seed=None)

        assert len(tasks) == 1
        assert tasks[0]._seed is None


class TestRealWorldSuiteStillLoads:
    """Smoke check: the real bilibili suite still loads correctly after the refactor."""

    def test_bilibili_still_present(self):
        reg = TaskRegistry()
        names = reg.list_tasks("bilibili")
        assert len(names) > 0
        assert "OpenRankingTask" in names
