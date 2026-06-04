// Base browser agent, mirroring bench_env.agent.base at a smaller scale.
//
// Subclasses provide prompt construction details and response parsing. The base
// class owns task lifecycle, history, pending INFO replies, and LLM invocation.
import { chat } from './vlm-client.js';

export class BaseAgent {
  static id = 'base';
  static label = 'Base Agent';
  static blurb = '';
  static defaultArgs = {};
  static keepRecentHeavyRecords = 2;

  /**
   * @param {{baseUrl:string,model:string,apiKey:string}} cfg
   * @param {object} args resolved model args
   */
  constructor(cfg, args = {}) {
    this.cfg = cfg;
    this.args = args || {};
    this.task = '';
    this.history = []; // { raw, app, image, userComment }
    this.pendingComment = '';
  }

  get name() {
    return this.constructor.label || this.constructor.id;
  }

  reset(task) {
    this.task = task;
    this.history = [];
    this.pendingComment = '';
  }

  resetHistory() {
    this.history = [];
  }

  evictOldRecords() {
    const keepRecent = Number(this.constructor.keepRecentHeavyRecords ?? 2);
    const evictBefore = this.history.length - Math.max(0, keepRecent);
    for (let i = 0; i < evictBefore; i += 1) {
      if (this.history[i]) {
        this.history[i].image = '';
      }
    }
  }

  addUserComment(comment) {
    this.pendingComment = String(comment || '');
  }

  systemPrompt(_ctx = {}) {
    return '';
  }

  userStepText(_ctx = {}) {
    return '';
  }

  historyAssistant(raw) {
    return raw;
  }

  buildMessages({ image, app, today }) {
    const messages = [{ role: 'system', content: this.systemPrompt({ today }) }];
    this.history.forEach((record, index) => {
      messages.push({
        role: 'user',
        content: [{
          type: 'text',
          text: this.userStepText({
            task: this.task,
            app: record.app,
            index,
            userComment: record.userComment || '',
          }),
        }],
      });
      messages.push({ role: 'assistant', content: this.historyAssistant(record.raw) });
    });
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: image } },
        {
          type: 'text',
          text: this.userStepText({
            task: this.task,
            app,
            index: this.history.length,
            userComment: this.pendingComment,
          }),
        },
      ],
    });
    return messages;
  }

  parseResponse(_responseText) {
    throw new Error(`${this.name} must implement parseResponse()`);
  }

  /** One step: { image, app, today } in -> { thought, action, raw } out. */
  async act({ image, app, today }, { signal, onDelta } = {}) {
    const messages = this.buildMessages({ image, app, today });
    const content = await chat(this.cfg, messages, { args: this.args, signal, onDelta });
    const { thought, action } = this.parseResponse(content);
    this.history.push({ raw: content, app, image, userComment: this.pendingComment });
    this.evictOldRecords();
    this.pendingComment = '';
    return { thought, action, raw: content };
  }
}
