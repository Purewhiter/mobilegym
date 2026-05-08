import BroadcastBus, { ACTION_CLIPBOARD_CHANGED } from './BroadcastBus';
import { configureTextSelectionClipboardAdapter } from './TextSelectionService';
import { createOsStore } from './createOsStore';
import * as TimeService from './TimeService';

export type ClipboardItemType = 'text' | 'image' | 'file';

export interface ClipboardItem {
  type: ClipboardItemType;
  content: string;
  timestamp: number;
  source?: string;
}

export interface ClipboardServiceState {
  current: ClipboardItem | null;
  history: ClipboardItem[];
}

const MAX_HISTORY = 20;
let lastBroadcastSignature: string | null = null;

function nowMs(): number {
  return TimeService.now();
}

function normalizeContent(content: string): string {
  return String(content ?? '');
}

function normalizeItem(raw: any): ClipboardItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type;
  if (type !== 'text' && type !== 'image' && type !== 'file') return null;
  const content = normalizeContent(raw.content);
  const timestamp = typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
    ? raw.timestamp
    : nowMs();
  const source = typeof raw.source === 'string' && raw.source.trim() ? raw.source.trim() : undefined;
  return { type, content, timestamp, source };
}

const base = createOsStore<ClipboardServiceState>(
  'clipboard',
  {
    current: null,
    history: [],
  },
  {
    persistName: 'os_clipboard_v1',
    validate: (raw) => {
      const parsed = raw && typeof raw === 'object' ? raw : {};
      const historyRaw = Array.isArray((parsed as any).history) ? (parsed as any).history : [];
      const history = historyRaw
        .map(normalizeItem)
        .filter((it: ClipboardItem | null): it is ClipboardItem => !!it)
        .slice(0, MAX_HISTORY);
      const current = normalizeItem((parsed as any).current) ?? (history[0] ?? null);
      return {
        current,
        history: current ? [current, ...history.filter((it: ClipboardItem) => it.timestamp !== current.timestamp)].slice(0, MAX_HISTORY) : history,
      };
    },
  },
);

function pushHistory(state: ClipboardServiceState, item: ClipboardItem): ClipboardItem[] {
  const head = state.history[0];
  if (head && head.type === item.type && head.content === item.content) {
    return [{ ...head, timestamp: item.timestamp, source: item.source }, ...state.history.slice(1)];
  }
  return [item, ...state.history].slice(0, MAX_HISTORY);
}

function broadcastClipboardChanged(state: ClipboardServiceState) {
  const cur = state.history[0] ?? state.current;
  const type = cur?.type ?? null;
  const contentLen = typeof cur?.content === 'string' ? cur.content.length : String(cur?.content ?? '').length;
  const source = typeof cur?.source === 'string' && cur.source.trim() ? cur.source.trim() : undefined;
  const hasContent = !!cur;
  const hasText = type === 'text' && contentLen > 0;

  const signature = JSON.stringify({
    type,
    contentLen,
    source: source ?? null,
    hasContent,
    hasText,
  });

  if (signature === lastBroadcastSignature) return;
  lastBroadcastSignature = signature;

  BroadcastBus.sendBroadcast({
    action: ACTION_CLIPBOARD_CHANGED,
    extras: {
      hasContent,
      hasText,
      type,
      source,
    },
  });
}

export const ClipboardService = {
  getState: base.getState,

  subscribe(listener: (state: ClipboardServiceState) => void): () => void {
    listener(base.getState());
    return base.subscribe(listener);
  },

  read(): ClipboardItem | null {
    const state = base.getState();
    return state.history[0] ?? state.current;
  },

  write(item: Omit<ClipboardItem, 'timestamp'>): void {
    const newItem: ClipboardItem = { ...item, content: normalizeContent(item.content), timestamp: nowMs() };
    const state = base.getState();
    const next = {
      current: newItem,
      history: pushHistory(state, newItem),
    };
    base.setState(next, true);
    broadcastClipboardChanged(next);
  },

  copyText(text: string, source?: string): void {
    ClipboardService.write({ type: 'text', content: text, source });
  },

  copyImage(uri: string, source?: string): void {
    ClipboardService.write({ type: 'image', content: uri, source });
  },

  getText(): string | null {
    const cur = ClipboardService.read();
    return cur?.type === 'text' ? cur.content : null;
  },

  hasContent(): boolean {
    return ClipboardService.read() !== null;
  },

  hasText(): boolean {
    const t = ClipboardService.getText();
    return typeof t === 'string' && t.length > 0;
  },

  clear(): void {
    const next = { current: null, history: [] };
    base.setState(next, true);
    broadcastClipboardChanged(next);
  },

  getHistory(): ClipboardItem[] {
    return base.getState().history;
  },

  readHistory(limit: number = MAX_HISTORY): ClipboardItem[] {
    const n = Math.max(0, Math.min(MAX_HISTORY, Math.floor(limit)));
    return base.getState().history.slice(0, n);
  },
};

configureTextSelectionClipboardAdapter({
  copyText: (text: string) => ClipboardService.copyText(text),
  getText: () => ClipboardService.getText(),
});

export default ClipboardService;
