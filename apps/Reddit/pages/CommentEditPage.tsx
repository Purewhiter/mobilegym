import React from 'react';
import { IcClose, IcLink, IcImage, IcSticker } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useRedditGestures } from '../hooks/useRedditGestures';
import type { Comment } from '../types';

function getIdsFromPath(pathname: string): { postId: string; commentId: string } | null {
  const m = pathname.match(/^\/post\/([^/?#]+)\/edit\/([^/?#]+)/);
  if (!m) return null;
  return { postId: decodeURIComponent(m[1]), commentId: decodeURIComponent(m[2]) };
}

export const CommentEditPage: React.FC = () => {
  const { user, commentsTable } = useRedditStore(useShallow((s) => ({
    user: s.user,
    commentsTable: s.comments,
  })));
  const storeEditComment = useRedditStore((s) => s.editComment);
  const { bindBack, bindTap, back } = useRedditGestures();
  const location = useLocation();
  const ids = getIdsFromPath(location.pathname);
  const postId = ids?.postId ?? null;
  const commentId = ids?.commentId ?? null;

  const myName = String(user.username || 'Embarrassed_Fee8630');
  const target: Comment | null = commentId ? commentsTable[commentId] ?? null : null;

  const [text, setText] = React.useState('');
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    setText(target?.body ?? '');
  }, [target?.body]);

  React.useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const canPost = !!postId && !!commentId && !!target && target.author === myName && text.trim().length > 0;

  const submit = React.useCallback(() => {
    if (!postId || !commentId) return;
    if (!target) return;
    if (target.author !== myName) return;
    const body = text.trim();
    if (!body) return;

    storeEditComment(commentId, body);

    back();
  }, [back, commentId, myName, postId, storeEditComment, target, text]);

  return (
    <div className="flex flex-col h-full bg-app-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3 border-b border-gray-100">
        <button
          type="button"
          aria-label="Close"
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center active:bg-gray-100"
          {...bindBack()}
        >
          <IcClose className="w-6 h-6 text-gray-800" strokeWidth={2} />
        </button>

        <div className="text-[18px] font-bold text-app-text">Reply</div>

        <button
          type="button"
          onClick={() => {}}
          {...bindTap(
            { kind: 'action', id: 'commentEdit.post.submit' },
            {
              params: { postId: postId ?? '', commentId: commentId ?? '', body: text },
              onTrigger: submit,
            },
          )}
          className={`text-[15px] font-bold ${canPost ? 'text-[#0045AC]' : 'text-gray-300'}`}
        >
          Post
        </button>
      </div>

      {/* Context: comment being edited */}
      <div className="px-4 pt-4">
        <div className="text-[14px] text-gray-600">
          <span className="font-semibold text-app-text">{target?.author ?? ''}</span>
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Your reply"
          className="mt-2 w-full min-h-[180px] text-[16px] text-app-text placeholder-gray-400 outline-none resize-none"
        />
      </div>

      <div className="flex-1" />

      {/* Bottom toolbar (visual only) */}
      <div className="border-t border-gray-100 bg-app-surface px-5 py-3 flex items-center justify-between text-gray-600">
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => {}} aria-label="Link" className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100">
            <IcLink className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => {}} aria-label="GIF" className="h-10 px-3 rounded-full border border-app-border text-[13px] font-bold text-gray-600 active:bg-gray-100">
            GIF
          </button>
          <button type="button" onClick={() => {}} aria-label="Image" className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100">
            <IcImage className="w-6 h-6" strokeWidth={2} />
          </button>
          <button type="button" onClick={() => {}} aria-label="Sticker" className="w-10 h-10 rounded-full flex items-center justify-center active:bg-gray-100">
            <IcSticker className="w-6 h-6" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};
