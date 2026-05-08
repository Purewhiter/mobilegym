import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';

import React, { useState } from 'react';
import { IcCopy } from '../res/icons';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { useMeetingStore } from '../state';

export const QuickMeetingPage: React.FC = () => {
    const { bindTap, bindBack } = useMeetingGestures();
    const personalRoom = useMeetingStore(s => s.personalRoom);
    const setPendingMeetingConfig = useMeetingStore(s => s.setPendingMeetingConfig);
    const [videoOn, setVideoOn] = useState(false);
    const [usePMI, setUsePMI] = useState(false);
    const s = useTencentMeetingStrings();

    // 进入会议前设置配置
    const handleEnterMeeting = () => {
        setPendingMeetingConfig({ usePersonalId: usePMI, videoOn });
    };

    const Toggle = ({ value, onChange, label }: any) => (
        <div className="flex justify-between items-center py-3.5 bg-app-surface px-4 border-b border-gray-50 last:border-0 active:bg-gray-50">
            <span className="text-gray-900 text-[15px]">{label}</span>
            <div
                className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onChange(!value);
                }}
            >
                <div className={`absolute top-0.5 w-5 h-5 bg-app-surface rounded-full transition-transform shadow-sm ${value ? 'left-[22px]' : 'left-0.5'}`}></div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-[#f6f7f9]">
            {/* Status bar background + Header */}
            <div className="bg-app-surface pt-10 shrink-0">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
                    <button className="text-gray-600 text-[15px]" {...bindBack()}>{s.btn_cancel}</button>
                    <h1 className="text-[17px] font-medium text-gray-900">{s.quick_title}</h1>
                    <div className="w-8"></div>
                </div>
            </div>

            {/* Banner */}
            <div className="bg-[#e8f0fe] px-4 py-3 flex items-start">
                <p className="text-[13px] text-gray-600 leading-snug">
                    {s.quick_banner}
                    <span className="text-blue-600 font-medium ml-1">{s.quick_upgrade}</span>
                </p>
            </div>

            {/* Options */}
            <div className="mt-3 bg-app-surface">
                <Toggle label={s.quick_toggle_video} value={videoOn} onChange={setVideoOn} />
            </div>

            <div className="mt-3 bg-app-surface">
                <div className="flex justify-between items-center py-3.5 px-4 border-b border-gray-50">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-900 text-[15px]">{s.quick_use_pmi}</span>
                        <div className="w-3.5 h-3.5 rounded-full border border-gray-400 text-[10px] flex items-center justify-center text-gray-500">i</div>
                    </div>
                    <div
                        className={`w-11 h-6 rounded-full relative transition-colors ${usePMI ? 'bg-blue-600' : 'bg-gray-200'}`}
                        onClick={() => setUsePMI(!usePMI)}
                    >
                        <div className={`absolute top-0.5 w-5 h-5 bg-app-surface rounded-full transition-transform shadow-sm ${usePMI ? 'left-[22px]' : 'left-0.5'}`}></div>
                    </div>
                </div>
                <div className="flex justify-between items-center py-3.5 px-4">
                    <span className="text-gray-900 text-[15px]">{s.quick_pmi_label}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-900 text-[15px]">{personalRoom.meetingId}</span>
                        <IcCopy size={16} className="text-blue-600" />
                    </div>
                </div>
            </div>

            {/* Submit */}
            <div className="px-4 mt-auto mb-8">
                <button
                    {...bindTap('quick.meeting.open', { beforeTrigger: handleEnterMeeting })}
                    className="w-full py-3 rounded-lg font-medium text-white bg-blue-600 active:bg-blue-700"
                >
                    {s.quick_btn_enter}
                </button>
            </div>
        </div>
    );
};
