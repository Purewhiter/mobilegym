import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React, { useState, useEffect } from 'react';
import { useMeetingStore } from '../state';
import { useMeetingGestures } from '../hooks/useMeetingGestures';

// Toast 组件
const Toast: React.FC<{ message: string; visible: boolean }> = ({ message, visible }) => {
    if (!visible) return null;
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-black/70 text-white px-6 py-3 rounded-lg text-[15px]">
                {message}
            </div>
        </div>
    );
};

export const JoinMeetingPage: React.FC = () => {
    const user = useMeetingStore(s => s.user);
    const startMeeting = useMeetingStore(s => s.startMeeting);
    const ongoingMeetings = useMeetingStore(s => s.ongoingMeetings);
    const settings = useMeetingStore(s => s.settings);
    const validateMeetingId = (id: string) => ongoingMeetings.find(m => m.meetingId === id.replace(/\s/g, '')) ?? null;
    const { bindBack, go } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    const [meetingId, setMeetingId] = useState('');
    const [name, setName] = useState(user.name);
    // 从全局设置读取默认值
    const [micOn, setMicOn] = useState(settings.micOnJoin);
    const [speakerOn, setSpeakerOn] = useState(settings.speakerOnJoin);
    const [cameraOn, setCameraOn] = useState(settings.cameraOnJoin);
    const [persistName, setPersistName] = useState(false);
    const [showToast, setShowToast] = useState(false);

    // 获取纯数字会议号（移除空格）
    const cleanMeetingId = meetingId.replace(/\s/g, '');

    // 会议号验证：9-12位数字
    const isValidLength = cleanMeetingId.length >= 9 && cleanMeetingId.length <= 12;
    const canJoin = isValidLength;

    // 处理会议号输入（只允许数字，最多12位）
    const handleMeetingIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 12);
        // 格式化为 xxx xxx xxx 或 xxx xxxx xxxx
        if (value.length <= 9) {
            const formatted = value.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
            setMeetingId(formatted);
        } else {
            const formatted = `${value.slice(0, 3)} ${value.slice(3, 7)} ${value.slice(7)}`.trim();
            setMeetingId(formatted);
        }
    };

    // 处理加入会议
    const handleJoinMeeting = () => {
        if (!canJoin) return;

        // 验证会议号是否存在
        const meeting = validateMeetingId(cleanMeetingId);
        if (!meeting) {
            // 显示 Toast
            setShowToast(true);
            return;
        }

        // 加入会议（传递页面上的设置）
        startMeeting({
            isHost: false,
            meetingId: cleanMeetingId,
            settings: { micOn, cameraOn },
        });

        // 使用声明式导航
        go('join.meeting.open');
    };

    // Toast 自动消失
    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    const Toggle = ({ value, onChange, label }: any) => (
        <div className="flex justify-between items-center py-4 bg-app-surface px-4">
            <span className="text-gray-900 text-[15px]">{label}</span>
            <div
                className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={() => onChange(!value)}
            >
                <div className={`absolute top-0.5 w-5 h-5 bg-app-surface rounded-full transition-transform shadow-sm ${value ? 'left-[22px]' : 'left-0.5'}`}></div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-app-surface" data-keep-keyboard>
            {/* Toast */}
            <Toast message={s.join_invalid_id} visible={showToast} />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
                {/* Status bar background + Header */}
                <div className="bg-app-surface pt-10 shrink-0">
                    <div className="flex justify-between items-center px-4 py-3">
                        <button className="text-gray-600 text-[15px]" {...bindBack()}>{s.btn_cancel}</button>
                        <h1 className="text-lg font-medium text-gray-900">{s.join_title}</h1>
                        <div className="w-8"></div>
                    </div>
                </div>

                {/* Inputs */}
                <div className="mt-4 bg-app-surface px-4">
                    <div className="py-5 flex items-center">
                        <span className="w-20 text-gray-900 text-[15px]">{s.join_meeting_id}</span>
                        <div className="flex-1 flex items-center gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder={s.join_meeting_id_placeholder}
                                value={meetingId}
                                onChange={handleMeetingIdChange}
                                className="flex-1 text-[15px] outline-none placeholder-gray-300"
                            />
                            <button className="text-gray-400">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="py-5 flex items-center">
                        <span className="w-20 text-gray-900 text-[15px]">{s.join_your_name}</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex-1 text-[15px] outline-none"
                        />
                    </div>
                </div>

                <div className="px-4 py-4 mt-1 flex items-center justify-between text-xs text-gray-400">
                    <span>{s.join_persist_name}</span>
                    <button
                        onClick={() => setPersistName(!persistName)}
                        className={`w-5 h-5 rounded-full border ${persistName ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-app-surface'}`}
                    >
                        <span className={`block w-full h-full rounded-full ${persistName ? 'scale-50 bg-app-surface' : ''}`}></span>
                    </button>
                </div>

                {/* Toggles */}
                <div className="bg-app-surface">
                    <Toggle label={s.join_toggle_mic} value={micOn} onChange={setMicOn} />
                    <Toggle label={s.join_toggle_speaker} value={speakerOn} onChange={setSpeakerOn} />
                    <Toggle label={s.join_toggle_video} value={cameraOn} onChange={setCameraOn} />
                </div>
            </div>

            {/* Submit — flex child, adjustResize handles keyboard offset */}
            <div className="flex-shrink-0 px-4 py-3 bg-white">
                <button
                    onClick={handleJoinMeeting}
                    disabled={!canJoin}
                    className={`w-full py-3 rounded-lg font-medium text-white ${canJoin ? 'bg-[#2f6bff] active:bg-[#2458d6]' : 'bg-[#b7d0ff]'}`}
                >
                    {s.join_btn}
                </button>
            </div>
        </div>
    );
};
