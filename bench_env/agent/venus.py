from __future__ import annotations

import re
from typing import Any, Optional

from bench_env.agent.base import AgentConfig, BaseAgent, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient


class VenusAgent(BaseAgent):

    # 官方 UI-Venus 1.5 prompt 模板（与 uivenus_processor.py USER_PROMPT 完全一致）
    PROMPT_TEMPLATE = """\n**你是一个手机图形界面智能体代理**
你的任务是根据历史操作和当前设备状态去执行一系列操作来完成用户的任务。

###你可以用的操作以及对应功能如下
- Click(box=(x1,y1))
>>点击操作，点击屏幕上的指定位置。坐标区间从左上角(0,0)到右下角(999,999)。
- Drag(start=(x1,y1), end=(x2,y2))
>>拖动操作，从起始坐标长按数秒之后拖动到结束坐标。用于调整app布局，滑动滑块验证码等。
- Scroll(start=(x1,y1), end=(x2,y2))
>>滑动操作，从起始坐标拖动到结束坐标。用于滚动查找内容，切换选项卡，下拉通知栏等。坐标区间从左上角(0,0)到右下角(999,999)。
- Type(content='')
>>输入操作，在当前激活的输入框输入指定内容。
- Launch(app='')
>>启动目标app。当目标app在当前界面不可见时，可以使用该动作打开app。
- Wait()
>>等待页面加载。
- Finished(content='')
>>任务结束，退出设备接管。
- CallUser(content='')
>>回答用户的问题或者当前界面有多个符合要求的选项时需要用户接管。
- LongPress(box=(x1,y1))
>>长按操作，在指定位置长按一定的时间。该操作可以触发更多功能选项，例如复制、转发消息，删除等。坐标区间从左上角(0,0)到右下角(999,999)。
- PressBack()
>>返回上一个界面，一般用于错误回退或继续执行剩余任务。
- PressHome()
>>返回系统桌面，一般用于跨app任务中快速打开下一个app或遇到严重错误时回退到系统桌面。
- PressEnter()
>>回车操作，用于换行或者在搜索框中输入内容之后执行搜索操作。
- PressRecent()
>>打开系统后台界面。

###用户任务
{user_task}

###先前的动作和推理过程
{previous_actions}

###输出格式
<think>你的思考过程</think>
<action>执行的操作</action>
<conclusion>总结当前操作</conclusion>

###额外的提示
-输入内容之前，确保输入框已经被激活（出现键盘或者'ADB Keyboard {{ON}}'字样代表输入框已经激活）。
-在app内找不到任务要求的入口时，尝试使用搜索功能，或者如果当前页面上方存在选多个项卡，尝试使用Scroll操作查看。
-如果在执行任务的过程中进入到和任务无关的界面，使用PressBack进行回退。
-任务结束之前，确保已经完整准确地完成用户的任务，如果存在漏做、错做的内容，需要返回重新执行。
"""

    # ==================== 类属性 ====================

    # ACTION_MAP 在 __init__ 中构建（需绑定 screen_size 计算 swipe duration）

    DEFAULT_MODEL_ARGS = {
        "temperature": 0.0,
        # "top_p": 1.0,
        # "max_tokens": 4096,
    }

    # ==================== 初始化 ====================

    @staticmethod
    def _swipe_duration(start, end, ref_w: int, ref_h: int):
        """官方 Venus adb_controller.swipe duration 计算（L94-96）.

        公式: max(1000, min(dist_sq_physical / 1000, 2000))
        ref_w/ref_h 为设备物理分辨率，用于将 0-999 归一化坐标还原。
        """
        if not start or not end or len(start) < 2 or len(end) < 2:
            return 1000
        dx = (start[0] - end[0]) * ref_w / 1000
        dy = (start[1] - end[1]) * ref_h / 1000
        dist_sq = dx * dx + dy * dy
        return max(1000, min(int(dist_sq / 1000), 2000))

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None):
        super().__init__(config)
        self.llm = llm
        self._action_history: list[str] = []
        self._pending_comment = ""

        # 构建实例级 ACTION_MAP，绑定 screen_size 计算 swipe/drag duration
        w, h = self.config.screen_size
        dur = lambda s, e: self._swipe_duration(s, e, w, h)
        self.ACTION_MAP = {
            "Click": (ActionType.CLICK, lambda p: {"point": p.get("box")}),
            "LongPress": (ActionType.LONG_PRESS, lambda p: {"point": p.get("box"), "duration": 500}),
            "Scroll": (ActionType.SWIPE, lambda p: {
                "point1": p.get("start"), "point2": p.get("end"),
                "duration": dur(p.get("start"), p.get("end")),
            }),
            "Drag": (ActionType.DRAG, lambda p: {
                "point1": p.get("start"), "point2": p.get("end"),
                "duration": dur(p.get("start"), p.get("end")),
            }),
            "Type": (ActionType.TYPE, lambda p: {"value": p.get("content", "")}),
            "Launch": (ActionType.AWAKE, lambda p: {"value": p.get("app", "")}),
            "Wait": (ActionType.WAIT, lambda p: {"value": 1.0}),
            "Finished": (ActionType.COMPLETE, lambda p: {"return": p.get("content", "")}),
            "CallUser": (ActionType.INFO, lambda p: {"value": p.get("content", "")}),
            "PressBack": (ActionType.BACK, lambda p: {}),
            "PressHome": (ActionType.HOME, lambda p: {}),
            "PressEnter": (ActionType.ENTER, lambda p: {}),
            "PressRecent": (ActionType.RECENT, lambda p: {}),
        }

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "VenusAgent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._action_history: list[str] = []
        self._pending_comment = ""

    def reset_history(self) -> None:
        super().reset_history()
        self._action_history.clear()

    # ==================== 响应解析 ====================

    def _parse_llm_output(self, response_text: str) -> dict[str, Any]:
        raw = str(response_text or "").strip()
        if not raw:
            return {"action": "CallUser", "content": "empty_response", "think": "", "conclusion": ""}

        def extract_tag_content(tag_name: str, data: str) -> Optional[str]:
            pattern = rf"<{tag_name}>(.*?)</{tag_name}>"
            match = re.search(pattern, data, re.DOTALL)
            return match.group(1).strip() if match else None

        think = extract_tag_content('think', raw) or ''
        conclusion = extract_tag_content('conclusion', raw) or ''

        action_str = extract_tag_content('action', raw) or raw.strip()

        action_type = "CallUser"
        params = {"content": "无法解析模型输出"}

        try:
            func_call_match = re.match(r'(\w+)\((.*)\)', action_str)
            if func_call_match:
                func_name = func_call_match.group(1)
                params_str = func_call_match.group(2)

                parsed_params = {}
                param_pattern = r"(\w+)\s*=\s*(\([^)]+\)|'[^']*'|\"[^\"]*\"|[^,]+)"
                param_matches = re.findall(param_pattern, params_str)

                for key, value in param_matches:
                    key = key.strip()
                    value = value.strip()
                    if value.startswith("'") and value.endswith("'"):
                        parsed_params[key] = value[1:-1]
                    elif value.startswith('"') and value.endswith('"'):
                        parsed_params[key] = value[1:-1]
                    elif value.startswith('(') and value.endswith(')'):
                        try:
                            inner = value[1:-1]
                            parts = [p.strip() for p in inner.split(',')]
                            parsed_params[key] = [int(p) for p in parts]
                        except ValueError:
                            parsed_params[key] = value
                    elif value.replace('.', '', 1).replace('-', '', 1).isdigit():
                        parsed_params[key] = float(value) if '.' in value else int(value)
                    else:
                        parsed_params[key] = value

                action_type = func_name
                params = parsed_params

        except (ValueError, KeyError) as e:
            action_type = 'CallUser'
            params = {'content': f"解析失败: {str(e)}"}

        return {
            "action": action_type,
            "params": params,
            "think": think,
            "conclusion": conclusion,
            "raw_action": action_str,
        }

    def parse_response(self, response_text: str) -> Action:
        parsed = self._parse_llm_output(response_text)
        action_name = str(parsed.get("action", "CallUser")).strip()

        return self.parse_action(
            action_name,
            parsed.get("params", {}),
            thought=parsed.get("think", ""),
            explain=parsed.get("conclusion", ""),
            raw_response=response_text,
        )

    # ==================== 消息构建 ====================

    def _build_status_prompt(self, task: str, image_url: str) -> list[dict]:
        formatted_list = [f"Step {i}: {item}" for i, item in enumerate(self._action_history)]
        action_list = "\n".join(formatted_list)
        prompt_text = self.PROMPT_TEMPLATE.format(user_task=task, previous_actions=action_list)

        return [
            {"type": "text", "text": prompt_text},
            {"type": "image_url", "image_url": {"url": image_url}},
        ]

    def build_messages(self, obs: Observation) -> list[dict]:
        user_content = self._build_status_prompt(self._task, obs.image_data_url)
        return [
            {"role": "user", "content": user_content},
        ]

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[VenusAgent] Step {obs.step_idx}, sending prompt...")

        response = self.llm.chat(
            messages=messages,
            args={
                **self.config.model_args,
                "stream": self.config.stream,
                "stream_print": self.config.stream,
            },
        )

        llm_output = response.content

        if self.config.verbose and not self.config.stream:
            print(f"\n[LLM Response]\n{llm_output}\n")

        action = self.parse_response(llm_output)

        self._history.append(AgentStepRecord(
            step_idx=obs.step_idx,
            observation=obs,
            action=action,
            llm_response=llm_output,
            llm_prompt=messages,
            user_comment=self._pending_comment,
        ))

        parsed = self._parse_llm_output(llm_output)
        think = parsed.get('think', '')
        raw_action = parsed.get('raw_action', '')
        if think:
            result_new = f"<think>{think}</think><action>{raw_action}</action>"
        else:
            result_new = raw_action
        self._action_history.append(result_new)

        # 内存瘦身：build_messages 仅用 _action_history（纯文本），保留最近 2 条完整记录
        self._evict_old_records(keep_recent=2)

        self._pending_comment = ""

        if self.config.verbose:
            print(f"[VenusAgent] Action: {action.action_type}, Data: {action.data}")

        return action

    def add_user_comment(self, comment: str) -> None:
        self._pending_comment = comment
