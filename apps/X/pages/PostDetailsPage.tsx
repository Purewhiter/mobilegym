import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useXStore, selectUser } from '../state';
import { useXHydratedPosts, useXAllUsers, useXRepliesForPost, useXRepliesLoaded, useXResolvedPost } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { XImage, XVideo } from '../components/XMedia';
import { BookmarkToast } from '../components/BookmarkToast';
import { XRetweetSheet } from '../components/XRetweetSheet';
import { XPostActionBar } from '../components/XPostActionBar';
import { useXStrings } from '../hooks/useXStrings';
import {
  IcMore, IcChevronDown, IcCheck, IcClose,
} from '../res/icons';
import type { XPost } from '../types';
import { parseXTimeToMinutes } from '../utils/formatTime';

export const PostDetailsPage: React.FC = () => {
  const { id } = useParams();
  const location = useLocation();
  const posts = useXHydratedPosts();
  const resolvedPost = useXResolvedPost(id || '');
  const user = useXStore(selectUser);
  // 顶层一次订阅 user 字典, 传给所有 ReplyItem, 避免每条回复独立订阅。
  const allUsers = useXAllUsers();
  const toggleRetweet = useXStore(s => s.toggleRetweet);
  const repliesLoaded = useXRepliesLoaded();
  const ensureRepliesLoaded = useXStore(s => s.ensureRepliesLoaded);
  const repliesForRoutePost = useXRepliesForPost(id || '');
  const { bindBack, bindTap, go } = useXGestures();
  const s = useXStrings();
  const [sortMethod, setSortMethod] = React.useState<'relevant' | 'recent' | 'likes'>('relevant');
  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const [retweetMenuPostId, setRetweetMenuPostId] = React.useState<string | null>(null);
  const [showBookmarkToast, setShowBookmarkToast] = React.useState(false);
  // Loading 完全派生于 (id 形态 + loader cache 状态), 不引入额外 useState 状态,
  // 因此路由参数切换时不会有 stale loading/empty 闪现。
  const repliesLoading = !!id && !id.startsWith('mock_') && !repliesLoaded;

  React.useEffect(() => {
    if (!repliesLoading) return;
    // loader 内部有 in-flight 去重 + 加载完 bump baseSnapshot 触发 useXRepliesLoaded() 重渲染。
    ensureRepliesLoaded().catch(() => {});
  }, [ensureRepliesLoaded, repliesLoading]);

  const post = React.useMemo(() => {
    if (resolvedPost) return resolvedPost;

    const dynamicReplies = posts.filter(p => p.threadId === id);

    if (id?.startsWith('mock_')) {
      const state = location.state as { quotedPostId?: string };
      const quotedPostId = state?.quotedPostId;
      const quotedPost = quotedPostId ? posts.find(p => p.id === quotedPostId) : undefined;

      const mockAuthorId = id.includes('1') ? 'fotobeek' : 'cb_doge';
      return {
        id,
        authorId: mockAuthorId,
        content: id.includes('1')
          ? "Utter bullshit, X is an ultraright propaganda platform.\nMusk is a manipulator.\nIt has nothing to do with objective journalism."
          : "X is the only platform you can trust for honest information. All the others are bought and paid for.",
        time: '1h',
        author: {
          id: mockAuthorId,
          name: id.includes('1') ? 'John ter Beek 🌶️' : 'DogeDesigner',
          avatar: id.includes('1')
            ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=John'
            : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Doge',
          verified: true,
          following: 100,
          followers: 200,
        },
        stats: { comments: 12 + dynamicReplies.length, retweets: 34, likes: 56, views: 7890 },
        quotedPost,
        quotedPostId,
        replies: dynamicReplies,
      } as any;
    }
    return undefined;
  }, [resolvedPost, posts, id, location.state]);

  const mergedReplies = React.useMemo(() => {
    if (!post?.id) return [];

    const dynamicReplies = posts.filter(p => p.threadId === post.id);
    const importedReplies = post.id.startsWith('mock_')
      ? ((post as any).replies || [])
      : (Array.isArray(post.replies) ? post.replies : repliesForRoutePost);

    const combined = [...importedReplies, ...dynamicReplies];
    const seen = new Set<string>();
    const unique: any[] = [];
    for (const r of combined) {
      if (!r || typeof (r as any).id !== 'string') continue;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      unique.push(r);
    }
    return unique;
  }, [post, posts, repliesForRoutePost]);

  const sortedReplies = React.useMemo(() => {
    const replies = [...mergedReplies];
    if (sortMethod === 'recent') return replies.sort((a, b) => parseXTimeToMinutes(a.time) - parseXTimeToMinutes(b.time));
    if (sortMethod === 'likes') return replies.sort((a, b) => b.stats.likes - a.stats.likes);
    return replies;
  }, [mergedReplies, sortMethod]);

  const getSortLabel = (method: string) => {
    if (method === 'recent') return s.post_sort_recent;
    if (method === 'likes') return s.post_sort_likes;
    return s.post_sort_relevant;
  };

  if (!post) {
    // Reply id 深链 (r_p_xxx) 进入时, post 解析依赖 replies map 加载完成;
    // 加载中显示 loading 占位, 避免错误闪现 "未找到帖子"。
    return (
      <div className="flex flex-col bg-app-bg min-h-full text-app-text pt-10 px-4">
        <div className="flex items-center py-2">
          <button className="text-app-text mr-4" {...bindBack()}>←</button>
          <div className="font-bold text-lg">{s.post_title}</div>
        </div>
        <div className="mt-6 text-gray-500">
          {repliesLoading ? s.post_loading_replies : s.post_not_found}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-app-bg text-app-text pt-10 pb-20">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-app-border sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <button className="text-app-text mr-6" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current">
            <g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g>
          </svg>
        </button>
        <div className="font-bold text-lg">{s.post_title}</div>
      </div>

      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {/* Main Post */}
        <div className="px-4 pt-4 pb-2 border-b border-app-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div
                className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden"
                {...bindTap('user.open.fromPost', { params: { id: post.authorId } })}
              >
                {post.author.avatar
                  ? <XImage src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />
                  : null}
              </div>
              <div className="flex flex-col">
                <div className="font-bold text-app-text flex items-center">
                  {post.author.name}
                  {post.author.verified && <span className="text-blue-400 ml-1">✓</span>}
                </div>
                <div className="text-gray-500 text-sm">{`@${post.author.id}`}</div>
              </div>
            </div>
            <button className="text-gray-500" aria-label="More options">
              <IcMore size={20} />
            </button>
          </div>

          <div className="text-app-text text-lg whitespace-pre-wrap mb-3 leading-normal">{post.content}</div>

          {post.image && (
            <div className="mb-3 rounded-xl overflow-hidden border border-app-border w-full">
              <XImage src={post.image} alt="Post image" className="w-full h-auto object-cover max-h-(--app-feed-image-max-height)" />
            </div>
          )}

          {post.video && (
            <div className="mb-3 rounded-xl overflow-hidden border border-app-border w-full">
              <XVideo src={post.video} className="w-full h-auto max-h-(--app-feed-image-max-height)" />
            </div>
          )}

          {post.quotedPost && (
            <div
              className="mb-3 rounded-xl overflow-hidden border border-app-border w-full p-3 cursor-pointer active:bg-gray-100/50"
              {...bindTap('status.open', { params: { id: post.quotedPost.id } })}
            >
              <div className="flex items-center gap-1 mb-1">
                <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden">
                  {post.quotedPost.author.avatar && (
                    <XImage src={post.quotedPost.author.avatar} alt={post.quotedPost.author.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <span className="font-bold text-sm text-app-text">{post.quotedPost.author.name}</span>
                <span className="text-gray-500 text-sm">{`@${post.quotedPost.author.id}`}</span>
                <span className="text-gray-500 text-sm">· {post.quotedPost.time}</span>
              </div>
              <div className="text-app-text text-sm line-clamp-3">{post.quotedPost.content}</div>
            </div>
          )}

          <div
            className="text-gray-500 text-sm py-3 border-b border-app-border active:bg-black/5 cursor-pointer"
            {...bindTap('status.activity.open', { params: { id: post.id } })}
          >
            {post.time} · {post.stats.views} {s.post_views_suffix}
          </div>

          <div className="py-3 border-b border-app-border px-4">
            <XPostActionBar
              postId={post.id}
              stats={post.stats}
              actionIds={{
                retweet: 'post.item.retweet',
                like: 'status.post.like',
                bookmark: 'status.post.bookmark',
                share: 'post.item.share',
              }}
              showCounts
              className="mt-0 max-w-none"
              onRetweetTrigger={setRetweetMenuPostId}
              onBookmarkAdded={() => setShowBookmarkToast(true)}
            />
          </div>

          {/* Sorting Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-app-border">
            <div
              className="flex items-center gap-1 font-bold text-app-text cursor-pointer"
              onClick={() => setShowSortMenu(true)}
            >
              <span>{getSortLabel(sortMethod)}</span>
              <IcChevronDown size={16} />
            </div>
            <div className="text-gray-500 text-sm flex items-center gap-1 cursor-pointer active:opacity-60">
              <span>{s.post_view_quotes}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
                <g><path d="M17.207 11.293l-7.5-7.5c-.39-.39-1.023-.39-1.414 0s-.39 1.023 0 1.414L15.086 12l-6.793 6.793c-.39.39-.39 1.023 0 1.414.195.195.45.293.707.293s.512-.098.707-.293l7.5-7.5c.39-.39.39-1.023 0-1.414z" /></g>
              </svg>
            </div>
          </div>
        </div>

        {/* Replies List — loading / list / empty 三态互斥 */}
        <div className="pb-20">
          {!repliesLoaded && repliesLoading ? (
            <div className="p-6 text-center text-gray-500">{s.post_loading_replies}</div>
          ) : sortedReplies.length > 0 ? (
            sortedReplies.map((reply: XPost) => (
              <ReplyItem key={reply.id} reply={reply} onRetweet={setRetweetMenuPostId} users={allUsers} />
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">{s.post_no_replies}</div>
          )}
        </div>
      </div>

      {/* Sort Menu Bottom Sheet */}
      {showSortMenu && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSortMenu(false)} />
          <div className="relative bg-white text-black w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in-0 duration-200">
            <div className="p-4 border-b border-gray-100 relative">
              <div className="font-bold text-lg text-center">{s.post_sort_replies}</div>
              <button
                onClick={() => setShowSortMenu(false)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
                aria-label={s.follow_menu_close_aria_label}
              >
                <IcClose size={20} />
              </button>
            </div>
            <div className="p-2">
              {(['recent', 'relevant', 'likes'] as const).map(id => (
                <button
                  key={id}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors"
                  onClick={() => { setSortMethod(id); setShowSortMenu(false); }}
                >
                  <span className="font-bold text-base">{getSortLabel(id)}</span>
                  {sortMethod === id
                    ? <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center"><IcCheck size={12} className="text-white" strokeWidth={3} /></div>
                    : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  }
                </button>
              ))}
            </div>
            <div className="p-2 pt-0">
              <button
                className="w-full py-3.5 font-bold rounded-full bg-gray-100 active:bg-gray-200 transition-colors"
                onClick={() => setShowSortMenu(false)}
              >
                {s.common_cancel}
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

      {/* Fixed Bottom Reply Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-app-border bg-app-bg z-40">
        <div
          className="flex items-center px-4 py-2"
          {...bindTap('reply.open', { params: { id: post.id } })}
        >
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-3 shrink-0">
            {user.avatar
              ? <XImage src={user.avatar} alt="Current user avatar" className="w-full h-full object-cover" />
              : null}
          </div>
          <div className="flex-1 bg-app-surface rounded-full h-9 flex items-center px-4 text-gray-500">
            {s.post_reply_placeholder}
          </div>
        </div>
      </div>

      <BookmarkToast visible={showBookmarkToast} onClose={() => setShowBookmarkToast(false)} />
    </div>
  );
};

interface ReplyItemProps {
  reply: XPost & { author?: { id: string; name: string; avatar?: string; verified?: boolean } };
  onRetweet: (id: string) => void;
  // Parent 一次性传入用户字典, 避免每个回复实例各自订阅整个 user table。
  users: Record<string, any>;
}

const ReplyItem: React.FC<ReplyItemProps> = ({ reply, onRetweet, users }) => {
  const { bindTap } = useXGestures();
  const author = reply.author ?? users[reply.authorId];

  return (
    <div className="border-b border-app-border p-4 flex">
      <div
        className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0"
        {...bindTap('user.open.fromPost', { params: { id: reply.authorId } })}
      >
        {author?.avatar
          ? <XImage src={author.avatar} alt={author.name} className="w-full h-full object-cover" />
          : null}
      </div>
      <div className="flex-1">
        <div className="flex items-center text-gray-500 text-sm">
          <span className="font-bold text-app-text mr-1">{author?.name ?? 'Unknown'}</span>
          {author?.verified && <span className="text-blue-400 mr-1">✓</span>}
          <span className="mr-1">{author?.id ? `@${author.id}` : '@unknown'}</span>
          <span>· {reply.time}</span>
        </div>
        <div className="mt-1 text-app-text whitespace-pre-wrap">{reply.content}</div>

        <XPostActionBar
          postId={reply.id}
          stats={reply.stats}
          actionIds={{
            retweet: 'post.item.retweet',
            like: 'post.item.like',
          }}
          showCounts
          showBookmark={false}
          iconSize={16}
          className="mt-3 max-w-[300px]"
          onRetweetTrigger={onRetweet}
        />

        {/* Nested Replies */}
        {reply.replies && reply.replies.length > 0 && (
          <div className="mt-3">
            {reply.replies.map(subReply => (
              <ReplyItem key={subReply.id} reply={subReply} onRetweet={onRetweet} users={users} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
