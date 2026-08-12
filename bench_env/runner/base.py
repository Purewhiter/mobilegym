"""BaseRunner - 所有 Runner 的基类 (async version)"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field, replace as dc_replace
from pathlib import Path
from typing import Any, Optional, TYPE_CHECKING
from urllib.parse import urlparse

from bench_env.logger import get_logger
from bench_env.env.base import ActionType
from bench_env.task.judge import JudgeResult, JudgeInput
from bench_env.config import RunnerConfig

if TYPE_CHECKING:
    from bench_env.task.vlm_judge import VLMJudge

logger = get_logger(__name__)

# Default wall-clock budget for a single episode's step loop (setup excluded).
# Prevents one hung episode (slow LLM, stuck page) from stalling a run forever.
DEFAULT_EPISODE_TIMEOUT_S = 900.0


class Evaluator:
    """Evaluates task success and side effects."""

    def __init__(self, judge_mode: str = "state", vlm_judge: Optional["VLMJudge"] = None,
                 eval_mode: str = "grounded"):
        """
        Args:
            judge_mode: "state" | "vlm" | "auto"
                - state: Use JSON state matching (default)
                - vlm: Use VLM visual evaluation
                - auto: Use VLM whenever a vlm_judge is configured OR the
                  final observation has no state data; falls back to state
                  matching only when neither condition holds
            vlm_judge: VLMJudge instance (required for vlm/auto mode)
            eval_mode: "text" | "grounded"
                - text: Legacy match_value answer checking
                - grounded: answer_sheet UI-based checking
        """
        self.judge_mode = judge_mode
        self.vlm_judge = vlm_judge
        self.eval_mode = eval_mode
        self._warned_auto_vlm = False
    
    async def evaluate(
        self, task, init_obs, last_obs, exec_result, episode=None
    ) -> JudgeResult:
        """
        Unified evaluation entry point (async).
        
        Automatically chooses state-based or VLM-based evaluation
        based on judge_mode and available data.
        
        VLM calls are wrapped in thread pool to avoid blocking event loop.
        """
        import asyncio

        # Determine if VLM evaluation should be used
        use_vlm = (
            self.judge_mode == "vlm" or
            (self.judge_mode == "auto" and (not last_obs.state or self.vlm_judge is not None))
        )
        
        if use_vlm and self.vlm_judge and episode:
            if self.judge_mode == "auto" and last_obs.state and not self._warned_auto_vlm:
                self._warned_auto_vlm = True
                logger.warning(
                    "judge_mode=auto with a configured vlm_judge always uses VLM "
                    "evaluation, even though state data is available; "
                    "pass judge_mode=state to force state-based judging"
                )
            # Wrap blocking VLM call in thread pool
            return await asyncio.to_thread(
                self._evaluate_with_vlm, task, exec_result, episode
            )
        else:
            # State evaluation is fast (pure CPU), no need for thread
            return self._evaluate_with_state(task, init_obs, last_obs, exec_result)
    
    def _evaluate_with_state(self, task, init_obs, last_obs, exec_result) -> JudgeResult:
        """State-based evaluation using JSON state matching.

        In grounded mode:
        - AnswerTask with answer_fields: use grounded checks (answer_sheet state)
        - Other tasks with answer_fields: hydrate input.answer from answer_sheet,
          then fall through to normal task.evaluate()
        """

        judge_input = JudgeInput(
            init_obs=init_obs,
            last_obs=last_obs,
            answer=exec_result.agent_answer,
        )

        # Grounded mode handling
        if self.eval_mode == "grounded" and getattr(task, "answer_fields", None):
            sheet_state = judge_input.apps.get("answer_sheet", {})

            # Task with get_expected_response and no custom check_goals:
            # use structured grounded matching (exact field comparison)
            has_grounded = hasattr(task, "get_expected_response")
            # Walk MRO: intermediate bases (CriteriaTask, etc.) that define
            # check_goals must route to Path B, not just direct subclass overrides.
            from bench_env.task.base import BaseTask as _BT
            from bench_env.task.common_tasks import AnswerTask as _AT
            _cg_definer = next(
                (c for c in type(task).__mro__ if "check_goals" in c.__dict__), _BT
            )
            has_custom_cg = _cg_definer not in (_BT, _AT)
            if has_grounded and not has_custom_cg:
                from bench_env.task.common_tasks import build_grounded_checks
                try:
                    grounded_checks = build_grounded_checks(task, judge_input, sheet_state)
                except Exception as err:
                    return JudgeResult.error(f"build_grounded_checks() raised: {err}")
                return task._evaluate_with_checks(judge_input, grounded_checks)

            # Has custom check_goals: hydrate input.answer from answer_sheet,
            # then let task.evaluate() run normally
            answers = sheet_state.get("answers", {})
            submitted = sheet_state.get("submitted", False)
            if answers and submitted:
                parts = []
                for k in sorted(answers, key=lambda x: int(x)):
                    v = answers[k]
                    if isinstance(v, list):
                        parts.extend(str(item) for item in v)
                    else:
                        parts.append(str(v))
                judge_input = JudgeInput(
                    init_obs=init_obs,
                    last_obs=last_obs,
                    answer=", ".join(parts),
                )
            else:
                # Grounded mode: block fallback to ANSWER action text
                judge_input = JudgeInput(
                    init_obs=init_obs,
                    last_obs=last_obs,
                    answer=None,
                )

        return task.evaluate(judge_input)
    
    def _evaluate_with_vlm(self, task, exec_result, episode) -> JudgeResult:
        """VLM-based evaluation using trajectory screenshots."""
        logger.info("Using VLM judge for evaluation")
        
        # Get trajectory data with screenshots
        trajectory = episode.get_trajectory_for_vlm()
        
        # Run VLM evaluation
        assert self.vlm_judge is not None
        output = self.vlm_judge.evaluate(
            task.description,
            trajectory,
            agent_answer=exec_result.agent_answer,
            agent_message=exec_result.agent_message,
            stop_reason=exec_result.stop_reason,
        )
        
        # Save VLM judge data for debugging
        episode.save_vlm_judge(output.prompt, output.response)
        
        return output.result


def _action_fingerprint(action) -> str:
    """Extract action behavioral fingerprint (type + normalized data)."""
    return f"{action.action_type}|{json.dumps(action.data, sort_keys=True, ensure_ascii=False)}"


def _snapshot_stopwatch(sw) -> tuple[float, dict[str, float], list[dict[str, Any]]]:
    try:
        return float(sw.total), sw.to_flat(), sw.to_tree()
    except Exception as err:
        logger.warning(f"stopwatch snapshot failed: {type(err).__name__}: {err}")
        return 0.0, {}, []


class Controller:
    """Controls the agent-environment interaction loop."""


    @staticmethod
    async def setup(env, task, eval_mode: str = "grounded") -> tuple[Any, dict]:
        """
        Execute task setup only, return initial observation and sampled params.

        In grounded mode, injects answer_sheet state after task setup.

        Args:
            env: Environment instance
            task: Task instance
            eval_mode: "text" | "grounded"

        Returns:
            tuple: (initial_obs, params_dict)
        """
        initial_obs = await task.setup(env)

        # Grounded mode: inject answer_sheet state after _post_sample.
        # Skipped on envs without state injection (e.g. real device has no
        # set_state and no answer_sheet app); in that case the caller must
        # use a non-grounded judge (e.g. --judge-mode vlm).
        if (
            eval_mode == "grounded"
            and getattr(task, "answer_fields", None)
            and getattr(env, "supports_state_injection", True)
        ):
            fields = task._resolve_answer_fields()
            question = task._resolve_answer_question() or task.description
            # strict=True: silent failure here would leave the answer_sheet
            # app unseeded and every grounded answer judged as missing.
            await env.set_state({"apps": {"answer_sheet": {
                "question": question,
                "hint": getattr(task, "answer_hint", None),
                "fields": fields,
                "answers": {},
                "submitted": False,
            }}}, deep=True, reload=False, strict=True)
            # Append answer sheet hint via task_name (instance attribute,
            # highest priority in description property — no ClassVar shadow)
            task.task_name = task.description + " 然后打开 答题卡 APP 在里面回答问题并提交"

        return initial_obs, dict(task.params)

    @staticmethod
    async def run(
        env, agent, task, initial_obs, max_steps=20, recorder=None, trial_id: int = 0,
        eval_mode: str = "grounded",
        loop_threshold: int = 0,
        episode_timeout_s: float = DEFAULT_EPISODE_TIMEOUT_S,
    ) -> tuple[ExecutionResult, Any, Any, Any, Any]:
        """
        Run the interaction loop after setup is complete.

        Args:
            env: Environment instance
            agent: Agent instance
            task: Task instance (already setup, params sampled)
            initial_obs: Initial observation from setup()
            max_steps: Maximum steps per episode
            recorder: Optional recorder for saving trajectory
            trial_id: Trial index for pass@k evaluation
            eval_mode: "text" | "grounded"
            episode_timeout_s: Wall-clock budget for the step loop; on expiry
                the episode ends with stop_reason="TIMEOUT" and is recorded
                as an error episode (0 or negative disables the cap)

        Returns:
            tuple: (ExecutionResult, init_obs, final_obs, episode, task)
        """
        import asyncio
        start_time = time.time()
        trace = []
        episode = None
        obs = initial_obs
        _recent_fps: deque[str] = deque(maxlen=loop_threshold if loop_threshold > 0 else None)

        try:
            # task.description includes grounded suffix (via task_name set in setup)
            if recorder:
                episode = recorder.start_episode(
                    task_id=task.id, task_name=task.description,
                    extra_meta={"agent": agent.name, "max_steps": max_steps},
                    trial_id=trial_id,
                )

            logger.info(f"Instruction: {task.description}")
            agent.reset(task.description)
            done, truncated, stop_reason = False, False, None

            from bench_env.env.stopwatch import set_current_stopwatch

            episode_error: Optional[str] = None

            async def _step_loop() -> None:
                nonlocal obs, done, truncated, stop_reason
                for step in range(max_steps):
                    # Sync agent.act runs in a worker thread (asyncio default executor).
                    # We split the wallclock into two pre-measured sub-phases so the
                    # episode profile shows where infer time goes:
                    #   queue — wait for a free thread (cap = min(32, cpu+4) by default;
                    #           at parallel >= 32 this is what bottlenecks throughput)
                    #   exec  — actual agent.act run (HTTP to vLLM + parsing)
                    # During exec we bind env.stopwatch as the worker's "current"
                    # stopwatch so LLMClient (deep inside agent.act) can record its
                    # own ttft/decode children without plumbing sw through agent API.
                    with env.stopwatch.phase("infer"):
                        submit_t = time.monotonic()
                        timing: dict[str, float] = {}

                        def _wrapped_act():
                            timing["start"] = time.monotonic()
                            set_current_stopwatch(env.stopwatch)
                            try:
                                return agent.act(obs)
                            finally:
                                set_current_stopwatch(None)
                                timing["end"] = time.monotonic()

                        action = await asyncio.to_thread(_wrapped_act)
                        env.stopwatch.record("queue", timing["start"] - submit_t)
                        env.stopwatch.record("exec", timing["end"] - timing["start"])

                    with env.stopwatch.phase("record"):
                        trace.append({"step": step + 1, "action_type": action.action_type,
                                      "data": action.data, "thought": action.thought[:200] if action.thought else ""})
                        if episode:
                            # 从 agent 历史中获取 prompt（如果有）
                            prompt = None
                            if agent.history:
                                last_record = agent.history[-1]
                                prompt = getattr(last_record, "llm_prompt", None)
                            # Image resize/JPEG encode + file writes are blocking —
                            # run off the event loop (same pattern as agent.act above).
                            await asyncio.to_thread(
                                episode.record_step,
                                step_idx=step + 1, obs=obs, action=action,
                                route=obs.route, model_response=action.raw_response,
                                model_prompt=prompt,
                            )

                        # ---- Repetitive loop detection ----
                        if loop_threshold > 0:
                            fp = _action_fingerprint(action)
                            _recent_fps.append(fp)
                            if (len(_recent_fps) >= loop_threshold
                                    and all(f == _recent_fps[-1]
                                            for f in _recent_fps)):
                                logger.warning(
                                    "Repetitive loop: action repeated %dx — %s",
                                    loop_threshold, fp)
                                truncated, stop_reason = True, "REPETITIVE_LOOP"
                                break

                    try:
                        result = await env.step(action)
                    except (ValueError, TypeError) as e:
                        # Model output format error (e.g. invalid point coordinates)
                        # Terminate episode — this is the model's fault
                        logger.warning("Action format error at step %d: %s", step + 1, e)
                        done, stop_reason = True, "FORMAT_ERROR"
                        break
                    obs, done, stop_reason = result.observation, result.done, result.stop_reason

                    # INFO 处理
                    if action.is_info and not done:
                        config = getattr(agent, "config", None)
                        info_reply = getattr(config, "info_reply", None) if config else None
                        if info_reply is not None:
                            question = action.data.get("value", "")
                            reply = info_reply(question) if callable(info_reply) else str(info_reply)
                            if reply:
                                agent.add_user_comment(reply)

                    if done:
                        break
                else:
                    truncated, stop_reason = True, "MAX_STEPS"

            # Steps are capped by count above; the wall-clock cap below keeps a
            # hung step (LLM call, page evaluate) from stalling the run forever.
            try:
                if episode_timeout_s and episode_timeout_s > 0:
                    await asyncio.wait_for(_step_loop(), timeout=episode_timeout_s)
                else:
                    await _step_loop()
            except asyncio.TimeoutError:
                done, truncated, stop_reason = False, True, "TIMEOUT"
                episode_error = (
                    f"Episode exceeded wall-clock budget of {episode_timeout_s:.0f}s "
                    f"after {len(trace)} recorded steps"
                )
                logger.warning(f"[{task.id}] {episode_error}")

            stopwatch_total_s, stopwatch_flat, stopwatch_tree = _snapshot_stopwatch(env.stopwatch)
            exec_result = ExecutionResult(
                steps=len(trace), trace=trace, runtime_s=time.time() - start_time,
                finished=done, truncated=truncated, stop_reason=stop_reason,
                agent_message=env.agent_message,
                agent_answer=env.agent_answer,
                error=episode_error,
                stopwatch_total_s=stopwatch_total_s,
                stopwatch_flat=stopwatch_flat,
                stopwatch_tree=stopwatch_tree,
            )
            # Re-fetch final state with retry for reliable judging
            try:
                final_state = await env.get_state(
                    required_apps=list(task.apps) if task.apps else None
                )
                from dataclasses import replace as dc_replace
                obs = dc_replace(obs, state=final_state)
            except Exception as e:
                logger.warning(f"Final state re-fetch failed: {type(e).__name__}: {e}")
            return exec_result, initial_obs, obs, episode, task

        except Exception as e:
            # Handle runtime errors gracefully
            error_msg = f"{type(e).__name__}: {e}"
            logger.exception(f"Runtime error in episode: {error_msg}")
            
            stopwatch_total_s, stopwatch_flat, stopwatch_tree = _snapshot_stopwatch(env.stopwatch)
            exec_result = ExecutionResult(
                steps=len(trace), trace=trace, runtime_s=time.time() - start_time,
                finished=False, truncated=False, stop_reason="ERROR",
                agent_message=None, agent_answer=None, error=error_msg,
                stopwatch_total_s=stopwatch_total_s,
                stopwatch_flat=stopwatch_flat,
                stopwatch_tree=stopwatch_tree,
            )
            return exec_result, None, None, episode, task
        finally:
            try:
                task.teardown(env)
            except Exception as e:
                logger.debug(f"task.teardown() failed: {type(e).__name__}: {e}")
    
    @staticmethod
    async def run_loop(env, agent, task, max_steps=20, recorder=None, trial_id: int = 0,
                       eval_mode: str = "grounded",
                       loop_threshold: int = 0,
                       episode_timeout_s: float = DEFAULT_EPISODE_TIMEOUT_S) -> tuple[ExecutionResult, Any, Any, Any, Any]:
        """
        Run the full interaction loop (setup + run).

        Internally calls setup() + run().

        Returns:
            tuple: (ExecutionResult, init_obs, final_obs, episode, task)
        """
        try:
            initial_obs, _ = await Controller.setup(env, task, eval_mode=eval_mode)
        except Exception as e:
            # Setup failed - ensure teardown is called
            try:
                task.teardown(env)
            except Exception as te:
                logger.debug(f"task.teardown() failed after setup error: {type(te).__name__}: {te}")
            # Return error result (same behavior as original run_loop)
            error_msg = f"{type(e).__name__}: {e}"
            logger.exception(f"Setup error in episode: {error_msg}")
            stopwatch_total_s, stopwatch_flat, stopwatch_tree = _snapshot_stopwatch(env.stopwatch)
            exec_result = ExecutionResult(
                steps=0, trace=[], runtime_s=0.0,
                finished=False, truncated=False, stop_reason="ERROR",
                agent_message=None, agent_answer=None, error=error_msg,
                stopwatch_total_s=stopwatch_total_s,
                stopwatch_flat=stopwatch_flat,
                stopwatch_tree=stopwatch_tree,
            )
            return exec_result, None, None, None, task
        return await Controller.run(env, agent, task, initial_obs, max_steps, recorder, trial_id,
                                    eval_mode=eval_mode, loop_threshold=loop_threshold,
                                    episode_timeout_s=episode_timeout_s)


@dataclass
class ExecutionResult:
    """Result of task execution."""
    steps: int
    trace: list[dict]
    runtime_s: float
    finished: bool
    truncated: bool
    stop_reason: Optional[str] = None
    agent_message: Optional[str] = None
    agent_answer: Optional[str] = None
    error: Optional[str] = None
    stopwatch_total_s: float = 0.0
    stopwatch_flat: dict[str, float] = field(default_factory=dict)
    stopwatch_tree: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class EpisodeResult:
    """
    Structured result of a single episode.
    
    Composed of:
    - Task Info (id, name, suite, apps)
    - Execution (trace, steps, runtime)
    - Judge (success, progress, issues, warnings)
    - Trial Info (trial_id for pass@k evaluation)
    - Termination analysis (false complete / overdue)
    """
    task_id: str
    task_name: str
    suite: str  # task-set name (e.g. "wechat", "crossapp_content")
    
    execution: ExecutionResult
    judge: Optional[JudgeResult] = None
    trial_id: int = 0
    apps: list[str] = field(default_factory=list)
    max_steps: int = 0  # actual max_steps used in this episode

    # ---- Task taxonomy (optional, from BaseTask class vars) ----
    difficulty: str = ""
    scope: str = ""
    objective: str = ""
    composition: str = ""
    capabilities: list[str] = field(default_factory=list)

    @staticmethod
    def _task_taxonomy(task: Any) -> dict[str, Any]:
        """Extract taxonomy fields from a BaseTask for EpisodeResult construction."""
        return {
            "difficulty": getattr(task, "difficulty", ""),
            "scope": getattr(task, "scope", ""),
            "objective": getattr(task, "objective", ""),
            "composition": getattr(task, "composition", ""),
            "capabilities": list(getattr(task, "capabilities", [])),
        }

    # ---- Proxies ----
    
    @property
    def success(self) -> bool:
        return (
            self.execution.stop_reason == ActionType.COMPLETE
            and (self.judge.passed if self.judge else False)
        )
        
    @property
    def goal_success(self) -> bool:
        return self.judge.success if self.judge else False
        
    @property
    def no_unexpected_changes(self) -> bool:
        return self.judge.clean if self.judge else True
    
    @property
    def progress(self) -> float:
        return self.judge.progress if self.judge else 0.0
        
    @property
    def goal_mismatches(self) -> list[dict[str, Any]]:
        return self.judge.issues if self.judge else []
        
    @property
    def unexpected_changes(self) -> list[dict[str, Any]]:
        return self.judge.warnings if self.judge else []
        
    @property
    def steps(self) -> int:
        return self.execution.steps
        
    @property
    def error(self) -> Optional[str]:
        """Unified error: execution error or judge-phase error."""
        if self.execution.error:
            return self.execution.error
        if self.judge and self.judge.judge_error:
            return self.judge.judge_error
        return None

    @property
    def false_complete(self) -> bool:
        """Agent declared FINISH but the episode is not fully successful.

        Paper definition (FC): the agent issued COMPLETE but the run does not
        count as a full success — either the goal was not reached or there were
        unexpected side effects. Equivalent to `COMPLETE AND NOT is_success`.
        """
        return self.execution.stop_reason == ActionType.COMPLETE and not self.success and not self.error

    @property
    def overdue_termination(self) -> bool:
        """Agent achieved the goal but never declared FINISH (truncated by step limit or loop detection)."""
        return self.execution.truncated and self.goal_success and not self.error

    def to_dict(self) -> dict[str, Any]:
        exec_d = {
            "steps": self.execution.steps,
            "finished": self.execution.finished,
            "truncated": self.execution.truncated,
            "stop_reason": self.execution.stop_reason,
            "agent_message": self.execution.agent_message,
            "agent_answer": self.execution.agent_answer,
            "runtime_s": self.execution.runtime_s,
            "error": self.execution.error,
            "stopwatch_total_s": self.execution.stopwatch_total_s,
            "stopwatch_flat": self.execution.stopwatch_flat,
            "stopwatch_tree": self.execution.stopwatch_tree,
        }
        d: dict[str, Any] = {
            "id": self.task_id,
            "task_name": self.task_name,
            "suite": self.suite,
            "apps": self.apps,
            "trial_id": self.trial_id,
            "max_steps": self.max_steps,
            "execution": exec_d,
            "judge": self.judge.to_dict() if self.judge else None,
            "is_success": self.success,
            "is_error": self.error is not None,
            "progress": self.progress,
            "false_complete": self.false_complete,
            "overdue_termination": self.overdue_termination,
        }
        # Task taxonomy (omit empty)
        if self.difficulty:
            d["difficulty"] = self.difficulty
        if self.scope:
            d["scope"] = self.scope
        if self.objective:
            d["objective"] = self.objective
        if self.composition:
            d["composition"] = self.composition
        if self.capabilities:
            d["capabilities"] = self.capabilities
        return d


class BaseRunner(ABC):
    """所有 Runner 的基类，提供核心循环"""

    @staticmethod
    def build_run_meta(config: RunnerConfig, tasks: list[Any] | None = None) -> dict:
        """构建运行元数据（用于可复现性）"""
        meta = config.to_dict()
        if tasks is not None:
            meta["task_max_steps"] = {
                task.id: config.get_max_steps(task)
                for task in tasks
            }
        return meta

    # ---- 核心循环 (async) ----

    @staticmethod
    async def run_episode(
        env, agent, task, max_steps=20, recorder=None, trial_id: int = 0,
        evaluator: Optional[Evaluator] = None,
        loop_threshold: int = 0,
        episode_timeout_s: float = DEFAULT_EPISODE_TIMEOUT_S,
    ) -> EpisodeResult:
        """运行单个 episode (Facade 方法).
        
        Args:
            env: Environment instance
            agent: Agent instance
            task: Task instance
            max_steps: Maximum steps per episode
            recorder: Optional recorder for saving trajectory
            trial_id: Trial index for pass@k evaluation (0-indexed)
            evaluator: Evaluator instance for task evaluation
            episode_timeout_s: Wall-clock budget per episode step loop
        """
        # Use default evaluator if not provided
        if evaluator is None:
            evaluator = Evaluator()
        
        # 1. Control Phase (Interaction)
        eval_mode = getattr(evaluator, "eval_mode", "grounded")
        exec_result, init_obs, last_obs, episode, task = await Controller.run_loop(
            env, agent, task, max_steps, recorder, trial_id=trial_id, eval_mode=eval_mode,
            loop_threshold=loop_threshold,
            episode_timeout_s=episode_timeout_s,
        )
        
        # 2. Evaluation Phase (Judge)
        judge = None
        sw = env.stopwatch
        with sw.phase("eval"):
            if not exec_result.error and init_obs and last_obs:
                try:
                    judge = await evaluator.evaluate(task, init_obs, last_obs, exec_result, episode)
                except Exception as eval_err:
                    logger.error(f"[{task.id}] evaluator.evaluate() crashed: {type(eval_err).__name__}: {eval_err}")
                    exec_result = dc_replace(
                        exec_result,
                        error=f"judge_error: {type(eval_err).__name__}: {eval_err}",
                    )
            
        # 3. Result Assembly
        try:
            result = EpisodeResult(
                task_id=task.id, task_name=task.description, suite=task.suite,
                execution=exec_result,
                judge=judge,
                trial_id=trial_id,
                apps=list(task.apps),
                max_steps=max_steps,
                **EpisodeResult._task_taxonomy(task),
            )
        except Exception as e:
            logger.error(f"[{task.id}] EpisodeResult construction failed: {e}")
            result = EpisodeResult(
                task_id=task.id, task_name=str(task.id), suite=task.suite,
                execution=exec_result,
                judge=None,
                trial_id=trial_id,
                apps=list(task.apps),
                max_steps=max_steps,
            )
        
        try:
            if episode:
                episode.finish(result.to_dict())
            elif recorder:
                recorder.record_result(result.to_dict())

            try:
                logger.info(
                    f"[{task.id}] profile: {sw.summary()} "
                    f"(steps={exec_result.steps} runtime={exec_result.runtime_s:.1f}s)"
                )
            except Exception as sw_err:
                logger.warning(f"[{task.id}] stopwatch summary failed: {type(sw_err).__name__}: {sw_err}")
        finally:
            agent.reset_history()

        return result

    # ---- 打印 ----

    @staticmethod
    def print_summary(results, run_dir=None):
        from collections import defaultdict

        valid = [r for r in results if r is not None]
        total = len(valid)
        if total == 0:
            logger.info("No results to summarize.")
            return

        success_count = sum(1 for r in valid if r.success)
        errored = [r for r in valid if r.error]
        error_count = len(errored)
        valid_count = total - error_count
        sr = success_count / max(1, valid_count)

        progresses = [r.progress for r in valid]
        pr = sum(progresses) / total

        finished = [r for r in valid if r.execution.finished]
        truncated = [r for r in valid if r.execution.truncated]

        false_complete = sum(1 for r in valid if r.false_complete)
        overdue = sum(1 for r in valid if r.overdue_termination)
        fc_rate = false_complete / total
        otr = overdue / total

        successful_steps = [r.steps for r in valid if r.success]
        avg_steps_success = (sum(successful_steps) / len(successful_steps)) if successful_steps else 0
        avg_steps_all = sum(r.steps for r in valid) / total

        dirty = sum(1 for r in valid if r.judge and not r.judge.clean)
        dirty_rate = dirty / total

        logger.info(f"\n{'='*60}")
        logger.info(f"  RESULTS SUMMARY ({total} episodes, {error_count} errors)")
        logger.info(f"{'='*60}")
        logger.info(f"  Success Rate (SR):              {success_count}/{valid_count} = {sr:.1%}")
        logger.info(f"  Progress Rate (PR):             {pr:.1%}")
        logger.info(f"  False Complete (FC):            {false_complete}/{total} = {fc_rate:.1%}")
        logger.info(f"  Overdue Termination (OT):       {overdue}/{total} = {otr:.1%}")
        logger.info(f"  Unexpected Side Effects (USE):  {dirty}/{total} = {dirty_rate:.1%}")
        logger.info(f"  Avg Steps (success):            {avg_steps_success:.1f}")
        logger.info(f"  Avg Steps (all):                {avg_steps_all:.1f}")
        logger.info(f"  Errors:                         {error_count}")
        if run_dir:
            logger.info(f"  Output:                         {run_dir}")
        logger.info(f"{'='*60}")

        by_suite: dict[str, list] = defaultdict(list)
        for r in valid:
            by_suite[r.suite].append(r)

        if len(by_suite) > 1:
            logger.info(f"\n  {'Suite':<20} {'SR':>8} {'PR':>8} {'Count':>6}")
            logger.info(f"  {'-'*20} {'-'*8} {'-'*8} {'-'*6}")
            for suite in sorted(by_suite):
                rs = by_suite[suite]
                s_err = sum(1 for r in rs if r.error)
                s_valid = len(rs) - s_err
                s_sr = sum(1 for r in rs if r.success) / max(1, s_valid)
                s_pr = sum(r.progress for r in rs) / len(rs)
                logger.info(f"  {suite:<20} {s_sr:>7.1%} {s_pr:>7.1%} {len(rs):>6}")

    # ---- Monitor ----

    @staticmethod
    def _start_monitor(run_dir: Path | None, config: "RunnerConfig" = None) -> asyncio.Task | None:
        """Start monitor as an asyncio task. Returns the task (cancel to stop)."""
        from bench_env.monitor import monitor_loop

        vllm_port: int | None = None
        if config and config.model_base_url:
            parsed = urlparse(config.model_base_url)
            host = parsed.hostname or ""
            if host in ("127.0.0.1", "localhost", "0.0.0.0") and parsed.port:
                vllm_port = parsed.port

        return asyncio.create_task(
            monitor_loop(run_dir=run_dir, vllm_port=vllm_port, interval=10.0)
        )

    @staticmethod
    def _stop_monitor(task: asyncio.Task | None) -> None:
        if task is not None and not task.done():
            task.cancel()

    # ---- 抽象接口 ----

    @classmethod
    @abstractmethod
    async def from_args(cls, args: argparse.Namespace) -> "BaseRunner":
        raise NotImplementedError

    @abstractmethod
    async def run(self):
        raise NotImplementedError
