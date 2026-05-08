import React from 'react';
import type { Conversation } from '../types';

interface ConversationItemProps {
    conversation: Conversation;
    /** Derived from latest message — not stored on Conversation */
    preview: string;
    onClick?: () => void;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
    onPointerCancel?: () => void;
    onPointerLeave?: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
    conversation,
    preview,
    onClick,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerLeave,
}) => {
    const {
        sender,
        timestamp,
        avatarUrl,
        avatarColor,
        avatarText,
        isUnread,
        simSlot,
    } = conversation;

    return (
        <div
            className="flex items-start px-5 py-3.5 active:bg-gray-50"
            onClick={onClick}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerLeave}
        >
            {/* Unread indicator */}
            <div className="w-5 flex-shrink-0 flex items-center justify-center pt-4">
                {isUnread && (
                    <div className="w-2 h-2 rounded-full bg-[#FF6B00]" />
                )}
            </div>

            {/* Avatar */}
            <div className="flex-shrink-0 mr-3">
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: avatarColor || '#E0E0E0' }}
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-white text-sm font-medium">
                            {avatarText || sender.charAt(0)}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {/* Header row: sender + SIM badge + timestamp */}
                <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[16px] font-medium text-app-text truncate">
                        {sender}
                    </span>
                    {simSlot && (
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {simSlot}
                        </span>
                    )}
                    <span className="text-[13px] text-gray-400 ml-auto flex-shrink-0">
                        {timestamp}
                    </span>
                </div>

                {/* Preview text */}
                <p className="text-[14px] text-app-text-muted line-clamp-2 leading-snug">
                    {preview}
                </p>
            </div>
        </div>
    );
};
