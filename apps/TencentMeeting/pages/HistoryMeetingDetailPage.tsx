import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React, { useState, useMemo } from 'react';
import { IcNavBack, IcMore, IcClock, IcExpand, IcNavForward, IcCopy, IcDownload } from '../res/icons';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { useMeetingStore } from '../state';
import { useParams } from 'react-router-dom';
import * as TimeService from '../../../os/TimeService';
import { MeetingRecord } from '../data';
import {
    formatMeetingMonthDay,
    getDefaultMeetingTimezone,
    isEnglishMeetingStrings,
    localizeMeetingTimezone,
    type TencentMeetingStrings,
} from '../utils/localization';
// 格式化时间为 "00:00"
const formatTime = (timestamp: number): string => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 格式化日期为 "02/04 02:20"
const formatDateTime = (timestamp: number, s: TencentMeetingStrings): string => {
    const date = TimeService.fromTimestamp(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${formatMeetingMonthDay(date, s, { padMonth: true, padDay: true })} ${hours}:${minutes}`;
};

// 格式化日期为 "02月04日02:15-03:15(GMT+08:00) 中国标准时间 -..."
// 使用 startTime + duration（预计时长）计算预计结束时间
const formatMeetingTime = (startTime: number, duration: number, timezone: string, s: TencentMeetingStrings): string => {
    const start = TimeService.fromTimestamp(startTime);
    const expectedEndTime = startTime + duration * 60 * 1000; // 预计结束时间
    const startTimeStr = formatTime(startTime);
    const endTimeStr = formatTime(expectedEndTime);
    const datePrefix = formatMeetingMonthDay(start, s, { padMonth: true, padDay: true });
    const timezoneLabel = localizeMeetingTimezone(timezone, s);
    if (isEnglishMeetingStrings(s)) {
        return `${datePrefix} ${startTimeStr}-${endTimeStr} ${timezoneLabel} -...`;
    }
    return `${datePrefix}${startTimeStr}-${endTimeStr}${timezoneLabel} -...`;
};

// 格式化参会时长为 "00:00:46"
const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

// 格式化会议号
const formatMeetingId = (id: string): string => {
    return id.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
};

// 根据 hostId 从参会者中获取主持人名字
const getHostName = (record: MeetingRecord, s: TencentMeetingStrings): string => {
    const host = record.participants.find(p => p.id === record.hostId);
    return host?.name || s.common_unknown;
};

export const HistoryMeetingDetailPage: React.FC = () => {
    const { bindBack, bindTap } = useMeetingGestures();
    const history = useMeetingStore(s => s.history);
    const startMeeting = useMeetingStore(s => s.startMeeting);
    const user = useMeetingStore(s => s.user);
    const ongoingMeetings = useMeetingStore(s => s.ongoingMeetings);
    const { meetingId } = useParams<{ meetingId: string }>();
    const [showParticipations, setShowParticipations] = useState(false);
    const s = useTencentMeetingStrings();

    // 查找对应的会议记录
    const meeting = useMemo(() => {
        return history.find(h => h.meetingId === meetingId);
    }, [history, meetingId]);

    if (!meeting) {
        return (
            <div className="flex flex-col h-full bg-app-surface pt-10 items-center justify-center">
                <p className="text-gray-500">{s.meeting_detail_not_found}</p>
            </div>
        );
    }

    const participations = meeting.participations || [];
    const lastParticipation = participations[participations.length - 1];
    const lastJoinTime = lastParticipation?.joinTime || meeting.startTime;
    
    // 计算总参会时长
    const totalDuration = participations.reduce((sum, p) => sum + p.duration, 0);
    
    const hostName = getHostName(meeting, s);
    // 使用会议的时区，默认北京时间
    const timezone = meeting.timezone || getDefaultMeetingTimezone(s);
    // 使用会议的预计时长，默认60分钟
    const meetingDuration = meeting.duration || 60;
    
    // 判断用户是否是主持人
    const isHost = meeting.hostId === user.id;
    
    // 判断会议是否还在进行中
    const isOngoing = ongoingMeetings.some(m => m.meetingId === meeting.meetingId);
    
    // 判断是否可以再次预定（自己预定的会议，非快速会议）
    const canReschedule = isHost && meeting.type === 'scheduled';
    
    // 准备重新入会
    const prepareRejoin = () => {
        startMeeting({
            isHost,
            meetingId: meeting.meetingId,
        });
    };

    return (
        <div className="flex flex-col h-full bg-app-surface">
            {/* Header */}
            <div className="pt-10 shrink-0">
                <div className="flex items-center justify-between px-4 h-12">
                    <div 
                        className="p-1 -ml-2 active:opacity-50"
                        {...bindBack()}
                    >
                        <IcNavBack size={24} className="text-gray-800" />
                    </div>
                    <div className="p-1 -mr-2 text-gray-800">
                        <IcMore size={24} />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-4" data-scroll-container="history-detail" data-scroll-direction="vertical">
                {/* 会议标题 */}
                <h1 className="text-xl font-medium text-gray-900 mt-4 mb-2">{meeting.title}</h1>

                {/* 会议时间 */}
                <p className="text-[14px] text-gray-600 mb-2">
                    {formatMeetingTime(meeting.startTime, meetingDuration, timezone, s)}
                </p>

                {/* 会议号 */}
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-[14px] text-gray-600">{s.history_detail_meeting_id}</span>
                    <span className="text-[14px] text-gray-900">{formatMeetingId(meeting.meetingId)}</span>
                    <IcCopy size={16} className="text-blue-500" />
                </div>

                {/* 发起人 */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px] text-gray-400 bg-gray-100 px-2 py-1 rounded">{s.history_detail_organizer}</span>
                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden">
                        {meeting.participants.find(p => p.id === meeting.hostId)?.avatar ? (
                            <img 
                                src={meeting.participants.find(p => p.id === meeting.hostId)?.avatar} 
                                alt="" 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-white text-xs">{hostName.charAt(0)}</span>
                        )}
                    </div>
                    <span className="text-[14px] text-gray-900">{hostName}</span>
                </div>

                {/* 已参会（仅主持人可见） */}
                {isHost && meeting.participants.length > 0 && (
                    <div 
                        className="flex items-center gap-2 mb-6 active:opacity-70"
                        {...bindTap('history.detail.attendees.open', { params: { id: meeting.id } })}
                    >
                        <span className="text-[13px] text-gray-400 bg-gray-100 px-2 py-1 rounded">{s.history_detail_participants}</span>
                        <div className="flex items-center -space-x-1">
                            {meeting.participants.slice(0, 5).map((p, i) => (
                                <div key={p.id} className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center overflow-hidden border-2 border-white">
                                    {p.avatar ? (
                                        <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-white text-xs">{p.name.charAt(0)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <span className="text-[14px] text-gray-900">{s.history_detail_total_people.replace('%s', String(meeting.participants.length))}</span>
                        <IcNavForward size={14} className="text-gray-400" />
                        <IcDownload size={16} className="text-blue-500 ml-1" />
                    </div>
                )}

                {/* 非主持人增加间距 */}
                {!isHost && <div className="mb-3" />}

                {/* 最近入会和参会时长 */}
                <div className="flex items-center border-t border-gray-100 pt-4">
                    {/* 最近入会 */}
                    <div className="flex-1 flex flex-col items-center">
                        <IcClock size={24} className="text-gray-400 mb-2" />
                        <span className="text-[15px] text-gray-900 mb-1">{formatDateTime(lastJoinTime, s)}</span>
                        <span className="text-[12px] text-gray-500">{s.history_detail_last_join}</span>
                    </div>

                    {/* 分隔线 */}
                    <div className="w-[1px] h-16 bg-gray-200"></div>

                    {/* 参会时长 - 只有多于1条记录才能点击展开 */}
                    <div 
                        className={`flex-1 flex flex-col items-center ${participations.length > 1 ? 'cursor-pointer active:opacity-70' : ''}`}
                        onClick={() => participations.length > 1 && setShowParticipations(true)}
                    >
                        <IcClock size={24} className="text-gray-400 mb-2" />
                        <div className="flex items-center gap-1 mb-1">
                            <span className="text-[15px] text-gray-900">{formatDuration(totalDuration)}</span>
                            {participations.length > 1 && (
                                <IcExpand size={14} className="text-gray-400" />
                            )}
                        </div>
                        <span className="text-[12px] text-gray-500">{s.history_detail_duration}</span>
                    </div>
                </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-4 py-4 shrink-0">
                {isOngoing ? (
                    // 会议进行中：重新入会
                    <button
                        {...bindTap('history.detail.rejoin', { beforeTrigger: prepareRejoin })}
                        className="w-full py-3.5 rounded-lg font-medium text-white bg-blue-600 active:bg-blue-700"
                    >
                        {s.history_detail_rejoin}
                    </button>
                ) : canReschedule ? (
                    // 自己预定的会议已结束：再次预定
                    <button
                        {...bindTap('history.detail.reschedule')}
                        className="w-full py-3.5 rounded-lg font-medium text-gray-700 border border-gray-300 active:bg-gray-50"
                    >
                        {s.history_detail_reschedule}
                    </button>
                ) : (
                    // 会议已结束
                    <div className="w-full py-3.5 text-center text-gray-400 font-medium">
                        {s.history_detail_ended}
                    </div>
                )}
            </div>

            {/* 参会记录弹窗 */}
            {showParticipations && (
                <div 
                    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
                    onClick={() => setShowParticipations(false)}
                >
                    <div 
                        className="bg-app-surface rounded-xl w-[85%] max-w-sm overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 表头 */}
                        <div className="flex items-center px-6 py-4 border-b border-gray-100">
                            <span className="flex-1 text-[15px] text-gray-600">{s.history_detail_join_column}</span>
                            <span className="text-[15px] text-gray-600">{s.history_detail_duration_column}</span>
                        </div>

                        {/* 参会记录列表 */}
                        <div className="max-h-[300px] overflow-y-auto">
                            {participations.slice().reverse().map((p, index) => (
                                <div key={index} className="flex items-center px-6 py-3 border-b border-gray-50 last:border-b-0">
                                    <span className="flex-1 text-[14px] text-gray-900">{formatDateTime(p.joinTime, s)}</span>
                                    <span className="text-[14px] text-gray-900">{formatDuration(p.duration)}</span>
                                </div>
                            ))}
                        </div>

                        {/* 底部按钮 */}
                        <div className="border-t border-gray-100">
                            <button
                                className="w-full py-4 text-blue-600 text-[16px] font-medium active:bg-gray-50"
                                onClick={() => setShowParticipations(false)}
                            >
                                {s.history_detail_dismiss}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
