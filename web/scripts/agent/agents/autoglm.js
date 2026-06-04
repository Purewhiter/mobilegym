// AutoGLM (Open-AutoGLM / autoglm-phone) — mirror of bench_env/agent/autoglm.py
// 0–999 coords, <think>…</think><answer>do(...)/finish(...)</answer> DSL.
// NOTE: the env normalizes all coords by /1000, so the executor's mapping is shared.
import { BaseAgent } from '../agent.js';
import { ActionType, makeAction } from '../actions.js';

const SYSTEM_PROMPT_TEMPLATE = "今天的日期是: {today}\n你是一个智能体分析专家，可以根据操作历史和当前状态图执行一系列操作来完成任务。\n你必须严格按照要求输出以下格式：\n<think>{think}</think>\n<answer>{action}</answer>\n\n其中：\n- {think} 是对你为什么选择这个操作的简短推理说明。\n- {action} 是本次执行的具体操作指令，必须严格遵循下方定义的指令格式。\n\n操作指令及其作用如下：\n- do(action=\"Launch\", app=\"xxx\")  \n    Launch是启动目标app的操作，这比通过主屏幕导航更快。此操作完成后，您将自动收到结果状态的截图。\n- do(action=\"Tap\", element=[x,y])  \n    Tap是点击操作，点击屏幕上的特定点。可用此操作点击按钮、选择项目、从主屏幕打开应用程序，或与任何可点击的用户界面元素进行交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。\n- do(action=\"Tap\", element=[x,y], message=\"重要操作\")  \n    基本功能同Tap，点击涉及财产、支付、隐私等敏感按钮时触发。\n- do(action=\"Type\", text=\"xxx\")  \n    Type是输入操作，在当前聚焦的输入框中输入文本。使用此操作前，请确保输入框已被聚焦（先点击它）。输入的文本将像使用键盘输入一样输入。重要提示：手机可能正在使用 ADB 键盘，该键盘不会像普通键盘那样占用屏幕空间。要确认键盘已激活，请查看屏幕底部是否显示 'ADB Keyboard {ON}' 类似的文本，或者检查输入框是否处于激活/高亮状态。不要仅仅依赖视觉上的键盘显示。自动清除文本：当你使用输入操作时，输入框中现有的任何文本（包括占位符文本和实际输入）都会在输入新文本前自动清除。你无需在输入前手动清除文本——直接使用输入操作输入所需文本即可。操作完成后，你将自动收到结果状态的截图。\n- do(action=\"Type_Name\", text=\"xxx\")  \n    Type_Name是输入人名的操作，基本功能同Type。\n- do(action=\"Interact\")  \n    Interact是当有多个满足条件的选项时而触发的交互操作，询问用户如何选择。\n- do(action=\"Swipe\", start=[x1,y1], end=[x2,y2])  \n    Swipe是滑动操作，通过从起始坐标拖动到结束坐标来执行滑动手势。可用于滚动内容、在屏幕之间导航、下拉通知栏以及项目栏或进行基于手势的导航。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。滑动持续时间会自动调整以实现自然的移动。此操作完成后，您将自动收到结果状态的截图。\n- do(action=\"Note\", message=\"True\")  \n    记录当前页面内容以便后续总结。\n- do(action=\"Call_API\", instruction=\"xxx\")  \n    总结或评论当前页面或已记录的内容。\n- do(action=\"Long Press\", element=[x,y])  \n    Long Pres是长按操作，在屏幕上的特定点长按指定时间。可用于触发上下文菜单、选择文本或激活长按交互。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的屏幕截图。\n- do(action=\"Double Tap\", element=[x,y])  \n    Double Tap在屏幕上的特定点快速连续点按两次。使用此操作可以激活双击交互，如缩放、选择文本或打开项目。坐标系统从左上角 (0,0) 开始到右下角（999,999)结束。此操作完成后，您将自动收到结果状态的截图。\n- do(action=\"Take_over\", message=\"xxx\")  \n    Take_over是接管操作，表示在登录和验证阶段需要用户协助。\n- do(action=\"Back\")  \n    导航返回到上一个屏幕或关闭当前对话框。相当于按下 Android 的返回按钮。使用此操作可以从更深的屏幕返回、关闭弹出窗口或退出当前上下文。此操作完成后，您将自动收到结果状态的截图。\n- do(action=\"Home\") \n    Home是回到系统桌面的操作，相当于按下 Android 主屏幕按钮。使用此操作可退出当前应用并返回启动器，或从已知状态启动新任务。此操作完成后，您将自动收到结果状态的截图。\n- do(action=\"Wait\", duration=\"x seconds\")  \n    等待页面加载，x为需要等待多少秒。\n- do(action=\"Answer\", text=\"xxx\")  \n    Answer是提交答案的操作，用于回答用户的问题。text为纯答案内容（不要包含思考过程）。此操作不会结束任务，提交答案后请继续执行执行任务，或者使用 finish 结束任务。\n- finish(message=\"xxx\")  \n    finish是结束任务的操作，表示准确完整完成任务，message是终止信息。 \n\n必须遵循的规则：\n1. 在执行任何操作前，先检查当前app是否是目标app，如果不是，先执行 Launch。\n2. 如果进入到了无关页面，先执行 Back。如果执行Back后页面没有变化，请点击页面左上角的返回键进行返回，或者右上角的X号关闭。\n3. 如果页面未加载出内容，最多连续 Wait 三次，否则执行 Back重新进入。\n4. 如果页面显示网络问题，需要重新加载，请点击重新加载。\n5. 如果当前页面找不到目标联系人、商品、店铺等信息，可以尝试 Swipe 滑动查找。\n6. 遇到价格区间、时间区间等筛选条件，如果没有完全符合的，可以放宽要求。\n7. 在做小红书总结类任务时一定要筛选图文笔记。\n8. 购物车全选后再点击全选可以把状态设为全不选，在做购物车任务时，如果购物车里已经有商品被选中时，你需要点击全选后再点击取消全选，再去找需要购买或者删除的商品。\n9. 在做外卖任务时，如果相应店铺购物车里已经有其他商品你需要先把购物车清空再去购买用户指定的外卖。\n10. 在做点外卖任务时，如果用户需要点多个外卖，请尽量在同一店铺进行购买，如果无法找到可以下单，并说明某个商品未找到。\n11. 请严格遵循用户意图执行任务，用户的特殊要求可以执行多次搜索，滑动查找。比如（i）用户要求点一杯咖啡，要咸的，你可以直接搜索咸咖啡，或者搜索咖啡后滑动查找咸的咖啡，比如海盐咖啡。（ii）用户要找到XX群，发一条消息，你可以先搜索XX群，找不到结果后，将\"群\"字去掉，搜索XX重试。（iii）用户要找到宠物友好的餐厅，你可以搜索餐厅，找到筛选，找到设施，选择可带宠物，或者直接搜索可带宠物，必要时可以使用AI搜索。\n12. 在选择日期时，如果原滑动方向与预期日期越来越远，请向反方向滑动查找。\n13. 执行任务过程中如果有多个可选择的项目栏，请逐个查找每个项目栏，直到完成任务，一定不要在同一项目栏多次查找，从而陷入死循环。\n14. 在执行下一步操作前请一定要检查上一步的操作是否生效，如果点击没生效，可能因为app反应较慢，请先稍微等待一下，如果还是不生效请调整一下点击位置重试，如果仍然不生效请跳过这一步继续任务，并在finish message说明点击不生效。\n15. 在执行任务中如果遇到滑动不生效的情况，请调整一下起始点位置，增大滑动距离重试，如果还是不生效，有可能是已经滑到底了，请继续向反方向滑动，直到顶部或底部，如果仍然没有符合要求的结果，请跳过这一步继续任务，并在finish message说明但没找到要求的项目。\n16. 在做游戏任务时如果在战斗页面如果有自动战斗一定要开启自动战斗，如果多轮历史状态相似要检查自动战斗是否开启。\n17. 如果没有合适的搜索结果，可能是因为搜索页面不对，请返回到搜索页面的上一级尝试重新搜索，如果尝试三次返回上一级搜索后仍然没有符合要求的结果，执行 finish(message=\"原因\")。\n18. 在结束任务前请一定要仔细检查任务是否完整准确的完成，如果出现错选、漏选、多选的情况，请返回之前的步骤进行纠正。\n19. 需要回答用户问题时，必须先使用 Answer 提交答案，再执行 finish 结束任务。\n";

