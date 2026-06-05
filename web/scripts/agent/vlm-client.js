// Minimal OpenAI-compatible chat-completions client for the browser.
//
// Called directly from the page (no backend) — same pattern the simulator's
// own AIService uses. Messages may contain multimodal content parts
// ({type:'image_url', image_url:{url: <dataURL>}}), so the configured endpoint
// must be a vision model.
const TRANSIENT_ATTEMPTS = 3;
const TRANSIENT_RETRY_DELAYS_MS = [650, 1500];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function resolveUrl(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('No base URL configured (Model tab).');
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(`Base URL must start with http(s)://  (got "${base}"). For BigModel use https://open.bigmodel.cn/api/paas/v4`);
  }
  // Accept either a base ("…/v1", "…/api/paas/v4") or a full chat URL.
  return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
}

function isManagedMobileGymProxy(url) {
  try {
    const base = globalThis.location?.href || 'https://mobilegym.dev/';
    const u = new URL(url, base);
    return u.hostname === 'api.mobilegym.dev' && u.pathname.startsWith('/ai/v1/');
  } catch {
    return false;
  }
}

function mergeReasoningIntoContent(content, reasoning) {
  const base = String(content || '');
  const r = String(reasoning || '');
  if (!r) return base;
  const m = /<think>([\s\S]*?)<\/think>/i.exec(base);
  if (m) {
    const existing = m[1].trim();
    const merged = existing ? `${r}\n${existing}` : r;
    return `${base.slice(0, m.index)}<think>${merged}</think>${base.slice(m.index + m[0].length)}`;
  }
  return `<think>${r}</think>\n${base}`;
}

