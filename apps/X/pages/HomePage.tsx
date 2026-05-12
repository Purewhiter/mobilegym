import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IcRepost } from '../res/icons';
import { useXStore, selectEffectiveFollowedSet, selectUser } from '../state';
import { useXHomeTimelines } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';
import { BookmarkToast } from '../components/BookmarkToast';
import { XRetweetSheet } from '../components/XRetweetSheet';
import { XTimelinePostCard } from '../components/XTimelinePostCard';
import { useElementHeight } from '../hooks/useElementHeight';
import { useVirtualList } from '../../../os/hooks/useVirtualList';
import { getNextTimelineTopBarVisibility } from '../utils/topBarVisibility';

export const HomePage: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
  const { forYou: posts, following: followingPosts } = useXHomeTimelines();
  const user = useXStore(selectUser);
  const followedSet = useXStore(selectEffectiveFollowedSet);
  const toggleFollow = useXStore(s => s.toggleFollow);
  const toggleRetweet = useXStore(s => s.toggleRetweet);
  const location = useLocation();
  const { bindTap, go } = useXGestures(isActive);
  const s = useXStrings();
  const [retweetMenuPostId, setRetweetMenuPostId] = useState<string | null>(null);
  const [showBookmarkToast, setShowBookmarkToast] = useState(false);
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const topBarHeight = useElementHeight(topBarRef, 96);
  const isTopBarVisibleRef = useRef(isTopBarVisible);
  isTopBarVisibleRef.current = isTopBarVisible;

  const searchParams = new URLSearchParams(location.search);
  const isOnHome = location.pathname === '/';
  const tab = searchParams.get('tab');
  const activeTab: 'foryou' | 'following' =
    isOnHome && (tab === 'foryou' || tab === 'following') ? tab : 'foryou';

  const displayPosts = activeTab === 'foryou' ? posts : followingPosts;
  const isFollowing = (userId: string) => followedSet.has(userId);
  const { parentRef, virtualizer, virtualItems, totalSize } = useVirtualList({
    items: displayPosts,
    estimateSize: () => 200,
    overscan: 5,
    paddingStart: topBarHeight,
    paddingEnd: 32,
    getItemKey: (index, item) => item.id || `post-${index}`,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
    virtualizer.scrollToOffset(0);
  }, [activeTab, parentRef, virtualizer]);

  const lastScrollTopRef = useRef(0);
  const isTickingRef = useRef(false);
  const onScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el || isTickingRef.current) return;

    isTickingRef.current = true;
    requestAnimationFrame(() => {
      const currentTop = el.scrollTop;
      const nextVisible = getNextTimelineTopBarVisibility({
        currentTop,
        previousTop: lastScrollTopRef.current,
        isVisible: isTopBarVisibleRef.current,
      });

      if (nextVisible !== isTopBarVisibleRef.current) {
        setIsTopBarVisible(nextVisible);
      }

      lastScrollTopRef.current = currentTop;
      isTickingRef.current = false;
    });
  }, [parentRef]);

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text relative">
      <div
        ref={topBarRef}
        className={`fixed top-0 left-0 right-0 z-40 pt-10 bg-app-bg/95 backdrop-blur transition-transform duration-200 ease-out ${
          isTopBarVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden cursor-pointer" {...bindTap('home.drawer.open')}>
            {user.avatar ? (
              <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
                {user.name[0]}
              </div>
            )}
          </div>
          <div className="font-bold text-lg">X</div>
          <div className="w-8" />
        </div>

        <div className="flex border-b border-app-border">
          <div
            className={`flex-1 text-center py-3 cursor-pointer hover:bg-black/5 transition relative ${activeTab === 'foryou' ? 'font-bold' : 'text-gray-500'}`}
            {...bindTap('home.feed.tab.toForyou')}
          >
            {s.home_tab_foryou}
            {activeTab === 'foryou' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />}
          </div>
          <div
            className={`flex-1 text-center py-3 cursor-pointer hover:bg-black/5 transition relative ${activeTab === 'following' ? 'font-bold' : 'text-gray-500'}`}
            {...bindTap('home.feed.tab.toFollowing')}
          >
            {s.home_tab_following}
            {activeTab === 'following' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />}
          </div>
        </div>
      </div>

      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto pb-20"
        data-scroll-container="main"
        data-scroll-direction="vertical"
        onScroll={onScroll}
      >
        <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
          {virtualItems.map(item => {
            const post = displayPosts[item.index];
            if (!post) return null;

            const sourcePost = post.retweetedPost ?? post;
            const sourceAuthorId = sourcePost.authorId;
            const isRetweetShell = Boolean(post.retweetedPost);

            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <XTimelinePostCard
                  post={sourcePost}
                  isActive={isActive}
                  topContent={
                    isRetweetShell ? (
                      <div className="ml-[52px] mb-2 flex items-center gap-1 text-sm text-green-500">
                        <IcRepost size={14} />
                        <span>{post.author.name} {s.retweet_sheet_retweet}</span>
                      </div>
                    ) : null
                  }
                  actionIds={{
                    retweet: activeTab === 'foryou' ? 'home.foryou.post.retweet' : 'home.following.post.retweet',
                    like: activeTab === 'foryou' ? 'home.foryou.post.like' : 'home.following.post.like',
                    bookmark: activeTab === 'foryou' ? 'home.foryou.post.bookmark' : 'home.following.post.bookmark',
                    share: activeTab === 'foryou' ? 'home.foryou.post.share' : 'home.following.post.share',
                  }}
                  onRetweetTrigger={setRetweetMenuPostId}
                  onBookmarkAdded={() => setShowBookmarkToast(true)}
                  headerRight={
                    activeTab === 'foryou' && !isFollowing(sourceAuthorId) && sourceAuthorId !== user.id ? (
                      <button
                        className="text-blue-400 text-xs font-bold px-2 py-1 rounded-full hover:bg-blue-500/10 transition-colors relative z-10 shrink-0"
                        {...bindTap(
                          { kind: 'action', id: 'home.foryou.user.follow' },
                          {
                            params: { id: sourceAuthorId },
                            stopPropagation: true,
                            onTrigger: () => toggleFollow(sourceAuthorId),
                          },
                        )}
                      >
                        {s.home_follow_button}
                      </button>
                    ) : null
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      <div
        {...bindTap('compose.open')}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-3xl shadow-lg cursor-pointer z-50"
      >
        +
      </div>

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
