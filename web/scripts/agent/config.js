// Effective-config resolution for the demo agent.
//
// Precedence: visitor settings (localStorage) override the baked-in preset.
// Connection is "usable" when it has both a baseUrl and a model; apiKey may be
// empty for keyless local endpoints.
import { DEFAULT_CONFIG } from './config.default.js';
import { AGENT_CLASSES, getAgentMeta, DEFAULT_AGENT_ID, ARG_FIELDS } from './agents/index.js';

const STORAGE_KEY = 'mg_agent_cfg_v2';
const ARG_KEYS = ARG_FIELDS.map((f) => f.key);
const BOOL_ARG_KEYS = ['stream'];

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Raw persisted settings (or null). */
export function getOverride() {
  return readStore();
}

/**
 * Persist visitor settings. `args` holds only the model-arg fields the visitor
 * actually changed (numbers); blank fields are dropped so the agent default
 * applies.
 */
export function saveOverride({ agent, framework, baseUrl, model, apiKey, args }) {
  const cleanArgs = {};
  if (args && typeof args === 'object') {
    for (const k of ARG_KEYS) {
      const v = args[k];
      if (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))) {
        cleanArgs[k] = Number(v);
      }
    }
    for (const k of BOOL_ARG_KEYS) {
      if (typeof args[k] === 'boolean') cleanArgs[k] = args[k];
    }
  }
  const agentId = agent || framework || DEFAULT_AGENT_ID;
  const payload = {
    agent: AGENT_CLASSES[agentId] ? agentId : DEFAULT_AGENT_ID,
    baseUrl: (baseUrl || '').trim(),
    model: (model || '').trim(),
    apiKey: (apiKey || '').trim(),
    args: cleanArgs,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearOverride() {
  localStorage.removeItem(STORAGE_KEY);
}

/** The agent id currently in effect. */
export function getAgentId() {
  const o = readStore();
  const id = (o && (o.agent || o.framework)) || DEFAULT_CONFIG.agent || DEFAULT_CONFIG.framework || DEFAULT_AGENT_ID;
  return AGENT_CLASSES[id] ? id : DEFAULT_AGENT_ID;
}

/**
 * Resolved model args for an agent: agent defaults, with any saved
 * numeric overrides layered on top.
 */
export function getEffectiveArgs(agentId = getAgentId()) {
  const meta = getAgentMeta(agentId);
  const base = { ...(meta.defaultArgs || {}) };
  const o = readStore();
  if (o && o.args && typeof o.args === 'object') {
    for (const k of ARG_KEYS) {
      if (Number.isFinite(Number(o.args[k]))) base[k] = Number(o.args[k]);
    }
    for (const k of BOOL_ARG_KEYS) {
      if (typeof o.args[k] === 'boolean') base[k] = o.args[k];
    }
  }
  return base;
}

/** Connection config (endpoint), preset overridden by saved settings. */
export function getEffectiveConfig() {
  const o = readStore() || {};
  return {
    agent: getAgentId(),
    baseUrl: (o.baseUrl || '').trim() || DEFAULT_CONFIG.baseUrl || '',
    model: (o.model || '').trim() || DEFAULT_CONFIG.model || '',
    apiKey: (o.apiKey || '').trim() || DEFAULT_CONFIG.apiKey || '',
  };
}

export function isConfigUsable(cfg = getEffectiveConfig()) {
  return Boolean(cfg.baseUrl && cfg.model);
}

/** Values to prefill the settings form with. Endpoint/key fields show only
 *  saved overrides, never baked presets, so public defaults are not exposed in
 *  visible inputs. */
export function getFormValues(agentId = getAgentId()) {
  const o = readStore() || {};
  const savedBaseUrl = (o.baseUrl || '').trim();
  const savedModel = (o.model || '').trim();
  const savedApiKey = (o.apiKey || '').trim();
  return {
    agent: agentId,
    baseUrl: savedBaseUrl,
    model: savedModel || DEFAULT_CONFIG.model || '',
    apiKey: savedApiKey,
    presetBaseUrlInUse: Boolean(DEFAULT_CONFIG.baseUrl && !savedBaseUrl),
    presetKeyInUse: Boolean(DEFAULT_CONFIG.apiKey && !savedApiKey),
    args: getEffectiveArgs(agentId),
  };
}
