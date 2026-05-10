import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack, IcUser, IcCheck, IcExpand } from '../res/icons';
import { AttachmentPanel } from './AttachmentPanel';
import { ensureConversation, sendMessage, isValidPhoneNumber, useSmsProviderState } from '../state';
import { SendArrowIcon, QuestionCircleIcon } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import ContentResolver from '../../../os/ContentResolver';
import { ensureContactsProviderRegistered } from '../../../os/providers/ContactsProvider';
import { useActivityContext } from '../../../os/ActivityContext';
import { useSmsGestures } from '../hooks/useSmsGestures';

interface ContactOption {
    displayName: string;
    phoneNumber: string;
    avatarColor?: string;
}

export const NewMessagePage: React.FC = () => {
    const { go, bindBack } = useSmsGestures();
    const s = useAppStrings(strings, stringsEn);
    const location = useLocation();
    const { activityId } = useActivityContext();
    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    // 接收 intent.data（外部 startActivity ACTION_VIEW scheme=sms 投递时填这里），
    // 没有则回退 URL search params（保持原 deep-link 兼容）。
    const intentData = useMemo(() => {
        const os = window.__OS__;
        const payload = os?.getIntentPayload?.(activityId) ?? os?.getIntentPayload?.('sms');
        return (payload as { data?: Record<string, any> } | null)?.data;
    }, [activityId]);
    const [showAttachments, setShowAttachments] = useState(false);
    const [recipient, setRecipient] = useState(
        () => (typeof intentData?.address === 'string' ? intentData.address : null)
            ?? queryParams.get('address')
            ?? '',
    );
    const [message, setMessage] = useState(
        () => (typeof intentData?.body === 'string' ? intentData.body : null)
            ?? queryParams.get('body')
            ?? '',
    );
    const [boundPhone, setBoundPhone] = useState<string | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showErrorDialog, setShowErrorDialog] = useState(false);

    const allContacts = useMemo(() => {
        const result: ContactOption[] = [];
        try {
            ensureContactsProviderRegistered();
            const cursor = ContentResolver.query<{
                displayName?: string;
                phones?: { number?: string }[];
                avatarColor?: string;
            }>('content://contacts/contacts');
            for (const c of cursor.items) {
                const name = String(c?.displayName || '').trim();
                const phone = c?.phones?.[0]?.number;
                if (name && phone) {
                    result.push({
                        displayName: name,
                        phoneNumber: String(phone).replace(/\s/g, ''),
                        avatarColor: c?.avatarColor,
                    });
                }
            }
        } catch { /* noop */ }
        return result;
    }, []);

    const filteredContacts = useMemo(() => {
        const q = recipient.trim().toLowerCase();
        if (!q) return allContacts;
        const qDigits = q.replace(/\D/g, '');
        return allContacts.filter(
            (c) =>
                c.displayName.toLowerCase().includes(q) ||
                (qDigits.length > 0 && c.phoneNumber.replace(/\D/g, '').includes(qDigits)),
        );
    }, [allContacts, recipient]);

    const handleRecipientChange = (value: string) => {
        setRecipient(value);
        setBoundPhone(null);
        setShowSuggestions(value.trim().length > 0);
    };

    const handleSelectContact = (contact: ContactOption) => {
        setRecipient(contact.displayName);
        setBoundPhone(contact.phoneNumber);
        setShowSuggestions(false);
    };

    const toggleAttachments = () => setShowAttachments(!showAttachments);

    const handleSend = () => {
        const trimmedRecipient = recipient.trim();
        if (!trimmedRecipient || !message.trim()) return;
        let phoneNumber = boundPhone;
        if (!phoneNumber && isValidPhoneNumber(trimmedRecipient)) {
            phoneNumber = trimmedRecipient;
        }
        if (!phoneNumber) {
            setShowErrorDialog(true);
            return;
        }
        const convId = ensureConversation(trimmedRecipient, phoneNumber);
        if (!convId) return;
        sendMessage(convId, message.trim());
        setMessage('');
        setShowAttachments(false);
        go('conversation.open.fromNew', { conversationId: convId });
    };

    const canSend = recipient.trim().length > 0 && message.trim().length > 0;

    return (
        <div className="h-full bg-app-surface flex flex-col">
            {/* Status bar spacer */}
            <div className="h-12 flex-shrink-0" />

            {/* Header */}
            <div className="flex items-center px-4 h-12 flex-shrink-0">
                <button className="w-10 h-10 -ml-2 flex items-center justify-center" {...bindBack()}>
                    <IcNavBack size={24} className="text-app-text" />
                </button>
            </div>

            {/* Title */}
            <div className="px-6 pt-2 pb-4 flex-shrink-0">
                <h1 className="text-[28px] font-bold text-app-text leading-tight">{s.new_message_title}</h1>
            </div>

            {/* Recipient input */}
            <div className="px-6 flex-shrink-0 border-b border-gray-100">
                <div className="flex items-center py-3">
                    <span className="text-[16px] text-gray-400 mr-2">{s.recipient_label}</span>
                    <input
                        type="text"
                        value={recipient}
                        onChange={(e) => handleRecipientChange(e.target.value)}
                        onFocus={() => { if (recipient.trim()) setShowSuggestions(true); }}
                        className="flex-1 text-[16px] text-app-text outline-none"
                        placeholder=""
                    />
                    <button className="w-10 h-10 flex items-center justify-center text-app-text-muted">
                        {showSuggestions ? (
                            <IcCheck size={22} className="text-blue-500" />
                        ) : (
                            <IcUser size={22} />
                        )}
                    </button>
                </div>
            </div>
            {/* Contact suggestions — replaces spacer+input when visible */}
            {showSuggestions && filteredContacts.length > 0 ? (
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {filteredContacts.map((contact) => (
                        <button
                            key={`${contact.displayName}-${contact.phoneNumber}`}
                            className="w-full px-6 py-3.5 flex items-center gap-3 active:bg-gray-50"
                            onClick={() => handleSelectContact(contact)}
                        >
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[14px] font-medium flex-shrink-0"
                                style={{ backgroundColor: contact.avatarColor || '#3482FF' }}
                            >
                                {contact.displayName.charAt(0)}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                                <div className="text-[15px] text-app-text truncate">{contact.displayName}</div>
                                <div className="text-[13px] text-gray-400 truncate">{contact.phoneNumber}</div>
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <>
                    <div className="flex-1" />
                    {/* Bottom input area */}
                    <div className="flex-shrink-0 border-t border-gray-100 bg-app-bg">
                        {showAttachments && <AttachmentPanel />}
                        <div className="flex items-center px-3 py-2 gap-2">
                            <button
                                className="w-11 h-11 flex items-center justify-center bg-app-surface rounded-lg"
                                onClick={toggleAttachments}
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
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                                    className="flex-1 text-[14px] text-app-text outline-none"
                                    placeholder={s.sms_placeholder}
                                />
                                <button className="ml-2 text-blue-500">
                                    <QuestionCircleIcon />
                                </button>
                            </div>
                            <button
                                className={`w-11 h-11 flex items-center justify-center rounded-full ${canSend ? 'bg-app-primary' : 'bg-gray-200'}`}
                                onPointerDown={(e) => e.preventDefault()}
                                onClick={handleSend}
                                aria-disabled={!canSend}
                            >
                                <SendArrowIcon active={canSend} />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Error dialog: invalid recipient */}
            {showErrorDialog && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl w-[280px] overflow-hidden">
                        <div className="px-6 pt-6 pb-4 text-center">
                            <div className="text-[16px] font-medium text-gray-900 mb-2">
                                {s.error_invalid_recipient_title}
                            </div>
                            <div className="text-[14px] text-gray-500">
                                {s.error_invalid_recipient_body}
                            </div>
                        </div>
                        <div className="border-t border-gray-100">
                            <button
                                className="w-full py-3.5 text-[16px] font-medium text-blue-500 active:bg-gray-50"
                                onClick={() => setShowErrorDialog(false)}
                            >
                                {s.error_invalid_recipient_ok}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
