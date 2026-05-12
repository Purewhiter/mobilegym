import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcAddCircle, IcCamera, IcChart, IcGlobe, IcImage, IcLocation } from '../res/icons';
import { dimens } from '../res/dimens';
import { useXStore, selectUser } from '../state';
import { useXResolvedPost } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage } from '../components/XMedia';

export const ComposePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const quotedPostIdFromUrl = searchParams.get('quotedPostId');

  const user = useXStore(selectUser);
  const addPost = useXStore(s => s.addPost);
  const pendingQuotedPostId = useXStore(s => s.pendingQuotedPostId);
  const setPendingQuotedPostId = useXStore(s => s.setPendingQuotedPostId);
  const [content, setContent] = useState('');
  const { bindBack, bindTap, back } = useXGestures();
  const s = useXStrings();

  const effectiveQuotedPostId = quotedPostIdFromUrl || pendingQuotedPostId;
  const quotedPost = useXResolvedPost(effectiveQuotedPostId || '');

  useEffect(() => {
    return () => {
      setPendingQuotedPostId(null);
    };
  }, [setPendingQuotedPostId]);

  const handlePost = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      addPost(trimmed, undefined, effectiveQuotedPostId ?? undefined);
      setPendingQuotedPostId(null);
      setTimeout(() => back(), 0);
    } catch (error) {
      console.error('Error posting:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text relative pt-10">
      <div className="flex justify-between items-center px-4 py-2">
        <button {...bindBack()} className="text-app-text text-base">{s.compose_cancel}</button>
        <button
          {...bindTap(
            { kind: 'action', id: 'compose.post.submit' },
            {
              params: { content, quotedPostId: effectiveQuotedPostId },
              onTrigger: handlePost,
            },
          )}
          disabled={!content.trim()}
          className={`px-4 py-1.5 rounded-full font-bold text-sm text-white ${content.trim() ? 'bg-blue-500' : 'bg-blue-500/50'}`}
        >
          {s.compose_submit}
        </button>
      </div>

      <div className="flex px-4 gap-3 flex-1 mt-4 flex-col">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-pink-600 font-bold">{user.name[0]}</div>
            )}
          </div>
          <div className="flex-1 pt-1">
            <textarea
              className="w-full bg-transparent text-xl outline-none resize-none placeholder-gray-500"
              placeholder={s.compose_placeholder}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              autoFocus
              data-action="compose.content.input"
              data-action-type="input"
              data-action-params={JSON.stringify({ value: content })}
              rows={4}
            />
          </div>
        </div>

        {quotedPost && (
          <div className="mt-2 rounded-xl border border-app-border overflow-hidden">
            <div className="p-3 bg-app-surface">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0">
                  {quotedPost.author?.avatar ? (
                    <XImage src={quotedPost.author.avatar} alt={quotedPost.author.name} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm text-app-text truncate">{quotedPost.author?.name}</span>
                    {quotedPost.author?.verified && <span className="text-blue-400 text-xs">✓</span>}
                  </div>
                  <div className="text-gray-500 text-xs">{quotedPost.author?.id ? `@${quotedPost.author.id}` : ''}</div>
                </div>
              </div>
              <div className="text-app-text text-sm line-clamp-4 whitespace-pre-wrap">{quotedPost.content}</div>
            </div>
          </div>
        )}
      </div>

      <div className="pb-2">
        <div className="px-4 py-3 border-t border-app-border flex items-center gap-2 text-blue-400 font-bold text-sm">
          <IcGlobe size={16} />
          <span>{s.compose_reply_permission}</span>
        </div>

        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-6 text-blue-400">
            <IcImage size={dimens.compose_toolbar_icon_size} />
            <IcCamera size={dimens.compose_toolbar_icon_size} />
            <div className="border border-current rounded px-0.5 text-[10px] font-bold h-5 flex items-center justify-center w-6">GIF</div>
            <IcChart size={dimens.compose_toolbar_icon_size} className="transform rotate-90" />
            <IcLocation size={dimens.compose_toolbar_icon_size} />
            <IcAddCircle size={dimens.compose_toolbar_icon_size} className="opacity-50" />
          </div>

          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-app-border border-t-blue-500 transform -rotate-45" />
            <div className="w-6 h-6 rounded-full border border-app-border flex items-center justify-center text-blue-400 text-xl pb-1">+</div>
          </div>
        </div>
      </div>
    </div>
  );
};

