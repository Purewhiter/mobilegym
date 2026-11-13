import asyncio
from types import SimpleNamespace

import pytest

from bench_env.config import RunnerConfig
from bench_env.runner.parallel import ParallelRunner


@pytest.mark.asyncio
async def test_repeat_queue_reports_startup_failure_when_no_workers_survive():
    def create_agent():
        raise ValueError("agent initialization failed")

    runner = ParallelRunner(
        [SimpleNamespace(), SimpleNamespace()], create_agent, [SimpleNamespace()],
        RunnerConfig(agent="generic_v2", model_name=None, quiet=True),
    )

    with pytest.raises(RuntimeError, match="All repeat workers exited") as error:
        await asyncio.wait_for(runner._run_with_repeat(n=2, repeat_n=2), timeout=2)
    assert isinstance(error.value.__cause__, ValueError)
