import { createVolatileOsStore } from './createOsStore';
import { realNow } from './TimeService';
type EditableEl = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

export interface SelectionMenuPosition {
  x: number;
  y: number;
}

export interface TextSelectionState {
  selectionMenuVisible: boolean;
  selectionMenuPosition: SelectionMenuPosition | null;
  selectedText: string;
  targetElement: HTMLElement | null;
}

interface ClipboardAdapter {
  copyText: (text: string) => void;
  getText: () => string | null;
}

const clipboardAdapter: ClipboardAdapter = {
  copyText: () => {},
  getText: () => null,
};

const base = createVolatileOsStore<TextSelectionState>('textSelection', {
  selectionMenuVisible: false,
  selectionMenuPosition: null,
  selectedText: '',
  targetElement: null,
}, {
  useImmer: false,
  registerToServiceRegistry: false,
});

let suppressAutoMenuUntil = 0;

function nowMs(): number {
  return realNow();
}

function isSuppressed(): boolean {
  return nowMs() < suppressAutoMenuUntil;
}

function isEditableElement(el: any): el is EditableEl {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) return !el.disabled && !el.readOnly && el.type !== 'hidden';
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  return el.isContentEditable === true;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  let proto: any = Object.getPrototypeOf(el);
  while (proto) {
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && typeof desc.set === 'function') {
      desc.set.call(el, value);
      return;
    }
    proto = Object.getPrototypeOf(proto);
  }
  (el as any).value = value;
}

function dispatchInput(el: HTMLElement) {
  try {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } catch {
    // ignore
  }
}

function insertTextAtCursor(el: EditableEl, text: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const value = String(el.value ?? '');
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;
    const next = value.slice(0, start) + text + value.slice(end);
    setNativeValue(el, next);
    try {
      const caret = start + text.length;
      el.setSelectionRange(caret, caret);
    } catch {
      // ignore
    }
    dispatchInput(el);
    return;
  }

  try {
    document.execCommand('insertText', false, text);
  } catch {
    el.textContent = (el.textContent || '') + text;
    dispatchInput(el);
  }
}

function selectAllText(el: EditableEl) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function configureTextSelectionClipboardAdapter(adapter: Partial<ClipboardAdapter>) {
  if (typeof adapter.copyText === 'function') clipboardAdapter.copyText = adapter.copyText;
  if (typeof adapter.getText === 'function') clipboardAdapter.getText = adapter.getText;
}

export const TextSelectionService = {
  getState: base.getState,

  subscribe(listener: (state: TextSelectionState) => void): () => void {
    listener(base.getState());
    return base.subscribe(listener);
  },

  showSelectionMenu(x: number, y: number, selectedText: string, targetElement?: HTMLElement): void {
    base.setState({
      selectionMenuVisible: true,
      selectionMenuPosition: { x, y },
      selectedText: String(selectedText ?? ''),
      targetElement: targetElement || null,
    }, true);
  },

  updateSelectedText(selectedText: string): void {
    const state = base.getState();
    if (!state.selectionMenuVisible) return;
    const next = String(selectedText ?? '');
    if (next === state.selectedText) return;
    base.setState({
      ...state,
      selectedText: next,
    }, true);
  },

  hideSelectionMenu(): void {
    const state = base.getState();
    if (!state.selectionMenuVisible) return;
    base.setState({
      ...state,
      selectionMenuVisible: false,
      selectionMenuPosition: null,
      selectedText: '',
      targetElement: null,
    }, true);
  },

  suppressAutoMenu(ms: number = 350): void {
    const dur = Math.max(0, Math.min(2000, Math.floor(ms)));
    suppressAutoMenuUntil = nowMs() + dur;
  },

  canAutoShowMenu(): boolean {
    return !isSuppressed();
  },

  isMenuVisible(): boolean {
    return base.getState().selectionMenuVisible;
  },

  getTargetElement(): HTMLElement | null {
    return base.getState().targetElement;
  },

  performCopy(): void {
    const state = base.getState();
    if (!state.selectedText) return;
    TextSelectionService.suppressAutoMenu();
    clipboardAdapter.copyText(state.selectedText);
    TextSelectionService.hideSelectionMenu();
  },

  performPaste(): void {
    const state = base.getState();
    const text = clipboardAdapter.getText();
    if (text && state.targetElement && isEditableElement(state.targetElement)) {
      state.targetElement.focus();
      insertTextAtCursor(state.targetElement, text);
    }
    TextSelectionService.suppressAutoMenu();
    TextSelectionService.hideSelectionMenu();
  },

  performSelectAll(): void {
    const state = base.getState();
    if (state.targetElement && isEditableElement(state.targetElement)) {
      state.targetElement.focus();
      selectAllText(state.targetElement);
    }
    TextSelectionService.suppressAutoMenu();
    TextSelectionService.hideSelectionMenu();
  },
};

export default TextSelectionService;
