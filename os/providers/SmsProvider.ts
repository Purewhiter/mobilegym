import ContentProvider from '../ContentProvider';
import ContentResolver from '../ContentResolver';
import { createOsStore } from '../createOsStore';
import { NotificationService } from '../NotificationService';
import * as TimeService from '../TimeService';
import { ensureContactsProviderRegistered } from './ContactsProvider';
import type { ContentUri, ContentValues, Cursor } from '../types/content';
import type { Conversation, Message } from '../../system/Sms/types';
import smsDefaults from './defaults/sms.json';

type MessagesByConversationId = Record<string, Message[]>;

export interface SmsProviderState {
  conversations: Conversation[];
  messagesByConversationId: MessagesByConversationId;
}

const randomId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${TimeService.now().toString(36).slice(-4)}`;

const pickAvatarColor = () => {
  const palette = ['#07C160', '#3482FF', '#FF6B00', '#7C3AED', '#06B6D4', '#EF4444', '#F59E0B', '#10B981'];
  return palette[Math.floor(Math.random() * palette.length)];
};

const defaultState: SmsProviderState = {
  conversations: structuredClone(smsDefaults.conversations) as Conversation[],
  messagesByConversationId: structuredClone(smsDefaults.messagesByConversationId) as MessagesByConversationId,
};

export const useSmsProviderStore = createOsStore<SmsProviderState>(
  'provider.sms',
  defaultState,
  {
    persistName: 'provider_sms',
    registerToServiceRegistry: false,
    registerToProviderRegistry: true,
  },
);

function updateConversationThread(
  conversationId: string,
  message: Message,
  options: { unread: boolean },
): void {
  (useSmsProviderStore.setState as any)((state: SmsProviderState) => {
    const messages = state.messagesByConversationId[conversationId] ?? [];
    state.messagesByConversationId[conversationId] = [...messages, message];

    const idx = state.conversations.findIndex((conversation) => conversation.id === conversationId);
    if (idx === -1) return;

    const conversation = state.conversations[idx];
    const updatedConversation: Conversation = {
      ...conversation,
      timestamp: message.timestamp,
      isUnread: options.unread,
      messageCount: (conversation.messageCount ?? messages.length) + 1,
    };
    state.conversations.splice(idx, 1);
    state.conversations.unshift(updatedConversation);
  });
}

function ensureConversationInternal(recipient: string, phoneNumber?: string): string {
  const normalized = recipient.trim();
  if (!normalized) return '';

  // Try to find existing conversation by sender name
  const existing = useSmsProviderStore.getState().conversations.find((conversation) => conversation.sender === normalized);
  if (existing) {
    // If found but missing phoneNumber, patch it if we now have one
    if (phoneNumber && !existing.phoneNumber) {
      (useSmsProviderStore.setState as any)((state: SmsProviderState) => {
        const idx = state.conversations.findIndex((c) => c.id === existing.id);
        if (idx !== -1) state.conversations[idx] = { ...state.conversations[idx], phoneNumber };
      });
    }
    return existing.id;
  }

  // Also try finding by phoneNumber if provided
  if (phoneNumber) {
    const byPhone = useSmsProviderStore.getState().conversations.find(
      (c) => c.phoneNumber === phoneNumber,
    );
    if (byPhone) return byPhone.id;
  }

  const conversationId = randomId('conv');
  const avatarText = normalized.replace(/\s+/g, '').slice(0, 1) || '\uFF1F';
  const nextConversation: Conversation = {
    id: conversationId,
    sender: normalized,
    ...(phoneNumber ? { phoneNumber } : {}),
    timestamp: '',
    avatarColor: pickAvatarColor(),
    avatarText,
    isUnread: false,
    simSlot: 1,
    messageCount: 0,
  };

  (useSmsProviderStore.setState as any)((state: SmsProviderState) => {
    state.conversations.unshift(nextConversation);
    state.messagesByConversationId[conversationId] = [];
  });

  return conversationId;
}

export function receiveIncomingSms(from: string, content: string): void {
  const sender = String(from ?? '').trim();
  const trimmed = String(content ?? '').trim();
  if (!sender || !trimmed) return;

  let recipient = sender;
  try {
    ensureContactsProviderRegistered();
    const cursor = ContentResolver.query<{ displayName?: string }>(
      `content://contacts/contacts?phone=${encodeURIComponent(sender)}`,
    );
    const matchedName = String(cursor.items[0]?.displayName ?? '').trim();
    if (matchedName) recipient = matchedName;
  } catch {
    // noop
  }

  const conversationId = ensureConversationInternal(recipient);
  if (!conversationId) return;

  const message: Message = {
    id: randomId('msg'),
    content: trimmed,
    timestamp: TimeService.formatTime(),
    isOutgoing: false,
  };

  updateConversationThread(conversationId, message, { unread: true });
  ContentResolver.notifyChange(`content://sms/conversations/${conversationId}`);

  NotificationService.push({
    appId: 'sms',
    title: recipient,
    body: trimmed,
    importance: 'high',
    route: `/conversation/${conversationId}`,
  });
}

