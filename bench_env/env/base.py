"""
Base environment interface and data types.

This module defines the core abstractions for mobile GUI environments:
- Observation: What the agent sees
- Action: What the agent does
- StepResult: What the environment returns
- BaseMobileEnv: Abstract environment interface
"""

from __future__ import annotations

import base64
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    import numpy as np
    from bench_env.task.judge import JudgeResult
    from bench_env.task.base import BaseTask


class ActionType(str, Enum):
    """
    Standard action types supported by the environment.
    
    Inherits from str for JSON serialization and string comparison compatibility.
    
    Physical actions (require coordinates):
        CLICK: 单击，data={point: [x, y]}
        DOUBLE_TAP: 双击，data={point: [x, y]}
        LONG_PRESS: 长按，data={point: [x, y]}
        TYPE: 输入文本，data={value: str, point?: [x, y]}
        SWIPE: 滑动（带惯性），data={point1: [x, y], point2: [x, y]}
        DRAG: 拖动（长按后移动，无惯性），data={point1: [x, y], point2: [x, y]}
        BACK: 返回键，data={}
        HOME: 主页键，data={}
        RECENT: 最近任务键，data={}
        ENTER: 回车键，data={}
    
    Control actions:
        WAIT: 等待，data={value: seconds}
        AWAKE: 启动应用，data={value: app_id}
    
    Answer action:
        ANSWER: 提交答案，data={value: str}

    Terminal actions (end episode):
        COMPLETE: 完成任务，data={return: str}
        ABORT: 放弃任务，data={value: reason}
    
    Special actions:
        INFO: 向用户提问，data={value: question}
        NOOP: 无操作，data={}
    """
    # Physical actions
    CLICK = "CLICK"
    DOUBLE_TAP = "DOUBLE_TAP"
    LONG_PRESS = "LONG_PRESS"
    TYPE = "TYPE"
    SWIPE = "SWIPE"
    DRAG = "DRAG"
    BACK = "BACK"
    HOME = "HOME"
    RECENT = "RECENT"
    ENTER = "ENTER"
    
    # Control actions
    WAIT = "WAIT"
    AWAKE = "AWAKE"
    
    # Answer action
    ANSWER = "ANSWER"
    
    # Terminal actions
    COMPLETE = "COMPLETE"
    ABORT = "ABORT"
    
    # Special actions
    INFO = "INFO"
    NOOP = "NOOP"  # 无操作（Agent 内部动作，不影响环境）


class EmptyData(TypedDict):
    pass


class PointData(TypedDict):
    point: list[int]


class SwipeData(TypedDict):
    point1: list[int]
    point2: list[int]


class TypeData(TypedDict, total=False):
    value: str
    point: list[int]
    clear: bool


class WaitData(TypedDict, total=False):
    value: float


class AwakeData(TypedDict, total=False):
    value: str


class AnswerData(TypedDict):
    value: str


CompleteData = TypedDict("CompleteData", {"return": str}, total=False)


class AbortData(TypedDict, total=False):
    value: str


class InfoData(TypedDict, total=False):
    value: str


class NoopData(TypedDict, total=False):
    message: str
    instruction: str
    unknown_action: str


ActionData = (
    EmptyData
    | PointData
    | SwipeData
    | TypeData
    | WaitData
    | AwakeData
    | AnswerData
    | CompleteData
    | AbortData
    | InfoData
    | NoopData
)


