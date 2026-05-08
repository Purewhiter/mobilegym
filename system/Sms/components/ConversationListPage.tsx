import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { IcSearch, IcAdd, IcClose } from '../res/icons';
import { ConversationItem } from './ConversationItem';
import { Toast } from '@/os/components/Toast';
import { markAllRead, markConversationRead, markConversationUnread, deleteConversation, pinConversation, useSmsProviderState } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useSmsGestures } from '../hooks/useSmsGestures';
import type { Conversation } from '../types';
const smsIcon = (name: string) => name ? `/@app-assets/Sms/icons/${name}.svg` : '';

/** Toolbar icon button */
const ToolbarIcon: React.FC<{
    icon: React.ReactNode;
    onClick?: () => void;
}> = ({ icon, onClick }) => (
    <button
        className="w-10 h-10 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-full"
        onClick={onClick}
    >
        {icon}
    </button>
);

/** Icon loaded from SMS app assets */
const SmsIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 24 }) => {
    const src = smsIcon(name);
    if (!src) return null;
    return <img src={src} alt={name} width={size} height={size} style={{ opacity: 0.8 }} />;
};

export const ConversationListPage: React.FC = () => {
    const { go } = useSmsGestures();
    const { conversations, messagesByConversationId } = useSmsProviderState();
    const s = useAppStrings(strings, stringsEn);
    const [query, setQuery] = React.useState('');
    const [toast, setToast] = React.useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
    const [searchParams, setSearchParams] = useSearchParams();
    const routerNavigate = useNavigate();
    const menuConvId = searchParams.get('contextMenu');
    const menuConv = React.useMemo(
        () => (menuConvId ? conversations.find((c) => c.id === menuConvId) : null) ?? null,
        [menuConvId, conversations],
    );

    const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressFiredRef = React.useRef(false);

    const openMenu = (conv: Conversation) => {
        setSearchParams((p) => { p.set('contextMenu', conv.id); return p; });
    };
    const closeMenu = () => {
        if (menuConvId) routerNavigate(-1);
    };

    const handlePointerDown = (conv: Conversation) => {
        longPressFiredRef.current = false;
        longPressRef.current = setTimeout(() => {
            longPressRef.current = null;
            longPressFiredRef.current = true;
            openMenu(conv);
        }, 500);
    };
    const cancelLongPress = () => {
        if (longPressRef.current) {
            clearTimeout(longPressRef.current);
            longPressRef.current = null;
        }
    };
    const handleConversationClick = (conversationId: string) => {
        if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
        }
        go('conversation.open', { conversationId });
    };

    const handleNewMessage = () => {
        go('compose.open');
    };

    const handleSettings = () => {
        go('settings.open');
    };

    const showToast = (message: string) => {
        setToast({ visible: true, message });
        window.setTimeout(() => setToast({ visible: false, message: '' }), 1200);
    };

    const filteredConversations = React.useMemo(() => {
        const q = query.trim();
        const filtered = conversations.filter((c) => {
            if (!q) return true;
            const hit =
                c.sender.includes(q) ||
                (messagesByConversationId[c.id] ?? []).some((m) => m.content.includes(q));
            return hit;
        });
        return filtered.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    }, [conversations, query, messagesByConversationId]);

    return (
        <div className="h-full bg-app-bg flex flex-col relative">
            <Toast message={toast.message} visible={toast.visible} />
            {/* Status bar spacer */}
            <div className="h-12 flex-shrink-0" />

            {/* Toolbar */}
            <div className="flex items-center justify-end px-2 h-12 flex-shrink-0">
                <ToolbarIcon
                    icon={<SmsIcon name="ic_one_click_button" />}
                    onClick={() => {
                        const n = markAllRead();
                        showToast(n > 0 ? `${s.toast_cleared_prefix}${n}${s.toast_cleared_suffix}` : s.toast_no_unread);
                    }}
                />
                <ToolbarIcon icon={<SmsIcon name="action_bar_setting" />} onClick={handleSettings} />
            </div>

            {/* Title */}
            <div className="px-6 pt-2 pb-4 flex-shrink-0">
                <h1 className="text-[28px] font-bold text-app-text leading-tight">{s.app_name}</h1>
            </div>

            {/* Search bar */}
            <div className="px-4 pb-4 flex-shrink-0">
                <div className="bg-white/80 backdrop-blur rounded-full flex items-center px-4 py-2.5 gap-2">
                    <IcSearch size={16} className="text-gray-400 flex-shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-[14px] text-app-text placeholder:text-gray-400"
                        placeholder={s.search_hint}
                    />
                    {query.trim().length > 0 && (
                        <button
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100"
                            onClick={() => setQuery('')}
                            aria-label="清空搜索"
                        >
                            <IcClose size={16} className="text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface rounded-t-2xl">
                {filteredConversations.length === 0 ? (
                    <div className="py-12 text-center text-[13px] text-gray-400">{s.empty_search_results}</div>
                ) : (
                    filteredConversations.map((conversation) => {
                        const msgs = messagesByConversationId[conversation.id];
                        const lastMsg = msgs && msgs.length > 0 ? msgs[msgs.length - 1].content : '';
                        return (
                            <ConversationItem
                                key={conversation.id}
                                conversation={conversation}
                                preview={lastMsg}
                                onClick={() => handleConversationClick(conversation.id)}
                                onPointerDown={() => handlePointerDown(conversation)}
                                onPointerUp={cancelLongPress}
                                onPointerCancel={cancelLongPress}
                                onPointerLeave={cancelLongPress}
                            />
                        );
                    })
                )}
            </div>

            {/* Context menu overlay */}
            {menuConv && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10" onClick={closeMenu}>
                    <div
                        className="bg-white rounded-2xl w-56 overflow-hidden shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {[
                            { label: s.menu_delete, action: () => { deleteConversation(menuConv.id); closeMenu(); } },
                            {
                                label: menuConv.isUnread ? s.menu_mark_read : s.menu_mark_unread,
                                action: () => {
                                    if (menuConv.isUnread) markConversationRead(menuConv.id);
                                    else markConversationUnread(menuConv.id);
                                    closeMenu();
                                },
                            },
                            {
                                label: menuConv.isPinned ? s.menu_unpin : s.menu_pin,
                                action: () => { pinConversation(menuConv.id, !menuConv.isPinned); closeMenu(); },
                            },
                            { label: s.menu_block, action: closeMenu },
                            { label: s.menu_add_contact, action: closeMenu },
                            { label: s.menu_encrypt, action: closeMenu },
                        ].map((item) => (
                            <button
                                key={item.label}
                                className="w-full px-5 py-3.5 text-left text-[15px] text-app-text active:bg-gray-50 border-b border-gray-100 last:border-b-0"
                                onClick={item.action}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* FAB - New message button */}
            <button
                className="absolute bottom-6 right-6 w-14 h-14 bg-app-primary rounded-full shadow-lg flex items-center justify-center active:bg-[#06A050]"
                onClick={handleNewMessage}
            >
                <IcAdd size={28} className="text-white" />
            </button>
        </div>
    );
};
