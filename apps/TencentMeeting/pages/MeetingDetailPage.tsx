import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React from 'react';
import { useNavigate as useRouterNavigate, useSearchParams } from 'react-router-dom';
import { IcNavForward, IcExternalLink, IcMore, IcCopy, IcQrCode, IcInfo } from '../res/icons';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import * as TimeService from '../../../os/TimeService';
import { useMeetingStore } from '../state';
import { useAppNavigate } from '../navigation';
import { formatMeetingFullDate, localizeMeetingTimezone } from '../utils/localization';
// 格式化时间为 "00:00"
const formatTime = (timestamp: number): string => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export const MeetingDetailPage: React.FC = () => {
    const { bindTap } = useMeetingGestures();
    const { go, back } = useAppNavigate();
    const routerNavigate = useRouterNavigate();
    const user = useMeetingStore(s => s.user);
    const currentScheduledMeeting = useMeetingStore(s => s.currentScheduledMeeting);
    const cancelScheduledMeeting = useMeetingStore(s => s.cancelScheduledMeeting);
    const s = useTencentMeetingStrings();
    const [searchParams] = useSearchParams();
    const showActions = searchParams.get('dialog') === 'actions';

    const handleEditMeeting = () => {
        // Replace dialog entry with edit page (back from edit returns to detail page)
        routerNavigate('/meeting/edit', { replace: true });
    };

    const handleCancelMeeting = () => {
        if (currentScheduledMeeting) {
            cancelScheduledMeeting(currentScheduledMeeting.id);
        }
        go('meeting.detail.cancel');
    };

    if (!currentScheduledMeeting) {
        return (
            <div className="flex flex-col h-full bg-app-surface pt-10 items-center justify-center">
                <p className="text-gray-500">{s.meeting_detail_not_found}</p>
            </div>
        );
    }

    const meeting = currentScheduledMeeting;
    const startTime = meeting.startTime;
    const endTime = startTime + meeting.duration * 60000;
    const timeReached = TimeService.now() >= startTime;
    const meetingTimezone = localizeMeetingTimezone(meeting.timezone, s);

    return (
        <div className="flex flex-col h-full bg-[#F3F3F3]">
            {/* Header */}
            <div className="bg-app-surface pt-10 shrink-0">
                <div className="flex items-center justify-between px-2 py-2">
                    <button className="p-2" {...bindTap('meeting.detail.back')}>
                        <IcNavForward size={24} className="text-gray-900 transform rotate-180" />
                    </button>
                    <h1 className="text-[17px] font-medium text-gray-900">{s.meeting_detail_title}</h1>
                    <div className="flex items-center gap-2">
                        <button className="p-2">
                            <IcExternalLink size={20} className="text-gray-700" />
                        </button>
                        <button className="p-2" {...bindTap('meeting.detail.actions.open')}>
                            <IcMore size={20} className="text-gray-700" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
                {/* 会议主题 */}
                <div className="bg-app-surface px-4 py-5">
                    <h2 className="text-xl font-medium text-gray-900 mb-1">{meeting.title}</h2>
                    <span className="text-blue-600 text-[14px]">{s.meeting_detail_add_note}</span>
                </div>

                {/* 时间信息 */}
                <div className="bg-app-surface px-4 py-5 mt-3">
                    <div className="flex items-center justify-between">
                        {/* 开始时间 */}
                        <div className="flex flex-col">
                            <span className="text-3xl font-light text-gray-900">{formatTime(startTime)}</span>
                            <span className="text-[12px] text-gray-500 mt-1">{formatMeetingFullDate(TimeService.fromTimestamp(startTime), s, { padMonth: true, padDay: true })}</span>
                        </div>

                        {/* 状态和时长 */}
                        <div className="flex flex-col items-center">
                            <span className="text-[#C4993C] text-[13px] font-medium">{timeReached ? s.home_status_time_reached : s.home_status_pending}</span>
                            <div className="flex items-center gap-2 my-1">
                                <div className="w-8 h-[1px] bg-gray-300"></div>
                                <span className="text-[12px] text-gray-500">{meeting.duration}{s.meeting_detail_minutes}</span>
                                <div className="w-8 h-[1px] bg-gray-300"></div>
                            </div>
                            <span className="text-[12px] text-gray-400">{meetingTimezone.split(')')[0]})</span>
                        </div>

                        {/* 结束时间 */}
                        <div className="flex flex-col items-end">
                            <span className="text-3xl font-light text-gray-900">{formatTime(endTime)}</span>
                            <span className="text-[12px] text-gray-500 mt-1">{formatMeetingFullDate(TimeService.fromTimestamp(endTime), s, { padMonth: true, padDay: true })}</span>
                        </div>
                    </div>
                </div>

                {/* 发起人信息 */}
                <div className="bg-app-surface px-4 py-4 mt-3">
                    <div className="flex items-center gap-3">
                        {/* 头像 */}
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {user.avatar ? (
                                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-lg text-gray-500">{user.name.charAt(0)}</span>
                            )}
                        </div>
                        {/* 信息 */}
                        <div className="flex flex-col">
                            <span className="text-[12px] text-gray-500">{s.meeting_detail_organizer}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[15px] text-gray-900">{user.name}</span>
                                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                                    <span className="text-white text-[10px]">👍</span>
                                </div>
                                <span className="text-[12px] text-[#C4993C] bg-[#FFF8E6] px-1.5 py-0.5 rounded">{s.meeting_detail_upgrade}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 提示信息 */}
                <div className="mx-4 my-3 px-3 py-3 bg-[#e8f5ff] rounded-lg">
                    <p className="text-[13px] text-gray-600">
                        {s.meeting_detail_time_limit}
                        <IcInfo size={12} className="inline text-gray-400 mx-1" />
                        ，<span className="text-blue-600">{s.meeting_detail_upgrade_pro}</span>{s.meeting_detail_unlimited}
                    </p>
                </div>

                {/* 会议号 */}
                <div className="bg-app-surface px-4 py-4 mt-3">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-[15px]">{s.meeting_detail_meeting_id}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-gray-900 text-[15px]">{meeting.meetingId}</span>
                            <IcCopy size={18} className="text-gray-400" />
                            <IcQrCode size={18} className="text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* 电话入会 */}
                <div className="bg-app-surface px-4 py-4 mt-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 text-[15px]">{s.meeting_detail_phone_join}</span>
                            <IcInfo size={14} className="text-gray-400" />
                        </div>
                        <span className="text-blue-600 text-[15px]">{s.meeting_detail_phone_number}</span>
                    </div>
                </div>

                {/* 应用 */}
                <div className="bg-app-surface px-4 py-4 mt-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                            <span className="text-gray-900 text-[15px]">{s.meeting_detail_apps}</span>
                            <IcInfo size={14} className="text-gray-400" />
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-[15px]">
                            <span>{s.meeting_detail_apps_add}</span>
                            <IcNavForward size={16} className="text-gray-300" />
                        </div>
                    </div>
                </div>

                {/* 会议资料 */}
                <div className="bg-app-surface px-4 py-4 mt-3 mb-6">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-900 text-[15px]">{s.meeting_detail_materials}</span>
                        <div className="flex items-center gap-1 text-gray-500 text-[15px]">
                            <span>{s.meeting_detail_materials_empty}</span>
                            <IcNavForward size={16} className="text-gray-300" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 底部按钮 */}
            <div className="bg-app-surface px-4 py-4 flex gap-3 shrink-0">
                <button className="flex-1 py-3 rounded-lg font-medium text-gray-700 border border-gray-300">
                    {s.meeting_detail_btn_ai}
                </button>
                <button
                    {...bindTap('meeting.detail.join')}
                    className="flex-1 py-3 rounded-lg font-medium text-white bg-blue-600 active:bg-blue-700"
                >
                    {s.meeting_detail_btn_enter}
                </button>
            </div>

            {/* 操作底部弹窗 */}
            {showActions && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/30" onClick={() => back()}></div>
                    <div className="relative">
                        <div className="bg-app-surface rounded-t-2xl overflow-hidden">
                            <button
                                className="w-full py-4 text-center text-[17px] text-gray-900 active:bg-gray-100"
                                onClick={handleEditMeeting}
                            >
                                {s.meeting_detail_action_modify}
                            </button>
                            <div className="h-px bg-gray-100"></div>
                            <button
                                className="w-full py-4 text-center text-[17px] text-red-500 active:bg-gray-100"
                                onClick={handleCancelMeeting}
                            >
                                {s.meeting_detail_action_cancel_meeting}
                            </button>
                        </div>
                        <div className="h-2 bg-[#F3F3F3]"></div>
                        <div className="bg-app-surface">
                            <button
                                className="w-full py-4 text-center text-[17px] text-gray-900 active:bg-gray-100"
                                onClick={() => back()}
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