@dataclass(frozen=True)
class Observation:
    """
    Environment observation.

    Attributes:
        screenshot_base64: Base64-encoded screenshot (JPEG or PNG), optional when
            screenshot_bytes is set (legacy / fallback path).
        screenshot_bytes: Raw screenshot bytes (JPEG or PNG); preferred for memory.
        screenshot: Optional decoded image array (HWC RGB)
        route: Current app/page route information
        state: Application state dictionary
        step_idx: Current step number (1-indexed)
    """
    screenshot_base64: str = ""
    route: dict[str, Any] = field(default_factory=dict)
    state: dict[str, Any] = field(default_factory=dict)
    step_idx: int = 0
    screenshot: Optional[Any] = None  # Optional numpy array
    screenshot_bytes: bytes = b""

    def get_screenshot_bytes(self) -> bytes:
        """Prefer raw bytes; fallback decode screenshot_base64."""
        if self.screenshot_bytes:
            return self.screenshot_bytes
        if self.screenshot_base64:
            return base64.b64decode(self.screenshot_base64.encode("utf-8"))
        return b""

    @property
    def image_data_url(self) -> str:
        """Return data URL for VLM consumption."""
        if self.screenshot_bytes:
            mime = (
                "image/jpeg"
                if self.screenshot_bytes[:2] == b"\xff\xd8"
                else "image/png"
            )
            b64 = base64.b64encode(self.screenshot_bytes).decode()
            return f"data:{mime};base64,{b64}"
        if self.screenshot_base64:
            mime = "image/jpeg" if self.screenshot_base64.startswith("/9j") else "image/png"
            return f"data:{mime};base64,{self.screenshot_base64}"
        return ""

    @property
    def current_app(self) -> str:
        """Return current app name from route."""
        return str(self.route.get("app") or "")

    @property
    def current_path(self) -> str:
        """Return current path from route."""
        return str(self.route.get("path") or "")


@dataclass
class Action:
    """
    Agent action.
    
    Standard action types:
    - Physical: CLICK, TYPE, SWIPE, LONG_PRESS, DOUBLE_TAP, BACK, HOME
    - Control: WAIT, AWAKE (open app), ANSWER
    - Terminal: COMPLETE, ABORT
    - Special: INFO
    
    Attributes:
        action_type: Action type (ActionType enum or string)
        data: Action parameters (point, value, etc.)
        thought: Agent's reasoning (optional, for logging)
        explain: Brief explanation (optional)
        summary: Step summary (optional, for history)
    """
    action_type: ActionType
    data: ActionData = field(default_factory=dict)
    thought: str = ""
    explain: str = ""
    summary: str = ""
    raw_response: str = ""

    def __post_init__(self):
        """Validate action type."""
        if not isinstance(self.action_type, ActionType):
            raise TypeError(f"action_type must be ActionType, got {type(self.action_type)}")

    @property
    def is_terminal(self) -> bool:
        """Check if this is a terminal action."""
        return self.action_type in {ActionType.COMPLETE, ActionType.ABORT}

    @property
    def is_info(self) -> bool:
        """Check if this is an INFO action (requires user response)."""
        return self.action_type == ActionType.INFO

    # Factory methods for common actions
    @classmethod
    def click(cls, point: list[int], **kwargs) -> "Action":
        return cls(ActionType.CLICK, {"point": point}, **kwargs)

    @classmethod
    def type_text(cls, value: str, point: Optional[list[int]] = None, **kwargs) -> "Action":
        data = {"value": value}
        if point:
            data["point"] = point
        return cls(ActionType.TYPE, data, **kwargs)

    @classmethod
    def swipe(cls, point1: list[int], point2: list[int], **kwargs) -> "Action":
        return cls(ActionType.SWIPE, {"point1": point1, "point2": point2}, **kwargs)

    @classmethod
    def complete(cls, message: str = "", **kwargs) -> "Action":
        return cls(ActionType.COMPLETE, {"return": message}, **kwargs)

    @classmethod
    def abort(cls, reason: str = "", **kwargs) -> "Action":
        return cls(ActionType.ABORT, {"value": reason}, **kwargs)

    @classmethod
    def info(cls, question: str, **kwargs) -> "Action":
        return cls(ActionType.INFO, {"value": question}, **kwargs)

    @classmethod
    def wait(cls, seconds: float = 1.0, **kwargs) -> "Action":
        return cls(ActionType.WAIT, {"value": seconds}, **kwargs)

    @classmethod
    def back(cls, **kwargs) -> "Action":
        return cls(ActionType.BACK, {}, **kwargs)

    @classmethod
    def home(cls, **kwargs) -> "Action":
        return cls(ActionType.HOME, {}, **kwargs)

    @classmethod
    def awake(cls, app_name: str, **kwargs) -> "Action":
        return cls(ActionType.AWAKE, {"value": app_name}, **kwargs)

    @classmethod
    def answer(cls, value: str, **kwargs) -> "Action":
        return cls(ActionType.ANSWER, {"value": value}, **kwargs)


