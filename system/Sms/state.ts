import { useSyncExternalStore } from 'react';
import { createAppStoreWithActions } from '../../os/createAppStore';
import { SMS_CONFIG } from './data';
import ContentResolver from '../../os/ContentResolver';
import { ensureSmsProviderRegistered } from '../../os/providers/SmsProvider';
import * as TimeService from '../../os/TimeService';
import { NotificationService } from '../../os/NotificationService';
import type { Conversation, Message } from './types';

// --- Helper functions ---

type MessagesByConversationId = Record<string, Message[]>;

const randomId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${TimeService.now().toString(36).slice(-4)}`;

// --- State & Actions interfaces ---

interface SmsState {
  settings: Record<string, boolean>;
  _temp: {
    pendingTimers: number[];
  };
}

interface SmsActions {
  updateSettings: (patch: Record<string, boolean>) => void;
  trackTimer: (timerId: number) => void;
  untrackTimer: (timerId: number) => void;
  clearTimers: () => void;
}

// --- Initial state ---

const initialState: SmsState = {
  settings: { ...SMS_CONFIG.settings },
  _temp: { pendingTimers: [] },
};

// --- Store ---

export const useSmsStore = createAppStoreWithActions<SmsState, SmsActions>(
  'sms',
  initialState,
  (set, get) => ({
    updateSettings(patch: Record<string, boolean>) {
      set(state => ({ settings: { ...state.settings, ...patch } }));
    },
    trackTimer(timerId: number) {
      set((state) => ({ _temp: { ...state._temp, pendingTimers: [...state._temp.pendingTimers, timerId] } }));
    },
    untrackTimer(timerId: number) {
      set((state) => ({
        _temp: { ...state._temp, pendingTimers: state._temp.pendingTimers.filter((id) => id !== timerId) },
      }));
    },
    clearTimers() {
      const { pendingTimers } = get()._temp;
      pendingTimers.forEach((timerId) => window.clearTimeout(timerId));
      set((state) => ({ _temp: { ...state._temp, pendingTimers: [] } }));
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v !== 'function' && k !== '_temp') result[k] = v;
      }
      return result as Partial<SmsState>;
    },
  },
);

function buildSmsSnapshot(): { conversations: Conversation[]; messagesByConversationId: MessagesByConversationId } {
  ensureSmsProviderRegistered();
  const conversations = ContentResolver.query<Conversation>('content://sms/conversations').items;
  const messagesByConversationId: MessagesByConversationId = {};
  conversations.forEach((conversation) => {
    messagesByConversationId[conversation.id] = ContentResolver.query<Message>(
      `content://sms/messages?conversationId=${conversation.id}`,
    ).items;
  });
  return { conversations, messagesByConversationId };
}

function getEmptySmsSnapshot(): { conversations: Conversation[]; messagesByConversationId: MessagesByConversationId } {
  return { conversations: [], messagesByConversationId: {} };
}

let _smsSnapshot: { conversations: Conversation[]; messagesByConversationId: MessagesByConversationId } | null = null;

function ensureSmsSnapshot(): { conversations: Conversation[]; messagesByConversationId: MessagesByConversationId } {
  if (_smsSnapshot) return _smsSnapshot;
  _smsSnapshot = buildSmsSnapshot();
  return _smsSnapshot;
}

function subscribeSms(listener: () => void): () => void {
  return ContentResolver.registerContentObserver('content://sms', () => {
    _smsSnapshot = buildSmsSnapshot();
    listener();
  });
}

function getSmsSnapshot() {
  return ensureSmsSnapshot();
}

export function useSmsProviderState(): { conversations: Conversation[]; messagesByConversationId: MessagesByConversationId } {
  return useSyncExternalStore(subscribeSms, getSmsSnapshot, getEmptySmsSnapshot);
}

/** Check whether a string looks like a valid phone number.
 * Accepts 3+ digits to cover short codes (110/120 emergency, 10086/12306/95588 service numbers). */
export function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/[\s+\-()]/g, '');
  return /^\d{3,}$/.test(digits);
}

export function ensureConversation(recipient: string, phoneNumber?: string): string {
  const normalized = recipient.trim();
  if (!normalized) return '';
  const existing = ContentResolver.query<Conversation>(
    `content://sms/conversations?sender=${encodeURIComponent(normalized)}`,
  ).items[0];
  if (existing) return existing.id;
  const uri = ContentResolver.insert('content://sms/conversations', {
    sender: normalized,
    ...(phoneNumber ? { phoneNumber } : {}),
  });
  return String(uri.split('/').pop() ?? '');
}

export function markConversationRead(conversationId: string): void {
  ContentResolver.update(`content://sms/conversations/${conversationId}`, { isUnread: false });
  NotificationService.dismissByRoute('sms', `/conversation/${conversationId}`);
}

export function markConversationUnread(conversationId: string): void {
  ContentResolver.update(`content://sms/conversations/${conversationId}`, { isUnread: true });
}

export function deleteConversation(conversationId: string): void {
  ContentResolver.delete(`content://sms/conversations/${conversationId}`);
  NotificationService.dismissByRoute('sms', `/conversation/${conversationId}`);
}

export function pinConversation(conversationId: string, pinned: boolean): void {
  ContentResolver.update(`content://sms/conversations/${conversationId}`, { isPinned: pinned });
}

export function markAllRead(): number {
  const conversations = ContentResolver.query<Conversation>('content://sms/conversations').items;
  const changed = conversations.filter((conversation) => conversation.isUnread).length;
  conversations.forEach((conversation) => {
    if (conversation.isUnread) {
      ContentResolver.update(`content://sms/conversations/${conversation.id}`, { isUnread: false });
    }
  });
  if (changed > 0) NotificationService.clearForApp('sms');
  return changed;
}

export function sendMessage(conversationId: string, content: string): void {
  const trimmed = content.trim();
  if (!conversationId || !trimmed) return;

  const messageUri = ContentResolver.insert(
    `content://sms/messages?conversationId=${encodeURIComponent(conversationId)}`,
    {
      id: randomId('msg'),
      content: trimmed,
      timestamp: TimeService.formatTime(),
      isOutgoing: true,
      status: 'sending',
    },
  );

  const conversation = ContentResolver.query<Conversation>(`content://sms/conversations/${conversationId}`).items[0];
  if (conversation) {
    window.dispatchEvent(new CustomEvent('sms-outgoing', {
      detail: { to: conversation.sender, content: trimmed },
    }));
  }

  const timerId = window.setTimeout(() => {
    ContentResolver.update(messageUri, { status: 'sent' });
    useSmsStore.getState().untrackTimer(timerId);
  }, 300);
  useSmsStore.getState().trackTimer(timerId);
}

export function getUnreadCount(): number {
  return ensureSmsSnapshot().conversations.filter((conversation) => conversation.isUnread).length;
}
