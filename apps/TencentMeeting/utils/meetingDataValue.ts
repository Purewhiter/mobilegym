import type { ChatMessage } from '../data';

export const DEFAULT_MEETING_TIMEZONE_VALUE = '(GMT+08:00) 中国标准时间';

export function buildQuickMeetingTitle(userName: string): string {
  return `${userName}的快速会议`;
}

export function getPersistedMeetingChatRecipientName(recipient: 'all' | { name: string }): string {
  return recipient === 'all' ? '所有人' : recipient.name;
}

export function shouldShowPrivateChatBadge(
  message: Pick<ChatMessage, 'toId' | 'senderId'>,
  currentUserId: string,
): boolean {
  return message.toId != null && message.toId !== 'all' && message.senderId === currentUserId;
}

export function formatAttendeesPageTitle(template: string, count: number): string {
  return template.replace('%s', String(count));
}
