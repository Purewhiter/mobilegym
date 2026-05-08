"""
Task evaluation module.

This module provides the task system for bench_env:
- JudgeInput/JudgeResult: Input/output types for evaluation
- BaseTask/BaseApp: Abstract base classes
- TaskSampler: Parameter sampling from environment state
- CriteriaTask/AnswerTask: Common task patterns
- TaskRegistry: Registry for discovering task classes

App-specific modules:
- bench_env.task.wechat: WeChat tasks and state accessor
- bench_env.task.redbook: Redbook tasks and state accessor
"""

from bench_env.task.judge import JudgeInput, JudgeResult
from bench_env.task.base import BaseTask, BaseApp
from bench_env.task.sampler import TaskSampler, SampleResult
from bench_env.task.common_tasks import CriteriaTask, AnswerTask
from bench_env.task.registry import TaskRegistry, load_tasks

# App-specific exports (for convenience)
from bench_env.task.wechat import Wechat
from bench_env.task.file_manager import FileManager, FileSystem
from bench_env.task.redbook import Redbook

__all__ = [
    # Judge types
    "JudgeInput",
    "JudgeResult",
    # Task base classes
    "BaseTask",
    "BaseApp",
    # Sampler
    "TaskSampler",
    "SampleResult",
    # Common task patterns
    "CriteriaTask",
    "AnswerTask",
    # Registry
    "TaskRegistry",
    # Convenience function
    "load_tasks",
    # App-specific state accessors
    "FileManager",
    "FileSystem",
    "Wechat",
    "Redbook",
]
