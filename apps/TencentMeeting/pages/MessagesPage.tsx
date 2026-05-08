import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcSettings, IcBell, IcGift, IcNavForward } from '../res/icons';
import { useMeetingStore } from '../state';
import { useMeetingGestures } from '../hooks/useMeetingGestures';
const MessageList: React.FC<{ type: 'todo' | 'all' | 'system' | 'welfare' }> = ({ type }) => {
    const messages = useMeetingStore(s => s.messages);
    const s = useTencentMeetingStrings();

    // Filter logic
    const filteredMessages = messages.filter((msg: typeof messages[number]) => {
        if (type === 'todo') return msg.type === 'todo';
        if (type === 'all') return true; // Show all (excluding todo? usually 'all' means all notifications)
        return msg.type === type;
    });

    if (filteredMessages.length === 0) {
        if (type === 'todo') {
            return (
                <div className="flex flex-col items-center justify-center mt-32">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <div className="w-8 h-1 bg-blue-400 rounded-full" />
                        </div>
                    </div>
                    <div className="text-gray-400 text-sm">{s.messages_todo_done}</div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center mt-32">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <div className="w-10 h-8 bg-gray-200 rounded-md" />
                </div>
                <div className="text-gray-400 text-sm">{s.messages_no_messages}</div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {filteredMessages.map((msg: typeof messages[number]) => (
                <div key={msg.id} className="bg-app-surface rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        {msg.type === 'system' && (
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                <IcBell size={16} fill="currentColor" />
                            </div>
                        )}
                        {msg.type === 'welfare' && (
                            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white">
                                <IcGift size={16} />
                            </div>
                        )}
                        <span className="font-medium text-gray-900 flex-1">{msg.title}</span>
                        <span className="text-xs text-gray-400">{msg.time}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                            <div className="font-medium text-gray-900 text-sm">{msg.content}</div>
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                            {msg.detail}
                        </div>
                        <div className="mt-2 pt-2 border-t border-app-border flex justify-between items-center">
                            <span className="text-xs text-gray-500">{s.messages_view_detail}</span>
                            <IcNavForward size={12} className="text-gray-400" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const MessagesLayout: React.FC = () => {
    const { bindBack, bindTap } = useMeetingGestures();
    const [searchParams] = useSearchParams();
    const s = useTencentMeetingStrings();

    // 从 query 参数读取当前 tab 状态
    const tab = searchParams.get('tab') || 'all';
    const sub = searchParams.get('sub');

    const isTodo = tab === 'todo';
    const isAll = tab === 'all';

    // 确定当前显示的消息类型
    const getMessageType = (): 'todo' | 'all' | 'system' | 'welfare' => {
        if (isTodo) return 'todo';
        if (sub === 'system') return 'system';
        if (sub === 'welfare') return 'welfare';
        return 'all';
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Status bar background + Header */}
            <div className="bg-app-surface pt-10 shrink-0">
                <div className="flex justify-between items-center px-4 py-2">
                    <button className="p-1 -ml-2" {...bindBack()}>
                        <IcNavBack size={24} className="text-gray-600" />
                    </button>

                    {/* Top Tabs (.switch 模式) */}
                    <div className="flex gap-6">
                        <button
                            {...bindTap('messages.tab.switch', { params: { tab: 'todo' } })}
                            className={`text-base font-medium relative ${isTodo ? 'text-gray-900' : 'text-gray-500'}`}
                        >
                            {s.messages_tab_todo}
                            {isTodo && (
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                        <button
                            {...bindTap('messages.tab.switch', { params: { tab: 'all' } })}
                            className={`text-base font-medium relative ${isAll ? 'text-gray-900' : 'text-gray-500'}`}
                        >
                            {s.messages_tab_all}
                            {isAll && (
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    </div>

                    <button className="p-1 -mr-2">
                        <IcSettings size={22} className="text-gray-600" />
                    </button>
                </div>

                {/* Sub Tabs (Only for All Messages) */}
                {isAll && <SubTabsBar currentSub={sub} />}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto" data-scroll-container="main" data-scroll-direction="vertical">
                <MessageList type={getMessageType()} />
            </div>
        </div>
    );
};

const SubTabsBar: React.FC<{ currentSub: string | null }> = ({ currentSub }) => {
    const { bindTap } = useMeetingGestures();
    const s = useTencentMeetingStrings();

    // 消息子标签配置（.switch 模式）
    const MESSAGE_SUB_TABS: Array<{ sub: string | undefined; label: string }> = [
        { sub: undefined, label: s.messages_sub_all },
        { sub: 'system', label: s.messages_sub_system },
        { sub: 'welfare', label: s.messages_sub_welfare },
    ];

    return (
        <div className="flex items-center gap-6 px-4 py-3 bg-app-surface border-b border-gray-100">
            {MESSAGE_SUB_TABS.map(tab => {
                const isActive = tab.sub === undefined ? currentSub === null : currentSub === tab.sub;
                // 子 Tab 使用 messages.sub.switch，传入 sub 参数
                // 注意："全部"按钮不传 sub，使用 messages.tab.switch 切换到 tab=all
                const bindProps = tab.sub
                    ? bindTap('messages.sub.switch', { params: { sub: tab.sub } })
                    : bindTap('messages.tab.switch', { params: { tab: 'all' } });
                return (
                    <button
                        key={tab.sub ?? 'all'}
                        {...bindProps}
                        className={`text-sm ${isActive ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};

export const MessagesPage = MessagesLayout;
