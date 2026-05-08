"""
Base agent interface.

Agents encapsulate the complete decision-making logic:
- Prompt construction
- LLM calling
- Response parsing
- History management
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, ClassVar, Optional

from bench_env.env.base import Action, ActionType, Observation


def _default_info_reply(question: str = "") -> str:
    """默认 INFO 回复"""
    return "请继续完成任务，不要再询问。"


def _interactive_info_reply(question: str = "") -> str:
    """交互式 INFO 回复（等待用户输入）"""
    if question:
        print(f"\n[Agent Question] {question}")
    return input("[Your Reply] > ").strip()


# 动作映射类型：Agent动作名 -> (环境动作类型, 参数提取函数)
ActionMapping = dict[str, tuple[ActionType, Callable[[dict], dict]]]


@dataclass
class AgentConfig:
    """
    Agent configuration.
    
    Attributes:
        model_args: LLM model arguments (temperature, max_tokens, etc.)
        verbose: Whether to print debug information
        stream: Whether to stream LLM output
        info_reply: INFO 回复策略，可以是：
            - str: 固定回复文本
            - Callable[[str], str]: 回调函数，接收问题返回回复
            - None: 不回复
    """
    model_args: dict[str, Any] = field(default_factory=lambda: {
        "temperature": 0.1,
        "top_p": 0.95,
        "max_tokens": 4096,
    })
    verbose: bool = False
    stream: bool = True
    info_reply: Any = field(default_factory=lambda: _default_info_reply)
    screen_size: tuple[int, int] = (1080, 2400)  # 设备物理分辨率（像素）


@dataclass
class AgentStepRecord:
    """
    Record of a single agent step.
    
    Used for history tracking and debugging.
    """
    step_idx: int
    observation: Optional[Observation]
    action: Action
    llm_response: str = ""
    llm_prompt: list = field(default_factory=list)  # 完整的 prompt messages
    user_comment: str = ""


class BaseAgent(ABC):
    """
    Abstract base class for mobile GUI agents.
    
    子类必须实现：
    - name: Agent 标识名
    - SYSTEM_PROMPT: 系统提示词
    - ACTION_MAP: 动作映射表 {Agent动作名 -> (环境动作类型, 参数提取函数)}
    - parse_response(): 解析 LLM 响应为 Action
    - build_messages(): 构建发送给 LLM 的消息
    - reset(): 重置状态
    - act(): 生成动作
    """
    
    # ==================== 子类必须定义的类属性 ====================
    
    SYSTEM_PROMPT: ClassVar[str] = ""
    """系统提示词，定义 Agent 的行为规范和动作空间"""
    
    ACTION_MAP: ActionMapping = {}
    """动作映射表：Agent动作名 -> (环境ActionType, 参数提取函数)
    
    子类可在类级别直接赋值（静态映射），也可在 __init__ 中
    通过 self.ACTION_MAP = {...} 构建实例级映射（需捕获 config 参数时）。
    """
    
    DEFAULT_MODEL_ARGS: ClassVar[dict[str, Any]] = {}
    """默认模型参数"""

    def __init__(self, config: Optional[AgentConfig] = None):
        """
        Initialize agent.
        
        Args:
            config: Agent configuration
        """
        self.config = config or AgentConfig()
        self._task: str = ""
        self._history: list[AgentStepRecord] = []

    # ==================== 子类必须实现的抽象方法 ====================
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Agent name/identifier."""
        pass

    @abstractmethod
    def parse_response(self, response_text: str) -> Action:
        """
        解析 LLM 响应为 Action。
        
        应使用 ACTION_MAP 进行动作映射。
        
        Args:
            response_text: LLM 原始响应文本
            
        Returns:
            解析后的 Action
        """
        pass

    @abstractmethod
    def build_messages(self, obs: Observation) -> list[dict]:
        """
        构建发送给 LLM 的消息列表。
        
        应使用 SYSTEM_PROMPT 和当前 observation/history。
        
        Args:
            obs: 当前观察
            
        Returns:
            OpenAI 格式的消息列表
        """
        pass

    @abstractmethod
    def reset(self, task: str) -> None:
        """
        Reset agent state for a new task.
        
        Args:
            task: Task description/instruction
        """
        pass

    @abstractmethod
    def act(self, obs: Observation) -> Action:
        """
        Generate action from observation.
        
        典型实现流程：
        1. build_messages(obs) 构建消息
        2. 调用 LLM
        3. parse_response() 解析响应
        4. 更新 history
        5. 返回 action
        
        Args:
            obs: Current observation
            
        Returns:
            Action to execute
        """
        pass

    # ==================== 通用属性和方法 ====================
    
    @property
    def task(self) -> str:
        """Current task description."""
        return self._task

    @property
    def history(self) -> list[AgentStepRecord]:
        """Step history for current episode."""
        return self._history

    def add_user_comment(self, comment: str) -> None:
        """
        Add user comment to be included in next prompt.
        
        Used for INFO action responses.
        
        Args:
            comment: User's response to agent question
        """
        # Default implementation: subclasses can override
        pass

    def _evict_old_records(self, keep_recent: int) -> None:
        """清空过旧历史记录的重量级数据以释放内存。

        保留最近 *keep_recent* 条完整记录（含 observation 和 llm_prompt），
        更早的记录仅保留 step_idx、llm_response（短文本）和 action 等轻量标识。

        典型调用位置：agent.act() 中 ``_history.append(...)`` 之后。
        keep_recent 一般设为 ``HISTORY_WINDOW_SIZE + 1``
        （窗口条数 + 1 条供 Runner 读取 llm_prompt）。
        """
        evict_before = len(self._history) - keep_recent
        for i in range(max(0, evict_before)):
            rec = self._history[i]
            if rec.observation is not None:
                rec.observation = None
            if rec.llm_prompt:
                rec.llm_prompt = []

    def reset_history(self) -> None:
        """清空历史记录，释放内存。每个 episode 结束后由 Runner 调用。"""
        self._history.clear()

    def get_last_action(self) -> Optional[Action]:
        """Get the last action taken."""
        if self._history:
            return self._history[-1].action
        return None
    
    def get_action_space(self) -> list[str]:
        """获取该 Agent 支持的动作列表"""
        return list(self.ACTION_MAP.keys())

    def parse_action(self, action_name: str, parsed_data: dict[str, Any], **kwargs) -> Action:
        """
        根据 ACTION_MAP 将 Agent 动作转换为环境 Action。
        
        这是通用逻辑，子类一般不需要覆盖。
        
        Args:
            action_name: Agent 输出的动作名称
            parsed_data: 解析出的动作参数字典
            **kwargs: 额外参数（thought, explain, summary, raw_response 等）
            
        Returns:
            转换后的 Action 对象
        """
        if action_name in self.ACTION_MAP:
            env_type, data_fn = self.ACTION_MAP[action_name]
            data = data_fn(parsed_data)
            # 过滤 None 值
            data = {k: v for k, v in data.items() if v is not None}
        else:
            env_type = ActionType.NOOP
            data = {"unknown_action": action_name}
        
        return Action(
            action_type=env_type,
            data=data,
            thought=kwargs.get("thought", ""),
            explain=kwargs.get("explain", ""),
            summary=kwargs.get("summary", ""),
            raw_response=kwargs.get("raw_response", ""),
        )
