import React from 'react';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage, XVideo } from './XMedia';
import { XPostActionBar, type XPostActionIds } from './XPostActionBar';
import type { XPost } from '../types';

type TimelineAuthor = {
  id?: string;
  name?: string;
  avatar?: string;
  verified?: boolean;
};

type TimelineQuotedPost = Partial<XPost> & {
  id: string;
  content?: string;
  time?: string;
  author?: TimelineAuthor;
};

export type XTimelinePost = XPost & {
  author?: TimelineAuthor;
  quotedPost?: TimelineQuotedPost;
  replyToUserId?: string;
};

interface XTimelinePostCardProps {
  post: XTimelinePost;
  actionIds: XPostActionIds;
  isActive?: boolean;
  headerRight?: React.ReactNode;
  topContent?: React.ReactNode;
  onRetweetTrigger?: (postId: string) => void;
  onBookmarkAdded?: (postId: string) => void;
  showCounts?: boolean;
}

export const XTimelinePostCard: React.FC<XTimelinePostCardProps> = ({
  post,
  actionIds,
  isActive = true,
  headerRight,
  topContent,
  onRetweetTrigger,
  onBookmarkAdded,
  showCounts,
}) => {
  const { bindTap } = useXGestures(isActive);
  const s = useXStrings();
  const authorName = post.author?.name ?? 'Unknown';
  const authorHandle = post.author?.id ? `@${post.author.id}` : '@unknown';

  return (
    <div className="border-b border-app-border p-4 active:bg-black/5 cursor-pointer transition-colors" {...bindTap('post.open', { params: { id: post.id } })}>
      {topContent}

      <div className="flex">
        <div
          className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0 cursor-pointer relative z-10"
          {...bindTap('user.open.fromPost', {
            params: { id: post.authorId },
            stopPropagation: true,
          })}
        >
          {post.author?.avatar ? (
            <XImage src={post.author.avatar} alt={authorName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
              {authorName[0] ?? '?'}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center text-gray-500 text-sm flex-wrap">
              <span className="font-bold text-app-text mr-1">{authorName}</span>
              {post.author?.verified ? <span className="text-blue-400 mr-1">✓</span> : null}
              <span className="mr-1">{authorHandle}</span>
              <span>· {post.time}</span>
            </div>
            {headerRight}
          </div>

          {post.replyToUserId ? (
            <div className="text-gray-500 text-sm mt-0.5">
              {s.reply_to_prefix}
              <span className="text-blue-400">{`@${post.replyToUserId}`}</span>
            </div>
          ) : null}

          <div className="mt-1 text-app-text whitespace-pre-wrap">{post.content}</div>

          {post.image && !post.video ? (
            <div className="mt-2 rounded-xl overflow-hidden border border-app-border bg-app-surface w-full">
              <XImage src={post.image} alt="Post image" className="w-full h-auto object-cover max-h-(--app-feed-image-max-height)" />
            </div>
          ) : null}

          {post.video ? (
            <div className="mt-2 rounded-xl overflow-hidden border border-app-border bg-app-surface w-full">
              <XVideo src={post.video} poster={post.image} active={isActive} className="w-full h-auto max-h-(--app-feed-image-max-height)" />
            </div>
          ) : null}

          {post.quotedPost ? (
            <div className="mt-2 rounded-xl border border-app-border overflow-hidden">
              <div className="p-3 bg-app-surface">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                    {post.quotedPost.author?.avatar ? (
                      <XImage src={post.quotedPost.author.avatar} alt={post.quotedPost.author.name ?? 'Unknown'} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm text-app-text truncate">{post.quotedPost.author?.name ?? 'Unknown'}</span>
                      {post.quotedPost.author?.verified && <span className="text-blue-400 text-xs">✓</span>}
                    </div>
                    <div className="text-gray-500 text-xs">{post.quotedPost.author?.id ? `@${post.quotedPost.author.id}` : '@unknown'}</div>
                  </div>
                </div>
                <div className="text-app-text text-sm line-clamp-4 whitespace-pre-wrap">{post.quotedPost.content}</div>
              </div>
            </div>
          ) : null}

          <XPostActionBar
            postId={post.id}
            stats={post.stats}
            actionIds={actionIds}
            isActive={isActive}
            onRetweetTrigger={onRetweetTrigger}
            onBookmarkAdded={onBookmarkAdded}
            showCounts={showCounts}
          />
        </div>
      </div>
    </div>
  );
};

