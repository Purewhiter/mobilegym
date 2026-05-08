import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import { formatMeetingHomeDateLabel } from '../utils/localization';
import React from 'react';
import { useMeetingStore } from '../state';
import { IcAdd, IcFastPay, IcCalendar, IcCast, IcUserAdd, IcMail, IcNavForward, IcMonitor, IcLaptop, IcTablet, IcGlobe, IcPhone, IcCalendarDays } from '../res/icons';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { TransitionId } from '../navigation.declaration';
import * as TimeService from '../../../os/TimeService';
import { DeviceLogin, ScheduledMeeting, OngoingMeeting } from '../data';
import { useShallow } from 'zustand/react/shallow';
// 根据设备类型获取图标
const getDeviceIcon = (deviceType: DeviceLogin['deviceType']) => {
    switch (deviceType) {
        case 'pc':
            return IcMonitor;
        case 'mac':
            return IcMonitor;
        case 'ipad':
            return IcTablet;
        case 'web':
            return IcGlobe;
        case 'phone':
            return IcPhone;
        default:
            return IcLaptop;
    }
};

// 格式化时间为 "00:00"
const formatTime = (timestamp: number): string => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 按日期分组会议
const groupMeetingsByDate = (meetings: ScheduledMeeting[]): Map<string, ScheduledMeeting[]> => {
    const groups = new Map<string, ScheduledMeeting[]>();

    // 只显示 pending 状态的会议，按开始时间排序
    const pendingMeetings = meetings
        .filter(m => m.status === 'pending')
        .sort((a, b) => a.startTime - b.startTime);

    pendingMeetings.forEach(meeting => {
        const date = TimeService.fromTimestamp(meeting.startTime);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(meeting);
    });

    return groups;
};

