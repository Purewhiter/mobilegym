// Orchestrates one agent run: snapshot → act → execute, looping until the
// agent says COMPLETE/ABORT, the step cap is hit, or the visitor stops.
import * as capture from './capture.js';
import * as executor from './executor.js';
import { ActionFormatError, ActionType } from './actions.js';
import { resolveAppId } from './app-resolver.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// i18n helper (browser-only); falls back to the key when i18n isn't present.
const T = (key, params) => (typeof window !== 'undefined' && window.I18N ? window.I18N.t(key, params) : key);
const DEFAULT_INFO_REPLY = '请继续完成任务，不要再询问。';

function extractStreamingThought({ content = '', reasoning = '' } = {}) {
  const r = String(reasoning || '').trim();
  if (r) return r;

  const text = String(content || '');
  if (!text.trim()) return '';

  const open = /<think>/i.exec(text);
  if (open) {
    const afterOpen = text.slice(open.index + open[0].length);
    const close = /<\/think>/i.exec(afterOpen);
    return (close ? afterOpen.slice(0, close.index) : afterOpen).trim();
  }

  const answer = /<answer>/i.exec(text);
  const preview = answer ? text.slice(0, answer.index) : text;
  return preview
    .replace(/^\s*<\s*\/?\s*think\s*>?/i, '')
    .trim();
}

export class Runner {
  constructor({
    getFrameEl,
    makeAgent,
    callbacks = {},
    maxSteps = 30,
    settleMs = 900,
    captureProvider = capture,
    executorProvider = executor,
    infoReply = DEFAULT_INFO_REPLY,
    appResolver = resolveAppId,
  }) {
    this.getFrameEl = getFrameEl;
    this.makeAgent = makeAgent;
    this.cb = callbacks;
    this.maxSteps = maxSteps;
    this.settleMs = settleMs;
    this.captureProvider = captureProvider;
    this.executorProvider = executorProvider;
    this.infoReply = infoReply;
    this.appResolver = appResolver;
    this.state = 'idle';
    this.abortCtl = null;
  }

  get running() {
    return this.state === 'running';
  }

  stop() {
    if (this.state === 'running' && this.abortCtl) this.abortCtl.abort();
  }

  async _emit(name, payload) {
    const fn = this.cb[name];
    if (typeof fn === 'function') {
      try { return await fn(payload); } catch (err) { console.warn('[agent-runner]', name, err); }
    }
    return undefined;
  }

  _frameWindow() {
    const frame = this.getFrameEl();
    const iframe = frame ? frame.querySelector('iframe') : null;
    try {
      return iframe ? iframe.contentWindow : null;
    } catch {
      return null;
    }
  }

  async _waitForSim(timeoutMs = 12000) {
    const startedAt = Date.now();
    for (;;) {
      const win = this._frameWindow();
      if (win && win.__SIM__?.getState && win.__OS__) return win;
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(T('runner.notReady'));
      }
      if (this._aborted()) throw new DOMException('aborted', 'AbortError');
      await sleep(150);
    }
  }

  // Per-step context some agents use (autoglm injects current_app; the
  // prompt date comes from simulated time). Read defensively — never throw.
  _stepContext(win) {
    let app = '';
    let today = '';
    try {
      app = win.__OS__?.getState?.().activeAppId || win.__OS__?.state?.activeAppId || '';
    } catch { /* ignore */ }
    try {
      const ts = Number(win.__SIM__?.getState?.()?.os?.time?.timestamp);
      const d = new Date(Number.isFinite(ts) ? ts : Date.now());
      const pad = (n) => String(n).padStart(2, '0');
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      today = `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日 ${weekdays[d.getDay()]}`;
    } catch { /* ignore */ }
    return { app, today };
  }

  _aborted() {
    return Boolean(this.abortCtl && this.abortCtl.signal.aborted);
  }

  _infoReply(question) {
    if (this.infoReply === null || this.infoReply === undefined) return '';
    return typeof this.infoReply === 'function'
      ? String(this.infoReply(question) || '')
      : String(this.infoReply || '');
  }

  async start(task) {
    if (this.state === 'running') return;

    this.abortCtl = new AbortController();
    this.state = 'running';
    this._emit('onStatus', { state: 'running', text: T('runner.connecting') });

    try {
      const win = await this._waitForSim();
      const agent = this.makeAgent();
      agent.reset(task);

      for (let step = 0; step < this.maxSteps; step += 1) {
        if (this._aborted()) break;

        const shot = await this.captureProvider.grab({ win });
        const { app, today } = this._stepContext(win);

        this._emit('onStatus', { state: 'running', text: T('runner.thinking', { n: step }) });
        this._emit('onStepStart', { step, shot });
        const { thought, action, raw } = await agent.act(
          { image: shot, app, today },
          {
            signal: this.abortCtl.signal,
            onDelta: (delta) => {
              const thoughtText = extractStreamingThought(delta);
              if (thoughtText) this._emit('onStepDelta', { step, thought: thoughtText });
            },
          },
        );
        if (this._aborted()) break;

        await this._emit('onStep', { step, thought, action, raw, shot });
        if (this._aborted()) break;

        if (action.type === ActionType.ANSWER) {
          this._emit('onAnswer', { value: action.data.value });
          // generic_v2: ANSWER records the answer but does not end the task.
        } else if (action.type === ActionType.COMPLETE) {
          return this._finish('complete', action.data.return);
        } else if (action.type === ActionType.ABORT) {
          return this._finish('abort', action.data.value);
        } else if (action.type === ActionType.INFO) {
          const question = action.data.value || '';
          const reply = this._infoReply(question);
          if (typeof agent.addUserComment === 'function') {
            agent.addUserComment(reply);
          }
          this._emit('onStepError', { step, message: question ? `INFO: ${question}` : 'INFO' });
        } else if (action.type === ActionType.NOOP) {
          this._emit('onStepError', { step, message: action.data.unknown_action || action.data.reason || 'noop' });
        } else {
          try {
            await this.executorProvider.run(win, action, { resolveAppId: this.appResolver });
          } catch (err) {
            if (err instanceof ActionFormatError || (err && err.name === 'FormatError')) {
              return this._finish('format_error', err.message || String(err));
            }
            this._emit('onStepError', { step, message: err.message || String(err) });
          }
        }

        await sleep(this.settleMs);
      }

      this._finish(this._aborted() ? 'stopped' : 'maxsteps');
    } catch (err) {
      if (err && err.name === 'AbortError') this._finish('stopped');
      else this._finish('error', err && err.message ? err.message : String(err));
    }
  }

  _finish(reason, message = '') {
    this.state = 'idle';
    this.abortCtl = null;
    this._emit('onDone', { reason, message });
  }
}
