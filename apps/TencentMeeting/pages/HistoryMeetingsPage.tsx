import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { IcNavBack, IcMore, IcSearch, IcNavForward, IcClose } from '../res/icons';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
import { useMeetingStore } from '../state';
import * as TimeService from '../../../os/TimeService';
import { MeetingRecord } from '../data';
import { formatMeetingHistoryDate, type TencentMeetingStrings } from '../utils/localization';
// 用于持久化搜索状态的 key
const SEARCH_STATE_KEY = 'history_search_state';

// 格式化时间为 "20:35"
const formatTime = (timestamp: number): string => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// 获取日期 key（用于分组）
const getDateKey = (timestamp: number): string => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

// 获取最近入会时间（用户最后一次加入该会议的时间）
const getLastJoinTime = (record: MeetingRecord): number => {
    if (record.participations && record.participations.length > 0) {
        // 返回最后一次参会的加入时间
        return record.participations[record.participations.length - 1].joinTime;
    }
    // 兼容没有参会记录的历史数据
    return record.startTime;
};

interface DisplayMeeting {
    id: string;
    title: string;
    time: string;
    host: string;
    type: string;
    isRecurring?: boolean;
    hasIcon?: boolean;
}

interface GroupedHistory {
    date: string;
    meetings: DisplayMeeting[];
}

// 根据 hostId 从参会者中获取主持人名字
const getHostName = (record: MeetingRecord, s: TencentMeetingStrings): string => {
    const host = record.participants.find(p => p.id === record.hostId);
    return host?.name || s.common_unknown;
};

// 将配置数据转换为显示格式
const convertToDisplayFormat = (records: MeetingRecord[], s: TencentMeetingStrings): GroupedHistory[] => {
    const groups = new Map<string, MeetingRecord[]>();
    
    // 按最近入会时间倒序排列
    const sortedRecords = [...records].sort((a, b) => getLastJoinTime(b) - getLastJoinTime(a));
    
    // 按最近入会日期分组
    sortedRecords.forEach(record => {
        const key = getDateKey(getLastJoinTime(record));
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(record);
    });

    // 转换为显示格式
    return Array.from(groups.entries()).map(([_, records]) => ({
        date: formatMeetingHistoryDate(getLastJoinTime(records[0]), s),
        meetings: records.map(r => ({
            id: r.meetingId,
            title: r.title,
            time: formatTime(getLastJoinTime(r)), // 显示最近入会时间
            host: getHostName(r, s),
            type: r.type,
            isRecurring: r.isRecurring,
            hasIcon: r.type === 'recurring',
        })),
    }));
};