export const HomePage: React.FC = () => {
    const { user, otherDevices, scheduledMeetings, ongoingMeetings, history } = useMeetingStore(useShallow(s => ({
        user: s.user,
        otherDevices: s.otherDevices,
        scheduledMeetings: s.scheduledMeetings,
        ongoingMeetings: s.ongoingMeetings,
        history: s.history,
    })));
    const setCurrentScheduledMeeting = useMeetingStore(s => s.setCurrentScheduledMeeting);
    const startMeeting = useMeetingStore(s => s.startMeeting);
    const { bindTap } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    // Action 按钮配置（需在组件内以访问 s）
    const HOME_ACTIONS: Array<{ id: string; label: string; color: string; icon: React.ComponentType<any>; transition: TransitionId }> = [
        { id: 'join', label: s.action_join_meeting, color: 'bg-blue-600', icon: IcAdd, transition: 'home.join.open' },
        { id: 'quick', label: s.action_quick_meeting, color: 'bg-blue-600', icon: IcFastPay, transition: 'home.quick.open' },
        { id: 'schedule', label: s.action_schedule_meeting, color: 'bg-blue-600', icon: IcCalendar, transition: 'home.schedule.open' },
        { id: 'share', label: s.action_share_screen, color: 'bg-blue-600', icon: IcCast, transition: 'home.share.open' },
    ];

    // 获取设备状态文案
    const getDeviceStatusText = (device: DeviceLogin): string => {
        if (!device.isLoggedIn) return s.device_not_logged_in;
        if (device.inMeeting) {
            return device.meetingTitle ? `${s.device_in_meeting}: ${device.meetingTitle}` : s.device_in_meeting;
        }
        return s.device_logged_in;
    };

    // 格式化日期标签（今天/明天/X月X日）
    const formatDateLabel = (timestamp: number): string => {
        return formatMeetingHomeDateLabel(timestamp, s);
    };

    // 过滤出已登录的设备
    const loggedInDevices = otherDevices.filter(d => d.isLoggedIn);

    // 按日期分组预定会议
    const groupedMeetings = groupMeetingsByDate(scheduledMeetings);

    // 只显示用户加入过的进行中会议（history 中有记录 = 与用户有关系）
    const joinedOngoingMeetings = ongoingMeetings
        .filter(m => history.some(h => h.meetingId === m.meetingId))
        .sort((a, b) => b.startTime - a.startTime);

    const hasScheduledMeetings = groupedMeetings.size > 0;
    const hasOngoingMeetings = joinedOngoingMeetings.length > 0;
    const hasMeetings = hasScheduledMeetings || hasOngoingMeetings;

    // 点击会议卡片
    const handleMeetingClick = (meeting: ScheduledMeeting) => {
        setCurrentScheduledMeeting(meeting);
    };

    // 准备加入进行中的会议（在 beforeTrigger 中调用）
    const prepareJoinMeeting = (meeting: OngoingMeeting) => {
        startMeeting({
            isHost: false,
            meetingId: meeting.meetingId,
        });
    };

    return (
        <div className="flex flex-col h-full bg-app-surface pt-10" data-scroll-container="main" data-scroll-direction="vertical">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-2">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm active:opacity-70 transition-opacity cursor-pointer"
                        {...bindTap('home.profile.open')}
                    >
                        {user.name.slice(0, 2)}
                    </div>
                    <div {...bindTap('home.profile.open')} className="active:opacity-70 transition-opacity cursor-pointer">
                        <div className="text-base font-semibold text-gray-900">{user.name}</div>
                        <div className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex w-fit items-center">
                            {s.home_upgrade_pro} <IcNavForward size={10} />
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 text-gray-600">
                    <div {...bindTap('home.profile.open')} className="active:opacity-50 cursor-pointer">
                        <IcUserAdd size={24} strokeWidth={1.5} />
                    </div>
                    <div {...bindTap('home.messages.open')} className="active:opacity-50 cursor-pointer">
                        <IcMail size={24} strokeWidth={1.5} />
                    </div>
                </div>
            </div>

            {/* Other Device Status */}
            {loggedInDevices.length > 0 && (
                <div className="px-7 mt-2">
                    {loggedInDevices.map(device => {
                        const DeviceIcon = getDeviceIcon(device.deviceType);
                        return (
                            <div key={device.id} className="flex items-center gap-2 text-gray-500 text-sm min-w-0">
                                <DeviceIcon size={16} strokeWidth={1.5} />
                                <span className="min-w-0 truncate">{device.deviceName} {getDeviceStatusText(device)}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Action Grid */}
            <div className="grid grid-cols-4 gap-4 px-4 mt-6">
                {HOME_ACTIONS.map(action => (
                    <div
                        key={action.id}
                        className="flex flex-col items-center gap-2 active:opacity-80 transition-opacity"
                        {...bindTap(action.transition)}
                    >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm ${action.color}`}>
                            <action.icon size={28} strokeWidth={2.5} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{action.label}</span>
                    </div>
                ))}
            </div>

            {/* Meeting List or Empty State */}
            {hasMeetings ? (
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {/* Date Header */}
                    <div className="px-4 mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <IcCalendarDays size={16} />
                            <span>{formatDateLabel(TimeService.now())}</span>
                        </div>
                        <button
                            className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 flex items-center gap-1 active:bg-gray-100"
                            {...bindTap('home.history.open')}
                        >
                            <span>{s.home_history_meetings}</span>
                            <IcNavForward size={12} />
                        </button>
                    </div>

                    {/* Scheduled Meetings */}
                    {Array.from(groupedMeetings.entries()).map(([dateKey, meetings]) => (
                        <div key={dateKey}>
                            {/* Meeting Cards */}
                            {meetings.map(meeting => {
                                const endTime = meeting.startTime + meeting.duration * 60000;
                                const showPending = meeting.startTime - TimeService.now() <= 15 * 60 * 1000;
                                return (
                                    <div
                                        key={meeting.id}
                                        className="mx-4 mt-3 px-4 py-3 bg-app-surface rounded-lg border border-gray-100 active:bg-gray-50"
                                        {...bindTap('home.meeting.detail', { beforeTrigger: () => handleMeetingClick(meeting) })}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="text-[15px] font-medium text-gray-900 mb-1">
                                                    {meeting.title}
                                                </div>
                                                <div className="text-[13px] text-gray-500 mb-1">
                                                    {formatTime(meeting.startTime)}-{formatTime(endTime)} · {meeting.meetingId}
                                                </div>
                                                {showPending && (
                                                    <div className="text-[13px] text-[#C4993C]">
                                                        {s.home_status_pending}
                                                    </div>
                                                )}
                                            </div>
                                            <IcNavForward size={16} className="text-gray-300" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {/* Ongoing Meetings (joined) */}
                    {joinedOngoingMeetings.map(meeting => {
                        const endTime = meeting.startTime + meeting.duration * 60 * 1000;
                        return (
                            <div
                                key={meeting.meetingId}
                                className="mx-4 mt-3 px-4 py-3 bg-app-surface rounded-lg border border-gray-100"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="text-[15px] font-medium text-gray-900 mb-1">
                                            {meeting.title}
                                        </div>
                                        <div className="text-[13px] text-gray-500 mb-1">
                                            {formatTime(meeting.startTime)}-{formatTime(endTime)} · {meeting.meetingId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}
                                        </div>
                                        <div className="text-[13px] text-blue-500">
                                            {s.home_status_ongoing}
                                        </div>
                                    </div>
                                    <button
                                        {...bindTap('home.ongoing.join', { beforeTrigger: () => prepareJoinMeeting(meeting) })}
                                        className="bg-blue-500 text-white text-[13px] px-4 py-1.5 rounded-md active:bg-blue-600"
                                    >
                                        {s.home_btn_join}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <>
                    {/* History Link */}
                    <div className="px-4 mt-6 relative z-10">
                        <div className="w-full h-[1px] bg-gray-100 mb-2"></div>
                        <div className="flex justify-end">
                            <button
                                className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 flex items-center gap-1 active:bg-gray-100"
                                {...bindTap('home.history.open')}
                            >
                                <span>{s.home_history_meetings}</span>
                                <IcNavForward size={12} />
                            </button>
                        </div>
                    </div>

                    {/* Empty State */}
                    <div className="flex-1 flex flex-col items-center justify-center -mt-20">
                        <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mb-4 opacity-50">
                            <IcCalendar size={48} className="text-blue-200" />
                        </div>
                        <div className="text-gray-400 text-sm">{s.home_no_meetings}</div>
                    </div>
                </>
            )}
        </div>
    );
};
