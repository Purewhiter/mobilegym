import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcSearch, IcDelete, IcClose, IcScan, IcCamera, IcSlidersH } from '../res/icons';
const ChevronLeft = IcNavBack, Search = IcSearch, Trash2 = IcDelete, X = IcClose, ScanLine = IcScan, Camera = IcCamera, SlidersHorizontal = IcSlidersH;
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { DiscoveryFeed } from './HomePage';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { strings, type StringKey } from '../res/strings';
import { RedBookFlameIcon } from '../res/icons';
// Helper for Hot Search Rank Colors
const getRankColor = (index: number) => {
    if (index === 0) return 'text-app-primary'; // Red
    if (index === 1) return 'text-[#ff6600]'; // Orange
    if (index === 2) return 'text-[#ffaa00]'; // Yellow
    return 'text-app-text-muted'; // Gray
};

const getTagColor = (type?: string) => {
    if (type === 'isHot') return 'bg-app-primary';
    if (type === 'isNew') return 'bg-[#ffaa00]';
    if (type === 'label') return 'bg-[#ffaa00]'; // '梗' usually yellow/orange
    return 'bg-gray-300';
};

const getTagText = (item: any): StringKey => {
    if (item.isHot) return 'searchpage_hot';
    if (item.isNew) return 'searchpage_new';
    if (item.label) return item.label;
    return 'none';
};

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const view = useRedBookView();
  const history = useRedBookStore(s => s.searchHistory);
  const hotSearch = useRedBookStore(s => s.hotSearch);
  const guessYouLike = useRedBookStore(s => s.guessYouLike);
  const addSearchHistory = useRedBookStore(s => s.addSearchHistory);
  const removeSearchHistory = useRedBookStore(s => s.removeSearchHistory);
  const clearSearchHistory = useRedBookStore(s => s.clearSearchHistory);
  const feed = useMemo(() => view.feedIds.map(id => view.notesById[id]).filter(Boolean), [view.feedIds, view.notesById]);
  const users = useMemo(() => view.userIds.map(id => view.usersById[id]).filter(Boolean), [view.userIds, view.usersById]);
  const { bindTap, bindBack, go, back } = useRedBookGestures();
  const s = useRedBookStrings();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const keyword = searchParams.get('q') || '';
  const activeTab = searchParams.get('tab') || 'searchpage_all';
  const panelState = searchParams.get('panel');
  const sortKey = activeTab === 'searchpage_all' ? (searchParams.get('sort') || 'comprehensive') : 'comprehensive';
  const isFilterOpen = activeTab === 'searchpage_all' && panelState === 'filter';
  const isSearching = !!keyword;
  
  const [inputValue, setInputValue] = useState(keyword);
  const [showHistoryDelete, setShowHistoryDelete] = useState(false);
  
  // Result Page State
  const [activeSubTab, setActiveSubTab] = useState<StringKey>('general');

  const tabs: StringKey[] = ['searchpage_all', 'users', 'products', 'images', 'searchpage_ask'];
  const subTabs: StringKey[] = ['general', 'latest', 'movie_releases', 'birthday_quotes', 'day_and_night_rotation'];
  const sortOptions = [
      { key: 'comprehensive', label: 'general' as StringKey },
      { key: 'latest', label: 'latest' as StringKey },
      { key: 'likes', label: 'most_liked' as StringKey },
      { key: 'comments', label: 'most_commented' as StringKey },
      { key: 'collects', label: 'most_collected' as StringKey },
  ];

  const handleBackFromSearch = () => {
      // 无论是否在搜索中，点击返回都应该回退历史
      // 如果在搜索结果页，back() 会回到落地页
      // 如果在落地页，back() 会触发系统返回逻辑
      back();
  };

  // Sync input with URL
  useEffect(() => {
      setInputValue(keyword);
  }, [keyword]);

  // Auto focus search input when entering the search page (matches real app behavior).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const focus = () => {
      try {
        (el as any).focus?.({ preventScroll: true });
      } catch {
        try {
          el.focus();
        } catch {
          // ignore
        }
      }
    };
    // Focus now + next frame (some UIs settle after layout)
    focus();
    requestAnimationFrame(focus);
  }, []);

  // Search Logic
  const handleSearch = (key: string = inputValue) => {
      if (!key.trim()) return;
      const nextParams: Record<string, string> = { q: key, tab: activeTab };
      if (activeTab === 'searchpage_all') {
          nextParams.sort = sortKey;
      }
      // 根据是否已有搜索词选择 push 或 replace
      const transitionId = keyword ? 'search.query.submit.replace' : 'search.query.submit.push';
      go(transitionId, nextParams);
      
      addSearchHistory(key);
  };

  const handleTabChange = (tab: string) => {
      // Tab switching should replace history so Back button always goes to Landing Page
      const nextParams: Record<string, string> = { tab };
      if (tab === 'searchpage_all') {
          nextParams.sort = sortKey;
      }
      go('search.tab.switch', nextParams);
  };

  const handleOpenFilter = () => {
      if (activeTab !== 'searchpage_all' || isFilterOpen) return;
      go('search.filter.open', { sort: sortKey });
  };

  const clearSearch = () => {
      setInputValue('');
      // 清空搜索时直接返回上一页（落地页），而不是 replace
      // 这样历史栈正确：首页 → /search，点一次返回即可回首页
      back();
      // 返回落地页后自动对焦输入框
      requestAnimationFrame(() => {
          inputRef.current?.focus();
      });
  };

  // Filtered Results
  const toNumber = (value?: number | string) => {
      if (value === undefined) return 0;
      if (typeof value === 'number') return value;
      const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
      return Number.isNaN(parsed) ? 0 : parsed;
  };

  const searchResults = useMemo(() => {
      if (!keyword) return [];
      const lowerKey = keyword.toLowerCase();
      return feed.filter(note =>
          note.title.toLowerCase().includes(lowerKey) ||
          note.content.toLowerCase().includes(lowerKey) ||
          note.category?.toLowerCase().includes(lowerKey)
      );
  }, [keyword, feed]);

  useEffect(() => {
      if (!isSearching) return;
      if (!searchParams.get('tab')) {
          go('search.tab.switch', { tab: 'searchpage_all', sort: sortKey });
          return;
      }
      if (activeTab !== 'searchpage_all') return;
      if (isFilterOpen) return;
      if (!sortKey) return;
      go('search.sort.apply', { sort: sortKey });
  }, [activeTab, isFilterOpen, isSearching, searchParams, sortKey, go]);

  const sortedResults = useMemo(() => {
      if (activeTab !== 'searchpage_all') return searchResults;
      if (searchResults.length === 0) return searchResults;
      const nextResults = [...searchResults];
      switch (sortKey) {
          case 'latest':
              nextResults.sort((a, b) => b.createdAt - a.createdAt);
              break;
          case 'likes':
              nextResults.sort((a, b) => toNumber(b.likes) - toNumber(a.likes));
              break;
          case 'comments':
              nextResults.sort((a, b) => toNumber(b.comments) - toNumber(a.comments));
              break;
          case 'collects':
              nextResults.sort((a, b) => toNumber(b.collections) - toNumber(a.collections));
              break;
          default:
              break;
      }
      return nextResults;
  }, [activeTab, searchResults, sortKey]);

  const userResults = useMemo(() => {
      if (!keyword) return [];
      const lowerKey = keyword.toLowerCase();
      return users.filter(user => user.name.toLowerCase().includes(lowerKey));
  }, [keyword, users]);


  // --- Render Components ---

  const renderLanding = () => (
      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-20"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
          {/* History */}
          {history.length > 0 && (
              <div className="mb-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 truncate text-[15px] font-medium text-app-text">{s.recent_searches}</div>
                      {showHistoryDelete ? (
                          <div className="flex flex-shrink-0 items-center gap-4 whitespace-nowrap">
                               <span className="text-[12px] text-app-text-muted" onClick={clearSearchHistory}>{s.delete_all}</span>
                               <span className="text-[12px] text-app-primary border-l border-[#eee] pl-4" onClick={() => setShowHistoryDelete(false)}>{s.searchpage_done}</span>
                          </div>
                      ) : (
                          <Trash2 size={14} className="text-app-text-muted" onClick={() => setShowHistoryDelete(true)} />
                      )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {history.map((item, idx) => (
                          <div key={idx} className="relative">
                              <span 
                                  {...bindTap('search.query.submit.push', { params: { q: item, tab: activeTab }, onTrigger: () => handleSearch(item) })}
                                  className="inline-block px-3 py-1.5 bg-[#f8f8f8] rounded-full text-[13px] text-app-text max-w-[150px] truncate"
                              >
                                  {item}
                              </span>
                              {showHistoryDelete && (
                                  <div 
                                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#ccc] rounded-full flex items-center justify-center text-white text-[10px]"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          removeSearchHistory(item);
                                      }}
                                  >
                                      ×
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* Guess You Like */}
          <div className="mb-8">
               <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 truncate text-[15px] font-medium text-app-text">{s.discover}</div>
                  {/* Ellipsis or Refresh icon */}
                  <span className="text-app-text-muted text-lg leading-none pb-2">...</span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {guessYouLike?.map((item, idx) => (
                       <span 
                          key={idx}
                          {...bindTap('search.query.submit.push', { params: { q: item, tab: activeTab }, onTrigger: () => handleSearch(item) })}
                          className="text-[14px] text-app-text truncate"
                      >
                          {item}
                      </span>
                  ))}
              </div>
          </div>

          {/* Hot Search */}
          <div>
              <div className="mb-4 flex items-center gap-1">
                  <span className="min-w-0 truncate text-[15px] font-bold italic text-app-primary">{s.rednote_trending}</span>
                  {/* Flame Icon */}
                  <RedBookFlameIcon className="flex-shrink-0 text-app-primary" />
              </div>
              <div className="flex flex-col gap-4">
                  {hotSearch?.map((item: any, idx) => (
                      <div 
                          key={idx} 
                          className="flex items-center justify-between active:opacity-70 cursor-pointer"
                          {...bindTap('search.query.submit.push', { params: { q: item.keyword, tab: activeTab }, onTrigger: () => handleSearch(item.keyword) })}
                      >
                           <div className="flex items-center gap-3 flex-1 min-w-0">
                               <span className={`text-[15px] font-bold w-4 text-center ${getRankColor(idx)}`}>
                                   {idx + 1}
                               </span>
                               <span className="min-w-0 flex-1 truncate text-[14px] text-app-text">{item.keyword}</span>
                               {(item.isHot || item.isNew || item.label) && (
                                   <span className={`flex h-[14px] flex-shrink-0 items-center rounded-[2px] px-1 text-[10px] leading-[14px] text-white ${getTagColor(item.isHot ? 'isHot' : item.isNew ? 'isNew' : 'label')}`}>
                                       {s[getTagText(item)]}
                                   </span>
                               )}
                           </div>
                           {item.heat && (
                               <span className="flex-shrink-0 pl-3 text-[12px] text-app-text-muted">{item.heat}</span>
                           )}
                      </div>
                  ))}
              </div>
          </div>
      </div>
  );

  const renderResults = () => (
      <div className="flex-1 flex flex-col bg-[#f8f8f8] min-h-0 relative">
          {/* Tabs */}
          <div className="bg-app-surface border-b border-gray-50 flex-shrink-0 relative z-10">
              <div className="flex h-[40px] items-center gap-5 overflow-x-auto px-4 no-scrollbar">
                  {tabs.map(tab => {
                      const isActive = activeTab === tab;
                      const isAllTab = tab === 'searchpage_all';
                      const canOpenFilter = isAllTab && isActive && !isFilterOpen;
                      return (
                          <div
                              key={tab}
                              className={`relative flex h-full flex-shrink-0 items-center justify-center text-[15px] transition-all ${isActive ? 'font-bold text-app-text' : 'text-[#666]'}`}
                              {...(isActive ? {} : bindTap('search.tab.switch', { params: { tab } }))}
                          >
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                  <span className="whitespace-nowrap">{s[tab]}</span>
                                  {isAllTab && (
                                      <span
                                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${canOpenFilter ? 'text-app-text-muted' : 'text-[#cfcfcf]'}`}
                                          {...(canOpenFilter ? bindTap('search.filter.open', { stopPropagation: true, onTrigger: handleOpenFilter }) : {})}
                                      >
                                          <SlidersHorizontal size={14} />
                                      </span>
                                  )}
                              </div>
                              {isActive && <div className="absolute bottom-0 w-4 h-[2px] bg-app-primary rounded-full"></div>}
                          </div>
                      );
                  })}
              </div>
          </div>

          {/* Sub Tabs */}
          {!isFilterOpen && (
              <div className="bg-app-surface px-3 py-2 flex gap-2 overflow-x-auto no-scrollbar mb-1 flex-shrink-0">
                  {subTabs.map(tab => (
                      <div
                          key={tab}
                          className={`px-3 py-1 rounded-[4px] text-[13px] whitespace-nowrap cursor-pointer ${activeSubTab === tab ? 'bg-[#f5f5f5] text-app-text font-medium' : 'text-[#666]'}`}
                          onClick={() => setActiveSubTab(tab)}
                      >
                          {s[tab]}
                      </div>
                  ))}
              </div>
          )}

          {isFilterOpen && (
              <div className="absolute left-0 right-0 top-[40px] bottom-0 z-20 flex flex-col">
                  <div className="bg-app-surface px-4 pt-4 pb-4 shadow-sm">
                      <div className="text-[13px] text-app-text-muted mb-3">{s.sort_by}</div>
                      <div className="flex flex-wrap gap-3">
                          {sortOptions.map(option => {
                              const isSelected = sortKey === option.key;
                              return (
                                  <div
                                      key={option.key}
                                      {...bindTap('search.sort.switch', { params: { sort: option.key }, onTrigger: () => go('search.sort.apply', { sort: option.key }) })}
                                      className={`px-4 py-2 rounded-[10px] text-[14px] ${isSelected ? 'bg-[#fde8eb] text-app-primary font-medium' : 'bg-[#f5f5f5] text-app-text'}`}
                                  >
                                      {s[option.label]}
                                  </div>
                              );
                          })}
                      </div>

                      <div className="mt-6 text-[13px] text-app-text-muted mb-3">{s.note_type}</div>
                      <div className="flex flex-wrap gap-3">
                          {(['searchpage_any', 'video', 'image_and_text', 'live'] as StringKey[]).map((label, index) => (
                              <div
                                  key={label}
                                  className={`px-4 py-2 rounded-[10px] text-[14px] ${index === 0 ? 'bg-[#fde8eb] text-app-primary font-medium' : 'bg-[#f5f5f5] text-app-text'}`}
                              >
                                  {s[label]}
                              </div>
                          ))}
                      </div>

                      <div className="mt-6 text-[13px] text-app-text-muted mb-3">{s.post_time}</div>
                      <div className="flex flex-wrap gap-3">
                          {(['searchpage_any', 'within_1_day', 'within_1_week', 'within_6_months'] as StringKey[]).map((label, index) => (
                              <div
                                  key={label}
                                  className={`px-4 py-2 rounded-[10px] text-[14px] ${index === 0 ? 'bg-[#fde8eb] text-app-primary font-medium' : 'bg-[#f5f5f5] text-app-text'}`}
                              >
                                  {s[label]}
                              </div>
                          ))}
                      </div>

                      <div className="mt-6 text-[13px] text-app-text-muted mb-3">{s.search_scope}</div>
                      <div className="flex flex-wrap gap-3">
                          {(['searchpage_any', 'viewed', 'not_viewed', 'followed'] as StringKey[]).map((label, index) => (
                              <div
                                  key={label}
                                  className={`px-4 py-2 rounded-[10px] text-[14px] ${index === 0 ? 'bg-[#fde8eb] text-app-primary font-medium' : 'bg-[#f5f5f5] text-app-text'}`}
                              >
                                  {s[label]}
                              </div>
                          ))}
                      </div>

                      <div className="mt-6 text-[13px] text-app-text-muted mb-3">{s.distance}</div>
                      <div className="flex flex-wrap gap-3">
                          {(['searchpage_any', 'same_city', 'near_me'] as StringKey[]).map((label, index) => (
                              <div
                                  key={label}
                                  className={`px-4 py-2 rounded-[10px] text-[14px] ${index === 0 ? 'bg-[#fde8eb] text-app-primary font-medium' : 'bg-[#f5f5f5] text-app-text'}`}
                              >
                                  {s[label]}
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="bg-app-surface border-t border-gray-100 px-6 py-4 flex items-center justify-between text-[15px] text-[#666]">
                      <div className="flex items-center gap-2">
                          <span className="text-[16px]">⟲</span>
                          <span>{s.reset}</span>
                      </div>
                      <div className="h-5 w-px bg-gray-200" />
                      <div
                        className="flex items-center gap-2"
                        {...bindTap('search.sort.apply', { params: { sort: sortKey }, onTrigger: () => go('search.sort.apply', { sort: sortKey }) })}
                      >
                          <span className="text-[16px]">˄</span>
                          <span>{s.collapse}</span>
                      </div>
                  </div>
                  <div
                    className="flex-1 bg-black/30"
                    {...bindTap('search.sort.apply', { params: { sort: sortKey }, onTrigger: () => go('search.sort.apply', { sort: sortKey }) })}
                  />
              </div>
          )}

          {/* Content */}
          <div
            className="flex-1 overflow-y-auto no-scrollbar p-[5px]"
            data-scroll-container="main"
            data-scroll-direction="vertical"
          >
              {activeTab === 'searchpage_all' && (
                  sortedResults.length > 0 ? (
                      <DiscoveryFeed feed={sortedResults} />
                  ) : (
                      <div className="py-20 text-center text-gray-400 text-sm">
                          {s.no_related_content_found}
                      </div>
                  )
              )}

              {activeTab === 'users' && (
                  <div className="flex flex-col bg-app-surface">
                      {userResults.length > 0 ? userResults.map(user => (
                          <div
                              key={user.id}
                              className="flex items-center justify-between gap-3 border-b border-gray-50 p-4"
                              {...bindTap('user.open', { params: { userId: user.id } })}
                          >
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <img src={user.avatar} className="w-[50px] h-[50px] rounded-full object-cover border border-gray-100" />
                                  <div className="flex min-w-0 flex-col gap-0.5">
                                      <div className="truncate text-[16px] text-app-text">{user.name}</div>
                                      <div className="truncate text-[12px] text-app-text-muted">{s.followers} {Number(user.followers) > 9999 ? (Number(user.followers)/10000).toFixed(1) + s.k : user.followers}</div>
                                      <div className="truncate text-[12px] text-app-text-muted">{s.rednote_id_2} {user.id}</div>
                                  </div>
                              </div>
                              <button className="min-w-[72px] flex-shrink-0 whitespace-nowrap rounded-full border border-app-primary px-5 py-1.5 text-[13px] font-medium text-app-primary">
                                  {s.following}
                              </button>
                          </div>
                      )) : (
                          <div className="py-20 text-center text-gray-400 text-sm">
                              {s.no_users_found}
                          </div>
                      )}
                  </div>
              )}
              
              {/* Other tabs placeholders */}
              {(activeTab !== 'searchpage_all' && activeTab !== 'users') && (
                   <div className="py-20 text-center text-gray-400 text-sm">
                      {s.no_related_content_found}
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-app-surface overflow-hidden">
      {/* Search Header */}
      <div className="pt-10 px-3 pb-2 flex items-center gap-3 bg-app-surface flex-shrink-0">
        <div className="active:opacity-60 cursor-pointer" {...bindBack({ onTrigger: handleBackFromSearch })}>
             <ChevronLeft size={26} className="text-app-text" />
        </div>
        
        <div className="flex-1 min-w-0 h-[36px] bg-gray-100 rounded-full flex items-center px-3 gap-2 border border-transparent focus-within:border-app-primary/20 transition-colors">
            {!isSearching && <Search size={18} className="text-app-text-muted" />}
            <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent text-[15px] text-app-text placeholder-[#999] focus:outline-none caret-app-primary"
                placeholder={isSearching ? "" : s.singer_2026_announced}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                autoFocus
            />
            {inputValue && (
                <div className="cursor-pointer p-1" {...bindBack({ onTrigger: clearSearch })}>
                    <div className="w-4 h-4 bg-[#ccc] rounded-full flex items-center justify-center">
                        <X size={10} className="text-white" />
                    </div>
                </div>
            )}
            {!inputValue && !isSearching && <Camera size={18} className="text-app-text-muted" />}
        </div>
        
        {keyword ? (
            <button
                {...bindTap('search.query.submit.replace', { params: { q: inputValue, tab: activeTab, sort: sortKey }, onTrigger: () => handleSearch() })}
                className="px-1 text-[15px] font-medium text-app-text active:opacity-60 flex-shrink-0 whitespace-nowrap"
            >
                {s.search}
            </button>
        ) : (
            <button
                {...bindTap('search.query.submit.push', { params: { q: inputValue, tab: activeTab, sort: sortKey }, onTrigger: () => handleSearch() })}
                className="px-1 text-[15px] font-medium text-app-text active:opacity-60 flex-shrink-0 whitespace-nowrap"
            >
                {s.search}
            </button>
        )}
      </div>

      {/* Main Content */}
      {isSearching ? renderResults() : renderLanding()}
    </div>
  );
};
