"""
AutoGLM Agent - Open-AutoGLM style agent implementation.
"""

from __future__ import annotations

import ast
import json
from datetime import datetime
from typing import Any, Optional

from bench_env.agent.base import AgentConfig, BaseAgent, AgentStepRecord
from bench_env.env.base import Action, ActionType, Observation
from bench_env.llm import LLMClient


class AutoGLMAgent(BaseAgent):
    """
    Open-AutoGLM style agent.
    
    Features:
    - Chinese phone agent prompt
    - do(action=...) / finish(message=...) action format
    - Multi-turn conversation history
    
    Modifications vs. upstream Open-AutoGLM:
    - Added do(action="Answer", text="xxx") action for submitting answers to
      query-type tasks. In the original, answers were embedded in
      finish(message=...). Inspired by Mobile-Agent-v3.5's android_world
      version which separates answer submission from task termination, but
      unlike Mobile-Agent where answer terminates the episode, here Answer
      is non-terminating to support hybrid tasks (answer + continue operating).
    - Added rule 19: must use Answer before finish for query tasks.
    """

    # ==================== 类属性 ====================
    
    @staticmethod
    def _get_today_string() -> str:
        """获取格式化的今日日期"""
        today = datetime.today()
        weekday_names = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
        return today.strftime("%Y年%m月%d日") + " " + weekday_names[today.weekday()]

    SYSTEM_PROMPT = f"""今天的日期是: {{today}}
你是一个智能体分析专家，可以根据操作历史和当前状态图执行一系列操作来完成任务。
你必须严格按照要求输出以下格式：
<think>{{think}}</think>
<answer>{{action}}</answer>

其中：
- {{think}} 是对你为什么选择这个操作的简短推理说明。
- {{action}} 是本次执行的具体操作指令，必须严格遵循下方定义的指令格式。

操作指令及其作用如下：
- do(action="Launch", app="xxx")  
    Launch是启动目标app的操作，这比通过主屏幕导航更快。此操作完成后，您将自动收到结果状态的截图。
- do(action="Tap", element=[x,y])  
    Tap是点击操作，点击屏幕上的特定点。可用此操作点击按钮、选择项目、从主屏幕打开应用程序，或与任何可点击的用户界面元素进行交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。
- do(action="Tap", element=[x,y], message="重要操作")  
    基本功能同Tap，点击涉及财产、支付、隐私等敏感按钮时触发。
- do(action="Type", text="xxx")  
    Type是输入操作，在当前聚焦的输入框中输入文本。使用此操作前，请确保输入框已被聚焦（先点击它）。输入的文本将像使用键盘输入一样输入。重要提示：手机可能正在使用 ADB 键盘，该键盘不会像普通键盘那样占用屏幕空间。要确认键盘已激活，请查看屏幕底部是否显示 'ADB Keyboard {{ON}}' 类似的文本，或者检查输入框是否处于激活/高亮状态。不要仅仅依赖视觉上的键盘显示。自动清除文本：当你使用输入操作时，输入框中现有的任何文本（包括占位符文本和实际输入）都会在输入新文本前自动清除。你无需在输入前手动清除文本——直接使用输入操作输入所需文本即可。操作完成后，你将自动收到结果状态的截图。
- do(action="Type_Name", text="xxx")  
    Type_Name是输入人名的操作，基本功能同Type。
- do(action="Interact")  
    Interact是当有多个满足条件的选项时而触发的交互操作，询问用户如何选择。
- do(action="Swipe", start=[x1,y1], end=[x2,y2])  
    Swipe是滑动操作，通过从起始坐标拖动到结束坐标来执行滑动手势。可用于滚动内容、在屏幕之间导航、下拉通知栏以及项目栏或进行基于手势的导航。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。滑动持续时间会自动调整以实现自然的移动。此操作完成后，您将自动收到结果状态的截图。
- do(action="Note", message="True")  
    记录当前页面内容以便后续总结。
- do(action="Call_API", instruction="xxx")  
    总结或评论当前页面或已记录的内容。
- do(action="Long Press", element=[x,y])  
    Long Pres是长按操作，在屏幕上的特定点长按指定时间。可用于触发上下文菜单、选择文本或激活长按交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的屏幕截图。
- do(action="Double Tap", element=[x,y])  
    Double Tap在屏幕上的特定点快速连续点按两次。使用此操作可以激活双击交互，如缩放、选择文本或打开项目。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。
- do(action="Take_over", message="xxx")  
    Take_over是接管操作，表示在登录和验证阶段需要用户协助。
- do(action="Back")  
    导航返回到上一个屏幕或关闭当前对话框。相当于按下 Android 的返回按钮。使用此操作可以从更深的屏幕返回、关闭弹出窗口或退出当前上下文。此操作完成后，您将自动收到结果状态的截图。
- do(action="Home") 
    Home是回到系统桌面的操作，相当于按下 Android 主屏幕按钮。使用此操作可退出当前应用并返回启动器，或从已知状态启动新任务。此操作完成后，您将自动收到结果状态的截图。
- do(action="Wait", duration="x seconds")  
    等待页面加载，x为需要等待多少秒。
- do(action="Answer", text="xxx")  
    Answer是提交答案的操作，用于回答用户的问题。text为纯答案内容（不要包含思考过程）。此操作不会结束任务，提交答案后请继续执行执行任务，或者使用 finish 结束任务。
- finish(message="xxx")  
    finish是结束任务的操作，表示准确完整完成任务，message是终止信息。 

必须遵循的规则：
1. 在执行任何操作前，先检查当前app是否是目标app，如果不是，先执行 Launch。
2. 如果进入到了无关页面，先执行 Back。如果执行Back后页面没有变化，请点击页面左上角的返回键进行返回，或者右上角的X号关闭。
3. 如果页面未加载出内容，最多连续 Wait 三次，否则执行 Back重新进入。
4. 如果页面显示网络问题，需要重新加载，请点击重新加载。
5. 如果当前页面找不到目标联系人、商品、店铺等信息，可以尝试 Swipe 滑动查找。
6. 遇到价格区间、时间区间等筛选条件，如果没有完全符合的，可以放宽要求。
7. 在做小红书总结类任务时一定要筛选图文笔记。
8. 购物车全选后再点击全选可以把状态设为全不选，在做购物车任务时，如果购物车里已经有商品被选中时，你需要点击全选后再点击取消全选，再去找需要购买或者删除的商品。
9. 在做外卖任务时，如果相应店铺购物车里已经有其他商品你需要先把购物车清空再去购买用户指定的外卖。
10. 在做点外卖任务时，如果用户需要点多个外卖，请尽量在同一店铺进行购买，如果无法找到可以下单，并说明某个商品未找到。
11. 请严格遵循用户意图执行任务，用户的特殊要求可以执行多次搜索，滑动查找。比如（i）用户要求点一杯咖啡，要咸的，你可以直接搜索咸咖啡，或者搜索咖啡后滑动查找咸的咖啡，比如海盐咖啡。（ii）用户要找到XX群，发一条消息，你可以先搜索XX群，找不到结果后，将"群"字去掉，搜索XX重试。（iii）用户要找到宠物友好的餐厅，你可以搜索餐厅，找到筛选，找到设施，选择可带宠物，或者直接搜索可带宠物，必要时可以使用AI搜索。
12. 在选择日期时，如果原滑动方向与预期日期越来越远，请向反方向滑动查找。
13. 执行任务过程中如果有多个可选择的项目栏，请逐个查找每个项目栏，直到完成任务，一定不要在同一项目栏多次查找，从而陷入死循环。
14. 在执行下一步操作前请一定要检查上一步的操作是否生效，如果点击没生效，可能因为app反应较慢，请先稍微等待一下，如果还是不生效请调整一下点击位置重试，如果仍然不生效请跳过这一步继续任务，并在finish message说明点击不生效。
15. 在执行任务中如果遇到滑动不生效的情况，请调整一下起始点位置，增大滑动距离重试，如果还是不生效，有可能是已经滑到底了，请继续向反方向滑动，直到顶部或底部，如果仍然没有符合要求的结果，请跳过这一步继续任务，并在finish message说明但没找到要求的项目。
16. 在做游戏任务时如果在战斗页面如果有自动战斗一定要开启自动战斗，如果多轮历史状态相似要检查自动战斗是否开启。
17. 如果没有合适的搜索结果，可能是因为搜索页面不对，请返回到搜索页面的上一级尝试重新搜索，如果尝试三次返回上一级搜索后仍然没有符合要求的结果，执行 finish(message="原因")。
18. 在结束任务前请一定要仔细检查任务是否完整准确的完成，如果出现错选、漏选、多选的情况，请返回之前的步骤进行纠正。
19. 需要回答用户问题时，必须先使用 Answer 提交答案，再执行 finish 结束任务。
"""
    
    # AutoGLM 动作映射
    ACTION_MAP = {
        "Tap": (ActionType.CLICK, lambda obj: {"point": obj.get("element")}),
        "Double Tap": (ActionType.DOUBLE_TAP, lambda obj: {"point": obj.get("element")}),
        "Long Press": (ActionType.LONG_PRESS, lambda obj: {"point": obj.get("element")}),
        "Swipe": (ActionType.SWIPE, lambda obj: {"point1": obj.get("start"), "point2": obj.get("end")}),
        "Type": (ActionType.TYPE, lambda obj: {"value": obj.get("text", ""), "clear": True}),
        "Type_Name": (ActionType.TYPE, lambda obj: {"value": obj.get("text", ""), "clear": True}),
        "Back": (ActionType.BACK, lambda obj: {}),
        "Home": (ActionType.HOME, lambda obj: {}),
        "Wait": (ActionType.WAIT, lambda obj: {"value": AutoGLMAgent._parse_duration(obj.get("duration"))}),
        "Launch": (ActionType.AWAKE, lambda obj: {"value": str(obj.get("app", "")).strip()}),
        "Interact": (ActionType.INFO, lambda obj: {"value": str(obj.get("message", "需要用户选择"))}),
        "Take_over": (ActionType.INFO, lambda obj: {"value": str(obj.get("message", "需要用户接管"))}),
        "Note": (ActionType.NOOP, lambda obj: {"message": obj.get("message", "")}),
        "Call_API": (ActionType.NOOP, lambda obj: {"instruction": obj.get("instruction", "")}),
        "Answer": (ActionType.ANSWER, lambda obj: {"value": str(obj.get("text", ""))}),
    }

    DEFAULT_MODEL_ARGS = {
        "temperature": 0.0,
        "top_p": 0.85,
        "frequency_penalty": 0.2,
        "max_tokens": 3000,
    }

    # ==================== 初始化 ====================

    def __init__(self, llm: LLMClient, config: Optional[AgentConfig] = None):
        super().__init__(config)
        self.llm = llm
        self._app_history: list[str] = []

        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "AutoGLMAgent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []
        self._app_history: list[str] = []
        self._pending_comment = ""

    def reset_history(self) -> None:
        super().reset_history()
        self._app_history.clear()

    def add_user_comment(self, comment: str) -> None:
        """添加用户回复（用于 INFO 动作）"""
        self._pending_comment = str(comment or "")

    # ==================== 响应解析 ====================

    @staticmethod
    def _parse_duration(v: Any) -> float:
        """解析时长为秒数"""
        if v is None:
            return 1.0
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip().lower().replace("seconds", "").replace("second", "").strip()
        try:
            return float(s)
        except Exception:
            return 1.0

    @staticmethod
    def _split_thinking_action(content: str) -> tuple[str, str]:
        """
        将 LLM 响应分离为 thinking 和 action 两部分。
        
        与 Open-AutoGLM 的 _parse_response 方法保持一致。
        
        解析规则：
        1. 如果包含 'finish(message='，之前为 thinking，之后为 action
        2. 如果包含 'do(action='，之前为 thinking，之后为 action
        3. 如果包含 '<answer>'，使用 XML 标签解析
        4. 否则返回空 thinking 和完整内容作为 action
        
        Returns:
            (thinking, action) 元组
        """
        if "<answer>" in content:
            parts = content.split("<answer>", 1)
            thinking = parts[0].replace("<think>", "").replace("</think>", "").strip()
            action = parts[1].replace("</answer>", "").strip()
            return thinking, action

        # Rule 1: Check for finish(message=
        if "finish(message=" in content:
            parts = content.split("finish(message=", 1)
            thinking = parts[0].strip()
            action = "finish(message=" + parts[1]
            return thinking, action

        # Rule 2: Check for do(action=
        if "do(action=" in content:
            parts = content.split("do(action=", 1)
            thinking = parts[0].strip()
            action = "do(action=" + parts[1]
            return thinking, action

        # Rule 3: Fallback to legacy XML tag parsing
        # if "<answer>" in content:
        #     parts = content.split("<answer>", 1)
        #     thinking = parts[0].replace("<think>", "").replace("</think>", "").strip()
        #     action = parts[1].replace("</answer>", "").strip()
        #     return thinking, action

        # Rule 4: No markers found, return content as action
        return "", content

    def _parse_llm_output(self, response_text: str) -> dict[str, Any]:
        """
        解析 LLM 输出为结构化字典。
        
        格式：
            <think>思考</think><answer>do(action="Tap", element=[x,y])</answer>
            或 finish(message="完成信息")
        
        Returns:
            {"action": str, "thought": str, ...其他参数}
            如果是 finish，返回 {"_finish": True, "message": str, "thought": str}
        """
        raw = str(response_text or "").strip()
        if not raw:
            return {"_error": "empty_response"}

        # 使用 _split_thinking_action 分离 thinking 和 action
        thought, action_text = self._split_thinking_action(raw)

        # 解析 do(...) 或 finish(...)
        s = action_text.strip()
        try:
            if s.startswith("do"):
                tree = ast.parse(s, mode="eval")
                if not isinstance(tree.body, ast.Call):
                    raise ValueError("Expected a function call")
                result: dict[str, Any] = {"thought": thought}
                for kw in tree.body.keywords:
                    result[str(kw.arg)] = ast.literal_eval(kw.value)
                return result
            if s.startswith("finish"):
                msg = s.replace("finish(message=", "")[1:-2] if "finish(message=" in s else s
                return {"_finish": True, "message": msg, "thought": thought}
        except Exception:
            # ast.parse 失败时，尝试用正则提取 action 名称和参数
            # 这通常发生在 message 中包含中文引号或特殊字符时
            import re
            if s.startswith("do"):
                # 提取 action 名称
                action_match = re.search(r'action\s*=\s*["\']([^"\']+)["\']', s)
                if action_match:
                    action_name = action_match.group(1)
                    result: dict[str, Any] = {"thought": thought, "action": action_name}
                    
                    # 尝试提取常见参数
                    # element=[x,y]
                    elem_match = re.search(r'element\s*=\s*\[([^\]]+)\]', s)
                    if elem_match:
                        try:
                            coords = [float(x.strip()) for x in elem_match.group(1).split(",")]
                            result["element"] = coords
                        except Exception:
                            pass
                    
                    # start=[x,y], end=[x,y]
                    start_match = re.search(r'start\s*=\s*\[([^\]]+)\]', s)
                    end_match = re.search(r'end\s*=\s*\[([^\]]+)\]', s)
                    if start_match:
                        try:
                            result["start"] = [float(x.strip()) for x in start_match.group(1).split(",")]
                        except Exception:
                            pass
                    if end_match:
                        try:
                            result["end"] = [float(x.strip()) for x in end_match.group(1).split(",")]
                        except Exception:
                            pass
                    
                    # message="..." (贪婪匹配到最后的引号)
                    msg_match = re.search(r'message\s*=\s*["\'](.+)["\']', s, re.DOTALL)
                    if msg_match:
                        result["message"] = msg_match.group(1)
                    
                    # text="..."
                    text_match = re.search(r'text\s*=\s*["\']([^"\']*)["\']', s)
                    if text_match:
                        result["text"] = text_match.group(1)
                    
                    # app="..."
                    app_match = re.search(r'app\s*=\s*["\']([^"\']+)["\']', s)
                    if app_match:
                        result["app"] = app_match.group(1)
                    
                    # duration="..."
                    dur_match = re.search(r'duration\s*=\s*["\']([^"\']+)["\']', s)
                    if dur_match:
                        result["duration"] = dur_match.group(1)
                    
                    return result
        
        # 解析失败，当作完成
        return {"_finish": True, "message": action_text, "thought": thought}

    def parse_response(self, response_text: str) -> Action:
        """解析 LLM 响应为 Action"""
        parsed = self._parse_llm_output(response_text)
        
        if parsed.get("_error"):
            return Action(ActionType.ABORT, {"value": parsed["_error"]}, raw_response=response_text)
        
        if parsed.get("_finish"):
            return Action(
                ActionType.COMPLETE,
                {"return": str(parsed.get("message", ""))},
                thought=parsed.get("thought", ""),
                raw_response=response_text,
            )

        action_name = str(parsed.get("action", "")).strip()
        return self.parse_action(
            action_name,
            parsed,
            thought=parsed.get("thought", ""),
            raw_response=response_text,
        )

    # ==================== 消息构建 ====================

    def build_messages(self, obs: Observation) -> list[dict[str, Any]]:
        """构建发送给 LLM 的消息"""
        # 动态替换日期
        system_prompt = self.SYSTEM_PROMPT.replace("{today}", self._get_today_string())
        
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]

        for i, record in enumerate(self._history):
            app = self._app_history[i] if i < len(self._app_history) else ""
            app = app or "未知"
            screen_info = json.dumps({"current_app": app}, ensure_ascii=False)
            
            # 包含历史步骤的用户回复（如果有）
            hist_comment = ""
            if getattr(record, "user_comment", ""):
                hist_comment = f"\n\n[用户回复] {record.user_comment}"

            if i == 0:
                user_text = f"{self._task}\n\n{screen_info}{hist_comment}"
            else:
                user_text = f"** Screen Info **\n\n{screen_info}{hist_comment}"

            messages.append({
                "role": "user",
                "content": [{"type": "text", "text": user_text}],
            })

            thinking, action_text = self._split_thinking_action(record.llm_response)
            messages.append({
                "role": "assistant",
                "content": f"<think>{thinking}</think><answer>{action_text}</answer>",
            })

        app = obs.current_app or "未知"
        screen_info = json.dumps({"current_app": app}, ensure_ascii=False)

        # 添加用户回复（INFO 动作的响应）
        user_comment = ""
        if self._pending_comment:
            user_comment = f"\n\n[用户回复] {self._pending_comment}"

        if len(self._history) == 0:
            user_text = f"{self._task}\n\n{screen_info}{user_comment}"
        else:
            user_text = f"** Screen Info **\n\n{screen_info}{user_comment}"

        messages.append({
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": obs.image_data_url}},
                {"type": "text", "text": user_text},
            ],
        })

        return messages

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        """生成动作"""
        messages = self.build_messages(obs)

        if self.config.verbose:
            print(f"\n[AutoGLMAgent] Step {obs.step_idx}, sending prompt...")

        response = self.llm.chat(
            messages=messages,
            args={
                **self.config.model_args,
                "stream": self.config.stream,
                "stream_print": self.config.stream,
            },
        )

        if self.config.verbose and not self.config.stream:
            print(f"\n[LLM Response]\n{response.content}\n")

        action = self.parse_response(response.content)

        self._history.append(AgentStepRecord(
            step_idx=obs.step_idx,
            observation=obs,
            action=action,
            llm_response=response.content,
            llm_prompt=messages,
            user_comment=self._pending_comment,
        ))
        self._app_history.append(obs.current_app or "")

        # 内存瘦身：AutoGLM 无截图窗口，历史只用文本，保留最近 2 条完整记录
        self._evict_old_records(keep_recent=2)

        self._pending_comment = ""

        if self.config.verbose:
            print(f"[AutoGLMAgent] Action: {action.action_type}, Data: {action.data}")

        return action
