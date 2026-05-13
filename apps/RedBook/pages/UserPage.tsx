import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { IcHeart, IcNavBack, IcMore, IcShare, IcNavBackArrow, IcSearch, IcScan } from '../res/icons';
const Heart = IcHeart, ChevronLeft = IcNavBack, MoreHorizontal = IcMore, Share2 = IcShare, ArrowLeft = IcNavBackArrow, Search = IcSearch, ScanLine = IcScan;
import { useParams, useLocation } from 'react-router-dom';
import { useRedBookGestures } from '../hooks/useRedBookGestures';

/** Standalone preview of user page — no router dependency, non-interactive. */
export const UserPagePreview: React.FC<{ userId: string }> = ({ userId }) => {
  const s = useRedBookStrings();
  const currentUser = useRedBookStore(s => s.user);
  const view = useRedBookView();

  const user = userId === currentUser.id
    ? {
        ...currentUser,
        following: currentUser.followingIds?.length ?? 0,
        followers: currentUser.followerIds?.length ?? 0,
      }
    : view.usersById[userId];
  if (!user) return <div className="h-full bg-[#1a1a1a]" />;

  const feed = view.feedIds.map(id => view.notesById[id]).filter(Boolean);
  const userNotes = feed.filter(note => note.authorId === user.id);

  return (
    <div className="h-full flex flex-col bg-app-surface overflow-y-auto no-scrollbar relative text-white">
      <div className="bg-[#1a1a1a]">
        <div className="px-4 pt-12 pb-3 flex items-center justify-between">
          <ChevronLeft className="w-7 h-7 text-white" />
          <div className="flex items-center gap-4">
            <Share2 className="w-5 h-5 text-white" strokeWidth={2} />
            <MoreHorizontal className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
        </div>
        <div className="relative z-10 px-4 pt-0 pb-4">
          <div className="flex items-start gap-4 mb-3">
            <div className="w-[80px] h-[80px] rounded-full p-[2px] bg-white/20 flex-shrink-0">
              <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
            </div>
            <div className="flex-1 pt-2">
              <h1 className="text-[20px] font-medium text-white leading-tight mb-1">{user.name}</h1>
              <div className="text-[11px] text-gray-400 flex flex-col gap-0.5">
                <span>{s.rednote_id_3}：{user.id.replace('user_', '')}</span>
                <span>{s.ip_location_2}：{user.location || user.address || s.unknown}</span>
              </div>
            </div>
          </div>
          <div className="text-[14px] text-white mb-4 leading-relaxed px-1">
            {user.intro || s.this_person_is_lazy_and_wrote_nothing}
          </div>
          <div className="flex items-center gap-5 px-1 mb-2">
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-medium text-white">{user.following || 0}</span>
              <span className="text-[11px] text-gray-400">{s.following}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-medium text-white">{user.followers || 0}</span>
              <span className="text-[11px] text-gray-400">{s.followers}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[16px] font-medium text-white">{user.likesAndCollections || 0}</span>
              <span className="text-[11px] text-gray-400">{s.likes_and_collects}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-app-surface rounded-t-[20px] min-h-screen relative z-20 -mt-4">
        <div className="pt-3 pb-2 px-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="relative flex flex-col items-center">
              <span className="text-[15px] font-bold text-gray-900">{s.notes}</span>
              <div className="absolute -bottom-1 w-8 h-[2px] bg-app-primary rounded-full" />
            </div>
            <span className="text-[15px] text-gray-400">{s.collects}</span>
          </div>
          <Search size={18} className="text-gray-900" />
        </div>
        <div className="bg-app-surface min-h-[500px] px-1 pt-2">
          {userNotes.length > 0 ? (
            <div className="flex gap-1 items-start">
              {[0, 1].map(colIndex => (
                <div key={colIndex} className="flex-1 flex flex-col gap-1">
                  {userNotes.filter((_, i) => i % 2 === colIndex).map((note, idx) => {
                    const noteAuthor = note.authorId === currentUser.id ? currentUser : view.usersById[note.authorId];
                    return (
                      <div key={note.id + idx} className="bg-app-surface rounded-[4px] overflow-hidden mb-1">
                        <div className="relative overflow-hidden rounded-[4px] max-h-[220px]">
                          {note.images?.[0] ? (
                            <img src={note.images[0]} className="w-full h-auto object-cover block" />
                          ) : (
                            <div className="w-full h-32 flex items-center justify-center text-gray-400 bg-gray-100 text-[10px]">No Image</div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="text-[13px] text-gray-900 font-bold line-clamp-2 leading-snug mb-2">{note.title || note.content}</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <img src={noteAuthor?.avatar || ''} className="w-4 h-4 rounded-full object-cover bg-gray-200 flex-shrink-0" />
                              <span className="text-[10px] text-[#666] truncate">{noteAuthor?.name || s.unknown}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[#666] flex-shrink-0">
                              <Heart size={12} />
                              <span className="text-[10px]">{note.likes}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="text-4xl mb-3">📭</span>
              <span className="text-[13px]">{s.nothing_here_yet}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const UserPage: React.FC = () => {
  const s = useRedBookStrings();
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const fallbackName = searchParams.get('name');
  const fallbackAvatar = searchParams.get('avatar');

  const followUser = useRedBookStore(s => s.followUser);
  const currentUser = useRedBookStore(s => s.user);
  const view = useRedBookView();
  const { bindTap, bindBack, go } = useRedBookGestures();
  const [activeTab, setActiveTab] = useState<'works' | 'collects'>('works');
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const user = useMemo(() => {
      const existing = userId
          ? (userId === currentUser.id
              ? {
                  ...currentUser,
                  following: currentUser.followingIds?.length ?? 0,
                  followers: currentUser.followerIds?.length ?? 0,
                }
              : view.usersById[userId])
          : undefined;
      if (existing) return existing;

      // Fallback mock user if not found in database but details provided via URL params
      if (userId && (fallbackName || fallbackAvatar)) {
          return {
              id: userId,
              name: fallbackName || 'Unknown',
              avatar: fallbackAvatar || '',
              intro: s.no_bio,
              location: s.unknown,
              followers: 0,
              following: 0,
              likesAndCollections: 0,
          };
      }
      return null;
  }, [currentUser, view.usersById, fallbackAvatar, fallbackName, s, userId]);

  const feed = useMemo(() => view.feedIds.map(id => view.notesById[id]).filter(Boolean), [view.feedIds, view.notesById]);

  // Check if user is a fallback/mock user (not found in database)
  const isFallbackUser = useMemo(() => {
      if (!user) return false;
      return user.id !== currentUser.id && !view.usersById[user.id];
  }, [currentUser.id, view.usersById, user]);

  // User's notes or collects
  const displayNotes = useMemo(() => {
      if (!user) return [];

      if (activeTab === 'works') {
          // If fallback user, always return empty list (don't show random mock works)
          if (isFallbackUser) {
              return [];
          }
          // Only show notes authored by this user
          const userNotes = feed.filter(note => note.authorId === user.id);
          return userNotes;
      } else if (activeTab === 'collects') {
          // If fallback user, always return empty list
          if (isFallbackUser) {
              return [];
          }
          // For collects tab, show some placeholder notes if it's the current user
          // For other users, show empty as we don't have their collect data
          if (user.id === currentUser.id && currentUser.collectedNotes?.length) {
              return currentUser.collectedNotes
                  .map(noteId => view.notesById[noteId])
                  .filter(Boolean)
                  .slice(0, 10);
          }
          return [];
      }
      return [];
  }, [activeTab, feed, user, currentUser, view.notesById, isFallbackUser]);

  const handleScroll = () => {
      if (containerRef.current) {
          const scrollTop = containerRef.current.scrollTop;
          setIsScrolled(scrollTop > 50);
      }
  };

  useEffect(() => {
      const container = containerRef.current;
      if (container) {
          container.addEventListener('scroll', handleScroll);
          return () => container.removeEventListener('scroll', handleScroll);
      }
  }, []);

  const likedSet = useMemo(() => new Set(currentUser.likedNotes || []), [currentUser.likedNotes]);

  if (!user) {
      return <div className="flex items-center justify-center h-full text-white bg-[#1a1a1a]">{s.user_not_found}</div>;
  }

  const isMe = user.id === currentUser.id;
  const isFollowing = (currentUser.followingIds || []).includes(user.id);

  return (
    <div className="h-full relative">
      {/* Navbar — 固定在顶部，不参与滚动 */}
      <div
        className={`absolute top-0 left-0 right-0 z-50 px-4 pt-10 pb-3 flex items-center justify-between transition-all ${
            isScrolled ? 'bg-app-surface shadow-sm' : 'bg-transparent'
        }`}
        style={{ transitionDuration: 'var(--app-duration-medium)' }}
      >
        <div className={`w-7 h-7 cursor-pointer ${isScrolled ? 'text-gray-900' : 'text-white'}`} {...bindBack()}>
          <ChevronLeft className="w-7 h-7" />
        </div>
        {/* 头像绝对居中，不受两侧宽度影响 */}
        <div className={`absolute left-0 right-0 flex justify-center pointer-events-none transition-opacity ${isScrolled ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDuration: 'var(--app-duration-medium)' }}>
          <img src={user.avatar} className="w-8 h-8 rounded-full object-cover" />
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 transition-opacity ${isScrolled ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDuration: 'var(--app-duration-medium)' }}>
            {!isMe && (
              <button
                className={`px-4 py-1 rounded-full text-[13px] font-medium border-none ${isFollowing ? 'text-gray-600 bg-gray-100' : 'text-white bg-app-primary'}`}
                {...bindTap(
                  { kind: 'action', id: 'user.page.follow.toggle' },
                  { params: { userId: user.id, to: !isFollowing }, onTrigger: () => followUser(user.id) },
                )}
              >
                {isFollowing ? s.following_2 : s.following}
              </button>
            )}
          </div>
          <MoreHorizontal className={`w-5 h-5 cursor-pointer ${isScrolled ? 'text-gray-900' : 'text-white'}`} strokeWidth={2} />
        </div>
      </div>

      {/* 滚动容器 */}
      <div
        ref={containerRef}
        className="h-full bg-app-surface overflow-y-auto no-scrollbar relative text-white"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
       <div className="bg-[#1a1a1a]">
       {/* Main Content Area — 顶部留出 navbar 高度 */}
       <div className="relative z-10 px-4 pt-20 pb-4">
            <div className="flex items-start gap-4 mb-3">
                {/* Avatar */}
                <div className="w-[80px] h-[80px] rounded-full p-[2px] bg-white/20 flex-shrink-0">
                    <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 pt-2">
                    <h1 className="text-[20px] font-medium text-white leading-tight mb-1">{user.name}</h1>
                    <div className="text-[11px] text-gray-400 flex flex-col gap-0.5">
                        <span>{s.rednote_id_3}：{user.id.replace('user_', '')}</span>
                        <span>{s.ip_location_2}：{user.location || user.address || s.unknown}</span>
                    </div>
                </div>
            </div>

            {/* Bio */}
            <div className="text-[14px] text-white mb-4 leading-relaxed px-1">
                {user.intro || s.this_person_is_lazy_and_wrote_nothing} 🏠
            </div>

            {/* Stats & Buttons */}
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-5">
                     <div className="flex flex-col items-center">
                        <span className="text-[16px] font-medium text-white">{user.following || 0}</span>
                        <span className="text-[11px] text-gray-400">{s.following}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[16px] font-medium text-white">{user.followers || 0}</span>
                        <span className="text-[11px] text-gray-400">{s.followers}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[16px] font-medium text-white">{user.likesAndCollections || 0}</span>
                        <span className="text-[11px] text-gray-400">{s.likes_and_collects}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isMe ? (
                        <button
                            className="px-6 py-1.5 rounded-full text-[13px] font-medium text-white border border-white/30 bg-white/10 backdrop-blur-sm"
                            {...bindTap('editProfile.open')}
                        >
                            {s.edit_profile}
                        </button>
                    ) : (
                        <>
                            <button
                                className={`px-6 py-1.5 rounded-full text-[13px] font-medium transition-colors border-none ${
                                    isFollowing
                                    ? 'text-white/60 bg-white/10'
                                    : 'text-white bg-app-primary'
                                }`}
                                {...bindTap(
                                  { kind: 'action', id: 'user.page.follow.toggle' },
                                  { params: { userId: user.id, to: !isFollowing }, onTrigger: () => followUser(user.id) },
                                )}
                            >
                                {isFollowing ? s.following_2 : s.following}
                            </button>
                            <button
                                className="px-6 py-1.5 rounded-full text-[13px] font-medium text-white bg-[#333] border border-white/10"
                                {...bindTap('chat.open', { params: { userId: user.id } })}
                            >
                                {s.message_2}
                            </button>
                        </>
                    )}
                </div>
            </div>
       </div>
       </div>

       {/* White Content Area */}
       <div className="flex-1 bg-app-surface rounded-t-[20px] min-h-screen relative z-20 -mt-4">
            {/* Tabs */}
            <div className="sticky top-[80px] bg-app-surface z-30 pt-3 pb-2 px-4 border-b border-gray-100 flex items-center justify-between">
               <div className="flex items-center gap-8">
                   <div
                      className={`relative flex flex-col items-center cursor-pointer transition-colors ${activeTab === 'works' ? 'text-app-text' : 'text-app-text-muted'}`}
                      {...bindTap({ kind: 'action', id: 'user.page.tab.select.works' }, { onTrigger: () => setActiveTab('works') })}
                   >
                       <span className={`text-[15px] ${activeTab === 'works' ? 'font-bold' : ''}`}>{s.notes}</span>
                       {activeTab === 'works' && <div className="absolute -bottom-1 w-8 h-[2px] bg-app-primary rounded-full" />}
                   </div>
                   <div
                      className={`relative flex flex-col items-center cursor-pointer transition-colors ${activeTab === 'collects' ? 'text-app-text' : 'text-app-text-muted'}`}
                      {...bindTap({ kind: 'action', id: 'user.page.tab.select.collects' }, { onTrigger: () => setActiveTab('collects') })}
                   >
                       <span className={`text-[15px] ${activeTab === 'collects' ? 'font-bold' : ''}`}>{s.collects}</span>
                       {activeTab === 'collects' && <div className="absolute -bottom-1 w-8 h-[2px] bg-app-primary rounded-full" />}
                   </div>
               </div>

               <Search size={18} className="text-app-text" />
            </div>

            {/* Grid Content */}
            <div className="bg-app-surface min-h-[500px] px-1 pt-4">
                {displayNotes.length > 0 ? (
                    <div className="flex gap-1 items-start">
                        {[0, 1].map(colIndex => (
                            <div key={colIndex} className="flex-1 flex flex-col gap-1">
                                {displayNotes.filter((_, i) => i % 2 === colIndex).map((note, idx) => {
                                    const author = note.authorId === currentUser.id ? currentUser : view.usersById[note.authorId];
                                    return (
                                    <div
                                        key={note.id + idx}
                                        className="bg-app-surface rounded-[4px] overflow-hidden relative cursor-pointer mb-1"
                                        onClick={() => go('note.open', { id: note.id }, { state: { fromAuthorId: user.id } })}
                                    >
                                        {/* Constraint height for masonry items to avoid huge gaps */}
                                        <div className="relative overflow-hidden rounded-[4px] max-h-[220px]">
                                            {note.images && note.images[0] ? (
                                                <img
                                                    src={note.images[0]}
                                                    className="w-full h-auto object-cover block"
                                                />
                                            ) : (
                                                <div className="w-full h-32 flex items-center justify-center text-gray-400 bg-gray-100 text-[10px]">No Image</div>
                                            )}
                                            {/* Video Icon */}
                                            {note.type === 'video' && (
                                                <div className="absolute top-2 right-2 text-white drop-shadow-md">
                                                    <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[8px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <div className="text-[13px] text-app-text font-bold line-clamp-2 leading-snug mb-2">
                                                {note.title || note.content}
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <img src={author?.avatar || ''} className="w-4 h-4 rounded-full object-cover bg-gray-200 flex-shrink-0" />
                                                    <span className="text-[10px] text-[#666] truncate">{author?.name || s.unknown}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[#666] flex-shrink-0">
                                                    <Heart size={12} className={likedSet.has(note.id) ? "fill-current text-app-primary" : ""} />
                                                    <span className="text-[10px]">{note.likes}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-app-text-muted">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <span className="text-4xl">📭</span>
                        </div>
                        <span className="text-[13px]">{s.nothing_here_yet}</span>
                    </div>
                )}
            </div>
            {/* Small padding for bottom safe area */}
            <div className="h-[20px] bg-app-surface"></div>
       </div>
      </div>{/* 滚动容器结束 */}
    </div>
  );
};
