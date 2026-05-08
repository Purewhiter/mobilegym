import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React from 'react';
import { IcNavForward, IcCopy, IcQrCode, IcImage, IcExternalLink, IcEdit } from '../res/icons';
import { useMeetingStore } from '../state';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { ClipboardService } from '@/os/clipboard';

export const PersonalRoomPage: React.FC = () => {
    const user = useMeetingStore(s => s.user);
    const personalRoom = useMeetingStore(s => s.personalRoom);
    const { bindBack } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    const ListItem = ({ label, value, isLink = true }: { label: string, value: string, isLink?: boolean }) => (
        <div className="flex items-center justify-between gap-3 py-4 px-4 bg-app-surface active:bg-gray-50 border-b border-gray-50 last:border-none">
            <span className="min-w-0 flex-1 text-[15px] leading-snug text-gray-800 break-words">{label}</span>
            <div className="flex min-w-0 shrink-0 items-center gap-1">
                <span className="max-w-[45vw] truncate text-[15px] text-gray-500">{value}</span>
                {isLink && <IcNavForward size={16} className="text-gray-300" />}
            </div>
        </div>
    );

    const copyToClipboard = (text: string) => {
        ClipboardService.copyText(text);
    };

    return (
        <div className="flex flex-col h-full bg-[#f6f7f9] relative">
            {/* Header / Background area - extends to status bar */}
            <div className="absolute top-0 left-0 right-0 h-56 bg-gradient-to-b from-[#e1f0ff] to-transparent"></div>

            {/* Nav Bar */}
            <div className="flex items-center justify-between px-2 py-2 pt-12 relative z-10">
                <button className="p-2" {...bindBack()}>
                    <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                </button>
                <div className="flex items-center gap-4 pr-2">
                    <IcImage size={22} className="text-gray-800" />
                    <IcExternalLink size={22} className="text-gray-800" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-20" data-scroll-container="main" data-scroll-direction="vertical">
                {/* Profile Section */}
                <div className="bg-app-surface rounded-xl p-6 mt-2 mb-3 shadow-sm relative">
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-medium">
                            {user.name.slice(0, 2)}
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-1 bg-gray-50 px-3 py-1.5 rounded-full text-sm text-gray-700 active:bg-gray-100">
                                <IcEdit size={14} />
                                {s.personal_room_edit}
                            </button>
                            <IcQrCode size={20} className="text-gray-800" />
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-6">{user.name}{s.personal_room_title_suffix}</h2>

                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] text-gray-500 w-16">{s.personal_room_meeting_id}</span>
                            <span className="text-[15px] text-gray-800 font-medium">{personalRoom.meetingId}</span>
                            <button onClick={() => copyToClipboard(personalRoom.meetingId)} className="p-1">
                                <IcCopy size={16} className="text-blue-600" />
                            </button>
                        </div>
                        <div className="flex items-start gap-2">
                            <span className="text-[15px] text-gray-500 w-16">{s.personal_room_meeting_link}</span>
                            <div className="flex-1">
                                <span className="text-[15px] text-gray-800 break-all">{personalRoom.link}</span>
                                <button onClick={() => copyToClipboard(personalRoom.link)} className="p-1 inline-block align-middle">
                                    <IcCopy size={16} className="text-blue-600" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Settings Section */}
                <div className="bg-app-surface rounded-xl overflow-hidden shadow-sm">
                    <ListItem label={s.personal_room_password} value={personalRoom.password} />
                    <ListItem label={s.personal_room_waiting_room} value={personalRoom.waitingRoom ? s.personal_room_on : s.personal_room_off} />
                    <ListItem label={s.personal_room_allow_before_host} value={personalRoom.allowBeforeHost ? s.personal_room_yes : s.personal_room_no} />
                    <ListItem label={s.personal_room_watermark} value={personalRoom.watermark ? s.personal_room_on : s.personal_room_not_on} />
                    <ListItem label={s.personal_room_multi_device} value={personalRoom.multiDevice ? s.personal_room_yes : s.personal_room_no} />
                    <ListItem label={s.personal_room_mute_on_join} value={personalRoom.muteOnJoin === 'auto_after_6' ? s.personal_room_mute_auto : (personalRoom.muteOnJoin === 'on' ? s.personal_room_mute_always : s.personal_room_off)} />
                </div>
            </div>

            {/* Bottom Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 px-4 py-4">
                <button className="w-full py-3 bg-app-primary text-white rounded-lg font-medium active:opacity-90 text-[15px]">
                    {s.personal_room_enter}
                </button>
            </div>
        </div>
    );
};
