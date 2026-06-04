// GenericAgentV2 — mirror of bench_env/agent/generic_v2.py
// 0–1000 normalized coords, <THINK>…</THINK> <ANSWER>{json}</ANSWER>.
import { BaseAgent } from '../agent.js';
import { ActionType, makeAction } from '../actions.js';

const SYSTEM_PROMPT = `你是一个手机 GUI-Agent 操作专家。你需要根据用户下发的任务、手机屏幕截图以及历史操作记录，分析当前界面并输出一个动作来与手机交互，从而完成任务。

坐标系：左上角为原点，x 向右，y 向下，取值范围均为 0-1000（归一化坐标）。

可用动作（JSON 格式）：

1. 点击：{"action": "CLICK", "point": [x, y]}
2. 双击：{"action": "DOUBLE_TAP", "point": [x, y]}
3. 长按：{"action": "LONGPRESS", "point": [x, y]}
4. 输入：{"action": "TYPE", "value": "文本内容"}  // 可选 "point": [x, y] 指定输入位置；可选 "clear": true 先清空输入框再输入（默认追加到已有文本后面）
5. 滑动：{"action": "SWIPE", "point1": [x1, y1], "point2": [x2, y2]}
6. 拖拽：{"action": "DRAG", "point1": [x1, y1], "point2": [x2, y2]}  // 按住起点拖动到终点
7. 返回：{"action": "BACK"}
8. 回到桌面：{"action": "HOME"}
9. 打开最近任务：{"action": "RECENT"}
10. 输入回车：{"action": "ENTER"}
11. 等待：{"action": "WAIT", "value": 秒数}
12. 打开应用：{"action": "AWAKE", "value": "应用名称"}
13. 提交答案：{"action": "ANSWER", "value": "纯答案文本"}
14. 任务完成：{"action": "COMPLETE", "return": "完成说明"} // 所有任务完成后使用，给出简短的说明
15. 中止任务：{"action": "ABORT", "value": "中止原因"}  // 任务无法完成时使用，需要说明原因


你必须按以下格式输出：

<THINK>
在这里描述你对当前屏幕的理解、分析和决策过程。
包括：
1. 当前屏幕显示的内容是什么
2. 为了完成任务，下一步应该做什么
3. 具体要点击/操作哪个元素
</THINK>
<ANSWER>
{
  "action": "动作类型",
  // 根据动作类型填写相应参数
}
</ANSWER>


要求：
- 坐标必须为数字，范围 0-1000
- JSON 必须是有效格式
- 仔细观察屏幕截图，根据视觉信息做出判断
- 需要回答问题时，必须使用 ANSWER 提交答案
- COMPLETE 只用于结束任务，需要在执行完任务后使用
`;

const ACTION_MAP = {
  CLICK: { type: ActionType.CLICK, extract: (p) => ({ point: p.point }) },
  TAP: { type: ActionType.CLICK, extract: (p) => ({ point: p.point }) },
  DOUBLE_TAP: { type: ActionType.DOUBLE_TAP, extract: (p) => ({ point: p.point }) },
  DOUBLETAP: { type: ActionType.DOUBLE_TAP, extract: (p) => ({ point: p.point }) },
  LONGPRESS: { type: ActionType.LONG_PRESS, extract: (p) => ({ point: p.point }) },
  LONG_PRESS: { type: ActionType.LONG_PRESS, extract: (p) => ({ point: p.point }) },
  TYPE: { type: ActionType.TYPE, extract: (p) => ({ value: p.value ?? p.text ?? '', point: p.point, clear: p.clear ?? false }) },
  SLIDE: { type: ActionType.SWIPE, extract: (p) => ({ point1: p.point1 ?? p.start, point2: p.point2 ?? p.end }) },
  SWIPE: { type: ActionType.SWIPE, extract: (p) => ({ point1: p.point1 ?? p.start, point2: p.point2 ?? p.end }) },
  DRAG: { type: ActionType.DRAG, extract: (p) => ({ point1: p.point1 ?? p.start, point2: p.point2 ?? p.end }) },
  BACK: { type: ActionType.BACK, extract: () => ({}) },
  HOME: { type: ActionType.HOME, extract: () => ({}) },
  RECENT: { type: ActionType.RECENT, extract: () => ({}) },
  ENTER: { type: ActionType.ENTER, extract: () => ({}) },
  WAIT: { type: ActionType.WAIT, extract: (p) => ({ value: Number(p.value ?? p.duration ?? 1.0) }) },
  AWAKE: { type: ActionType.AWAKE, extract: (p) => ({ value: p.value ?? p.app ?? '' }) },
  LAUNCH: { type: ActionType.AWAKE, extract: (p) => ({ value: p.value ?? p.app ?? '' }) },
  ANSWER: { type: ActionType.ANSWER, extract: (p) => ({ value: p.value ?? p.text ?? '' }) },
  COMPLETE: { type: ActionType.COMPLETE, extract: (p) => ({ return: p.return ?? p.message ?? '' }) },
  FINISH: { type: ActionType.COMPLETE, extract: (p) => ({ return: p.return ?? p.message ?? '' }) },
  ABORT: { type: ActionType.ABORT, extract: (p) => ({ value: p.value ?? p.reason ?? '' }) },
};

export class GenericV2Agent extends BaseAgent {
  static id = 'generic_v2';
  static label = 'Generic v2';
  static blurb = 'General agent template · JSON action format';
  static defaultArgs = { temperature: 0.1, top_p: 0.95, frequency_penalty: 0.0, max_tokens: 8192, stream: true };

  systemPrompt() {
    return SYSTEM_PROMPT;
  }

  userStepText({ task, index }) {
    return index === 0 ? `[任务]\n${task}` : `[Step ${index + 1}]`;
  }

  static extractThinkAnswer(text) {
    let think = '';
    let answer = '';
    const t = /<think>([\s\S]*?)<\/think>/i.exec(text);
    if (t) think = t[1].trim();
    const a = /<answer>([\s\S]*?)<\/answer>/i.exec(text);
    if (a) answer = a[1].trim();
    return { think, answer };
  }

  static extractFirstJson(text) {
    const s = String(text);
    const start = s.indexOf('{');
    if (start < 0) return null;
    let inStr = false;
    let esc = false;
    let depth = 0;
    for (let i = start; i < s.length; i += 1) {
      const ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  parseResponse(responseText) {
    const raw = String(responseText || '').trim();
    if (!raw) return { thought: '', action: makeAction(ActionType.ABORT, { value: 'empty_response' }) };

    const { think, answer } = GenericV2Agent.extractThinkAnswer(raw);
    const answerContent = answer || raw;

    let parsed = null;
    try { parsed = JSON.parse(answerContent); } catch {
      const extracted = GenericV2Agent.extractFirstJson(answerContent);
      if (extracted) { try { parsed = JSON.parse(extracted); } catch { /* ignore */ } }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { thought: think, action: makeAction(ActionType.ABORT, { value: 'invalid_json' }) };
    }

    const name = String(parsed.action || parsed.action_type || '').trim().toUpperCase();
    const entry = ACTION_MAP[name];
    if (!entry) return { thought: think, action: makeAction(ActionType.NOOP, { unknown_action: name }) };
    return { thought: think, action: makeAction(entry.type, entry.extract(parsed)) };
  }
}
