import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React, { useState, useEffect } from 'react';
import {
    IcMic,
    IcMicOff,
    IcVideo,
    IcVideoOff,
    IcScreenShare,
    IcParticipants,
    IcMenu,
    IcVolume,
    IcMinimize,
    IcSmile,
    IcFile,
    IcExternalLink,
    IcSubtitles,
    IcExpand,
    IcAdd,
    IcClose,
    IcNavBack,
    IcCheck,
    IcSearch,
    IcLayout,
    IcCaptions,
    IcDisc,
    IcHand,
    IcUserCog,
    IcMore,
    IcShare,
    IcStopCircle,
    IcSettings,
    IcUserAdd,
    IcEdit2
} from '../res/icons';
import { useLocation } from 'react-router-dom';
import * as TimeService from '../../../os/TimeService';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { useMeetingStore } from '../state';
import { getPersistedMeetingChatRecipientName, shouldShowPrivateChatBadge } from '../utils/meetingDataValue';
import { useShallow } from 'zustand/react/shallow';
// Format duration as MM:SS
const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const MeetingPage: React.FC = () => {
    const location = useLocation();
    const { bindTap, bindBack, back } = useMeetingGestures();
    const { user, activeMeeting, pendingMeetingConfig } = useMeetingStore(useShallow(s => ({
        user: s.user,
        activeMeeting: s.activeMeeting,
        pendingMeetingConfig: s.pendingMeetingConfig,
    })));
    const setPendingMeetingConfig = useMeetingStore(s => s.setPendingMeetingConfig);
    const startMeeting = useMeetingStore(s => s.startMeeting);
    const endMeeting = useMeetingStore(s => s.endMeeting);
    const updateMeetingSettings = useMeetingStore(s => s.updateMeetingSettings);
    const updateParticipant = useMeetingStore(s => s.updateParticipant);
    const muteAllParticipants = useMeetingStore(s => s.muteAllParticipants);
    const sendChatMessage = useMeetingStore(s => s.sendChatMessage);
    const s = useTencentMeetingStrings();

    const [duration, setDuration] = useState('00:00');
    const [isEntering, setIsEntering] = useState(true); // 正在进入会议状态

    // UI State
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null); // For profile sheet
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameText, setRenameText] = useState('');
    const [showRenameDialog, setShowRenameDialog] = useState(false);

    // Start meeting if not already started
    useEffect(() => {
        if (!activeMeeting) {
            const usePersonalId = pendingMeetingConfig?.usePersonalId ?? false;
            const cameraOn = pendingMeetingConfig?.videoOn;
            startMeeting({ isHost: true, usePersonalId, settings: { cameraOn } });
            // 清除 pending 配置
            setPendingMeetingConfig(null);
        }
    }, []);

    // 进入会议2秒后开始计时
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsEntering(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    // Update timer every second - 显示本次参会时长（从 joinTime 开始）
    useEffect(() => {
        if (!activeMeeting || isEntering) return;

        const updateDuration = () => {
            // 计时从进入完成后开始，减去2秒的进入时间
            const elapsed = TimeService.now() - activeMeeting.joinTime - 2000;
            setDuration(formatDuration(Math.max(0, elapsed)));
        };

        updateDuration();
        const interval = setInterval(updateDuration, 1000);
        return () => clearInterval(interval);
    }, [activeMeeting?.joinTime, isEntering]);

    const isExitModalOpen = new URLSearchParams(location.search).get('dialog') === 'exit';

    // Get current user's meeting state
    const isMuted = activeMeeting?.settings.isMuted ?? true;
    const isVideoOn = activeMeeting?.settings.isVideoOn ?? false;
    const isHost = activeMeeting?.hostId === user.id;
    const participantCount = activeMeeting?.participants.length ?? 1;

    // Chat state
    const [recipient, setRecipient] = useState<{id: string, name: string} | 'all'>('all');
    const [isSelectingRecipient, setIsSelectingRecipient] = useState(false);
    const [chatMessage, setChatMessage] = useState('');
    const chatTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const chatScrollRef = React.useRef<HTMLDivElement | null>(null);

    // Use messages from activeMeeting context
    const messages = activeMeeting?.chatMessages || [];

    const handleSendMessage = () => {
        const text = chatMessage.trimEnd();
        if (!text) return;

        const toId = recipient === 'all' ? 'all' : recipient.id;
        const toName = getPersistedMeetingChatRecipientName(recipient);

        sendChatMessage(text, toId, toName);
        setChatMessage('');
        // 不在这里 blur/focus：避免引发软键盘收起
    };

    const isChatDialogOpen = new URLSearchParams(location.search).get('dialog') === 'chat';

    const scrollChatToBottom = React.useCallback(() => {
        const el = chatScrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, []);

    // Chat input auto-grow/shrink: start at 1 line, expand up to 4 lines,
    // then become scrollable. lineHeight=18px, maxLines=4 → maxH=72px.
    const chatLineHeight = 18;
    const chatMaxLines = 4;
    const chatMaxH = chatLineHeight * chatMaxLines;
    React.useEffect(() => {
        const el = chatTextareaRef.current;
        if (!el) return;
        // Reset first so it can shrink.
        el.style.height = 'auto';
        const sh = el.scrollHeight;
        if (sh > chatMaxH) {
            el.style.height = `${chatMaxH}px`;
            el.style.overflowY = 'auto';
            el.style.scrollbarWidth = 'thin';
        } else {
            el.style.height = `${sh}px`;
            el.style.overflowY = 'hidden';
            el.style.scrollbarWidth = 'none';
        }
        // 输入框高度变化后，消息列表滚动到底部
        scrollChatToBottom();
    }, [chatMessage]);

    // 消息变化时滚到底部
    React.useEffect(() => {
        if (!isChatDialogOpen) return;
        const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(() => {
                scrollChatToBottom();
            });
            return () => cancelAnimationFrame(raf2);
        });
        return () => cancelAnimationFrame(raf1);
    }, [messages.length, isChatDialogOpen, scrollChatToBottom]);

    // 软键盘弹出/收起通常会触发 resize：再滚一次确保“最新消息在键盘上方”
    React.useEffect(() => {
        if (!isChatDialogOpen) return;
        let t: number | undefined;
        const onResize = () => {
            if (t) window.clearTimeout(t);
            t = window.setTimeout(() => {
                scrollChatToBottom();
            }, 80);
        };
        window.addEventListener('resize', onResize);
        return () => {
            if (t) window.clearTimeout(t);
            window.removeEventListener('resize', onResize);
        };
    }, [isChatDialogOpen, scrollChatToBottom]);

    return (
        <div className="flex flex-col h-full bg-[#2D3134] text-white relative overflow-hidden" data-status-bar-foreground="light">
            {/* Header */}
            <div className="relative flex items-center px-4 pt-12 pb-2 z-10 bg-[#232526]">
                {/* Left icons */}
                <div className="flex items-center gap-4">
                    <button className="p-1 hover:bg-white/10 rounded-full">
                        <IcMinimize size={20} className="text-white" />
                    </button>
                    <button className="p-1 hover:bg-white/10 rounded-full">
                        <IcVolume size={20} className="text-white" />
                    </button>
                </div>

                {/* Center title - absolute positioned for true centering */}
                <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="relative">
                        <span className="text-xs text-gray-300">{s.app_name}</span>
                        <svg width="10" height="10" viewBox="0 0 10 10" className="text-gray-300 absolute -right-3.5 top-1/2 -translate-y-1/2">
                            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        </svg>
                    </div>
                    <span className="text-[10px] text-gray-400">{duration}</span>
                </div>

                {/* Right button - 主持人显示"结束"，参与者显示"离开" */}
                <button
                    {...bindTap('meeting.exit.open')}
                    className={`ml-auto text-sm font-medium ${isHost ? 'text-[#e15555]' : 'text-[#e15555]'}`}
                >
                    {isHost ? s.meeting_btn_end : s.meeting_btn_leave}
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col justify-center items-center pb-20">
                {isEntering ? (
                    // 正在进入会议
                    <span className="text-white text-lg">{s.meeting_entering}</span>
                ) : (
                    // 参会者列表
                    <div className="flex items-center justify-center gap-10">
                        {activeMeeting?.participants.map((participant) => (
                            <div
                                key={participant.id}
                                className="flex flex-col items-center"
                                onClick={() => {
                                    setSelectedMemberId(participant.id);
                                }}
                            >
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-full bg-blue-600 overflow-hidden flex items-center justify-center border-2 border-transparent active:border-white/50">
                                        {participant.avatar ? (
                                            <img
                                                src={participant.avatar}
                                                alt="avatar"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-lg text-white font-medium">
                                                {participant.name.slice(0, 2)}
                                            </span>
                                        )}
                                    </div>
                                    {/* Role badge */}
                                    {participant.isHost && (
                                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-orange-500 rounded-full p-0.5" title={s.meeting_host_label}>
                                            <IcParticipants size={10} className="text-white" />
                                        </div>
                                    )}
                                    {participant.role === 'co-host' && (
                                        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 bg-blue-500 rounded-full p-0.5" title={s.meeting_co_host_label}>
                                            <IcUserCog size={10} className="text-white" />
                                        </div>
                                    )}
                                    {/* IcHand Raised */}
                                    {participant.isHandRaised && (
                                        <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                                            <IcHand size={10} className="text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 flex items-center gap-1">
                                    {/* 当前用户使用实际的麦克风状态 */}
                                    {(participant.id === user.id ? isMuted : participant.isMuted) ? (
                                        <IcMicOff size={12} className="text-red-500" />
                                    ) : (
                                        <IcMic size={12} className="text-white" />
                                    )}
                                    <span className="text-xs text-white">{participant.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Chat/Notes Bar */}
            <div className="px-4 mb-4 flex items-center justify-between">
                {/* Chat input */}
                <div
                    className="bg-[#3a3a3a] rounded-full h-10 flex min-w-0 items-center px-3 flex-1 mr-4 active:opacity-70"
                    {...bindTap('meeting.chat.open')}
                >
                    <IcSubtitles size={18} className="text-gray-400 shrink-0" />
                    <div className="w-px h-4 bg-gray-500 mx-2" />
                    <IcSmile size={18} className="text-gray-400 shrink-0" />
                    <span className="ml-2 min-w-0 flex-1 truncate text-sm text-gray-400">{s.meeting_chat_placeholder}</span>
                </div>
                {/* Document icon - separate */}
                <div className="w-10 h-10 bg-[#3a3a3a] rounded-full flex items-center justify-center">
                    <IcFile size={18} className="text-gray-400" />
                </div>
            </div>

            {/* Chat Overlay */}
            {new URLSearchParams(location.search).get('dialog') === 'chat' && (
                <div className="absolute inset-0 z-50 bg-black/50 flex flex-col justify-end">
                    <div className="bg-[#f5f5f5] w-full h-[90%] rounded-t-xl flex flex-col overflow-hidden">
                         {/* Header */}
                         <div className="flex items-center justify-between px-4 py-3 bg-app-surface border-b border-app-border">
                             <div className="flex items-center gap-2">
                                <IcFile size={20} className="text-gray-600" />
                                <IcVolume size={20} className="text-gray-600" />
                             </div>
                             <span className="text-black text-[17px] font-medium">{s.meeting_chat_title}</span>
                             <button {...bindBack()} className="p-1">
                                <IcClose size={24} className="text-black" />
                             </button>
                         </div>

                         {/* Chat Area */}
                         <div
                            ref={chatScrollRef}
                            className="flex-1 overflow-y-auto p-4 bg-[#f5f5f5]"
                         >
                             <div className="text-gray-400 text-xs text-center mt-4 mb-6">
                                 {recipient === 'all' ? s.meeting_chatting_with_all : `${s.meeting_chatting_with_prefix}${(recipient as {id: string, name: string}).name}${s.meeting_chatting_with_suffix}`}
                             </div>

                             {messages.length === 0 ? (
                                 <div className="text-gray-300 text-sm text-center mt-10">{s.meeting_no_chat_messages}</div>
                             ) : (
                                 <div className="flex flex-col gap-4">
                                     {messages.map(msg => (
                                         <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                                             <div className="flex flex-col max-w-[80%]">
                                                 <div className={`flex items-end gap-2 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                                                     {/* Avatar */}
                                                     <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs shrink-0">
                                                         {msg.sender.slice(0, 2)}
                                                     </div>

                                                     {/* Message Bubble */}
                                                     <div className="flex flex-col">
                                                         <div className={`flex items-center gap-2 mb-1 text-xs text-gray-400 ${msg.senderId === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                                                             <span>{msg.sender}</span>
                                                             <span>{TimeService.fromTimestamp(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                             {shouldShowPrivateChatBadge(msg, user.id) && (
                                                                 <span>({s.meeting_private_chat})</span>
                                                             )}
                                                         </div>
                                                         <div className={`px-3 py-2 rounded-lg text-sm break-words whitespace-pre-wrap ${
                                                             msg.senderId === user.id
                                                                 ? 'bg-blue-500 text-white rounded-tr-none'
                                                                 : 'bg-app-surface text-black rounded-tl-none border border-app-border'
                                                         }`}>
                                                             {msg.text}
                                                         </div>
                                                     </div>
                                                 </div>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>

                         {/* Bottom Input Area */}
                         <div className="bg-app-surface p-2 pb-safe">
                             {/* Send To Selector */}
                             <div className="mb-1 flex min-w-0 items-center gap-1 px-2 py-2" onClick={() => setIsSelectingRecipient(true)}>
                                 <span className="shrink-0 text-sm text-black">{s.meeting_send_to}</span>
                                 <div className="flex min-w-0 flex-1 items-center text-sm font-medium text-black">
                                     <IcParticipants size={14} className="mr-1 shrink-0 text-gray-500" />
                                     <span className="min-w-0 truncate">{recipient === 'all' ? s.meeting_send_to_all : (recipient as {id: string, name: string}).name}</span>
                                     <IcExpand size={14} className="ml-1 shrink-0 text-gray-400" />
                                 </div>
                             </div>

                             {/* Input Row */}
                             <div className="flex items-center gap-2 px-1" data-keep-keyboard="true">
                                 <IcSubtitles size={20} className="text-gray-400 shrink-0 self-end mb-2" />
                                 <div className="flex-1 bg-app-surface border border-app-border rounded-lg px-3 py-1.5 min-h-[34px] flex items-center">
                                     <textarea
                                        ref={chatTextareaRef}
                                        rows={1}
                                        placeholder={s.meeting_input_placeholder}
                                        className="w-full bg-transparent text-black text-sm focus:outline-none placeholder-gray-400 resize-none leading-[18px]"
                                        value={chatMessage}
                                        onChange={(e) => setChatMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                // 防止外层键盘/手势逻辑把 Enter 当成其他行为处理
                                                e.stopPropagation();
                                            }
                                        }}
                                     />
                                 </div>
                                 <IcSmile size={20} className="text-gray-400 shrink-0 self-end mb-2" />
                                 {chatMessage.trim().length === 0 ? (
                                     <IcAdd size={20} className="text-gray-400 shrink-0 self-end mb-2" />
                                 ) : (
                                     <button
                                        type="button"
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // 发送时强制保持焦点在输入框：避免移动端软键盘收起
                                            const el = chatTextareaRef.current;
                                            if (el) {
                                                (el as any).focus?.({ preventScroll: true });
                                                try {
                                                    // 发送后内容会清空，光标放回开头
                                                    el.setSelectionRange(0, 0);
                                                } catch {
                                                    // ignore
                                                }
                                            }
                                            // 用 pointerdown 直接发送，保证首触发就能发出去。
                                            handleSendMessage();
                                        }}
                                        onClick={(e) => {
                                            // 已在 pointerdown 里发送，这里避免重复
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        className="mb-2 p-0 flex items-center justify-center active:opacity-70 shrink-0 self-end"
                                        aria-label="Send message"
                                     >
                                        <svg
                                          width="22"
                                          height="22"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <circle cx="12" cy="12" r="11" fill="#2f6bff" />
                                          <path
                                            d="M12 17V8"
                                            stroke="white"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                          />
                                          <path
                                            d="M8 11L12 7L16 11"
                                            stroke="white"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                     </button>
                                 )}
                             </div>
                         </div>
                    </div>

                    {/* Recipient Selection Sheet */}
                    {isSelectingRecipient && (
                        <div className="absolute inset-0 z-[60] bg-black/30 flex flex-col justify-end" onClick={() => setIsSelectingRecipient(false)}>
                            <div
                                className="bg-app-surface w-full h-[90%] rounded-t-xl flex flex-col animate-slide-up overflow-hidden"
                                onClick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                {/* Header */}
                                <div className="flex items-center h-[50px] px-2 border-b border-gray-100">
                                    <button
                                        type="button"
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsSelectingRecipient(false);
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsSelectingRecipient(false);
                                        }}
                                        className="p-3 rounded-full active:bg-gray-50"
                                    >
                                        <IcNavBack size={24} className="text-black" />
                                    </button>
                                    <span className="mr-8 flex-1 truncate text-center text-[17px] font-medium text-black">{s.meeting_send_to}</span>
                                </div>

                                {/* IcSearch */}
                                <div className="px-4 py-2">
                                    <div className="bg-[#f5f5f5] rounded-lg h-9 flex min-w-0 items-center px-3">
                                        <IcSearch size={16} className="text-gray-400 mr-2 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder={s.meeting_search_member}
                                            className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* List */}
                                <div className="flex-1 overflow-y-auto">
                                    <div
                                        className="flex items-center justify-between px-4 py-3 active:bg-gray-50"
                                        onClick={() => {
                                            setRecipient('all');
                                            setIsSelectingRecipient(false);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                                <IcParticipants size={16} className="text-gray-500" />
                                            </div>
                                            <span className="text-black text-base">{s.meeting_everyone}</span>
                                        </div>
                                        {recipient === 'all' && <IcCheck size={20} className="text-blue-600" />}
                                    </div>

                                    {activeMeeting?.participants.filter(p => p.id !== user.id).map(p => (
                                        <div
                                            key={p.id}
                                            className="flex items-center justify-between px-4 py-3 active:bg-gray-50"
                                            onClick={() => {
                                                setRecipient({ id: p.id, name: p.name });
                                                setIsSelectingRecipient(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-600 overflow-hidden">
                                                     {p.avatar ? (
                                                        <img src={p.avatar} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-white text-xs">
                                                            {p.name.slice(0, 2)}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-black text-base">{p.name}</span>
                                            </div>
                                            {recipient !== 'all' && (recipient as {id: string, name: string}).id === p.id && <IcCheck size={20} className="text-blue-600" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Control Bar */}
            <div className="bg-[#232526] px-4 pb-6 pt-3 flex justify-between items-center rounded-t-2xl">
                {/* Mute */}
                <div
                    className="flex flex-col items-center gap-1 active:opacity-70"
                    onClick={() => updateMeetingSettings({ isMuted: !isMuted })}
                >
                    <div className="w-8 h-8 flex items-center justify-center">
                        {isMuted ? (
                            <IcMicOff size={24} className="text-red-500" />
                        ) : (
                            <IcMic size={24} className="text-white" />
                        )}
                    </div>
                    <span className="text-[10px] text-white">{isMuted ? s.meeting_unmute : s.meeting_mute}</span>
                </div>

                {/* Video */}
                <div
                    className="flex flex-col items-center gap-1 active:opacity-70"
                    onClick={() => updateMeetingSettings({ isVideoOn: !isVideoOn })}
                >
                    <div className="w-8 h-8 flex items-center justify-center">
                        {isVideoOn ? (
                            <IcVideo size={24} className="text-white" />
                        ) : (
                            <IcVideoOff size={24} className="text-red-500" />
                        )}
                    </div>
                    <span className="text-[10px] text-white">{isVideoOn ? s.meeting_video_on : s.meeting_video_off}</span>
                </div>

                {/* IcShare Screen */}
                <div
                    className="flex flex-col items-center gap-1 active:opacity-70"
                    onClick={() => updateMeetingSettings({ isSharing: !activeMeeting?.settings.isSharing })}
                >
                    <div className={`w-8 h-8 flex items-center justify-center ${activeMeeting?.settings.isSharing ? 'bg-[#4CD964] rounded-lg' : ''}`}>
                        {activeMeeting?.settings.isSharing ? (
                            <IcStopCircle size={24} className="text-white" />
                        ) : (
                            <IcScreenShare size={24} className="text-[#4CD964]" />
                        )}
                    </div>
                    <span className="text-[10px] text-white">{activeMeeting?.settings.isSharing ? s.meeting_stop_share : s.meeting_share_screen}</span>
                </div>

                {/* Participants */}
                <div
                    className="flex flex-col items-center gap-1 active:opacity-70"
                    onClick={() => setIsManageMembersOpen(true)}
                >
                    <div className="w-8 h-8 flex items-center justify-center">
                        <IcParticipants size={24} className="text-white" />
                    </div>
                    <span className="text-[10px] text-white">{s.meeting_manage_members}({participantCount})</span>
                </div>

                {/* More with red dot */}
                <div
                    className="flex flex-col items-center gap-1 active:opacity-70"
                    onClick={() => setIsMoreOpen(true)}
                >
                    <div className="w-8 h-8 flex items-center justify-center relative">
                        <IcMore size={24} className="text-white" />
                        <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                    </div>
                    <span className="text-[10px] text-white">{s.meeting_more}</span>
                </div>
            </div>

            {/* More Sheet */}
            {isMoreOpen && (
                <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={() => setIsMoreOpen(false)}>
                    <div className="bg-[#232526] rounded-t-xl p-4" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-4 gap-4">
                            <div
                                className="flex flex-col items-center gap-2 active:opacity-70"
                                onClick={() => {
                                    updateMeetingSettings({ isRecording: !activeMeeting?.settings.isRecording });
                                    setIsMoreOpen(false);
                                }}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeMeeting?.settings.isRecording ? 'bg-red-500' : 'bg-[#3a3a3a]'}`}>
                                    <IcDisc size={24} className="text-white" />
                                </div>
                                <span className="text-xs text-gray-300">{activeMeeting?.settings.isRecording ? s.meeting_stop_record : s.meeting_cloud_record}</span>
                            </div>

                            <div
                                className="flex flex-col items-center gap-2 active:opacity-70"
                                onClick={() => {
                                    const nextLayout = activeMeeting?.settings.layout === 'gallery' ? 'speaker' : 'gallery';
                                    updateMeetingSettings({ layout: nextLayout });
                                    setIsMoreOpen(false);
                                }}
                            >
                                <div className="w-12 h-12 rounded-xl bg-[#3a3a3a] flex items-center justify-center">
                                    <IcLayout size={24} className="text-white" />
                                </div>
                                <span className="text-xs text-gray-300">{s.meeting_layout}</span>
                            </div>

                            <div
                                className="flex flex-col items-center gap-2 active:opacity-70"
                                onClick={() => {
                                    updateMeetingSettings({ captionEnabled: !activeMeeting?.settings.captionEnabled });
                                    setIsMoreOpen(false);
                                }}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activeMeeting?.settings.captionEnabled ? 'bg-blue-600' : 'bg-[#3a3a3a]'}`}>
                                    <IcCaptions size={24} className="text-white" />
                                </div>
                                <span className="text-xs text-gray-300">{s.meeting_captions}</span>
                            </div>

                            <div className="flex flex-col items-center gap-2 active:opacity-70">
                                <div className="w-12 h-12 rounded-xl bg-[#3a3a3a] flex items-center justify-center">
                                    <IcSettings size={24} className="text-white" />
                                </div>
                                <span className="text-xs text-gray-300">{s.menu_settings}</span>
                            </div>
                        </div>
                        <button
                            className="w-full mt-6 py-3 bg-[#3a3a3a] rounded-lg text-white font-medium"
                            onClick={() => setIsMoreOpen(false)}
                        >
                            {s.btn_cancel}
                        </button>
                    </div>
                </div>
            )}

            {/* Manage Members Modal */}
            {isManageMembersOpen && (
                <div className="absolute inset-x-0 bottom-0 top-16 z-50 bg-app-surface flex flex-col rounded-t-xl animate-slide-up overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <IcSettings size={24} className="text-gray-600" />
                        <span className="text-[17px] font-medium text-black">{s.meeting_manage_members}</span>
                        <button onClick={() => setIsManageMembersOpen(false)}>
                            <IcClose size={24} className="text-gray-600" />
                        </button>
                    </div>
                    {/* IcSearch */}
                    <div className="px-4 py-2 flex items-center gap-3">
                        <div className="flex-1 bg-[#F5F5F5] h-9 rounded-lg flex items-center px-3">
                            <IcSearch size={16} className="text-gray-400 mr-2" />
                            <input placeholder={s.meeting_search_member} className="flex-1 bg-transparent text-sm outline-none text-gray-900" />
                        </div>
                        <IcUserAdd size={24} className="text-gray-600" />
                    </div>
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                        <div className="flex-1 py-3 text-center text-blue-600 border-b-2 border-blue-600 font-medium text-sm">
                            {s.meeting_in_meeting_tab}({participantCount})
                        </div>
                        <div className="flex-1 py-3 text-center text-gray-500 font-medium text-sm">
                            {s.meeting_not_joined}
                        </div>
                    </div>
                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {activeMeeting?.participants.map(p => (
                            <div
                                key={p.id}
                                className="flex items-center justify-between px-4 py-3 active:bg-gray-50 border-b border-gray-50"
                                onClick={() => setSelectedMemberId(p.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-600 overflow-hidden flex items-center justify-center">
                                        {p.avatar ? <img src={p.avatar} className="w-full h-full object-cover" /> :
                                        <span className="text-white text-sm font-medium">{p.name.slice(0,2)}</span>}
                                    </div>
                                    <div>
                                        <div className="text-base text-black font-medium">{p.name}</div>
                                        <div className="text-xs text-gray-500">
                                            {p.isHost && s.meeting_host_label}
                                            {p.isHost && p.id === user.id && ', '}
                                            {p.id === user.id && s.meeting_me_label}
                                        </div>
                                    </div>
                                </div>
                                <IcMic size={20} className={p.isMuted ? "text-red-500" : "text-gray-400"} />
                            </div>
                        ))}
                    </div>
                    {/* Bottom Actions */}
                    <div className="px-4 py-3 border-t border-gray-100 flex gap-3 shrink-0 bg-app-surface pb-6">
                        <button
                            className="flex-1 h-10 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium active:bg-gray-50"
                            onClick={() => {
                                if (isHost) {
                                    muteAllParticipants(true);
                                } else {
                                    // Non-host: no action or maybe a toast in future
                                }
                            }}
                        >
                            {s.meeting_mute_all}
                        </button>
                        <button
                            className="flex-1 h-10 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium active:bg-gray-50"
                            onClick={() => {
                                if (isHost) {
                                    muteAllParticipants(false);
                                } else {
                                    // Non-host: no action
                                }
                            }}
                        >
                            {s.meeting_unmute_all}
                        </button>
                        <button className="flex-1 h-10 border border-gray-300 rounded-lg text-sm text-gray-700 font-medium active:bg-gray-50">{s.meeting_invite}</button>
                    </div>
                </div>
            )}

            {/* Participant Profile Sheet */}
            {selectedMemberId && (
                <div className="absolute inset-0 z-[60] flex flex-col justify-end bg-black/50" onClick={() => setSelectedMemberId(null)}>
                    <div className="bg-app-surface rounded-t-xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                        {/* Header / Bg */}
                        <div className="h-24 bg-gradient-to-b from-blue-50 to-white relative">
                            <div className="absolute top-2 w-full text-center text-xs text-gray-400">{s.meeting_set_bg_hint}</div>
                            <div className="absolute -bottom-9 left-4">
                                <div className="w-20 h-20 rounded-full bg-blue-600 border-4 border-white overflow-hidden flex items-center justify-center">
                                     {activeMeeting?.participants.find(p => p.id === selectedMemberId)?.avatar ?
                                         <img src={activeMeeting?.participants.find(p => p.id === selectedMemberId)?.avatar} className="w-full h-full object-cover" /> :
                                         <span className="text-white text-2xl font-medium">{activeMeeting?.participants.find(p => p.id === selectedMemberId)?.name.slice(0,2)}</span>
                                     }
                                </div>
                            </div>
                        </div>
                        <div className="pt-10 px-4 pb-6">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl font-bold text-black">
                                    {activeMeeting?.participants.find(p => p.id === selectedMemberId)?.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                    ({activeMeeting?.participants.find(p => p.id === selectedMemberId)?.isHost ? s.meeting_host_label : ''}
                                    {activeMeeting?.participants.find(p => p.id === selectedMemberId)?.isHost && selectedMemberId === user.id ? ', ' : ''}
                                    {selectedMemberId === user.id ? s.meeting_me_label : ''})
                                </span>
                            </div>
                            {/* Badges */}
                            <div className="flex gap-2 mb-4">
                                <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-500">
                                    <span>{s.meeting_free_label}</span>
                                </div>
                                <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[10px] text-gray-500">
                                    <span>{s.account_unified_identity}</span>
                                </div>
                            </div>
                            {/* Signature */}
                            <div className="flex items-center justify-between py-3 border-t border-gray-100">
                                <span className="text-sm text-gray-900">{s.meeting_signature_label}</span>
                                <span className="text-sm text-gray-400">{s.me_signature_hint}</span>
                            </div>

                            {/* Actions */}
                            <div className="mt-2">
                                <div
                                    className="flex items-center justify-between py-4 border-b border-gray-50 active:bg-gray-50"
                                    onClick={() => {
                                        const p = activeMeeting?.participants.find(p => p.id === selectedMemberId);
                                        if (p) updateParticipant(selectedMemberId, { isMuted: !p.isMuted });
                                        setSelectedMemberId(null);
                                    }}
                                >
                                    <span className="text-base text-black">
                                        {activeMeeting?.participants.find(p => p.id === selectedMemberId)?.isMuted ? s.meeting_unmute : s.meeting_mute}
                                    </span>
                                    <IcMic size={20} className="text-gray-400" />
                                </div>
                                {/* Only show Rename if it's me or I am host */}
                                {(selectedMemberId === user.id || isHost) && (
                                    <div
                                        className="flex items-center justify-between py-4 active:bg-gray-50"
                                        onClick={() => {
                                            const p = activeMeeting?.participants.find(p => p.id === selectedMemberId);
                                            if (p) {
                                                setRenameText(p.name);
                                                setRenamingId(p.id);
                                                setShowRenameDialog(true);
                                                setSelectedMemberId(null);
                                            }
                                        }}
                                    >
                                        <span className="text-base text-black">{s.meeting_rename}</span>
                                        <IcEdit2 size={20} className="text-gray-400" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Dialog */}
            {showRenameDialog && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-app-surface rounded-xl w-[80%] p-4">
                        <div className="text-lg font-medium text-black mb-4">{s.meeting_rename_title}</div>
                        <input
                            className="w-full border border-app-border rounded-lg px-3 py-2 text-black mb-4 outline-none focus:border-blue-500"
                            value={renameText}
                            onChange={e => setRenameText(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                className="flex-1 py-2 text-gray-500 bg-gray-100 rounded-lg"
                                onClick={() => setShowRenameDialog(false)}
                            >
                                {s.btn_cancel}
                            </button>
                            <button
                                className="flex-1 py-2 text-white bg-blue-600 rounded-lg"
                                onClick={() => {
                                    if (renamingId) {
                                        updateParticipant(renamingId, { name: renameText });
                                    }
                                    setShowRenameDialog(false);
                                    setRenamingId(null);
                                }}
                            >
                                {s.btn_confirm}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Modal Overlay */}
            {isExitModalOpen && (
                <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-[1px]">
                    <div className="bg-[#f2f2f2] w-full rounded-t-xl overflow-hidden pb-8">
                        {/* Header Text - 主持人和参与者显示不同内容 */}
                        <div className="bg-app-surface px-4 py-4 text-center border-b border-gray-100">
                            {isHost ? (
                                <p className="text-[13px] text-gray-500 leading-relaxed">
                                    {s.exit_host_hint}
                                </p>
                            ) : (
                                <div className="text-[15px] text-gray-900">
                                    <p>{s.exit_participant_confirm}</p>
                                    <p className="text-[13px] text-gray-500 mt-1">
                                        {s.exit_participant_ai_hint}
                                        <span className="text-blue-500 ml-1">{s.exit_learn_more}</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Actions - 主持人有"结束会议"选项，参与者只有"离开会议" */}
                        <div className="bg-app-surface flex flex-col">
                            <button className="h-(--app-meeting-exit-button-height) flex items-center justify-center gap-1 text-[16px] text-app-text border-b border-gray-100 active:bg-gray-50">
                                {s.exit_ai_delegate} {isHost && <IcExternalLink size={14} className="text-gray-400 ml-0.5" />}
                            </button>
                            <button
                                {...bindTap('meeting.leave', { beforeTrigger: () => endMeeting() })}
                                className={`h-(--app-meeting-exit-button-height) flex items-center justify-center text-[16px] border-b border-gray-100 active:bg-gray-50 ${isHost ? 'text-app-text' : 'text-[#e15555]'}`}
                            >
                                {s.exit_leave_meeting}
                            </button>
                            {isHost && (
                                <button
                                    {...bindTap('meeting.end', { beforeTrigger: () => endMeeting() })}
                                    className="h-(--app-meeting-exit-button-height) flex items-center justify-center text-[16px] text-[#e15555] active:bg-gray-50 font-medium"
                                >
                                    {s.exit_end_meeting}
                                </button>
                            )}
                        </div>

                        {/* Cancel Button */}
                        <div className="mt-2 bg-app-surface">
                            <button
                                {...bindBack()}
                                className="w-full h-(--app-meeting-exit-button-height) flex items-center justify-center text-[16px] text-app-text active:bg-gray-50"
                            >
                                {s.btn_cancel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
