import type { ContactItem } from '../types';

export type ChatPeer = { wxid: string; name: string; avatar: string };

export function resolveChatPeerByWxid(
  wxid: string | null | undefined,
  contacts: ContactItem[],
): ChatPeer | null {
  if (!wxid) return null;
  const contact = contacts.find(c => c.wxid === wxid);
  if (contact) {
    return { wxid: contact.wxid, name: contact.name, avatar: contact.avatar };
  }
  return null;
}
