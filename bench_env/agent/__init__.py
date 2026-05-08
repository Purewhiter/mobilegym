"""Agent module."""

from bench_env.agent.base import BaseAgent, AgentConfig, _interactive_info_reply as interactive_info_reply
from bench_env.agent.gelab import GelabAgent
from bench_env.agent.autoglm import AutoGLMAgent
from bench_env.agent.human import HumanAgent
from bench_env.agent.generic import GenericAgent
from bench_env.agent.generic_v2 import GenericAgentV2
from bench_env.agent.venus import VenusAgent
from bench_env.agent.gui_owl import GUIOwl15Agent
from bench_env.agent.uitars import UITarsAgent
from bench_env.agent.mai_ui import MAIUIAgent

# Agent 注册表
AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "gelab": GelabAgent,
    "autoglm": AutoGLMAgent,
    "generic": GenericAgent,
    "generic_v2": GenericAgentV2,
    "human": HumanAgent,
    "venus": VenusAgent,
    "gui_owl": GUIOwl15Agent,
    "uitars": UITarsAgent,
    "mai_ui": MAIUIAgent,
}


def register_agent(name: str, agent_cls: type[BaseAgent]):
    """注册新 Agent"""
    AGENT_REGISTRY[name] = agent_cls


def get_agent_class(name: str) -> type[BaseAgent]:
    """获取 Agent 类"""
    if name not in AGENT_REGISTRY:
        raise ValueError(f"Unknown agent: {name}. Available: {list(AGENT_REGISTRY.keys())}")
    return AGENT_REGISTRY[name]


def list_agents() -> list[str]:
    """列出所有可用的 Agent"""
    return list(AGENT_REGISTRY.keys())


__all__ = [
    "BaseAgent",
    "AgentConfig",
    "GelabAgent",
    "AutoGLMAgent",
    "GenericAgent",
    "GenericAgentV2",
    "HumanAgent",
    "VenusAgent",
    "GUIOwl15Agent",
    "UITarsAgent",
    "MAIUIAgent",
    "AGENT_REGISTRY",
    "register_agent",
    "get_agent_class",
    "list_agents",
    "interactive_info_reply",
]
