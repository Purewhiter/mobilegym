"""ExecRunner - 执行模式 (async)"""

import asyncio

from bench_env.runner.base import BaseRunner, Controller
from bench_env.task import BaseTask, JudgeInput
from bench_env.logger import add_log_file


class ExecTask(BaseTask):
    """
    Simple task for exec mode (no evaluation).
    
    Used by ExecRunner to run arbitrary instructions without judging.
    """
    templates = []
    apps = []
    
    def __init__(self, instruction: str):
        super().__init__(task_name=instruction)
    
    def is_successful(self, input: JudgeInput) -> bool:
        # Exec mode doesn't evaluate
        return True


class ExecRunner(BaseRunner):
    """执行指令，不评判"""

    def __init__(self, env, agent, instruction: str, max_steps=20, verbose=True, recorder=None):
        self.env, self.agent, self.instruction = env, agent, instruction
        self.max_steps, self.verbose = max_steps, verbose
        self.recorder = recorder

    @classmethod
    async def from_args(cls, args):
        from bench_env import factory
        from bench_env.config import RunnerConfig
        
        config = RunnerConfig.from_args(args)
        recorder = factory.create_recorder(config)
        llm = factory.create_llm(config) if config.agent != "human" else None
        agent = factory.create_agent(config, llm)
        env = await factory.create_env(config)

        # Start run recording (Exec still benefits from trajectories)
        recorder.start_run(
            agent=factory.get_agent_name(config),
            model_name=config.model_name,
            extra_meta=cls.build_run_meta(config),
        )
        if recorder.run_dir:
            add_log_file(recorder.run_dir / "console.log")
        return cls(env, agent, args.exec, config.max_steps, not config.quiet, recorder)

    async def run(self) -> int:
        if self.verbose:
            print(f"\n[Exec] {self.instruction}")

        task = ExecTask(self.instruction)
        try:
            run_dir = self.recorder.run_dir if self.recorder else None
            exec_result, _init_obs, _last_obs, _episode, _task = await Controller.run_loop(
                self.env, self.agent, task, max_steps=self.max_steps, recorder=self.recorder
            )

            if self.verbose:
                for t in exec_result.trace:
                    print(f"[Step {t['step']}] {t['action_type']}: {t['data']}")
                if exec_result.error:
                    print(f"[ERROR] {exec_result.error}")
                elif exec_result.stop_reason:
                    print(f"[STOP] {exec_result.stop_reason}")
                if run_dir:
                    print(f"[OUTPUT] {run_dir}")
            return 0 if not exec_result.error else 2
        finally:
            if self.recorder:
                self.recorder.finish_run()
            await self.env.close()