export const HistoryMeetingsPage: React.FC = () => {
    const { bindBack, bindTap } = useMeetingGestures();
    const history = useMeetingStore(s => s.history);
    const inputRef = useRef<HTMLInputElement>(null);
    const s = useTencentMeetingStrings();
    
    // 从 sessionStorage 恢复搜索状态
    const [searchText, setSearchText] = useState(() => {
        try {
            const saved = sessionStorage.getItem(SEARCH_STATE_KEY);
            if (saved) {
                const { text } = JSON.parse(saved);
                return text || '';
            }
        } catch {}
        return '';
    });
    const [isSearching, setIsSearching] = useState(() => {
        try {
            const saved = sessionStorage.getItem(SEARCH_STATE_KEY);
            if (saved) {
                const { searching } = JSON.parse(saved);
                return searching || false;
            }
        } catch {}
        return false;
    });

    // 持久化搜索状态
    useEffect(() => {
        if (isSearching || searchText) {
            sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ text: searchText, searching: isSearching }));
        } else {
            sessionStorage.removeItem(SEARCH_STATE_KEY);
        }
    }, [searchText, isSearching]);

    // 如果是搜索模式，自动聚焦输入框（从详情页返回时恢复键盘）
    useEffect(() => {
        if (isSearching && inputRef.current) {
            // 延迟聚焦，确保页面渲染完成
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, []);
    
    // 从 Context 读取数据并转换为显示格式
    const HISTORY_DATA = useMemo(() =>
        convertToDisplayFormat(history, s),
    [history, s]);

    // 搜索过滤后的数据
    const filteredData = useMemo(() => {
        if (!searchText.trim()) return HISTORY_DATA;
        
        const keyword = searchText.toLowerCase().trim();
        // 过滤每个分组中的会议
        return HISTORY_DATA.map(group => ({
            ...group,
            meetings: group.meetings.filter(meeting => 
                meeting.title.toLowerCase().includes(keyword) ||
                meeting.id.replace(/\s/g, '').includes(keyword.replace(/\s/g, '')) ||
                meeting.host.toLowerCase().includes(keyword)
            )
        })).filter(group => group.meetings.length > 0); // 移除空分组
    }, [HISTORY_DATA, searchText]);

    // 处理搜索框聚焦
    const handleFocus = () => {
        setIsSearching(true);
    };

    // 处理取消搜索（回到所有历史记录）
    const handleCancel = () => {
        setSearchText('');
        setIsSearching(false);
        sessionStorage.removeItem(SEARCH_STATE_KEY);
        inputRef.current?.blur();
    };

    // 清除搜索内容
    const handleClear = () => {
        setSearchText('');
        inputRef.current?.focus();
    };

    return (
        <div 
            className="flex flex-col h-full bg-app-surface pt-10"
            data-keep-keyboard={isSearching ? "" : undefined}
        >
            {/* Header - 搜索模式下隐藏 */}
            {!isSearching && (
                <div className="flex items-center justify-between px-4 h-12 bg-app-surface sticky top-10 z-10 shrink-0">
                    <div 
                        className="p-1 -ml-2 active:opacity-50"
                        {...bindBack()}
                    >
                        <IcNavBack size={24} className="text-gray-800" />
                    </div>
                    <div className="text-[17px] font-medium text-gray-900">{s.history_title}</div>
                    <div className="p-1 -mr-2 text-gray-800">
                        <IcMore size={24} />
                    </div>
                </div>
            )}

            {/* IcSearch Bar */}
            <div className={`px-4 py-2 bg-gray-100 shrink-0 flex items-center gap-3 ${isSearching ? 'pt-2' : ''}`}>
                <div className="flex-1 flex items-center gap-2 bg-app-surface rounded-lg px-3 h-9">
                    <IcSearch size={16} className="text-gray-400 shrink-0" />
                    <input 
                        ref={inputRef}
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        onFocus={handleFocus}
                        placeholder={s.history_search_placeholder}
                        className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none min-w-0"
                    />
                    {searchText && (
                        <button 
                            onClick={handleClear}
                            className="p-0.5 active:opacity-50"
                        >
                            <IcClose size={16} className="text-gray-400" />
                        </button>
                    )}
                </div>
                {isSearching && (
                    <button 
                        onClick={handleCancel}
                        className="text-app-primary text-[15px] shrink-0 active:opacity-50"
                    >
                        {s.btn_cancel}
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface relative" data-scroll-container="history" data-scroll-direction="vertical">
                {/* 搜索遮罩 - 搜索模式下无输入时显示，点击退出搜索 */}
                {isSearching && !searchText.trim() && (
                    <div 
                        className="absolute inset-0 bg-black/40 z-10"
                        onClick={handleCancel}
                    />
                )}
                
                {/* 列表内容 - 搜索模式下显示过滤结果，否则显示全部 */}
                {(isSearching && searchText.trim() ? filteredData : HISTORY_DATA).length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                        {searchText ? s.history_no_result : s.history_empty}
                    </div>
                ) : (
                    (isSearching && searchText.trim() ? filteredData : HISTORY_DATA).map((group, groupIndex) => (
                        <div key={groupIndex}>
                            {/* Date Header */}
                            <div className="px-4 py-3 flex justify-between items-center text-xs text-gray-500 bg-gray-50/50">
                                <span>{group.date.split(' ').slice(0, 2).join(' ')}</span>
                                <span>{group.date.split(' ')[2]}</span>
                            </div>

                            {/* Meetings */}
                            <div className="bg-app-surface">
                                {group.meetings.map((meeting, meetingIndex) => (
                                    <div 
                                        key={meeting.id}
                                        {...bindTap('history.detail.open', { params: { meetingId: meeting.id } })}
                                        className={`flex items-center px-4 py-4 active:bg-gray-50 transition-colors ${
                                            meetingIndex !== group.meetings.length - 1 ? 'border-b border-gray-100' : ''
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-gray-500 text-[13px]">{meeting.id}</span>
                                                {meeting.isRecurring && (
                                                    <span className="bg-[#EBF5FF] text-app-primary text-[10px] px-1 rounded-[2px] h-[16px] flex items-center justify-center">
                                                        {s.history_recurring_tag}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[16px] text-gray-900 font-medium truncate">
                                                    {meeting.title}
                                                </span>
                                                {meeting.hasIcon && (
                                                    <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-gray-600 flex items-center justify-center">
                                                         <div className="w-1.5 h-1.5 bg-app-surface rounded-full"></div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-3">
                                                <span>{meeting.time}</span>
                                                <span className="w-[1px] h-3 bg-gray-200"></span>
                                                <span>{meeting.host}</span>
                                            </div>
                                        </div>
                                        <IcNavForward size={16} className="text-gray-300 ml-2 shrink-0" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
