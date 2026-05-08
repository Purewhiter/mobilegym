import React, { useState } from 'react';
import { IcNavBack, IcSearch, IcMenu, IcSortUpDown, IcClose } from '../res/icons';
const ChevronLeft = IcNavBack, Search = IcSearch, Menu = IcMenu, ArrowUpDown = IcSortUpDown, X = IcClose;
import { useSearchParams } from 'react-router-dom';
import { useBilibiliStore } from '../state';
import { useAuthors } from '../hooks/useData';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
export const UserRelationPage: React.FC = () => {
    const { bindBack, bindTap, back } = useBilibiliGestures();
    const [searchParams] = useSearchParams();
    const user = useBilibiliStore(s => s.user);
    const toggleFollow = useBilibiliStore(s => s.toggleFollow);
    const AUTHOR_DATA = useAuthors();

    // 1. Tab State (URL Param)
    const activeTab = (searchParams.get('tab') as 'follow' | 'fans') || 'follow';
    const showMenu = searchParams.get('menu') === 'true';

    // 2. Search State（本地，不写入 URL；属于原地输入动作）
    const [searchQuery, setSearchQuery] = useState('');
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value);

    // 3. Menu State（由 URL 控制打开/关闭；选中项用本地 state 记录即可）
    const [selectedMid, setSelectedMid] = useState<string | null>(null);

    // Get lists from user context directly and enrich with AUTHOR_DATA if available
    const rawList = activeTab === 'follow'
        ? (user.followingList || [])
        : (user.followersList || []);

    const list = rawList.map(u => {
        // Hybrid logic: If the user exists in our large database (AUTHOR_DATA), use that as the source of truth
        // Note: AUTHOR_DATA keys are numbers, so we convert.
        const authorData = AUTHOR_DATA[Number(u.mid)];
        if (authorData) {
            return {
                ...u,
                name: authorData.name,
                face: authorData.face,
                sign: authorData.sign,
                isVip: authorData.vip?.status === 1,
                // Add other synced fields as needed
            };
        }
        return u;
    });

    const filteredList = list.filter(u => u.name.includes(searchQuery));

    // Derived Menu State
    const selectedUser = selectedMid ? list.find(u => String(u.mid) === String(selectedMid)) : null;

    const closeMenu = () => {
        back(); // Pop history to close menu
        setSelectedMid(null);
    };

    const handleUnfollow = () => {
        if (selectedUser) {
            toggleFollow(String(selectedUser.mid));
        }
        closeMenu();
    };

    return (
        <div className="flex flex-col h-full bg-app-surface font-sans">
            {/* Header */}
            <div className="flex items-center gap-4 px-4 pt-10 pb-3 border-b border-gray-100 bg-app-surface sticky top-0 z-40">
                <button {...bindBack()}><ChevronLeft size={24} className="text-[#61666D]" /></button>
                <button {...bindBack()}><X size={24} className="text-[#61666D]" /></button>
                <h1 className="text-[17px] font-medium text-app-text">我的好友</h1>
            </div>

            {/* Tabs */}
            <div className="flex bg-app-surface border-b border-gray-100 sticky top-[57px] z-30">
                <button
                    {...(activeTab === 'follow' ? {} : bindTap('userRelation.tab.switch', { params: { tab: 'follow' } }))}
                    className={`flex-1 py-3 text-[14px] font-medium relative ${activeTab === 'follow' ? 'text-app-primary' : 'text-[#61666D]'}`}
                >
                    关注
                    {activeTab === 'follow' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-app-primary rounded-full" />}
                </button>
                <button
                    {...(activeTab === 'fans' ? {} : bindTap('userRelation.tab.switch', { params: { tab: 'fans' } }))}
                    className={`flex-1 py-3 text-[14px] font-medium relative ${activeTab === 'fans' ? 'text-app-primary' : 'text-[#61666D]'}`}
                >
                    粉丝
                    {activeTab === 'fans' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-app-primary rounded-full" />}
                </button>
            </div>

            {/* Search Bar */}
            <div className="px-4 py-2 bg-app-surface">
                <div className="bg-app-bg h-9 rounded-full flex items-center px-3 gap-2">
                    <Search size={16} className="text-app-text-muted" />
                    <input
                        className="flex-1 bg-transparent border-none outline-none text-[13px] text-app-text placeholder-[#9499A0]"
                        placeholder={activeTab === 'follow' ? "搜索我的关注" : "搜索我的粉丝"}
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                </div>
            </div>

            {/* List Header */}
            <div className="flex justify-between items-center px-4 py-2 text-app-text-muted text-[12px] bg-app-surface">
                <span>{activeTab === 'follow' ? '我的关注' : '我的粉丝'} {list.length}人</span>
                <button className="flex items-center gap-1">
                    <ArrowUpDown size={12} /> 最近访问
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto no-scrollbar bg-app-surface pb-20" data-scroll-container="main" data-scroll-direction="vertical">
                {filteredList.length > 0 ? (
                    filteredList.map((item: any) => (
                        <div
                            key={item.mid}
                            className="flex items-center justify-between px-4 py-3 active:bg-gray-50 bg-app-surface border-b border-gray-50 last:border-0"
                            {...bindTap('user.open', { params: { mid: item.mid } })}
                        >
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 border border-gray-100">
                                    <img src={item.face} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    {item.isVip && (
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-app-primary rounded-full border-2 border-white flex items-center justify-center">
                                            <span className="text-white text-[8px] font-bold">⚡</span>
                                        </div>
                                    )}
                                    {item.officialVerify?.type === 2 && (
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#23C9ED] rounded-full border-2 border-white flex items-center justify-center">
                                            <span className="text-white text-[8px] font-bold">⚡</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <div className={`text-[15px] font-medium truncate ${item.isVip ? 'text-app-primary' : 'text-app-text'}`}>
                                        {item.name}
                                    </div>
                                    <div className="text-[11px] text-app-text-muted truncate pr-4">
                                        {item.sign || '这个人很懒，什么都没有写'}
                                    </div>
                                </div>
                            </div>

                            <button
                                {...bindTap('userRelation.menu.open', {
                                    stopPropagation: true,
                                    beforeTrigger: () => setSelectedMid(String(item.mid)),
                                })}
                                className="h-7 px-3 rounded-full bg-[#E3E5E7] text-app-text-muted flex items-center justify-center gap-1 font-medium text-[12px] shrink-0 active:bg-[#d0d3d6] ml-2"
                            >
                                <Menu size={12} /> 已关注
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center pt-20 text-app-text-muted">
                        <div className="text-[13px]">{activeTab === 'follow' ? '暂无关注' : '暂无粉丝'}</div>
                    </div>
                )}
            </div>

            {/* Unfollow Menu Overlay */}
            {showMenu && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end text-base cursor-default font-sans">
                    <div className="absolute inset-0 bg-black/50" onClick={closeMenu} />
                    <div className="bg-app-surface rounded-t-xl z-20 overflow-hidden pb-4">
                        <div className="py-4 text-center text-app-text-muted text-[13px] border-b border-gray-100">
                            {selectedUser?.name}
                        </div>
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" onClick={closeMenu}>设置分组</div>
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" onClick={closeMenu}>加入特别关注</div>
                        <div className="py-3.5 text-center text-app-primary active:bg-gray-50 border-t border-gray-100" onClick={handleUnfollow}>取消关注</div>
                        <div className="h-2 bg-app-bg my-1" />
                        <div className="py-3.5 text-center text-app-text active:bg-gray-50" onClick={closeMenu}>取消</div>
                    </div>
                </div>
            )}
        </div>
    );
};