export class SmsProvider extends ContentProvider {
  query(uri: ContentUri, _projection?: string[]): Cursor<any> {
    const parsed = ContentResolver.parseUri(uri);
    const path = parsed.path;
    const state = useSmsProviderStore.getState();

    if (path === '/conversations' || path === '/conversations/') {
      const sender = String(parsed.query.get('sender') ?? '').trim();
      if (!sender) {
        return { items: state.conversations, count: state.conversations.length };
      }
      const items = state.conversations.filter((conversation) => conversation.sender === sender);
      return { items, count: items.length };
    }

    if (path === '/messages' || path === '/messages/') {
      const conversationId = String(parsed.query.get('conversationId') ?? '').trim();
      const items = conversationId ? (state.messagesByConversationId[conversationId] ?? []) : [];
      return { items, count: items.length };
    }

    const conversationMatch = path.match(/^\/conversations\/([^/]+)$/);
    if (conversationMatch) {
      const conversation = state.conversations.find((item) => item.id === conversationMatch[1]);
      return conversation ? { items: [conversation], count: 1 } : { items: [], count: 0 };
    }

    const messageMatch = path.match(/^\/messages\/([^/]+)$/);
    if (messageMatch) {
      const messageId = messageMatch[1];
      for (const messages of Object.values(state.messagesByConversationId)) {
        const message = messages.find((item) => item.id === messageId);
        if (message) return { items: [message], count: 1 };
      }
    }

    return { items: [], count: 0 };
  }

  insert(uri: ContentUri, values: ContentValues): ContentUri {
    const parsed = ContentResolver.parseUri(uri);
    if (parsed.path === '/conversations' || parsed.path === '/conversations/') {
      const sender = String(values.sender ?? '').trim();
      const phoneNumber = typeof values.phoneNumber === 'string' ? values.phoneNumber.trim() : undefined;
      const conversationId = ensureConversationInternal(sender, phoneNumber || undefined);
      if (!conversationId) {
        throw new Error('[SmsProvider] sender is required when creating a conversation');
      }
      return `content://sms/conversations/${conversationId}`;
    }

    if (parsed.path === '/messages' || parsed.path === '/messages/') {
      const conversationId = String(parsed.query.get('conversationId') ?? values.conversationId ?? '').trim();
      if (!conversationId) {
        throw new Error('[SmsProvider] conversationId is required when inserting a message');
      }
      const message: Message = {
        id: typeof values.id === 'string' && values.id.trim() ? values.id.trim() : randomId('msg'),
        content: String(values.content ?? '').trim(),
        timestamp: typeof values.timestamp === 'string' ? values.timestamp : TimeService.formatTime(),
        isOutgoing: Boolean(values.isOutgoing),
        status: typeof values.status === 'string' ? values.status as Message['status'] : undefined,
      };
      updateConversationThread(conversationId, message, { unread: !message.isOutgoing });
      return `content://sms/messages/${message.id}`;
    }

    throw new Error(`[SmsProvider] Unsupported insert URI: ${parsed.path}`);
  }

