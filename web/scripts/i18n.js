// Lightweight i18n for the static demo site. Covers the UI / demo chrome only
// (the academic paper prose stays English). Default language is English.
//
// Usage in markup:
//   <span data-i18n="key">English fallback</span>     → textContent
//   <input data-i18n-ph="key">                         → placeholder
//   <button data-i18n-aria="key">                       → aria-label
//   <button data-i18n-prompt="key">                     → data-prompt (agent task)
//
// Usage in JS (modules or classic):
//   window.I18N.t('key', { n: 3 })   // "{n}" placeholders interpolated
//   window.I18N.lang                  // 'en' | 'zh'
//   document.addEventListener('mg:langchange', (e) => { /* e.detail.lang */ });
(function () {
  const STORE_KEY = 'mg_lang';

  const DICT = {
    en: {
      // header / hero chrome
      'hero.liveDemo': 'Live demo',
      'hero.star': 'Star',
      'hero.powerOff': 'Power off',
      'hero.clickToStart': 'Click to start',
      'hero.scrollHint': 'Scroll to read paper',
      'lang.label': 'Switch language',

      // agent console
      'console.eyebrow': 'Live Agent',
      'console.statusIdle': 'Type a task, then Run.',
      'console.placeholder': 'Tell the agent what to do…',
      'console.run': 'Run',
      'console.stop': 'Stop',
      'console.settingsAria': 'Model & agent settings',
      'console.collapseAria': 'Collapse task bar',
      'console.expandAria': 'Expand task bar',
      'console.examplesAria': 'Example tasks',
      // Locale-specific demo slots. These are curated examples, not strict
      // translations; each language may showcase a different app/task.
      'chip.example1.label': 'WeChat · Boss',
      'chip.example1.prompt': 'Open WeChat and message Boss: I quit',
      'chip.example2.label': 'Bilibili · Like Video',
      'chip.example2.prompt': 'Open bilibili, and like the first video',

      // dynamic status (bottom bar) + HUD
      'status.enterTask': 'Enter an instruction first.',
      'status.setEndpoint': 'Set a model endpoint first (⚙ settings).',
      'status.poweringOn': 'Powering on the phone…',
      'status.running': 'Running…',
      'status.preparing': 'Preparing snapshot…',
      'done.complete': 'Task complete.',
      'done.abort': 'Agent aborted.',
      'done.formatError': 'Format error — see panel.',
      'done.maxsteps': 'Reached the step limit.',
      'done.stopped': 'Stopped.',
      'done.error': 'Run error — see panel.',
      'done.done': 'Done.',

      // narration card
      'narr.step': 'Step {n}',
      'narr.starting': 'starting…',
      'narr.thinking': 'thinking…',
      'narr.steps': '{n} steps',
      'narr.answer': 'Answer: {v}',
      'narr.error': 'ERROR',
      'narr.unknownError': 'Unknown error',
      'narr.stepHud': 'Step {n} · {verb}',
      'narr.stepError': 'Step {n}: {m}',

      // runner
      'runner.connecting': 'Connecting to the phone…',
      'runner.thinking': 'Step {n} · thinking…',
      'runner.notReady': 'Simulator is not ready. Power on the phone and try again.',

      // HUD action verbs
      'verb.CLICK': 'tap',
      'verb.DOUBLE_TAP': 'double-tap',
      'verb.LONG_PRESS': 'long-press',
      'verb.TYPE': 'type',
      'verb.SWIPE': 'swipe',
      'verb.DRAG': 'drag',
      'verb.AWAKE': 'open app',
      'verb.WAIT': 'wait',
      'verb.ANSWER': 'answer',
      'verb.INFO': 'ask',
      'verb.COMPLETE': 'done',
      'verb.ABORT': 'abort',
      'verb.BACK': 'back',
      'verb.HOME': 'home',
      'verb.RECENT': 'recents',
      'verb.ENTER': 'enter',

      // settings sheet
      'settings.title': 'Model & agent',
      'settings.sub': 'Use the built-in demo model, or connect your own OpenAI-compatible vision endpoint.',
      'settings.closeAria': 'Close settings',
      'settings.agent': 'Agent',
      'settings.endpoint': 'Endpoint',
      'settings.baseUrl': 'Base URL',
      'settings.model': 'Model',
      'settings.apiKey': 'API key',
      'settings.parameters': 'Parameters',
      'settings.save': 'Save',
      'settings.reset': 'Reset',
      'settings.saved': 'Saved.',
      'settings.savedNeedEndpoint': 'Saved — base URL + model still required.',
      'settings.resetDone': 'Reset to preset.',
      'settings.keyPreset': '(preset key in use — leave blank)',

      // gesture guide
      'gesture.eyebrow': 'Gestures',
      'gesture.orClick': 'or click',
      'gesture.back': 'Back',
      'gesture.backDesc': 'Swipe in from left or right edge',
      'gesture.home': 'Home',
      'gesture.homeDesc': 'Swipe up from bottom edge',
      'gesture.recents': 'Recents',
      'gesture.recentsDesc': 'Swipe up & hold mid-screen',
      'gesture.switch': 'Switch pages',
      'gesture.switchDesc': 'Swipe or drag horizontally on the desktop',

      // state dock
      'dock.eyebrow': 'State Builder',
      'dock.hint': 'Patch state',
    },

    zh: {
      'hero.liveDemo': 'Live demo',
      'hero.star': 'Star',
      'hero.powerOff': '关机',
      'hero.clickToStart': 'Click to start',
      'hero.scrollHint': '下滑阅读论文',
      'lang.label': '切换语言',

      'console.eyebrow': 'Live Agent',
      'console.statusIdle': '输入任务，点运行。',
      'console.placeholder': '告诉 Agent 要做什么…',
      'console.run': '运行',
      'console.stop': '停止',
      'console.settingsAria': '模型与 Agent 设置',
      'console.collapseAria': '收起任务栏',
      'console.expandAria': '展开任务栏',
      'console.examplesAria': '示例任务',
      // Locale-specific demo slots. These are curated examples, not strict
      // translations; each language may showcase a different app/task.
      'chip.example1.label': '微信 · 给 Boss 发消息',
      'chip.example1.prompt': '打开微信，给 Boss 发消息说不干了',
      'chip.example2.label': '小红书 · 旅行关注',
      'chip.example2.prompt': '打开小红书，帮我搜索旅行，关注第一个帖子的作者',

      'status.enterTask': '请先输入任务。',
      'status.setEndpoint': '请先在 ⚙ 设置里配置模型接口。',
      'status.poweringOn': '正在开机…',
      'status.running': '运行中…',
      'status.preparing': '正在准备截图…',
      'done.complete': '任务完成。',
      'done.abort': 'Agent 已中止。',
      'done.formatError': '格式错误 —— 详见右侧。',
      'done.maxsteps': '已达步数上限。',
      'done.stopped': '已停止。',
      'done.error': '运行出错 —— 详见右侧。',
      'done.done': '完成。',

      'narr.step': '第 {n} 步',
      'narr.starting': '准备中…',
      'narr.thinking': '思考中…',
      'narr.steps': '共 {n} 步',
      'narr.answer': '答案：{v}',
      'narr.error': '错误',
      'narr.unknownError': '未知错误',
      'narr.stepHud': '第 {n} 步 · {verb}',
      'narr.stepError': '第 {n} 步：{m}',

      'runner.connecting': '正在连接手机…',
      'runner.thinking': '第 {n} 步 · 思考中…',
      'runner.notReady': '模拟器未就绪，请先开机后重试。',

      'verb.CLICK': '点击',
      'verb.DOUBLE_TAP': '双击',
      'verb.LONG_PRESS': '长按',
      'verb.TYPE': '输入',
      'verb.SWIPE': '滑动',
      'verb.DRAG': '拖拽',
      'verb.AWAKE': '打开应用',
      'verb.WAIT': '等待',
      'verb.ANSWER': '作答',
      'verb.INFO': '提问',
      'verb.COMPLETE': '完成',
      'verb.ABORT': '中止',
      'verb.BACK': '返回',
      'verb.HOME': '主屏',
      'verb.RECENT': '多任务',
      'verb.ENTER': '回车',

      'settings.title': '模型与 Agent',
      'settings.sub': '使用内置 demo 模型，或接入你自己的 OpenAI 兼容视觉接口。',
      'settings.closeAria': '关闭设置',
      'settings.agent': 'Agent',
      'settings.endpoint': '接口',
      'settings.baseUrl': 'Base URL',
      'settings.model': '模型',
      'settings.apiKey': 'API key',
      'settings.parameters': '参数',
      'settings.save': '保存',
      'settings.reset': '重置',
      'settings.saved': '已保存。',
      'settings.savedNeedEndpoint': '已保存 —— 仍需填写 Base URL 和模型。',
      'settings.resetDone': '已重置为预设。',
      'settings.keyPreset': '(正在使用预设密钥 —— 留空即可)',

      'gesture.eyebrow': '手势',
      'gesture.orClick': '或点击',
      'gesture.back': '返回',
      'gesture.backDesc': '从左/右边缘向内滑',
      'gesture.home': '主屏',
      'gesture.homeDesc': '从底部边缘上滑',
      'gesture.recents': '多任务',
      'gesture.recentsDesc': '屏幕中部上滑并停住',
      'gesture.switch': '切换分页',
      'gesture.switchDesc': '在桌面上左右滑动或拖拽',

      'dock.eyebrow': 'State Builder',
      'dock.hint': '注入状态',
    },
  };

  function detectLang() {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
    } catch { /* ignore */ }
    return 'en'; // default English
  }

  let lang = detectLang();

  function t(key, params) {
    const table = DICT[lang] || DICT.en;
    let s = table[key];
    if (s == null) s = DICT.en[key];
    if (s == null) s = key;
    if (params) {
      for (const k in params) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(params[k]));
    }
    return s;
  }

  function apply(root) {
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    r.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))); });
    r.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    r.querySelectorAll('[data-i18n-prompt]').forEach((el) => { el.setAttribute('data-prompt', t(el.getAttribute('data-i18n-prompt'))); });
  }

  function updateToggle() {
    const toggle = document.getElementById('lang-toggle');
    if (!toggle) return;
    toggle.dataset.lang = lang;
    const current = toggle.querySelector('[data-lang-current]');
    if (current) current.textContent = lang === 'zh' ? '中' : 'EN';
  }

  function setLang(next) {
    if (next !== 'en' && next !== 'zh') return;
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(STORE_KEY, lang); } catch { /* ignore */ }
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    apply();
    updateToggle();
    document.dispatchEvent(new CustomEvent('mg:langchange', { detail: { lang } }));
  }

  window.I18N = {
    t,
    get lang() { return lang; },
    setLang,
    apply,
  };

  function init() {
    document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    apply();
    updateToggle();
    const toggle = document.getElementById('lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        setLang(lang === 'zh' ? 'en' : 'zh');
      });
    }
    // The phone frame swaps boot button ↔ iframe across power cycles; re-apply
    // translations to the re-injected boot button so it keeps the current lang.
    const frame = document.getElementById('demo-frame');
    if (frame && typeof MutationObserver === 'function') {
      new MutationObserver(() => apply(frame)).observe(frame, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
