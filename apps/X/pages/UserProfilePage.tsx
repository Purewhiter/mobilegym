import React from 'react';
import { useParams } from 'react-router-dom';
import { useLocale } from '@/os/locale';
import { IcCalendar, IcBalloon, IcClose, IcLocation, IcRepost, IcStar, IcTabNotifications, IcUserMinus } from '../res/icons';
import { useXStore, selectEffectiveFollowedSet } from '../state';
import { useXAllUsers, useXRepliesLoaded, useXUserProfilePosts, useXUserReplies } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';
import { BookmarkToast } from '../components/BookmarkToast';
import { XRetweetSheet } from '../components/XRetweetSheet';
import { XTimelinePostCard } from '../components/XTimelinePostCard';
import { useElementHeight } from '../hooks/useElementHeight';
import { shouldShowProfileTopBar } from '../utils/topBarVisibility';

export const UserProfilePage: React.FC = () => {
  const { id } = useParams();
  const users = useXAllUsers();
  const userPosts = useXUserProfilePosts(id || '', 80);
  const toggleFollow = useXStore(s => s.toggleFollow);
  const followedSet = useXStore(selectEffectiveFollowedSet);
  const ensureRepliesLoaded = useXStore(s => s.ensureRepliesLoaded);
  const repliesLoaded = useXRepliesLoaded();
  const rawUserReplies = useXUserReplies(id || '', 80);
  const toggleRetweet = useXStore(s => s.toggleRetweet);
  const { bindBack, bindTap, go } = useXGestures();
  const s = useXStrings();
  const locale = useLocale();

  const user = (id ? users[id] : undefined) ?? null;
  const isFollowing = (userId: string) => followedSet.has(userId);
  const isFollowed = id ? isFollowing(id) : false;
  const [showFollowMenu, setShowFollowMenu] = React.useState(false);
  const [retweetMenuPostId, setRetweetMenuPostId] = React.useState<string | null>(null);
  const [showBookmarkToast, setShowBookmarkToast] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'posts' | 'replies' | 'subs' | 'videos' | 'photos' | 'articles'>('posts');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const scrollElRef = React.useRef<HTMLDivElement | null>(null);
  const tabsRowRef = React.useRef<HTMLDivElement | null>(null);
  const tabsThresholdRef = React.useRef(0);
  const topBarRef = React.useRef<HTMLDivElement | null>(null);
  const topBarHeight = useElementHeight(topBarRef, 96);
  const [isTopBarVisible, setIsTopBarVisible] = React.useState(false);

  // Loading 派生于 activeTab + repliesLoaded; effect 只触发懒加载, 不维护额外 state。
  const repliesLoading = activeTab === 'replies' && !!id && !repliesLoaded;

  React.useEffect(() => {
    if (!repliesLoading) return;
    ensureRepliesLoaded().catch(() => {});
  }, [ensureRepliesLoaded, repliesLoading]);

  const measureThreshold = React.useCallback(() => {
    const scrollEl = scrollElRef.current;
    const tabsEl = tabsRowRef.current;
    if (!scrollEl || !tabsEl) return;

    const scrollRect = scrollEl.getBoundingClientRect();
    const tabsRect = tabsEl.getBoundingClientRect();
    tabsThresholdRef.current = scrollEl.scrollTop + (tabsRect.top - scrollRect.top);
  }, []);

  React.useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;

    const scrollEl = rootEl.closest('[data-scroll-container="main"]') as HTMLDivElement | null;
    if (!scrollEl) return;
    scrollElRef.current = scrollEl;

    const updateVisibility = () => {
      const nextVisible = shouldShowProfileTopBar({
        scrollTop: scrollEl.scrollTop,
        threshold: tabsThresholdRef.current,
      });
      setIsTopBarVisible(prev => (prev === nextVisible ? prev : nextVisible));
    };

    const frameId = requestAnimationFrame(() => {
      measureThreshold();
      updateVisibility();
    });

    scrollEl.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', measureThreshold);

    return () => {
      cancelAnimationFrame(frameId);
      scrollEl.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', measureThreshold);
    };
  }, [measureThreshold]);

  const userReplies = React.useMemo(() => {
    if (activeTab !== 'replies' || !id || !user) return [];
    if (!repliesLoaded && repliesLoading) return [];
    if (!repliesLoaded) return [];
    return rawUserReplies;
  }, [activeTab, id, rawUserReplies, repliesLoaded, repliesLoading, user]);

  const tabs = [
    { id: 'posts', label: s.profile_tab_posts },
    { id: 'replies', label: s.profile_tab_replies },
    { id: 'subs', label: s.profile_tab_subs },
    { id: 'videos', label: s.profile_tab_videos },
    { id: 'photos', label: s.profile_tab_photos },
    { id: 'articles', label: s.profile_tab_articles },
  ] as const;

  if (!user) {
    return (
      <div className="flex flex-col bg-app-bg min-h-full text-app-text pb-20 pt-10 px-4">
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 bg-white/70 rounded-full flex items-center justify-center cursor-pointer" {...bindBack()}>
            ←
          </div>
          <div className="font-bold text-lg">{s.user_not_found_title}</div>
        </div>
        <div className="text-gray-400 mt-6">{s.user_not_found_desc}</div>
      </div>
    );
  }

  const userArticlesEmptyDesc = locale === 'en'
    ? `When ${`@${user.id}`} ${s.user_articles_empty_desc_tpl}`
    : `当 ${`@${user.id}`}${s.user_articles_empty_desc_tpl}`;

  const userSubsUnlockDesc = locale === 'en'
    ? `${`@${user.id}`} ${s.user_subs_unlock_desc_tpl}`
    : `${`@${user.id}`} ${s.user_subs_unlock_desc_tpl}`;
  const localizedUserArticlesEmptyDesc =
    locale === 'en'
      ? userArticlesEmptyDesc
      : `当 ${`@${user.id}`}${s.user_articles_empty_desc_tpl}`;

  return (
    <div ref={rootRef} className="flex flex-col bg-app-bg min-h-full text-app-text pb-20 pt-10">
      <div
        ref={topBarRef}
        className={`fixed top-0 left-0 right-0 z-50 pt-10 bg-app-bg/95 backdrop-blur transition-transform duration-200 ease-out ${
          isTopBarVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 bg-white/70 rounded-full flex items-center justify-center cursor-pointer" {...bindBack()}>
            ←
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base truncate">{user.name}</div>
            <div className="text-xs text-gray-500">{userPosts.length} {s.profile_tab_posts}</div>
          </div>
        </div>
      </div>

      <div className="h-32 bg-gray-200 relative">
        {user.banner ? <XImage src={user.banner} alt="Banner" className="w-full h-full object-cover" /> : null}
        <div className="absolute top-4 left-4 w-8 h-8 bg-white/70 rounded-full flex items-center justify-center cursor-pointer" {...bindBack()}>
          ←
        </div>
      </div>

      <div className="px-4 relative mb-4">
        <div className="w-20 h-20 rounded-full bg-app-bg absolute -top-10 border-4 border-app-bg overflow-hidden">
          {user.avatar ? (
            <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold text-2xl">
              {user.name[0]}
            </div>
          )}
        </div>
        <div className="flex justify-end pt-3">
          <button
            className={`rounded-full px-4 py-1.5 font-bold text-sm ${isFollowed ? 'bg-app-bg border border-app-border text-app-text' : 'bg-app-text text-app-bg'}`}
            {...bindTap(
              { kind: 'action', id: 'userProfile.user.follow' },
              {
                params: id ? { id } : undefined,
                onTrigger: () => {
                  if (!id) return;
                  if (isFollowed) {
                    setShowFollowMenu(true);
                  } else {
                    toggleFollow(id);
                  }
                },
              },
            )}
          >
            {isFollowed ? s.user_following_button : s.user_follow_button}
          </button>
        </div>

        <div className="mt-3">
          <div className="font-bold text-xl flex items-center gap-1">
            {user.name}
            {user.verified ? <span className="text-blue-400">✓</span> : null}
          </div>
          <div className="text-gray-500 text-sm">{`@${user.id}`}</div>
        </div>

        {user.bio ? <div className="mt-3 text-sm whitespace-pre-wrap">{user.bio}</div> : null}

        <div className="mt-3 flex items-center gap-4 text-gray-500 text-sm flex-wrap">
          {user.location ? (
            <span className="flex items-center gap-1">
              <IcLocation size={15} />
              {user.location}
            </span>
          ) : null}
          {user.birthDate ? (
            <span className="flex items-center gap-1">
              <IcBalloon size={15} />
              {user.birthDate}
            </span>
          ) : null}
          {user.joinDate ? (
            <span className="flex items-center gap-1">
              <IcCalendar size={15} />
              {user.joinDate}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="cursor-pointer active:opacity-50" onClick={() => go('connections.open', { id: id!, type: 'following' })}>
            <span className="font-bold text-app-text">{user.following}</span>{' '}
            <span className="text-gray-500">{s.profile_following_label}</span>
          </div>
          <div className="cursor-pointer active:opacity-50" onClick={() => go('connections.open', { id: id!, type: 'followers' })}>
            <span className="font-bold text-app-text">{user.followers}</span>{' '}
            <span className="text-gray-500">{s.profile_followers_label}</span>
          </div>
        </div>
      </div>

      <div
        ref={tabsRowRef}
        className="sticky z-40 flex border-b border-app-border mt-2 overflow-x-auto no-scrollbar bg-app-bg/95 backdrop-blur"
        style={{ top: isTopBarVisible ? topBarHeight : 0 }}
      >
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`flex-none px-4 py-3 text-center cursor-pointer relative ${activeTab === tab.id ? 'font-bold text-app-text' : 'text-gray-500'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full mx-2" />}
          </div>
        ))}
      </div>

      <div>
        {activeTab === 'subs' ? (
          <div className="p-8 text-center flex flex-col items-center">
            <div className="font-bold text-xl mb-2">{s.user_subs_unlock_title}</div>
            <div className="text-gray-500 mb-6 text-sm">{userSubsUnlockDesc}</div>
            <button className="bg-app-text text-app-bg px-8 py-2.5 rounded-full font-bold text-sm">{s.user_subs_button}</button>
          </div>
        ) : activeTab === 'articles' ? (
          <div className="p-10 text-center text-gray-500">
            <div className="font-bold text-lg text-app-text mb-2">{s.user_articles_empty_title}</div>
            <div className="text-sm">{localizedUserArticlesEmptyDesc}</div>
          </div>
        ) : activeTab === 'replies' ? (
          repliesLoading ? (
            <div className="p-10 text-center text-gray-500">{s.post_loading_replies}</div>
          ) : userReplies.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <div className="font-bold text-lg text-app-text mb-2">{s.user_replies_empty}</div>
            </div>
          ) : (
            userReplies.map(({ reply, parent }) => (
              <div
                key={reply.id}
                className="border-b border-app-border p-4 active:bg-black/5 cursor-pointer transition-colors"
                {...bindTap('post.open', { params: { id: reply.id } })}
              >
                {parent && (
                  <div className="flex mb-1 relative">
                    <div className="flex flex-col items-center mr-3 w-10 shrink-0 relative">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 cursor-pointer z-10" {...bindTap('user.open.fromPost', { params: { id: parent.authorId }, stopPropagation: true })}>
                        {parent.author?.avatar ? <XImage src={parent.author.avatar} alt={parent.author.name} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="w-0.5 bg-gray-300 absolute left-1/2 -translate-x-1/2 top-8 -bottom-4 z-0" />
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center text-gray-500 text-sm flex-wrap">
                        <span className="font-bold text-app-text mr-1">{parent.author?.name}</span>
                        <span className="mr-1">{parent.author?.id ? `@${parent.author.id}` : ''}</span>
                        <span>· {parent.time}</span>
                      </div>
                      <div className="mt-0.5 text-app-text whitespace-pre-wrap text-sm line-clamp-3">{parent.content}</div>
                    </div>
                  </div>
                )}
                <div className="flex relative z-10">
                  <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0 cursor-pointer relative z-10" {...bindTap('user.open.fromPost', { params: { id: reply.authorId }, stopPropagation: true })}>
                    {user.avatar ? <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center text-gray-500 text-sm flex-wrap">
                      <span className="font-bold text-app-text mr-1">{user.name}</span>
                      {user.verified && <span className="text-blue-400 mr-1">✓</span>}
                      <span className="mr-1">{`@${user.id}`}</span>
                      <span>· {reply.time}</span>
                    </div>
                    <div className="mt-1 text-app-text whitespace-pre-wrap">{reply.content}</div>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          (() => {
            let displayPosts = userPosts;
            if (activeTab === 'videos') {
              displayPosts = userPosts.filter(post => post.video);
            } else if (activeTab === 'photos') {
              displayPosts = userPosts.filter(post => post.image && !post.video);
            }

            if (displayPosts.length === 0) {
              const emptyTitle = activeTab === 'videos'
                ? s.user_videos_empty
                : activeTab === 'photos'
                  ? s.user_photos_empty
                  : s.user_content_empty;

              return (
                <div className="p-10 text-center text-gray-500">
                  <div className="font-bold text-lg text-app-text mb-2">{emptyTitle}</div>
                </div>
              );
            }

            return displayPosts.map(post => (
              <XTimelinePostCard
                key={post.id}
                post={post}
                actionIds={{
                  retweet: 'userProfile.post.retweet',
                  like: 'userProfile.post.like',
                  bookmark: 'userProfile.post.bookmark',
                  share: 'userProfile.post.share',
                }}
                topContent={
                  post.retweetedPost ? (
                    <div className="ml-[52px] mb-2 flex items-center gap-1 text-sm text-green-500">
                      <IcRepost size={14} />
                      <span>{s.common_you_reposted}</span>
                    </div>
                  ) : null
                }
                onRetweetTrigger={setRetweetMenuPostId}
                onBookmarkAdded={() => setShowBookmarkToast(true)}
              />
            ));
          })()
        )}
      </div>

      {showFollowMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFollowMenu(false)} />
          <div className="relative bg-white text-black w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in-0 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-lg">{`@${user.id}`}</div>
              <button onClick={() => setShowFollowMenu(false)} className="p-1 rounded-full hover:bg-gray-100" aria-label={s.follow_menu_close_aria_label}>
                <IcClose size={20} />
              </button>
            </div>

            <div className="p-2">
              <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl text-left transition-colors">
                <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                  <IcStar size={20} fill="currentColor" />
                </div>
                <div>
                  <div className="font-bold text-base">{s.follow_menu_subscribe}</div>
                  <div className="text-xs text-gray-500">{s.follow_menu_subscribe_desc}</div>
                </div>
              </button>

              <button className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl text-left transition-colors">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                  <IcTabNotifications size={20} />
                </div>
                <div>
                  <div className="font-bold text-base">{s.follow_menu_notifications}</div>
                  <div className="text-xs text-gray-500">{s.follow_menu_notifications_desc}</div>
                </div>
              </button>

              <div className="my-1 border-t border-gray-100" />

              <button
                className="w-full flex items-center gap-3 p-3 hover:bg-red-50 rounded-xl text-left transition-colors text-red-600"
                onClick={() => {
                  if (id) toggleFollow(id);
                  setShowFollowMenu(false);
                }}
              >
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <IcUserMinus size={20} />
                </div>
                <div className="font-bold text-base">{s.follow_menu_unfollow}</div>
              </button>
            </div>
          </div>
        </div>
      )}

      <XRetweetSheet
        postId={retweetMenuPostId}
        onClose={() => setRetweetMenuPostId(null)}
        onRetweet={toggleRetweet}
        onQuote={(postId) => {
          go('compose.open', { quotedPostId: postId });
        }}
        onViewActivity={(postId) => go('status.activity.open', { id: postId })}
      />

      <BookmarkToast visible={showBookmarkToast} onClose={() => setShowBookmarkToast(false)} />
    </div>
  );
};