@dataclass(frozen=True)
class StepResult:
    """
    Result of environment step.
    
    Attributes:
        observation: New observation after action
        done: Whether episode is finished
        info: Additional information (stop_reason, etc.)
    """
    observation: Observation
    done: bool = False
    info: dict[str, Any] = field(default_factory=dict)

    @property
    def stop_reason(self) -> Optional[str]:
        return self.info.get("stop_reason")


class BaseMobileEnv(ABC):
    """
    Abstract base class for mobile GUI environments.

    All methods are async to support non-blocking I/O operations.

    Implementations:
    - MobileGymEnv: Playwright-based simulator
    - RealDeviceEnv: ADB-based real device (TODO)
    """

    # Feature flag: whether the env supports JSON state mutation via set_state().
    # Sim envs support this; real-device envs (screenshot + ADB only) do not,
    # which means grounded-mode answer_sheet injection must be skipped.
    supports_state_injection: bool = True

    @abstractmethod
    async def reset(self) -> None:
        """
        Reset environment and start a new episode.
        """
        pass

    @abstractmethod
    async def step(self, action: Action) -> StepResult:
        """
        Execute action and return result.
        
        Args:
            action: Action to execute
            
        Returns:
            StepResult with new observation and done flag
        """
        pass

    @abstractmethod
    async def close(self) -> None:
        """Close environment and release resources."""
        pass

    @property
    @abstractmethod
    def agent_message(self) -> Optional[str]:
        """Return agent's terminal message (from COMPLETE or ABORT action)."""
        pass

    @property
    @abstractmethod
    def agent_answer(self) -> Optional[str]:
        """Return agent's latest submitted answer (from ANSWER action)."""
        pass

    def get_device_size(self) -> tuple[int, int]:
        """Return device screen size (width, height) in physical pixels."""
        return (1080, 2400)  # Default

    # -------------------------------------------------------------------------
    # Public environment APIs used by tasks (do NOT call private methods).
    # -------------------------------------------------------------------------

    @abstractmethod
    async def get_observation(self) -> Observation:
        """Get a fresh observation without taking an action."""
        raise NotImplementedError

    @abstractmethod
    async def get_state(self) -> dict[str, Any]:
        """Get current environment state (apps/os)."""
        raise NotImplementedError

    async def set_state(self, patch: dict, *, deep: bool = True, reload: bool = False) -> None:
        """
        Optionally modify environment state.

        Not all environments can support this (e.g. real device visual-only mode).
        """
        raise NotImplementedError(f"{self.__class__.__name__} does not support set_state()")

    @abstractmethod
    async def open_app(self, app_name: str, timeout_ms: int = 8000, wait_stable: bool = False) -> None:
        """Open an application by name/package."""
        raise NotImplementedError

    async def go_home(self) -> None:
        """Return to the home screen (launcher)."""
        pass

    async def warm_apps(self, app_ids: list[str]) -> None:
        """Open each app to trigger mounting, then return to home.

        Default implementation opens sequentially. MobileGymEnv overrides
        with a single-evaluate approach to avoid per-app CDP round-trips.
        """
        for app_id in app_ids:
            await self.open_app(app_id, wait_stable=True)
        await self.go_home()
