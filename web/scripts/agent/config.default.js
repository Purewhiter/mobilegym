// Preset config for the in-browser demo agent.
//
// This is the DEFAULT, baked-into-the-page config. It is OVERRIDDEN at runtime
// by anything the visitor saves in the Settings panel (kept in localStorage).
//
// ⚠️ Whatever key you put here ships in the static page and can be extracted by
//    anyone. Only use an endpoint you are fine exposing (self-hosted, cheap,
//    rate-limited). Leave it blank to require BYOK.
//
// `baseUrl` is the part before `/chat/completions`, e.g. "https://api.openai.com/v1".
// `agent` is the default agent id (see agents/index.js):
//   'generic_v2' | 'autoglm'.
// The model args (temperature/top_p/...) default to the chosen agent's own
// defaults — no need to set them here.
export const DEFAULT_CONFIG = {
  agent: 'autoglm',
  baseUrl: 'https://api.mobilegym.dev/ai/v1',
  model: 'autoglm-phone',
  apiKey: '',
};
