from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from bench_env.env.mobile_gym import MobileGymEnv


@pytest.mark.asyncio
@pytest.mark.parametrize("reload", [False, True])
async def test_set_state_propagates_patch_failure(monkeypatch, reload):
    env = MobileGymEnv(url="http://localhost", verbose=False)
    page = SimpleNamespace(
        evaluate=AsyncMock(side_effect=RuntimeError("device write failed")),
        reload=AsyncMock(),
    )
    wait_ready = AsyncMock()
    monkeypatch.setattr(env, "_page", page)
    monkeypatch.setattr(env, "_wait_ready", wait_ready)

    with pytest.raises(RuntimeError, match="device write failed"):
        await env.set_state({"apps": {"notes": {"notes": []}}}, reload=reload)

    page.reload.assert_not_awaited()
    wait_ready.assert_not_awaited()


@pytest.mark.asyncio
async def test_set_state_reloads_after_acknowledgement(monkeypatch):
    env = MobileGymEnv(url="http://localhost", verbose=False)
    steps = []
    patch = {"apps": {"notes": {"notes": []}}}

    async def evaluate(script, args):
        assert "reload: false" in script
        assert "waitForStateCommit" in script
        assert args == {"patch": patch, "deep": False, "reload": True}
        steps.append("apply")

    async def reload(*, wait_until):
        assert wait_until == "load"
        steps.append("reload")

    async def wait_ready():
        steps.append("ready")

    monkeypatch.setattr(env, "_page", SimpleNamespace(evaluate=evaluate, reload=reload))
    monkeypatch.setattr(env, "_wait_ready", wait_ready)

    await env.set_state(patch, deep=False, reload=True)

    assert steps == ["apply", "reload", "ready"]