// action name -> { type, extract(obj) } ; mirrors AutoGLMAgent.ACTION_MAP
const ACTION_MAP = {
  Tap: { type: ActionType.CLICK, extract: (o) => ({ point: o.element }) },
  'Double Tap': { type: ActionType.DOUBLE_TAP, extract: (o) => ({ point: o.element }) },
  'Long Press': { type: ActionType.LONG_PRESS, extract: (o) => ({ point: o.element }) },
  Swipe: { type: ActionType.SWIPE, extract: (o) => ({ point1: o.start, point2: o.end }) },
  Type: { type: ActionType.TYPE, extract: (o) => ({ value: o.text ?? '', clear: true }) },
  Type_Name: { type: ActionType.TYPE, extract: (o) => ({ value: o.text ?? '', clear: true }) },
  Back: { type: ActionType.BACK, extract: () => ({}) },
  Home: { type: ActionType.HOME, extract: () => ({}) },
  Wait: { type: ActionType.WAIT, extract: (o) => ({ value: parseDuration(o.duration) }) },
  Launch: { type: ActionType.AWAKE, extract: (o) => ({ value: String(o.app ?? '').trim() }) },
  Answer: { type: ActionType.ANSWER, extract: (o) => ({ value: String(o.text ?? '') }) },
  Interact: { type: ActionType.INFO, extract: (o) => ({ value: String(o.message ?? '需要用户选择') }) },
  Take_over: { type: ActionType.INFO, extract: (o) => ({ value: String(o.message ?? '需要用户接管') }) },
  Note: { type: ActionType.NOOP, extract: (o) => ({ message: o.message ?? '' }) },
  Call_API: { type: ActionType.NOOP, extract: (o) => ({ instruction: o.instruction ?? '' }) },
};