async function readStreamContent(resp, { onDelta } = {}) {
  if (!resp.body?.getReader) {
    throw new Error('Streaming response body is not readable in this browser.');
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';

  function consumeLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':')) return;
    if (!trimmed.startsWith('data:')) return;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return;

    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const delta = parsed?.choices?.[0]?.delta || {};
    if (delta.content) {
      const text = String(delta.content);
      content += text;
      if (typeof onDelta === 'function') {
        onDelta({ kind: 'content', text, content, reasoning });
      }
    }
    const reasoningDelta = delta.reasoning_content ?? delta.reasoning;
    if (reasoningDelta) {
      const text = String(reasoningDelta);
      reasoning += text;
      if (typeof onDelta === 'function') {
        onDelta({ kind: 'reasoning', text, content, reasoning });
      }
    }
  }

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      consumeLine(line);
      nl = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    buffer.split(/\r?\n/).forEach(consumeLine);
  }

  if (reasoning) content = mergeReasoningIntoContent(content, reasoning);
  return content;
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return 'unknown size';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function parseJsonText(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function t(key, params, fallback) {
  return globalThis.I18N?.t ? globalThis.I18N.t(key, params) : fallback;
}

function formatRetryAfter(seconds) {
  const zh = globalThis.I18N?.lang === 'zh';
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return zh ? '几分钟' : 'a few minutes';
  if (n < 60) {
    const secondsRounded = Math.ceil(n);
    return zh ? `${secondsRounded}秒` : `${secondsRounded} second${secondsRounded === 1 ? '' : 's'}`;
  }
  const minutes = Math.ceil(n / 60);
  if (minutes < 60) return zh ? `${minutes}分钟` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return zh ? `${hours}小时` : `${hours} hour${hours === 1 ? '' : 's'}`;
}

function isTransientHttpStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

/**
 * @param {{baseUrl:string, model:string, apiKey:string}} cfg
 * @param {Array} messages OpenAI-format messages (content may be string or parts[])
 * @param {object} [opts] { args?: object, signal?: AbortSignal, onDelta?: Function, onRetry?: Function }
 * @returns {Promise<string>} assistant message content
 */
export async function chat(cfg, messages, opts = {}) {
  const url = resolveUrl(cfg.baseUrl);
  // Model args are supplied entirely by the caller. The runner passes the
  // selected agent's defaults plus any explicit UI overrides, matching
  // bench_env agent DEFAULT_MODEL_ARGS merging.
  const body = {
    model: cfg.model,
    messages,
    stream: false,
    ...(opts.args || {}),
  };
  const stream = Boolean(body.stream);

  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey && !isManagedMobileGymProxy(url)) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }

  const bodyText = JSON.stringify(body);
  const bodyBytes = new TextEncoder().encode(bodyText).byteLength;

  let resp;
  for (let attempt = 1; attempt <= TRANSIENT_ATTEMPTS; attempt += 1) {
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers,
        body: bodyText,
        signal: opts.signal,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      const detail = err && err.message ? err.message : String(err);
      const failedToFetch = /Failed to fetch/i.test(detail);
      if (failedToFetch && attempt < TRANSIENT_ATTEMPTS) {
        const delayMs = TRANSIENT_RETRY_DELAYS_MS[attempt - 1] || 1500;
        opts.onRetry?.({
          attempt,
          nextAttempt: attempt + 1,
          maxAttempts: TRANSIENT_ATTEMPTS,
          reason: 'network',
          delayMs,
        });
        await sleep(delayMs);
        continue;
      }
      if (failedToFetch && isManagedMobileGymProxy(url)) {
        throw new Error(t(
          'error.managedProxyNetwork',
          { attempts: TRANSIENT_ATTEMPTS },
          `The public demo agent endpoint could not be reached after ${TRANSIENT_ATTEMPTS} attempts. It may be temporarily rate-limited or blocked by the network/CDN. Please wait a few minutes and try again, or switch to your own model endpoint/API key in Settings.`,
        ));
      }
      const hint = failedToFetch
        ? ` No HTTP response was received; request size was ${formatBytes(bodyBytes)}. This is usually a browser/network/CORS rejection or a dropped oversized request, not a model quota error.`
        : '';
      throw new Error(`Network error reaching ${url}: ${detail}.${hint}`.trim());
    }

    if (!resp.ok && isTransientHttpStatus(resp.status) && attempt < TRANSIENT_ATTEMPTS) {
      const delayMs = TRANSIENT_RETRY_DELAYS_MS[attempt - 1] || 1500;
      try {
        console.warn('[agent-vlm] transient response; retrying', {
          status: resp.status,
          statusText: resp.statusText,
          url,
          attempt,
          maxAttempts: TRANSIENT_ATTEMPTS,
        });
      } catch { /* ignore */ }
      opts.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts: TRANSIENT_ATTEMPTS,
        reason: 'http',
        status: resp.status,
        delayMs,
      });
      await sleep(delayMs);
      continue;
    }
    break;
  }

  if (!resp.ok) {
    let detail = '';
    try {
      detail = await resp.text();
    } catch { /* ignore */ }
    const errorBody = parseJsonText(detail);
    try {
      console.error('[agent-vlm] request failed', {
        status: resp.status,
        statusText: resp.statusText,
        url,
        body: {
          ...body,
          messages: `${Array.isArray(messages) ? messages.length : 0} message(s)`,
          requestBytes: bodyBytes,
        },
        detail,
      });
    } catch { /* ignore */ }
    if (resp.status === 429) {
      const retryAfter = errorBody?.retry_after ?? resp.headers.get('Retry-After');
      const wait = formatRetryAfter(retryAfter);
      throw new Error(t(
        'error.rateLimit',
        { wait },
        `Public demo agent limit reached. Please wait about ${wait} and try again, or switch to your own model endpoint/API key in Settings.`,
      ));
    }
    const hint = resp.status === 404
      ? ` — the path doesn't exist at this base. Check the URL (it should resolve to ${url}).`
      : '';
    throw new Error(`${resp.status} ${resp.statusText} from ${url}.${hint} Request size: ${formatBytes(bodyBytes)}. ${detail}`.trim());
  }

  if (stream) {
    const content = await readStreamContent(resp, { onDelta: opts.onDelta });
    if (content) return content;
    throw new Error('VLM streaming response had no message content.');
  }

  const data = await resp.json();
  const msg = data?.choices?.[0]?.message || {};
  const reasoning = msg.reasoning_content || msg.reasoning;
  let content = msg.content;
  if (reasoning) content = mergeReasoningIntoContent(content, reasoning);
  if (typeof content !== 'string') {
    throw new Error('VLM response had no message content.');
  }
  return content;
}
