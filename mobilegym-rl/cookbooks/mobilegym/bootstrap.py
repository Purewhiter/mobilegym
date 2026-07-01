from __future__ import annotations

import os
import sys
from pathlib import Path


def add_mobilegym_to_path() -> Path:
    """Locate the mobilegym checkout (the directory containing ``bench_env``) and
    add it to ``sys.path``, returning its root.

    Works regardless of where this rllm tree is placed:

    - dev layout:   ``<rllm>/mobilegym/bench_env`` (``mobilegym`` is a symlink)
    - vendored:     ``<mobilegym>/mobilegym-rl/.../bootstrap.py`` where ``bench_env``
                    lives in an ancestor directory.

    Set ``MOBILEGYM_ROOT`` to override the search with an explicit path.
    """
    here = Path(__file__).resolve()

    candidates: list[Path] = []
    override = os.environ.get("MOBILEGYM_ROOT")
    if override:
        candidates.append(Path(override))
    for parent in here.parents:
        candidates.append(parent)            # vendored: bench_env in an ancestor
        candidates.append(parent / "mobilegym")  # dev: via the mobilegym symlink

    for cand in candidates:
        if (cand / "bench_env").is_dir():
            root_str = str(cand)
            if root_str not in sys.path:
                sys.path.insert(0, root_str)
            return cand

    raise RuntimeError(
        "mobilegym checkout (a directory containing 'bench_env') not found near "
        f"{here}; set MOBILEGYM_ROOT to point at it."
    )


def patch_verl_set_loss_fn() -> None:
    """Bridge missing ``set_loss_fn`` on spawned verl Ray worker groups."""
    from verl.single_controller.ray.base import RayWorkerGroup

    if hasattr(RayWorkerGroup, "set_loss_fn"):
        return

    def _set_loss_fn(self, loss_fn):
        for method_name in dir(self):
            if method_name == "set_loss_fn" or not method_name.endswith("_set_loss_fn"):
                continue
            method = getattr(self, method_name, None)
            if callable(method):
                return method(loss_fn)

        if hasattr(self, "execute_all_sync"):
            return self.execute_all_sync("set_loss_fn", loss_fn)
        raise AttributeError("No set_loss_fn-compatible method found on RayWorkerGroup")

    RayWorkerGroup.set_loss_fn = _set_loss_fn