function parseDuration(v) {
  if (v === null || v === undefined) return 1.0;
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 1.0;
}

// mirror AutoGLMAgent._split_thinking_action
function splitThinkingAction(content) {
  const c = String(content || '');
  if (c.includes('<answer>')) {
    const [a, b] = c.split('<answer>');
    const thinking = a.replace('<think>', '').replace('</think>', '').trim();
    const action = (b || '').replace('</answer>', '').trim();
    return [thinking, action];
  }
  if (c.includes('finish(message=')) {
    const [a, b] = c.split(/finish\(message=/);
    return [a.trim(), 'finish(message=' + b];
  }
  if (c.includes('do(action=')) {
    const [a, b] = c.split(/do\(action=/);
    return [a.trim(), 'do(action=' + b];
  }
  return ['', c];
}

// Parse a do(...) call body by regex (JS has no ast.literal_eval).
function parseDoCall(s) {
  const out = {};
  const action = /action\s*=\s*["']([^"']+)["']/.exec(s);
  if (action) out.action = action[1];
  const elem = /element\s*=\s*\[([^\]]+)\]/.exec(s);
  if (elem) out.element = elem[1].split(',').map((x) => parseFloat(x.trim())).filter((n) => Number.isFinite(n));
  const start = /start\s*=\s*\[([^\]]+)\]/.exec(s);
  if (start) out.start = start[1].split(',').map((x) => parseFloat(x.trim()));
  const end = /end\s*=\s*\[([^\]]+)\]/.exec(s);
  if (end) out.end = end[1].split(',').map((x) => parseFloat(x.trim()));
  const msg = /message\s*=\s*["']([\s\S]+)["']/.exec(s);
  if (msg) out.message = msg[1];
  const text = /text\s*=\s*["']([^"']*)["']/.exec(s);
  if (text) out.text = text[1];
  const app = /app\s*=\s*["']([^"']+)["']/.exec(s);
  if (app) out.app = app[1];
  const dur = /duration\s*=\s*["']([^"']+)["']/.exec(s);
  if (dur) out.duration = dur[1];
  return out;
}

export class AutoGLMAgent extends BaseAgent {
  static id = 'autoglm';
  static label = 'AutoGLM';
  static blurb = 'AutoGLM template · optimized for autoglm-phone';
  static defaultArgs = { temperature: 0.0, top_p: 0.85, frequency_penalty: 0.2, max_tokens: 3000, stream: true };

  systemPrompt({ today }) {
    return SYSTEM_PROMPT_TEMPLATE.replace('{today}', today || '');
  }

  userStepText({ task, app, index, userComment }) {
    const screen = JSON.stringify({ current_app: app || '\u672a\u77e5' });
    const comment = userComment ? `\n\n[用户回复] ${userComment}` : '';
    return index === 0 ? `${task}\n\n${screen}${comment}` : `** Screen Info **\n\n${screen}${comment}`;
  }

  historyAssistant(raw) {
    const [thinking, actionText] = splitThinkingAction(raw);
    return `<think>${thinking}</think><answer>${actionText}</answer>`;
  }

  parseResponse(responseText) {
    const raw = String(responseText || '').trim();
    if (!raw) return { thought: '', action: makeAction(ActionType.ABORT, { value: 'empty_response' }) };

    const [thought, actionText] = splitThinkingAction(raw);
    const s = actionText.trim();

    if (s.startsWith('finish')) {
      const m = /finish\(message\s*=\s*["']?([\s\S]*?)["']?\)\s*$/.exec(s);
      return { thought, action: makeAction(ActionType.COMPLETE, { return: m ? m[1] : s }) };
    }
    if (s.startsWith('do')) {
      const obj = parseDoCall(s);
      const entry = ACTION_MAP[String(obj.action || '').trim()];
      if (!entry) return { thought, action: makeAction(ActionType.NOOP, { unknown_action: String(obj.action || '') }) };
      return { thought, action: makeAction(entry.type, entry.extract(obj)) };
    }
    // No recognizable marker: treat as completion (mirrors python fallback).
    return { thought, action: makeAction(ActionType.COMPLETE, { return: actionText }) };
  }
}
