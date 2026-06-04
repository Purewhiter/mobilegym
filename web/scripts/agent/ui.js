// Entry module for the in-browser demo agent console.
//
// Layout: the phone is the star. During a run the agent's pointer actions are
// drawn straight onto the live screen (PhoneOverlay — cursor / ripple / swipe
// trail), a glass "narration" card floats off the phone's right edge with the
// current step's reasoning + a reviewable timeline, and a HUD pill on the phone
// reports live status. The bottom command bar stays minimal (instruction +
// Run/Stop + ⚙); all model/agent settings live in a slide-over sheet.
//
// A single body[data-agent-run="idle|running|done"] attribute drives every
// CSS state transition (dock retreat, narration/HUD visibility, bar morph).
import { Runner } from './runner.js';
import { ActionType } from './actions.js';
import { PhoneOverlay } from './overlay.js';
import {
  getEffectiveConfig,
  isConfigUsable,
  saveOverride,
  clearOverride,
  getFormValues,
  getOverride,
} from './config.js';
import { AGENT_ORDER, ARG_FIELDS, createAgent, getAgentMeta } from './agents/index.js';

function init() {
  const $ = (id) => document.getElementById(id);
  const console_ = $('agent-console');
  const instruction = $('agent-instruction');
  const runBtn = $('agent-run');
  const stopBtn = $('agent-stop');
  const statusEl = $('agent-status');
  if (!console_ || !instruction || !runBtn) return;

  // Narration card + on-phone HUD
  const narrStep = $('agent-narr-step');
  const narrAction = $('agent-narr-action');
  const narrThink = $('agent-narr-think');
  const answerEl = $('agent-answer');
  const hud = $('agent-hud');
  const hudText = $('agent-hud-text');
  const tlToggle = $('agent-narr-timeline-toggle');
  const tlCount = $('agent-narr-count');
  const tlTicks = $('agent-narr-ticks');
  const tlBox = $('agent-narr-timeline');

  // Settings sheet controls
  const sheet = $('agent-settings');
  const sheetOpenBtn = $('agent-settings-open');
  const agentSel = $('agent-cfg-agent');
  const agentBlurb = $('agent-blurb');
  const baseInput = $('agent-cfg-baseurl');
  const modelInput = $('agent-cfg-model');
  const keyInput = $('agent-cfg-key');
  const argsBox = $('agent-cfg-args');
  const cfgStatus = $('agent-cfg-status');

  const overlay = new PhoneOverlay(() => $('agent-overlay'));

  // i18n: translate dynamic strings through the shared dictionary (falls back
  // to the key if i18n isn't loaded). Static markup is handled by data-i18n.
  const t = (key, params) => (window.I18N ? window.I18N.t(key, params) : key);

  // ---- run-state attribute drives all CSS -------------------------------
  function setRunState(state) {
    document.body.dataset.agentRun = state;
    console_.dataset.runState = state;
  }
  setRunState('idle');

  // Example chips are discovery affordances, not permanent chrome: collapse
  // them once the input has text (or a run is active — handled by run-state).
  function syncEmpty() {
    console_.dataset.empty = instruction.value.trim() ? 'false' : 'true';
  }
  syncEmpty();

  // ---- status (bottom bar) + HUD (on phone) -----------------------------
  function setStatus(text, kind = 'idle') {
    statusEl.textContent = text;
    statusEl.title = text;
    statusEl.dataset.kind = kind;
  }
  function setHud(text, kind = 'running') {
    if (!hud) return;
    hud.dataset.kind = kind;
    hudText.textContent = text;
  }
  function setRunning(running) {
    runBtn.hidden = running;
    stopBtn.hidden = !running;
    instruction.disabled = running;
    document.querySelectorAll('.mg-agent-chip').forEach((c) => { c.disabled = running; });
  }

  // ---- action labels (shared protocol) ----------------------------------
  const fmtPt = (p) => (Array.isArray(p) ? `${Math.round(p[0])},${Math.round(p[1])}` : '?');
  function actionLabel(action) {
    const d = action.data || {};
    switch (action.type) {
      case ActionType.CLICK:
      case ActionType.DOUBLE_TAP:
      case ActionType.LONG_PRESS:
        return `${action.type} (${fmtPt(d.point)})`;
      case ActionType.TYPE: return `TYPE “${String(d.value || '').slice(0, 40)}”`;
      case ActionType.SWIPE:
      case ActionType.DRAG:
        return `${action.type} ${fmtPt(d.point1)} → ${fmtPt(d.point2)}`;
      case ActionType.AWAKE: return `OPEN ${d.value || ''}`;
      case ActionType.WAIT: return `WAIT ${d.value}s`;
      case ActionType.ANSWER: return `ANSWER “${String(d.value || '').slice(0, 60)}”`;
      case ActionType.INFO: return `INFO “${String(d.value || '').slice(0, 60)}”`;
      case ActionType.COMPLETE: return 'COMPLETE';
      case ActionType.ABORT: return `ABORT ${d.value || ''}`;
      default: return action.type;
    }
  }
  // Compact verb for the HUD pill (translated via verb.<TYPE> keys).
  const hudVerb = (action) => {
    const key = `verb.${action.type}`;
    const v = t(key);
    return v === key ? String(action.type || '').toLowerCase() : v;
  };

  // ---- narration + timeline ---------------------------------------------
  const steps = [];
  let following = true; // when true, narration mirrors the live step
  let liveStep = 0;

  function scrollThinkToEnd() {
    requestAnimationFrame(() => {
      narrThink.scrollTop = narrThink.scrollHeight;
    });
  }
  function crossfade(el, text) {
    el.classList.add('is-fading');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('is-fading');
      if (el === narrThink && following) scrollThinkToEnd();
    }, 130);
  }
  function showStepInCard(s) {
    liveStep = s.step;
    narrStep.textContent = t('narr.step', { n: s.step });
    narrAction.textContent = actionLabel(s.action);
    narrAction.dataset.type = s.action.type;
    crossfade(narrThink, s.thought || '');
  }
  function showThinkingStep({ step, thought = '' }) {
    liveStep = step;
    if (!following) return;
    narrStep.textContent = t('narr.step', { n: step });
    narrAction.textContent = t('narr.thinking');
    narrAction.dataset.type = '';
    narrThink.classList.remove('is-fading');
    narrThink.textContent = thought;
    scrollThinkToEnd();
  }
  function resetNarration() {
    steps.length = 0;
    following = true;
    liveStep = 0;
    narrStep.textContent = t('narr.step', { n: 0 });
    narrAction.textContent = t('narr.starting');
    narrAction.dataset.type = '';
    narrThink.classList.remove('is-fading');
    narrThink.textContent = '';
    narrThink.scrollTop = 0;
    answerEl.hidden = true;
    answerEl.textContent = '';
    tlCount.textContent = t('narr.steps', { n: 0 });
    tlTicks.innerHTML = '';
    tlBox.innerHTML = '';
    tlBox.hidden = true;
    tlToggle.setAttribute('aria-expanded', 'false');
  }
  function reviewStep(n) {
    const s = steps.find((x) => x.step === n);
    if (!s) return;
    following = false;
    showStepInCard(s);
    tlBox.querySelectorAll('.mg-narr-frame').forEach((f) => {
      f.classList.toggle('is-active', Number(f.dataset.step) === n);
    });
  }
  function appendStep(payload) {
    steps.push(payload);
    if (following) showStepInCard(payload);

    // tick in the collapsed strip
    const tick = document.createElement('span');
    tick.className = 'mg-narr-tick';
    tick.dataset.type = payload.action.type;
    tlTicks.appendChild(tick);
    tlCount.textContent = t('narr.steps', { n: steps.length });

    // thumbnail in the expandable timeline
    if (payload.shot) {
      const frame = document.createElement('button');
      frame.type = 'button';
      frame.className = 'mg-narr-frame';
      frame.dataset.step = String(payload.step);
      frame.title = `Step ${payload.step} · ${actionLabel(payload.action)}`;
      const img = document.createElement('img');
      img.src = payload.shot;
      img.alt = `Screen at step ${payload.step}`;
      img.loading = 'lazy';
      const num = document.createElement('span');
      num.className = 'mg-narr-frame-num';
      num.textContent = String(payload.step);
      frame.append(img, num);
      frame.addEventListener('click', () => reviewStep(payload.step));
      tlBox.appendChild(frame);
      if (tlToggle.getAttribute('aria-expanded') === 'true' && following) {
        frame.scrollIntoView({ inline: 'end', block: 'nearest', behavior: 'smooth' });
      }
    }
  }
  function appendError(message) {
    narrAction.textContent = t('narr.error');
    narrAction.dataset.type = 'ABORT';
    crossfade(narrThink, message || t('narr.unknownError'));
  }

  tlToggle.addEventListener('click', () => {
    const open = tlToggle.getAttribute('aria-expanded') === 'true';
    tlToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    tlBox.hidden = open;
    if (open) {
      // collapsing → resume following the live step
      following = true;
      const last = steps[steps.length - 1];
      if (last) showStepInCard(last);
    }
  });

  // ---- runner ------------------------------------------------------------
  const runner = new Runner({
    getFrameEl: () => $('demo-frame'),
    makeAgent: () => {
      const f = readForm();
      return createAgent(f.agent, { baseUrl: f.baseUrl, model: f.model, apiKey: f.apiKey }, f.args);
    },
    callbacks: {
      onStatus: ({ text }) => { setHud(text, 'running'); },
      onStepStart: (payload) => {
        showThinkingStep(payload);
      },
      onStepDelta: ({ step, thought }) => {
        if (following && step === liveStep) showThinkingStep({ step, thought });
      },
      onStep: (payload) => {
        const preview = overlay.play(payload.action);
        appendStep(payload);
        setHud(t('narr.stepHud', { n: payload.step, verb: hudVerb(payload.action) }), 'running');
        return preview;
      },
      onStepError: ({ step, message }) => {
        setHud(t('narr.stepError', { n: step, m: message }), 'warn');
        setStatus(t('narr.stepError', { n: step, m: message }), 'warn');
      },
      onAnswer: ({ value }) => {
        answerEl.hidden = false;
        answerEl.textContent = t('narr.answer', { v: value });
      },
      onDone: ({ reason, message }) => {
        setRunning(false);
        overlay.end();
        setRunState('done');
        if ((reason === 'error' || reason === 'format_error') && message) appendError(message);
        // The full completion text is the answer — surface it in the narration
        // card (it wraps + scrolls), never in the one-line bar status.
        if (reason === 'complete' && message && answerEl.hidden) {
          answerEl.hidden = false;
          answerEl.textContent = message;
        }
        const map = {
          complete: [t('done.complete'), 'ok'],
          abort: [t('done.abort'), 'warn'],
          format_error: [t('done.formatError'), 'error'],
          maxsteps: [t('done.maxsteps'), 'warn'],
          stopped: [t('done.stopped'), 'idle'],
          error: [t('done.error'), 'error'],
        };
        const [text, kind] = map[reason] || [t('done.done'), 'idle'];
        setStatus(text, kind);
        setHud(text, kind);
      },
    },
  });

  // ---- run / stop --------------------------------------------------------
  const phoneBooted = () => Boolean(document.querySelector('#demo-frame iframe'));

  async function onRun() {
    const task = instruction.value.trim();
    if (!task) { setStatus(t('status.enterTask'), 'warn'); instruction.focus(); return; }
    const f = readForm();
    if (!(f.baseUrl && f.model)) {
      setStatus(t('status.setEndpoint'), 'warn');
      openSheet();
      return;
    }
    if (!phoneBooted()) {
      $('demo-boot-btn')?.click();
      setStatus(t('status.poweringOn'), 'running');
    }
    resetNarration();
    overlay.begin();
    setRunning(true);
    setRunState('running');
    setStatus(t('status.running'), 'running');
    setHud(t('status.preparing'), 'running');
    runner.start(task);
  }

  function abortToIdle() {
    runner.stop();
    overlay.end();
    setRunning(false);
    setRunState('idle');
  }

  runBtn.addEventListener('click', onRun);
  stopBtn.addEventListener('click', () => runner.stop());
  instruction.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onRun(); }
  });
  instruction.addEventListener('input', syncEmpty);
  document.querySelectorAll('.mg-agent-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      instruction.value = chip.dataset.prompt || '';
      syncEmpty();
      instruction.focus();
    });
  });
  // Collapse / expand the task bar (folds input + chips, keeps the status).
  const collapseBtn = $('agent-collapse');
  collapseBtn?.addEventListener('click', () => {
    const collapsed = console_.dataset.collapsed === 'true';
    const next = collapsed ? 'false' : 'true';
    console_.dataset.collapsed = next;
    collapseBtn.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
    const ariaKey = next === 'true' ? 'console.expandAria' : 'console.collapseAria';
    collapseBtn.setAttribute('data-i18n-aria', ariaKey);
    collapseBtn.setAttribute('aria-label', t(ariaKey));
  });

  // Power-off mid-run: stop the agent and clear the overlay back to idle.
  $('demo-poweroff-btn')?.addEventListener('click', abortToIdle);
  // Dismiss the narration result → idle, restoring the phone's side tools.
  $('agent-narr-dismiss')?.addEventListener('click', abortToIdle);

  // ---- settings sheet ----------------------------------------------------
  function openSheet() {
    sheet.hidden = false;
    requestAnimationFrame(() => { sheet.dataset.open = 'true'; });
  }
  function closeSheet() {
    sheet.dataset.open = 'false';
    setTimeout(() => { sheet.hidden = true; }, 240);
  }
  sheetOpenBtn?.addEventListener('click', () => {
    if (sheet.dataset.open === 'true') closeSheet(); else openSheet();
  });
  $('agent-settings-close')?.addEventListener('click', closeSheet);
  $('agent-settings-backdrop')?.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.dataset.open === 'true') closeSheet();
  });

  // ---- settings form (config layer unchanged) ---------------------------
  AGENT_ORDER.forEach((id) => {
    const meta = getAgentMeta(id);
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = meta.label;
    agentSel.append(opt);
  });

  const argInputs = {};
  const dirtyArgs = new Set();
  ARG_FIELDS.forEach((f) => {
    const label = document.createElement('label');
    label.className = 'mg-agent-arg';
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = 'number'; input.id = `agent-arg-${f.key}`;
    input.step = f.step; input.min = f.min; input.max = f.max;
    input.autocomplete = 'off';
    input.addEventListener('input', () => dirtyArgs.add(f.key));
    label.append(input);
    argsBox.append(label);
    argInputs[f.key] = input;
  });

  function fillArgsFor(agentId, fromSaved) {
    const defaults = getAgentMeta(agentId).defaultArgs || {};
    const override = fromSaved ? getOverride() : null;
    const savedAgent = override && (override.agent || override.framework);
    const saved = override && savedAgent === agentId && override.args && typeof override.args === 'object'
      ? override.args
      : {};
    dirtyArgs.clear();
    ARG_FIELDS.forEach((f) => {
      const hasSaved = Number.isFinite(Number(saved[f.key]));
      const defaultValue = Number(defaults[f.key]);
      const savedValue = Number(saved[f.key]);
      const isExplicit = hasSaved && (!Number.isFinite(defaultValue) || savedValue !== defaultValue);
      const v = hasSaved ? saved[f.key] : defaults[f.key];
      argInputs[f.key].value = v === undefined || v === null ? '' : v;
      if (isExplicit) dirtyArgs.add(f.key);
    });
  }

  function loadForm() {
    const v = getFormValues();
    agentSel.value = v.agent;
    agentBlurb.textContent = getAgentMeta(v.agent).blurb || '';
    baseInput.value = v.baseUrl;
    baseInput.placeholder = v.presetBaseUrlInUse ? '(preset endpoint in use — leave blank)' : 'https://api.openai.com/v1';
    modelInput.value = v.model;
    keyInput.value = v.apiKey;
    keyInput.placeholder = v.presetKeyInUse ? t('settings.keyPreset') : 'sk-…';
    fillArgsFor(v.agent, true);
  }

  function readArgs() {
    const out = {};
    ARG_FIELDS.forEach((f) => {
      if (!dirtyArgs.has(f.key)) return;
      const raw = argInputs[f.key].value;
      if (raw === '') return;
      const n = Number(raw);
      if (Number.isFinite(n)) out[f.key] = n;
    });
    return out;
  }

  function readRunArgs(agentId) {
    return {
      ...(getAgentMeta(agentId).defaultArgs || {}),
      ...readArgs(),
    };
  }

  function readForm() {
    const eff = getEffectiveConfig();
    const agent = agentSel.value || eff.agent;
    return {
      agent,
      baseUrl: baseInput.value.trim() || eff.baseUrl,
      model: modelInput.value.trim() || eff.model,
      apiKey: keyInput.value.trim() || eff.apiKey,
      args: readRunArgs(agent),
    };
  }

  agentSel.addEventListener('change', () => {
    agentBlurb.textContent = getAgentMeta(agentSel.value).blurb || '';
    fillArgsFor(agentSel.value, false);
    if (cfgStatus) cfgStatus.textContent = '';
  });

  $('agent-cfg-save')?.addEventListener('click', () => {
    saveOverride({
      agent: agentSel.value,
      baseUrl: baseInput.value,
      model: modelInput.value,
      apiKey: keyInput.value,
      args: readArgs(),
    });
    if (cfgStatus) cfgStatus.textContent = isConfigUsable() ? t('settings.saved') : t('settings.savedNeedEndpoint');
  });
  $('agent-cfg-clear')?.addEventListener('click', () => {
    clearOverride();
    loadForm();
    if (cfgStatus) cfgStatus.textContent = t('settings.resetDone');
  });

  loadForm();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