  update(uri: ContentUri, values: ContentValues, _where?: string): number {
    const parsed = ContentResolver.parseUri(uri);

    const conversationMatch = parsed.path.match(/^\/conversations\/([^/]+)$/);
    if (conversationMatch) {
      const conversationId = conversationMatch[1];
      const exists = useSmsProviderStore.getState().conversations.some((item) => item.id === conversationId);
      if (!exists) return 0;
      (useSmsProviderStore.setState as any)((state: SmsProviderState) => {
        state.conversations = state.conversations.map((conversation) => (
          conversation.id === conversationId
            ? {
                ...conversation,
                ...(typeof values.sender === 'string' ? { sender: values.sender } : {}),
                ...(typeof values.phoneNumber === 'string' ? { phoneNumber: values.phoneNumber } : {}),
                ...(typeof values.timestamp === 'string' ? { timestamp: values.timestamp } : {}),
                ...('avatarUrl' in values ? { avatarUrl: typeof values.avatarUrl === 'string' ? values.avatarUrl : undefined } : {}),
                ...('avatarColor' in values ? { avatarColor: typeof values.avatarColor === 'string' ? values.avatarColor : undefined } : {}),
                ...('avatarText' in values ? { avatarText: typeof values.avatarText === 'string' ? values.avatarText : undefined } : {}),
                ...('isUnread' in values ? { isUnread: Boolean(values.isUnread) } : {}),
                ...('simSlot' in values ? { simSlot: values.simSlot as Conversation['simSlot'] } : {}),
                ...('messageCount' in values && typeof values.messageCount === 'number' ? { messageCount: values.messageCount } : {}),
              }
            : conversation
        ));
      });
      return 1;
    }

    const messageMatch = parsed.path.match(/^\/messages\/([^/]+)$/);
    if (messageMatch) {
      const messageId = messageMatch[1];
      let changed = 0;
      (useSmsProviderStore.setState as any)((state: SmsProviderState) => {
        Object.keys(state.messagesByConversationId).forEach((conversationId) => {
          state.messagesByConversationId[conversationId] = state.messagesByConversationId[conversationId].map((message) => {
            if (message.id !== messageId) return message;
            changed = 1;
            return {
              ...message,
              ...(typeof values.content === 'string' ? { content: values.content } : {}),
              ...(typeof values.timestamp === 'string' ? { timestamp: values.timestamp } : {}),
              ...(typeof values.status === 'string' ? { status: values.status as Message['status'] } : {}),
            };
          });
        });
      });
      return changed;
    }

    return 0;
  }

  delete(uri: ContentUri, _where?: string): number {
    const parsed = ContentResolver.parseUri(uri);
    const conversationMatch = parsed.path.match(/^\/conversations\/([^/]+)$/);
    if (conversationMatch) {
      const conversationId = conversationMatch[1];
      const exists = useSmsProviderStore.getState().conversations.some((item) => item.id === conversationId);
      if (!exists) return 0;
      (useSmsProviderStore.setState as any)((state: SmsProviderState) => {
        state.conversations = state.conversations.filter((item) => item.id !== conversationId);
        delete state.messagesByConversationId[conversationId];
      });
      return 1;
    }
    return 0;
  }

  getType(uri: ContentUri): string {
    const parsed = ContentResolver.parseUri(uri);
    if (parsed.path.startsWith('/messages/')) return 'vnd.android.cursor.item/sms-message';
    if (parsed.path.startsWith('/messages')) return 'vnd.android.cursor.dir/sms-message';
    if (parsed.path.match(/^\/conversations\/[^/]+$/)) return 'vnd.android.cursor.item/sms-conversation';
    return 'vnd.android.cursor.dir/sms-conversation';
  }
}

let smsProvider: SmsProvider | null = null;

export function ensureSmsProviderRegistered(): void {
  if (!smsProvider) {
    smsProvider = new SmsProvider();
  }
  ContentResolver.registerProvider('sms', smsProvider);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    smsProvider = null;
  });
}

export default SmsProvider;
