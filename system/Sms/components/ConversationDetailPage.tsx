import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IcNavBack, IcExpand } from '../res/icons';
import { AttachmentPanel } from './AttachmentPanel';
import { Toast } from '@/os/components/Toast';
import { markConversationRead, sendMessage, useSmsProviderState } from '../state';
import { useTheme } from '../../../os/ThemeContext';
import { NinePatch } from '../../../os/ui/ninepatch/NinePatch';
import { SendArrowIcon } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';

const Bubble: React.FC<{
    outgoing: boolean;
    content: string;
    timestamp: string;
    status?: string;
}> = ({ outgoing, content, timestamp, status }) => {
    const { themeService, version } = useTheme();
    const s = useAppStrings(strings, stringsEn);
    const bubbleCls = outgoing
        ? 'bg-app-primary text-white rounded-2xl rounded-tr-md'
        : 'bg-app-surface text-app-text rounded-2xl rounded-tl-md border border-gray-100';

    const themedBg = useMemo(() => {
        const pick = (hints: string[]) => hints.map((h) => themeService.getAppAsset('mms', h)).find(Boolean) || null;
        return outgoing
            ? pick(['bubble_out', 'bubble_send', 'msg_out', 'message_out', 'chat_to', 'sms_out'])
            : pick(['bubble_in', 'bubble_recv', 'msg_in', 'message_in', 'chat_from', 'sms_in']);
    }, [outgoing, themeService, version]);

    return (
        <div className={`flex flex-col ${outgoing ? 'items-end' : 'items-start'}`}>
            {themedBg ? (
                <NinePatch
                    src={themedBg}
                    className={`max-w-[78%] text-[15px] leading-relaxed ${bubbleCls.replace(outgoing ? 'bg-app-primary' : 'bg-app-surface', 'bg-transparent')}`}
                >
                    <div className="px-4 py-2.5">{content}</div>
                </NinePatch>
            ) : (
                <div className={`max-w-[78%] px-4 py-2.5 text-[15px] leading-relaxed ${bubbleCls}`}>{content}</div>
            )}
            <div className="mt-1 text-[11px] text-gray-400 flex items-center gap-2">
                <span>{timestamp}</span>
                {outgoing && status && <span>{status === 'sending' ? s.status_sending : s.status_sent}</span>}
            </div>
        </div>
    );
};

export const ConversationDetailPage: React.FC = () => {
    const { bindBack } = useSmsGestures();
    const { conversationId } = useParams<{ conversationId: string }>();
    const { conversations, messagesByConversationId } = useSmsProviderState();
    const conversation = useMemo(
        () => conversationId ? conversations.find(c => c.id === conversationId) : undefined,
        [conversations, conversationId],
    );
    const messages = useMemo(
        () => conversationId ? (messagesByConversationId[conversationId] ?? []) : [],
        [messagesByConversationId, conversationId],
    );
    const s = useAppStrings(strings, stringsEn);

    const [text, setText] = useState('');
    const [showAttachments, setShowAttachments] = useState(false);
    const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });

    const listRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!conversationId) return;
        markConversationRead(conversationId);
    }, [conversationId, markConversationRead]);

    useEffect(() => {
        // Scroll to bottom on first open & when new message arrives
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [messages.length]);

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const canSend = text.trim().length > 0 && !!conversationId && !!conversation;
    const handleSend = () => {
        if (!canSend || !conversationId || !conversation) return;
        const content = text.trim();
        setText('');
        setShowAttachments(false);
        sendMessage(conversationId, content);
    };

    if (!conversationId || !conversation) {
        return (
            <div className="h-full bg-app-surface flex flex-col">
                <div className="h-12 flex-shrink-0" />
                <div className="flex items-center px-4 h-12">
                    <button className="w-10 h-10 -ml-2 flex items-center justify-center" {...bindBack()}>
                        <IcNavBack size={24} className="text-app-text" />
                    </button>
                </div>
                <div className="px-6 pt-2 pb-4">
                    <h1 className="text-[18px] font-medium text-app-text">{s.conversation_not_found}</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-app-bg flex flex-col">
            <Toast message={toast.message} visible={toast.visible} />

            {/* Status bar spacer */}
            <div className="h-12 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center px-4 h-12 flex-shrink-0">
                <button className="w-10 h-10 -ml-2 flex items-center justify-center" {...bindBack()}>
                    <IcNavBack size={24} className="text-app-text" />
                </button>
                <div className="flex-1 text-center">
                    <div className="text-[16px] font-medium text-app-text truncate">{conversation?.sender ?? s.app_name}</div>
                </div>
                <div className="w-10 h-10 -mr-2" />
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 flex flex-col gap-3">
                {messages.length === 0 ? (
                    <div className="text-center text-[13px] text-gray-400 mt-10">{s.empty_messages}</div>
                ) : (
                    messages.map((m) => (
                        <Bubble
                            key={m.id}
                            outgoing={m.isOutgoing}
                            content={m.content}
                            timestamp={m.timestamp}
                            status={m.status}
                        />
                    ))
                )}
                <div className="h-2" />
            </div>

            {/* Bottom input area */}
            <div className="flex-shrink-0 border-t border-gray-100 bg-app-bg" data-keep-keyboard="true">
                {showAttachments && <AttachmentPanel />}

                <div className="flex items-center px-3 py-2 gap-2">
                    <button
                        className="w-11 h-11 flex items-center justify-center bg-app-surface rounded-lg"
                        onClick={() => setShowAttachments((v) => !v)}
                    >
                        {showAttachments ? (
                            <IcExpand size={20} className="text-gray-600" />
                        ) : (
                            <div className="grid grid-cols-3 gap-0.5">
                                {[...Array(9)].map((_, i) => (
                                    <div key={i} className="w-1 h-1 bg-gray-500 rounded-sm" />
                                ))}
                            </div>
                        )}
                    </button>

                    <div className="flex-1 bg-app-surface rounded-full flex items-center px-4 py-2.5">
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSend();
                            }}
                            className="flex-1 text-[14px] text-app-text outline-none"
                            placeholder={s.sms_placeholder}
                        />
                    </div>

                    <button
                        className={`w-11 h-11 flex items-center justify-center rounded-full ${canSend ? 'bg-app-primary' : 'bg-gray-200'
                            }`}
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={handleSend}
                        aria-disabled={!canSend}
                    >
                        <SendArrowIcon active={canSend} />
                    </button>
                </div>
            </div>
        </div>
    );
};
