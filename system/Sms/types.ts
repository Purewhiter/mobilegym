/**
 * SMS App Type Definitions
 * Based on MIUI SMS app UI structure
 */

/** Conversation thread in the list */
export interface Conversation {
    id: string;
    sender: string;
    /** Bound phone number — only conversations with a valid phoneNumber can send */
    phoneNumber?: string;
    timestamp: string;
    avatarUrl?: string;
    avatarColor?: string;
    avatarText?: string;
    isUnread: boolean;
    isPinned?: boolean;
    simSlot?: 1 | 2;
    messageCount?: number;
}

/** Individual message in a conversation */
export interface Message {
    id: string;
    content: string;
    timestamp: string;
    isOutgoing: boolean;
    status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

/** Attachment panel option */
export interface AttachmentOption {
    id: string;
    icon: string;
    label: string;
}

/** Settings toggle item (no targetPage) */
export interface SettingsToggle {
    key: string;
    title: string;
    summary?: string;
    targetPage?: never;
}

/** Settings navigation item (has targetPage) */
export interface SettingsNavItem {
    key: string;
    title: string;
    summary?: string;
    targetPage: string;
}

/** Settings category */
export interface SettingsCategory {
    title: string;
    items: (SettingsToggle | SettingsNavItem)[];
}

/** Type guard: toggle items are those without targetPage */
export function isToggle(item: SettingsToggle | SettingsNavItem): item is SettingsToggle {
    return !('targetPage' in item);
}
