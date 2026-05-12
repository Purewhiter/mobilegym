import React from 'react';
import { useXGestures } from '../hooks/useXGestures';
import { useXStore } from '../state';
import { IcMessage, IcRepost, IcHeart, IcChart, IcBookmark, IcShare } from '../res/icons';
import type { XPost } from '../types';

export interface XPostActionIds {
  retweet: string;
  like: string;
  bookmark?: string;
  share?: string;
}

interface XPostActionBarProps {
  postId: string;
  stats?: Partial<XPost['stats']>;
  actionIds: XPostActionIds;
  isActive?: boolean;
  showCounts?: boolean;
  showBookmark?: boolean;
  iconSize?: number;
  onRetweetTrigger?: (postId: string) => void;
  onBookmarkAdded?: (postId: string) => void;
  className?: string;
}

export const XPostActionBar: React.FC<XPostActionBarProps> = ({
  postId,
  stats,
  actionIds,
  isActive = true,
  showCounts,
  showBookmark = true,
  iconSize = 18,
  onRetweetTrigger,
  onBookmarkAdded,
  className = '',
}) => {
  const toggleLike = useXStore(s => s.toggleLike);
  const likedPostIds = useXStore(s => s.user.likedPostIds);
  const toggleRetweet = useXStore(s => s.toggleRetweet);
  const retweetedPostIds = useXStore(s => s.user.retweetedPostIds);
  const toggleBookmark = useXStore(s => s.toggleBookmark);
  const bookmarkedPostIds = useXStore(s => s.user.bookmarkedPostIds);
  const defaultShowCounts = useXStore(s => s.settings.showInteractionCounts);
  const { bindTap } = useXGestures(isActive);

  const resolvedShowCounts = showCounts ?? defaultShowCounts;
  const comments = stats?.comments ?? 0;
  const retweets = stats?.retweets ?? 0;
  const likes = stats?.likes ?? 0;
  const views = stats?.views ?? 0;
  // 调用方必须传源帖 id; HomePage/ProfilePage 都已 sourcePost = post.retweetedPost ?? post。
  const isLiked = likedPostIds.includes(postId);
  const isRetweeted = retweetedPostIds.includes(postId);
  const isBookmarked = bookmarkedPostIds.includes(postId);

  return (
    <div className={`flex justify-between mt-3 text-gray-500 text-sm max-w-[450px] ${className}`.trim()}>
      <div
        className="flex items-center gap-1 group cursor-pointer hover:text-blue-400 transition-colors relative z-10"
        {...bindTap('reply.open', {
          params: { id: postId },
          stopPropagation: true,
        })}
      >
        <div className="p-2 -ml-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
          <IcMessage size={iconSize} />
        </div>
        {resolvedShowCounts ? <span className="text-xs group-hover:text-blue-400">{comments}</span> : null}
      </div>

      <div
        className="flex items-center gap-1 group cursor-pointer hover:text-green-400 transition-colors relative z-10"
        {...bindTap(
          { kind: 'action', id: actionIds.retweet },
          {
            params: { id: postId },
            stopPropagation: true,
            onTrigger: () => {
              if (onRetweetTrigger) {
                onRetweetTrigger(postId);
              } else {
                toggleRetweet(postId);
              }
            },
          },
        )}
      >
        <div className={`p-2 -ml-2 rounded-full group-hover:bg-green-500/10 transition-colors ${isRetweeted ? 'text-green-500' : ''}`}>
          <IcRepost size={iconSize} />
        </div>
        {resolvedShowCounts ? (
          <span className={`text-xs group-hover:text-green-400 ${isRetweeted ? 'text-green-500' : ''}`}>
            {retweets}
          </span>
        ) : null}
      </div>

      <div
        className="flex items-center gap-1 group cursor-pointer hover:text-pink-400 transition-colors relative z-10"
        {...bindTap(
          { kind: 'action', id: actionIds.like },
          {
            params: { id: postId },
            stopPropagation: true,
            onTrigger: () => toggleLike(postId),
          },
        )}
      >
        <div className={`p-2 -ml-2 rounded-full group-hover:bg-pink-500/10 transition-colors ${isLiked ? 'text-pink-600' : ''}`}>
          <IcHeart size={iconSize} fill={isLiked ? 'currentColor' : 'none'} />
        </div>
        {resolvedShowCounts ? (
          <span className={`text-xs group-hover:text-pink-400 ${isLiked ? 'text-pink-600' : ''}`}>
            {likes}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-1 group cursor-default text-gray-600">
        <div className="p-2 -ml-2">
          <IcChart size={iconSize} />
        </div>
        {resolvedShowCounts ? <span className="text-xs">{views}</span> : null}
      </div>

      {showBookmark && actionIds.bookmark ? (
        <div
          className="flex items-center gap-1 group cursor-pointer hover:text-blue-400 transition-colors relative z-10"
          {...bindTap(
            { kind: 'action', id: actionIds.bookmark },
            {
              params: { id: postId },
              stopPropagation: true,
              onTrigger: () => {
                if (!isBookmarked) onBookmarkAdded?.(postId);
                toggleBookmark(postId);
              },
            },
          )}
        >
          <div className={`p-2 -ml-2 rounded-full group-hover:bg-blue-500/10 transition-colors ${isBookmarked ? 'text-blue-500' : ''}`}>
            <IcBookmark size={iconSize} fill={isBookmarked ? 'currentColor' : 'none'} />
          </div>
        </div>
      ) : null}

      {actionIds.share ? (
        <div
          className="flex items-center gap-1 group cursor-pointer hover:text-blue-400 transition-colors relative z-10"
          {...bindTap(
            { kind: 'action', id: actionIds.share },
            {
              params: { id: postId },
              stopPropagation: true,
              onTrigger: () => {},
            },
          )}
        >
          <div className="p-2 -ml-2 rounded-full group-hover:bg-blue-500/10 transition-colors">
            <IcShare size={iconSize} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
