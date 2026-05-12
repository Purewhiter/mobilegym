import React from 'react';
import { useParams } from 'react-router-dom';
import { useXStore, selectEffectiveFollowedSet } from '../state';
import { useXHydratedPosts, useXResolvedPost } from '../data/view';
import { useXGestures } from '../hooks/useXGestures';
import { XImage } from '../components/XMedia';
import { useXStrings } from '../hooks/useXStrings';
import type { XPost, XUser } from '../types';
import { IcSort } from '../res/icons';
export const PostActivityPage: React.FC = () => {
  const { id } = useParams();
  const posts = useXHydratedPosts();
  const post = useXResolvedPost(id || '');
  const toggleFollow = useXStore(s => s.toggleFollow);
  const followedSet = useXStore(selectEffectiveFollowedSet);
  const isFollowing = (userId: string) => followedSet.has(userId);
  const { bindBack, bindTap, go } = useXGestures();
  const s = useXStrings();
  const [activeTab, setActiveTab] = React.useState<'quotes' | 'retweets'>('quotes');
  const [showSortMenu, setShowSortMenu] = React.useState(false);
  const [sortMethod, setSortMethod] = React.useState<'popular' | 'recent'>('popular');

  const quotes = React.useMemo(() => {
    let q = posts.filter(p => p.quotedPostId === id);
    if (sortMethod === 'recent') {
      q = [...q].reverse();
    } else {
      q = [...q].sort((a, b) => b.stats.likes - a.stats.likes);
    }
    return q;
  }, [posts, id, sortMethod]);

  // Mock retweeter 列表 — 用于"谁转推了这条推文"展示, 不与 base data 关联。
  // 遵守 data contract: id 即 handle (无 @ 前缀), 没有独立的 handle 字段。
  const retweeters = React.useMemo<XUser[]>(() => [
    { id: '__Ishq_', name: 'Ishq🏵️', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ishq', verified: true, following: 100, followers: 200 },
    { id: 'RishiAjnoti', name: 'Rishi Ajnoti', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rishi', verified: true, bio: 'Creator', following: 50, followers: 300 },
    { id: 'Aliya562219', name: 'Kira_life 🇺🇸', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kira', verified: true, bio: 'X Creator | Turning thoughts, life lessons, and powerful quotes into daily inspiration for every soul', following: 120, followers: 400 },
    { id: 'SherriVermaat', name: 'Sherri', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sherri', verified: true, bio: 'Passionate about my friends, inspirational quotes, art, MAGA CONSERVATIVE🇺🇸 SAVE AMERICA ✝️ NO DMS', following: 200, followers: 500 },
    { id: 'sankichi48', name: 'さんきち👍✨', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sankichi', verified: true, bio: '戦国武将⚔️ 武田信玄の名言', following: 300, followers: 600 },
    { id: 'CG97POV', name: 'PlayerOneVideogamer', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=PlayerOne', verified: true, bio: '🇺🇸 1st. Gamer!', following: 400, followers: 700 },
  ], []);

  if (!post) {
    return (
      <div className="flex flex-col bg-app-bg min-h-full text-app-text pt-10 px-4">
        <div className="flex items-center py-2">
          <button className="text-app-text mr-4" {...bindBack()}>←</button>
          <div className="font-bold text-lg">{s.post_activity_title}</div>
        </div>
        <div className="mt-6 text-gray-500">{s.post_not_found}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-app-bg text-app-text pt-10">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-app-border sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <button className="text-app-text mr-6" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="font-bold text-lg">{s.post_activity_title}</div>
        <div className="ml-auto">
          {activeTab === 'quotes' && (
            <button className="text-app-text p-2" onClick={() => setShowSortMenu(true)} aria-label={s.post_sort_quotes}>
              <IcSort size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-app-border">
        <button
          className={`flex-1 py-4 font-bold text-sm relative hover:bg-black/5 transition-colors ${activeTab === 'quotes' ? 'text-app-text' : 'text-gray-500'}`}
          onClick={() => setActiveTab('quotes')}
        >
          {s.retweet_sheet_quote}
          {activeTab === 'quotes' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />}
        </button>
        <button
          className={`flex-1 py-4 font-bold text-sm relative hover:bg-black/5 transition-colors ${activeTab === 'retweets' ? 'text-app-text' : 'text-gray-500'}`}
          onClick={() => setActiveTab('retweets')}
        >
          {s.retweet_sheet_retweet}
          {activeTab === 'retweets' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-blue-500 rounded-full" />}
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {activeTab === 'quotes' ? (
          <div>
            {quotes.length > 0 ? (
              quotes.map(quote => (
                <div
                  key={quote.id}
                  className="border-b border-app-border p-4 active:bg-black/5 cursor-pointer transition-colors"
                  {...bindTap('status.open', { params: { id: quote.id } })}
                >
                  <div className="flex">
                    <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0">
                      {quote.author?.avatar ? <XImage src={quote.author.avatar} alt={quote.author.name} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center text-gray-500 text-sm">
                        <span className="font-bold text-app-text mr-1">{quote.author?.name}</span>
                        {quote.author?.verified && <span className="text-blue-400 mr-1">✓</span>}
                        <span className="mr-1">{quote.author?.id ? `@${quote.author.id}` : ''}</span>
                        <span>· {quote.time}</span>
                      </div>
                      <div className="mt-1 text-app-text whitespace-pre-wrap">{quote.content}</div>
                      <div className="mt-3 rounded-xl overflow-hidden border border-app-border w-full p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden">
                            {post.author?.avatar && <XImage src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />}
                          </div>
                          <span className="font-bold text-sm text-app-text">{post.author?.name}</span>
                          <span className="text-gray-500 text-sm">{post.author?.id ? `@${post.author.id}` : ''}</span>
                          <span className="text-gray-500 text-sm">· {post.time}</span>
                        </div>
                        <div className="text-app-text text-sm line-clamp-3">{post.content}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              [1, 2].map((i) => (
                <div
                  key={i}
                  className="border-b border-app-border p-4 active:bg-black/5 cursor-pointer transition-colors"
                  {...bindTap('status.open', { params: { id: `mock_quote_${i}` } })}
                >
                  <div className="flex">
                    <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0">
                      <XImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Quote${i}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center text-gray-500 text-sm">
                        <span className="font-bold text-app-text mr-1">Mock User {i}</span>
                        <span className="text-blue-400 mr-1">✓</span>
                        <span className="mr-1">@mockuser{i}</span>
                        <span>· {i}h</span>
                      </div>
                      <div className="mt-1 text-app-text whitespace-pre-wrap">
                        {i === 1 ? 'Utter bullshit, X is an ultraright propaganda platform.' : 'This is the only platform you can trust.'}
                      </div>
                      <div className="mt-3 rounded-xl overflow-hidden border border-app-border w-full p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden">
                            {post.author?.avatar && <XImage src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />}
                          </div>
                          <span className="font-bold text-sm text-app-text">{post.author?.name}</span>
                          <span className="text-gray-500 text-sm">· {post.time}</span>
                        </div>
                        <div className="text-app-text text-sm line-clamp-3">{post.content}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div>
            {retweeters.map(user => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border-b border-app-border active:bg-black/5 transition-colors cursor-pointer"
                {...bindTap('user.open.fromPost', { params: { id: user.id } })}
              >
                <div className="flex items-start flex-1 mr-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 mr-3 overflow-hidden shrink-0">
                    {user.avatar ? <XImage src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="font-bold text-app-text flex items-center">
                      <span className="truncate">{user.name}</span>
                      {user.verified && <span className="text-blue-400 ml-1 shrink-0">✓</span>}
                    </div>
                    <div className="text-gray-500 text-sm truncate">{`@${user.id}`}</div>
                    {user.bio && <div className="text-app-text text-sm mt-1 line-clamp-2">{user.bio}</div>}
                  </div>
                </div>
                <button
                  className={`font-bold px-4 py-1.5 rounded-full text-sm transition-colors shrink-0 ${
                    isFollowing(user.id) ? 'bg-transparent border border-app-border text-app-text hover:bg-black/5' : 'bg-app-text text-app-bg hover:opacity-90'
                  }`}
                  onClick={(e) => { e.stopPropagation(); toggleFollow(user.id); }}
                >
                  {isFollowing(user.id) ? s.connections_following_button : s.connections_follow_button}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sort Menu Bottom Sheet */}
      {showSortMenu && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowSortMenu(false)} />
          <div className="relative bg-white text-black w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom-10 fade-in-0 duration-200">
            <div className="p-4">
              <div className="font-bold text-lg mb-4 text-center">{s.post_sort_quotes}</div>
              {(['popular', 'recent'] as const).map(method => (
                <button
                  key={method}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors"
                  onClick={() => { setSortMethod(method); setShowSortMenu(false); }}
                >
                  <div className="font-bold text-lg">{method === 'popular' ? s.post_sort_popular : s.post_sort_recent}</div>
                  {sortMethod === method ? (
                    <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-2 pt-0">
              <button className="w-full py-3.5 font-bold rounded-full bg-gray-100 active:bg-gray-200 transition-colors" onClick={() => setShowSortMenu(false)}>
                {s.common_cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
