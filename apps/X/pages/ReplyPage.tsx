import React from 'react';
import { useParams } from 'react-router-dom';
import { IcCamera, IcChart, IcImage, IcLocation, IcSmile } from '../res/icons';
import { useXStore, selectUser } from '../state';
import { useXAllUsers, useXLocalPosts, useXRepliesForPost, useXResolvedPost } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { useXStrings } from '../hooks/useXStrings';
import { XImage, XVideo } from '../components/XMedia';

export const ReplyPage: React.FC = () => {
  const { id } = useParams();
  const user = useXStore(selectUser);
  const localPosts = useXLocalPosts();
  const importedReplies = useXRepliesForPost(id || '');
  const allUsers = useXAllUsers();
  const original = useXResolvedPost(id || '');
  const addReply = useXStore(s => s.addReply);
  const { bindBack, bindTap, back } = useXGestures();
  const s = useXStrings();

  const replies = React.useMemo(() => {
    const dynamicReplies = localPosts.filter(post => post.threadId === id);
    const inlineReplies = Array.isArray(original?.replies) ? original.replies : [];
    const combined = [...importedReplies, ...inlineReplies, ...dynamicReplies];
    const seen = new Set<string>();

    return combined.filter(reply => {
      if (!reply?.id || seen.has(reply.id)) return false;
      seen.add(reply.id);
      return true;
    });
  }, [id, importedReplies, localPosts, original]);

  const [content, setContent] = React.useState('');
  const trimmed = content.trim();

  if (!original) {
    return (
      <div className="flex flex-col bg-app-bg min-h-full text-app-text pt-10 px-4">
        <div className="flex items-center justify-between py-2">
          <button className="text-app-text font-bold" {...bindBack()}>
            {s.reply_cancel}
          </button>
          <div className="font-bold text-lg">{s.reply_title}</div>
          <div className="w-12" />
        </div>
        <div className="mt-6 text-gray-500">{s.reply_not_found}</div>
      </div>
    );
  }

  const submit = bindTap(
    { kind: 'action', id: 'reply.post.submit' },
    {
      params: { postId: original.id, content: trimmed },
      onTrigger: () => {
        if (!trimmed) return;
        addReply(original.id, trimmed);
        setContent('');
        window.requestAnimationFrame(() => {
          (document.activeElement as HTMLElement | null)?.blur?.();
        });
        back(1);
      },
    },
  );

  return (
    <div className="flex h-full flex-col bg-app-bg text-app-text pt-10">
      <div className="flex items-center justify-between px-4 py-2 border-b border-app-border">
        <button className="text-app-text font-bold" {...bindBack({ beforeTrigger: () => setContent('') })}>
          {s.reply_cancel}
        </button>
        <div className="font-bold text-lg">{s.reply_title}</div>
        <button className={`rounded-full px-4 py-1.5 font-bold text-sm ${trimmed ? 'bg-blue-500 text-white' : 'bg-blue-500/40 text-white/60'}`} {...submit}>
          {s.reply_submit}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="px-4 py-4">
          <div className="flex">
            <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0 cursor-pointer" {...bindTap('user.open.fromPost', { params: { id: original.authorId } })}>
              {original.author?.avatar ? (
                <XImage src={original.author.avatar} alt={original.author.name} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="flex-1">
              <div className="flex items-center text-gray-500 text-sm flex-wrap">
                <span className="font-bold text-app-text mr-1">{original.author?.name}</span>
                {original.author?.verified ? <span className="text-blue-400 mr-1">✓</span> : null}
                <span className="mr-1">{original.author?.id ? `@${original.author.id}` : ''}</span>
                <span>· {original.time}</span>
              </div>
              <div className="mt-1 text-app-text whitespace-pre-wrap">{original.content}</div>
              {original.image ? (
                <div className="mt-2 rounded-xl overflow-hidden border border-app-border bg-app-surface w-full">
                  <XImage src={original.image} alt="Post image" className="w-full h-auto object-cover max-h-[420px]" />
                </div>
              ) : null}
              {original.video ? (
                <div className="mt-2 rounded-xl overflow-hidden border border-app-border bg-app-surface w-full">
                  <XVideo src={original.video} className="w-full h-auto max-h-[420px]" />
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 text-gray-500 text-sm">
            {s.reply_to_prefix}
            <span className="text-blue-400">{original.author?.id ? `@${original.author.id}` : ''}</span>
          </div>

          <div className="mt-4 flex">
            <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0">
              {user.avatar ? (
                <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-pink-600 flex items-center justify-center text-white font-bold">
                  {user.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1">
              <textarea
                className="w-full bg-transparent outline-none resize-none text-app-text placeholder-gray-500 min-h-[140px]"
                placeholder={s.reply_placeholder}
                value={content}
                onChange={event => setContent(event.target.value)}
                data-action="reply.content.input"
                data-action-type="input"
                data-action-params={JSON.stringify({ value: content })}
              />
            </div>
          </div>

          {replies.length > 0 && (
            <div className="mt-6 pt-4 border-t border-app-border">
              {replies.map(reply => {
                const replyAuthor = (reply as any).author ?? allUsers[reply.authorId];
                return (
                  <div key={reply.id} className="flex gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                      {replyAuthor?.avatar ? (
                        <XImage src={replyAuthor.avatar} alt={replyAuthor.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center font-bold">
                          {replyAuthor?.name?.[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-0.5">
                        <span className="text-app-text font-bold">{replyAuthor?.name}</span>
                        <span>{replyAuthor?.id ? `@${replyAuthor.id}` : ''}</span>
                        <span>· {reply.time}</span>
                      </div>
                      <div className="text-app-text text-[15px] whitespace-pre-wrap">{reply.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-app-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5 text-blue-400">
          <div className="cursor-pointer active:opacity-70"><IcImage size={20} /></div>
          <div className="cursor-pointer active:opacity-70"><IcCamera size={20} /></div>
          <div className="cursor-pointer active:opacity-70"><IcSmile size={20} /></div>
          <div className="cursor-pointer active:opacity-70"><IcChart size={20} /></div>
          <div className="cursor-pointer active:opacity-70"><IcLocation size={20} /></div>
        </div>
        <div className="text-gray-600 text-sm">0</div>
      </div>
    </div>
  );
};
