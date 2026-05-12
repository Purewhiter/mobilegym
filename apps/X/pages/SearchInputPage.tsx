import React from 'react';
import { useLocale } from '@/os/locale';
import { IcRepost, IcTabSearch } from '../res/icons';
import { useXStore, selectEffectiveFollowedSet } from '../state';
import { useXAllUsers, useXRecentSearches, useXSearchPosts } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { BookmarkToast } from '../components/BookmarkToast';
import { XRetweetSheet } from '../components/XRetweetSheet';
import { XTimelinePostCard } from '../components/XTimelinePostCard';
import { compareXPostsByRecencyDesc } from '../utils/formatTime';

type SearchTab = 'hot' | 'latest' | 'people' | 'video' | 'photo';

export const SearchInputPage: React.FC = () => {
  const recentSearches = useXRecentSearches();
  const users = useXAllUsers();
  const followedSet = useXStore(selectEffectiveFollowedSet);
  const toggleFollow = useXStore(s => s.toggleFollow);
  const toggleRetweet = useXStore(s => s.toggleRetweet);
  const setSearchQuery = useXStore(s => s.setSearchQuery);
  const { bindBack, bindTap, go } = useXGestures();
  const s = useXStrings();
  const locale = useLocale();
  const [inputValue, setInputValue] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<SearchTab>('hot');
  const [retweetMenuPostId, setRetweetMenuPostId] = React.useState<string | null>(null);
  const [showBookmarkToast, setShowBookmarkToast] = React.useState(false);
  const query = inputValue.trim().toLowerCase();

  React.useEffect(() => {
    setSearchQuery(inputValue);
    return () => setSearchQuery('');
  }, [inputValue, setSearchQuery]);

  // People Search: user-input fuzzy match, 不属于 data contract 范围, 允许 case-insensitive。
  // 这是除 selectSearchPosts 之外的另一个合法 lowercase 例外, 都仅用于 query/content 文本匹配。
  const matchedUsers = React.useMemo(() => {
    if (!query) return [];

    const list = Object.values(users) as Array<{
      id: string;
      name?: string;
      restId?: string;
      followers?: number;
      avatar?: string;
      verified?: boolean;
      bio?: string;
    }>;

    const scored = list
      .map(user => {
        const name = (user.name || '').toLowerCase();
        const id = (user.id || '').toLowerCase();
        const restId = (user.restId || '').toLowerCase();
        const normalizedQuery = query.replace(/^@/, '');
        const hit =
          name.includes(query) ||
          id.includes(normalizedQuery) ||
          restId.includes(query);

        if (!hit) return null;

        const exactId = id === normalizedQuery;
        const starts = id.startsWith(normalizedQuery) || name.startsWith(query);

        const score = (exactId ? 300 : 0) + (starts ? 50 : 0);
        return { user, score };
      })
      .filter(Boolean) as { user: any; score: number }[];

    scored.sort((a, b) => b.score - a.score || (b.user.followers ?? 0) - (a.user.followers ?? 0));
    return scored.slice(0, 20).map(item => item.user);
  }, [query, users]);

  const matchedPosts = useXSearchPosts(query);

  const DISPLAY_LIMIT = 80;
  const displayedPosts = React.useMemo(() => {
    let result = [...matchedPosts];
    if (activeTab === 'latest') {
      result.sort(compareXPostsByRecencyDesc);
    } else if (activeTab === 'video') {
      result = result.filter(post => post.video);
    } else if (activeTab === 'photo') {
      result = result.filter(post => post.image && !post.video);
    } else if (activeTab === 'hot') {
      result.sort((a, b) => (b.stats?.likes || 0) - (a.stats?.likes || 0));
    }
    return result.slice(0, DISPLAY_LIMIT);
  }, [activeTab, matchedPosts]);

  const isFollowing = (userId: string) => followedSet.has(userId);
  const emptyResultsLabel = locale === 'en' ? 'No results found' : '没有找到相关内容';
  const tabs = [
    { id: 'hot', label: s.search_input_tab_hot },
    { id: 'latest', label: s.search_input_tab_latest },
    { id: 'people', label: s.search_input_tab_people },
    { id: 'video', label: s.search_input_tab_video },
    { id: 'photo', label: s.search_input_tab_photo },
  ] as const;

  const renderNoResults = (label = emptyResultsLabel) => (
    <div className="px-4 py-8 text-center text-gray-500">{label}</div>
  );

  const renderPost = (post: any) => {
    const sourcePost = post.retweetedPost ?? post;
    return (
      <XTimelinePostCard
        key={post.id}
        post={sourcePost}
        topContent={
          post.retweetedPost ? (
            <div className="ml-[52px] mb-2 flex items-center gap-1 text-sm text-green-500">
              <IcRepost size={14} />
              <span>{s.common_you_reposted}</span>
            </div>
          ) : null
        }
        actionIds={{
          retweet: 'search.post.retweet',
          like: 'search.post.like',
          bookmark: 'search.post.bookmark',
        }}
        onRetweetTrigger={setRetweetMenuPostId}
        onBookmarkAdded={() => setShowBookmarkToast(true)}
        showCounts
      />
    );
  };

  return (
    <div className="flex h-full flex-col bg-app-bg text-app-text pt-10">
      <div className="flex items-center gap-3 border-b border-app-border px-4 py-2">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-app-surface px-4 py-2">
          <IcTabSearch size={16} className="text-gray-500" />
          <input
            type="text"
            className="w-full border-none bg-transparent text-app-text outline-none placeholder-gray-400"
            placeholder={s.search_input_placeholder}
            autoFocus
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            data-action="search.query.input"
            data-action-type="input"
            data-action-params={JSON.stringify({ value: inputValue })}
          />
        </div>
        <button
          {...bindBack({
            beforeTrigger: () => {
              setInputValue('');
            },
          })}
          className="whitespace-nowrap font-bold text-app-text"
        >
          {s.search_input_cancel}
        </button>
      </div>

      {query ? (
        <>
          <div className="flex overflow-x-auto border-b border-app-border no-scrollbar">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`relative cursor-pointer whitespace-nowrap px-4 py-3 ${
                  activeTab === tab.id ? 'font-bold text-app-text' : 'text-gray-500'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-blue-500" />
                )}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
            {activeTab === 'people' ? (
              matchedUsers.length > 0 ? (
                matchedUsers.map(user => (
                  <div
                    key={user.id}
                    className="flex cursor-pointer items-center border-b border-app-border px-4 py-3 active:bg-gray-100"
                    {...bindTap('user.open.fromSearch', { params: { id: user.id } })}
                  >
                    <div className="mr-3 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-pink-600 font-bold text-white">
                          {user.name?.[0] ?? '?'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span className="truncate font-bold">{user.name}</span>
                            {user.verified ? <span className="text-blue-400">✓</span> : null}
                          </div>
                          <div className="truncate text-sm text-gray-500">{`@${user.id}`}</div>
                        </div>
                        <button
                          className={`rounded-full px-4 py-1.5 text-sm font-bold ${
                            isFollowing(user.id) ? 'border border-app-border text-app-text' : 'bg-app-text text-app-bg'
                          }`}
                          onClick={event => {
                            event.stopPropagation();
                            toggleFollow(user.id);
                          }}
                        >
                          {isFollowing(user.id) ? s.user_following_button : s.user_follow_button}
                        </button>
                      </div>
                      {user.bio ? <div className="mt-1 text-sm text-app-text">{user.bio}</div> : null}
                    </div>
                  </div>
                ))
              ) : (
                renderNoResults(s.search_results_empty)
              )
            ) : (
              <>
                {activeTab === 'hot' && matchedUsers.length > 0 && (
                  <div className="border-b border-app-border py-3">
                    <div className="mb-2 px-4 text-lg font-bold">{s.search_input_tab_people}</div>
                    <div className="flex gap-3 overflow-x-auto px-4 pb-2 no-scrollbar">
                      {matchedUsers.slice(0, 5).map(user => (
                        <div
                          key={user.id}
                          className="flex w-[150px] min-w-[150px] cursor-pointer flex-col overflow-hidden rounded-xl border border-app-border bg-app-surface"
                          {...bindTap('user.open.fromSearch', { params: { id: user.id } })}
                        >
                          <div className="relative h-16 bg-blue-500">
                            <div className="absolute bottom-[-20px] left-1/2 h-10 w-10 -translate-x-1/2 overflow-hidden rounded-full border-2 border-app-bg bg-gray-200">
                              {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col items-center px-2 pb-3 pt-6 text-center">
                            <div className="w-full truncate text-sm font-bold">{user.name}</div>
                            <div className="mb-2 w-full truncate text-xs text-gray-500">{`@${user.id}`}</div>
                            <button
                              className={`w-full rounded-full px-4 py-1 text-xs font-bold ${
                                isFollowing(user.id) ? 'border border-app-border text-app-text' : 'bg-app-text text-app-bg'
                              }`}
                              onClick={event => {
                                event.stopPropagation();
                                toggleFollow(user.id);
                              }}
                            >
                              {isFollowing(user.id) ? s.user_following_button : s.user_follow_button}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="cursor-pointer px-4 py-2 text-sm text-blue-400" onClick={() => setActiveTab('people')}>
                      {s.search_view_all}
                    </div>
                  </div>
                )}

                {(activeTab === 'video' || activeTab === 'photo') && displayedPosts.length === 0
                  ? renderNoResults()
                  : displayedPosts.map(post => renderPost(post))}

                {(activeTab === 'hot' || activeTab === 'latest') &&
                  displayedPosts.length === 0 &&
                  matchedUsers.length === 0 &&
                  renderNoResults()}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-lg font-bold">{s.search_recent_title}</div>
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-xs">×</div>
          </div>

          {recentSearches.map(item => (
            <div
              key={item.id}
              className="flex cursor-pointer items-center px-4 py-3 active:bg-gray-100"
              {...(item.type === 'user' && item.userId ? bindTap('user.open.fromSearch', { params: { id: item.userId } }) : {})}
            >
              {item.type === 'user' && item.user ? (
                <>
                  <div className="relative mr-3 h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
                    {item.user.avatar ? (
                      <img src={item.user.avatar} alt={item.user.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{item.user.name}</span>
                      {item.user.verified ? <span className="text-blue-400">✓</span> : null}
                    </div>
                    <div className="text-sm text-gray-500">{`@${item.user.id}`}</div>
                  </div>
                </>
              ) : (
                <div className="flex-1 font-bold">{item.keyword}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <XRetweetSheet
        postId={retweetMenuPostId}
        onClose={() => setRetweetMenuPostId(null)}
        onRetweet={toggleRetweet}
        onQuote={postId => {
          go('compose.open', { quotedPostId: postId });
        }}
        onViewActivity={postId => go('status.activity.open', { id: postId })}
      />
      <BookmarkToast visible={showBookmarkToast} onClose={() => setShowBookmarkToast(false)} />
    </div>
  );
};
