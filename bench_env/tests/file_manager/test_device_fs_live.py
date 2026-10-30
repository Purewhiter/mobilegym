"""
Live check of the device-server file system with real task setups.

Every task that seeds files through ``__SIM_FS__`` runs its own ``setup()``
(reset → fresh device session → seed). A no-op episode must fail the judge;
for ``CreateKeepFolderAndDeleteRawLogs`` the correct file operations must pass
it, end to end through ``__SIM_FS__`` and ``__SIM__.getState().os.fileSystem``.

Requires the dev server at ``--sim-url``. Skip with ``pytest -m 'not live'``.
"""

from __future__ import annotations

import pytest

from bench_env.env.base import Observation
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.judge import JudgeInput
from bench_env.task.registry import TaskRegistry


pytestmark = [pytest.mark.live, pytest.mark.asyncio(loop_scope="session")]

FS_SEEDING_TASKS = [
    "file_manager.CreateKeepFolderAndDeleteRawLogs",
    "file_manager.CleanObsoleteHandoffFiles",
    "file_manager.RenameEvidenceFilesByDate",
    "crossapp_work.CountCurrentLogErrorsToWechat",
    "crossapp_work.OrganizePdfReportsToWechat",
]


async def _judge(env: MobileGymEnv, task, init_obs: Observation):
    state = await env.get_state(required_apps=task.apps or None)
    last = Observation(state=state, route=init_obs.route, step_idx=1)
    return task.evaluate(JudgeInput(init_obs=init_obs, last_obs=last, answer=None))


@pytest.mark.parametrize("task_id", FS_SEEDING_TASKS)
async def test_seeded_task_rejects_noop(env: MobileGymEnv, task_id: str):
    task = TaskRegistry().create_task(task_id)
    init_obs = await task.setup(env)
    files = [n for n in init_obs.state["os"]["fileSystem"]["nodes"] if n["type"] == "file"]
    # The 58 preset sdcard files plus whatever the task seeded on top.
    assert len(files) > 58, task_id
    assert all(n["storage"] == "device" for n in files)
    assert not (await _judge(env, task, init_obs)).success, task_id


async def test_keep_folder_task_accepts_correct_operations(env: MobileGymEnv):
    task = TaskRegistry().create_task("file_manager.CreateKeepFolderAndDeleteRawLogs")
    init_obs = await task.setup(env)
    await env.page.evaluate(
        """async ({folder, targets}) => {
            const fs = window.__SIM_FS__;
            await fs.mkdir(folder);
            for (const p of targets) await fs.delete(p);
        }""",
        {"folder": task.keep_folder_path, "targets": task.target_paths},
    )
    result = await _judge(env, task, init_obs)
    assert result.success, result.to_dict()
