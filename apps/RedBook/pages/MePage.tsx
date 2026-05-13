import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { IcSettings, IcMenu, IcShare, IcScan, IcLock, IcContacts, IcClock, IcLightbulb, IcAdd, IcImage, IcSearch } from '../res/icons';
const Settings = IcSettings, Menu = IcMenu, Share2 = IcShare, ScanLine = IcScan, Lock = IcLock, Users = IcContacts, Clock = IcClock, Lightbulb = IcLightbulb, Plus = IcAdd, ImageIcon = IcImage, Search = IcSearch;
import { Drawer } from '../components/Drawer';
import { useLocation } from 'react-router-dom';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
export const MePage: React.FC = () => {
  const user = useRedBookStore(s => s.user);
  const view = useRedBookView();
  const feed = useMemo(() => view.feedIds.map(id => view.notesById[id]).filter(Boolean), [view.feedIds, view.notesById]);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isDrawerOpen = searchParams.get('menu') === 'drawer';
  const { bindTap, back } = useRedBookGestures();
  const s = useRedBookStrings();
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const followingCount = user.followingIds?.length ?? 0;
  const followerCount = user.followerIds?.length ?? 0;
  const getMeTextCardClass = (text: string) => {
      const len = (text || '').trim().length;
      if (len <= 8) return 'text-[26px] leading-[1.15]';
      if (len <= 16) return 'text-[22px] leading-[1.2]';
      if (len <= 28) return 'text-[18px] leading-[1.3]';
      if (len <= 48) return 'text-[16px] leading-[1.35]';
      return 'text-[14px] leading-[1.4]';
  };

  const activeTab = ((): 'notes' | 'collects' | 'likes' | 'comments' => {
      const t = searchParams.get('tab');
      if (t === 'notes' || t === 'collects' || t === 'likes' || t === 'comments') return t;
      // invalid deep link: do not auto-correct URL
      return 'notes';
  })();

  const noteSubTab = ((): 'public' | 'private' | 'collection' => {
      const sub = searchParams.get('sub');
      if (sub === 'public' || sub === 'private' || sub === 'collection') return sub;
      // invalid deep link: do not auto-correct URL
      return 'public';
  })();


  // Filter feed based on active tab
  const displayNotes = useMemo(() => {
      if (activeTab === 'notes') {
          // In a real app, filter by public/private. Here we just show all user's notes for 'public'
          if (noteSubTab === 'public') {
              const ids = user.publishedNoteIds || [];
              return ids.map(id => view.notesById[id]).filter(Boolean);
          }
          return []; // Mock empty for private/collection
      } else if (activeTab === 'collects') {
          const collected = new Set(user.collectedNotes || []);
          return feed.filter(note => collected.has(note.id));
      } else if (activeTab === 'likes') {
          const liked = new Set(user.likedNotes || []);
          return feed.filter(note => liked.has(note.id));
      }
      return [];
  }, [activeTab, noteSubTab, feed, user.publishedNoteIds, view.notesById, user.likedNotes, user.collectedNotes]);

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

  return (
    <div
      id="redbook-me-scroll"
      ref={containerRef}
      data-scroll-container="main"
      data-scroll-direction="vertical"
      className="h-full flex flex-col overflow-y-auto no-scrollbar relative text-white"
      style={{ backgroundColor: 'var(--app-c-me-page-bg)' }}
    >
       {/* Navigation Bar */}
       <div
         className={`sticky top-0 left-0 right-0 z-50 px-4 pt-10 pb-3 flex items-center justify-between transition-all ${
             isScrolled ? 'bg-(--app-c-me-page-bg) shadow-sm' : 'bg-transparent'
         }`}
         style={{ transitionDuration: 'var(--app-duration-medium)' }}
       >
           <Menu className="w-6 h-6 text-white cursor-pointer" strokeWidth={2} {...(bindTap('me.drawer.open') as unknown as Record<string, unknown>)} />

           {/* Center: User Name (Visible only when scrolled) */}
           <div className={`flex-1 flex justify-center items-center transition-opacity ${isScrolled ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDuration: 'var(--app-duration-medium)' }}>
               <span className="text-sm font-bold text-white">{user.name}</span>
           </div>

           {/* Right Icons */}
           <div className="flex items-center gap-4">
               {!isScrolled && (
                   <button className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[12px] font-medium border border-white/20 flex items-center gap-1">
                       <ImageIcon size={12} />
                       {s.set_background}
                   </button>
               )}
               <ScanLine className="w-5 h-5 text-white cursor-pointer" strokeWidth={2} />
               <Share2 className="w-5 h-5 text-white cursor-pointer" strokeWidth={2} />
           </div>
       </div>

       {/* Main Content Area */}
       <div className="relative z-10 px-4 pt-0 pb-4">
            {/* Profile Header */}
            <div className="flex items-start gap-4 mb-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className="w-[80px] h-[80px] rounded-full p-[2px] bg-white/20">
                        <img src={user.avatar} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <div className="absolute bottom-0 right-0 bg-[#ffce00] text-black rounded-full p-0.5 border-2 border-(--app-c-me-page-bg)">
                        <Plus size={14} strokeWidth={3} />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 pt-2">
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-[20px] font-bold text-white leading-tight">{user.name}</h1>
                    </div>
                    <div className="text-[11px] text-gray-400 mb-1 flex flex-col gap-0.5">
                        <span>{s.rednote_id}{user.id.replace('user_', '')} <span className="ml-2">{s.ip_location}{user.address || s.unknown}</span></span>
                    </div>
                </div>
            </div>

            {/* Bio */}
            <div className="mb-3 px-1">
                <div className="text-[14px] text-white mb-2">{user.intro || s.tap_here_to_fill_in_your_bio}</div>
                {/* Gender Tag */}
                <div className="inline-flex items-center justify-center bg-blue-500/20 px-2 py-0.5 rounded-full">
                    <span className="text-[10px] text-blue-300">{user.gender === 'Female' ? '♀' : '♂'}</span>
                </div>
            </div>

            {/* Stats & Buttons Row */}
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center cursor-pointer" {...bindTap('followList.open', { params: { type: '1' } })}>
                        <span className="text-[16px] font-bold text-white">{followingCount}</span>
                        <span className="text-[11px] text-gray-400">{s.following}</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer" {...bindTap('followList.open', { params: { type: '0' } })}>
                        <span className="text-[16px] font-bold text-white">{followerCount}</span>
                        <span className="text-[11px] text-gray-400">{s.followers}</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-[16px] font-bold text-white">{user.likesAndCollections || 0}</span>
                        <span className="text-[11px] text-gray-400">{s.likes_and_collects}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="px-6 py-1.5 rounded-full text-[13px] font-medium text-white border border-white/30 bg-white/10 backdrop-blur-sm active:bg-white/20 transition-colors"
                        {...bindTap('editProfile.open')}
                    >
                        {s.edit_profile}
                    </button>
                    <button
                        className="p-1.5 rounded-full text-white border border-white/30 bg-white/10 backdrop-blur-sm active:bg-white/20 transition-colors"
                        {...bindTap('settings.open')}
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-white/5 backdrop-blur-md rounded-lg p-3 flex flex-col items-start gap-1 cursor-pointer active:bg-white/10">
                    <div className="flex items-center gap-1 text-gray-200 text-[13px] font-medium">
                        <Lightbulb size={14} />
                        <span>{s.inspiration}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{s.learn_to_create}</span>
                </div>
                <div
                    className="bg-white/5 backdrop-blur-md rounded-lg p-3 flex flex-col items-start gap-1 cursor-pointer active:bg-white/10"
                    {...bindTap('history.open')}
                >
                    <div className="flex items-center gap-1 text-gray-200 text-[13px] font-medium">
                        <Clock size={14} />
                        <span>{s.history}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{s.viewed_notes}</span>
                </div>
                <div className="bg-white/5 backdrop-blur-md rounded-lg p-3 flex flex-col items-start gap-1 cursor-pointer active:bg-white/10">
                    <div className="flex items-center gap-1 text-gray-200 text-[13px] font-medium">
                        <Users size={14} />
                        <span>{s.group_chats}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{s.view_details}</span>
                </div>
            </div>
       </div>

       {/* Drawer Menu */}
       <Drawer isOpen={isDrawerOpen} />

       {/* White Content Area (Tabs + Grid) */}
       <div className="flex-1 bg-app-surface rounded-t-[20px] min-h-screen relative z-20 overflow-hidden">
            {/* Tabs */}
            <div className="sticky top-0 bg-app-surface z-30 pt-3 pb-2 px-4 border-b border-gray-100">
               <div className="flex items-center justify-between px-4 mb-2">
                   <div
                      className={`relative flex flex-col items-center cursor-pointer transition-colors ${activeTab === 'notes' ? 'text-app-text' : 'text-app-text-muted'}`}
                      {...bindTap(noteSubTab === 'private' ? 'me.tab.notes.private' : noteSubTab === 'collection' ? 'me.tab.notes.collection' : 'me.tab.notes.public')}
                   >
                       <span className={`text-[15px] ${activeTab === 'notes' ? 'font-bold' : ''}`}>{s.notes}</span>
                       {activeTab === 'notes' && <div className="absolute -bottom-1 w-8 h-[2px] bg-app-primary rounded-full" />}
                   </div>
                   <div
                      className={`relative flex flex-col items-center cursor-pointer transition-colors ${activeTab === 'comments' ? 'text-app-text' : 'text-app-text-muted'}`}
                      {...bindTap('me.tab.comments')}
                   >
                       <span className={`text-[15px] flex items-center gap-1 ${activeTab === 'comments' ? 'font-bold' : ''}`}>
                           <Lock size={12} /> {s.comments}
                       </span>
                       {activeTab === 'comments' && <div className="absolute -bottom-1 w-8 h-[2px] bg-app-primary rounded-full" />}
                   </div>
                   <div
                      className={`relative flex flex-col items-center cursor-pointer transition-colors ${activeTab === 'collects' ? 'text-app-text' : 'text-app-text-muted'}`}
                      {...bindTap('me.tab.collects')}
                   >
                       <span className={`text-[15px] flex items-center gap-1 ${activeTab === 'collects' ? 'font-bold' : ''}`}>
                           <Lock size={12} /> {s.collects}
                       </span>
                       {activeTab === 'collects' && <div className="absolute -bottom-1 w-8 h-[2px] bg-app-primary rounded-full" />}
                   </div>
                   <div
                      className={`relative flex flex-col items-center cursor-pointer transition-colors ${activeTab === 'likes' ? 'text-app-text' : 'text-app-text-muted'}`}
                      {...bindTap('me.tab.likes')}
                   >
                       <span className={`text-[15px] flex items-center gap-1 ${activeTab === 'likes' ? 'font-bold' : ''}`}>
                           <Lock size={12} /> {s.likes}
                       </span>
                       {activeTab === 'likes' && <div className="absolute -bottom-1 w-8 h-[2px] bg-app-primary rounded-full" />}
                   </div>
                   <div className="w-4" /> {/* Spacer for search icon if needed */}
                   <div className="text-app-text">
                        <Search size={18} />
                   </div>
               </div>

               {/* Sub Tabs (Only for Notes) */}
               {activeTab === 'notes' && (
                   <div className="flex items-center gap-6 px-4 mt-3 text-[13px]">
                       <span
                            className={`cursor-pointer transition-colors ${noteSubTab === 'public' ? 'text-app-text font-medium' : 'text-app-text-muted'}`}
                            {...bindTap('me.tab.notes.public')}
                       >
                           {s.public} {(user.publishedNoteIds || []).length}
                       </span>
                       <span
                            className={`flex items-center gap-1 cursor-pointer transition-colors ${noteSubTab === 'private' ? 'text-app-text font-medium' : 'text-app-text-muted'}`}
                            {...bindTap('me.tab.notes.private')}
                       >
                           <Lock size={12} /> {s.private} 0
                       </span>
                       <span
                            className={`cursor-pointer transition-colors ${noteSubTab === 'collection' ? 'text-app-text font-medium' : 'text-app-text-muted'}`}
                            {...bindTap('me.tab.notes.collection')}
                       >
                           {s.collection} 0
                       </span>
                   </div>
               )}
            </div>

            {/* Grid Content */}
            <div className="bg-app-surface min-h-[500px] pb-4 px-1 pt-2">
                {/* Banner for Notes */}
                {activeTab === 'notes' && noteSubTab === 'public' && (
                    <div className="px-1 mb-2">
                        <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-blue-100 rounded-md overflow-hidden">
                                    <img src="https://images.unsplash.com/photo-1544551763-46a42a46180b?w=100&h=100&fit=crop" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-medium text-app-text">{s.share_your_diving_diary}</span>
                                    <span className="text-[10px] text-app-text-muted">{s.join_trending_topics}</span>
                                </div>
                            </div>
                            <button className="px-3 py-1 rounded-full border border-app-primary text-app-primary text-[12px]">{s.post_now}</button>
                        </div>
                    </div>
                )}

                {displayNotes.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1">
                        {displayNotes.map((note, idx) => (
                            <div
                                key={note.id + idx}
                                className="bg-app-surface rounded-[4px] overflow-hidden relative cursor-pointer"
                                {...bindTap('note.open', { params: { id: note.id } })}
                            >
                                {/* Image Aspect Ratio wrapper */}
                                <div className="aspect-[3/4] bg-gray-100 relative overflow-hidden rounded-[4px]">
                                    {!note.images?.[0] && !note.video ? (
                                        <div className="w-full h-full flex items-center justify-center p-3 bg-[#fffbe6]">
                                            <div className={`w-[86%] mx-auto text-left overflow-hidden font-semibold text-[#333] whitespace-pre-wrap break-words ${getMeTextCardClass(note.content || note.title || s.write_a_post)}`}>
                                                {note.content || note.title || s.write_a_post}
                                            </div>
                                        </div>
                                    ) : note.images && note.images[0] ? (
                                        <img src={note.images[0]} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">{s.no_image}</div>
                                    )}
                                    {/* Video Icon if needed */}
                                    {note.type === 'video' && (
                                        <div className="absolute top-2 right-2 text-white drop-shadow-md">
                                            <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[8px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
                                        </div>
                                    )}
                                    {/* Views/Stats Overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/40 to-transparent flex items-center text-white">
                                        <ScanLine size={10} className="mr-1" /> {/* Eye icon replacement */}
                                        <span className="text-[10px]">{Number(note.likes) * 3}</span>
                                    </div>
                                </div>
                                {/* Note Title (Only for some views, usually MePage is just images in grid for 'Works' tab in some versions, but screenshot shows title below) */}
                                {/* Actually screenshot shows title below image */}
                                <div className="p-2">
                                    <div className="text-[13px] text-app-text font-bold line-clamp-2 leading-snug mb-1">
                                        {note.title || note.content}
                                    </div>
                                </div>
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
       </div>
    </div>
  );
};
