import { useRedBookStrings } from '../hooks/useRedBookStrings';
import React, { useMemo, useState, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useRedBookStore } from '../state';
import { useRedBookView } from '../data/view';
import { useShallow } from 'zustand/react/shallow';
import { REDBOOK_CONFIG } from '../data';
import { IcNavBack, IcShare, IcMore, IcMessageCircle, IcStar, IcHeart, IcSend, IcQuote, IcFrown, IcReply, IcAt, IcSmile, IcImage, IcFilter, IcCheck } from '../res/icons';
const ChevronLeft = IcNavBack, Share2 = IcShare, MoreHorizontal = IcMore, MessageCircle = IcMessageCircle, Star = IcStar, Heart = IcHeart, Send = IcSend, Quote = IcQuote, Frown = IcFrown, Reply = IcReply, AtSign = IcAt, Smile = IcSmile, ImageIcon = IcImage, ListFilter = IcFilter, Check = IcCheck;
import { ShareModal } from '../components/ShareModal';
import { formatPostTime, formatCommentTime } from '../utils/dateUtils';
import { useRedBookGestures } from '../hooks/useRedBookGestures';
import { UserPagePreview } from './UserPage';
export const DetailPage: React.FC = () => {
  const s = useRedBookStrings();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isShareOpen = searchParams.get('modal') === 'share';
  const { bindTap, bindBack, back, go } = useRedBookGestures();
  const { user, toggleLike, toggleCollect, followUser, addComment, toggleCommentLike, addToHistory } = useRedBookStore(useShallow(s => ({
    user: s.user,
    toggleLike: s.toggleLike,
    toggleCollect: s.toggleCollect,
    followUser: s.followUser,
    addComment: s.addComment,
    toggleCommentLike: s.toggleCommentLike,
    addToHistory: s.addToHistory,
  })));
  const view = useRedBookView();

  const note = useMemo(() => (id ? view.notesById[id] : undefined), [view.notesById, id]);
  const author = useMemo(() => {
      if (!note) return null;
      return note.authorId === user.id ? user : view.usersById[note.authorId];
  }, [view.usersById, note, user]);

  const isFollowingAuthor = !!author && (user.followingIds || []).includes(author.id);
  const cameFromAuthorPage = !!(location.state as any)?.fromAuthorId && (location.state as any).fromAuthorId === author?.id;
  const isLiked = !!note && (user.likedNotes || []).includes(note.id);
  const isCollected = !!note && (user.collectedNotes || []).includes(note.id);
  const likedCommentIds = (note && user.likedCommentsByNote?.[note.id]) || [];
  const isCommentLiked = (commentId: string) => likedCommentIds.includes(commentId);

  React.useEffect(() => {
    if (note) {
      addToHistory(note.id);
    }
  }, [note, addToHistory]);

  // Optimization: Preload surrounding notes or important assets
  React.useEffect(() => {
    // Preload note images (without <link rel="preload"> to avoid console warnings like:
    // "preloaded using link preload but not used within a few seconds").
    // We only warm up a small number of images to avoid unnecessary bandwidth.
    if (note?.images && note.images.length > 0) {
        const preloadImages = () => {
            note.images.slice(0, 2).forEach(src => {
                if (!src) return;
                const img = new Image();
                img.decoding = 'async';
                img.src = src;
            });
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(preloadImages);
        } else {
            setTimeout(preloadImages, 0);
        }
    }

    // Force preload comment avatars if using local data
    if ((REDBOOK_CONFIG as any).useLocalData && note?.commentList) {
        // Use requestIdleCallback to avoid blocking main thread transition
        const preloadComments = () => {
            note.commentList?.forEach(c => {
                if (c.avatar) {
                    const img = new Image();
                    img.decoding = 'async'; // Non-blocking decoding
                    img.src = c.avatar;
                }
            });
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(preloadComments);
        } else {
            setTimeout(preloadComments, 0);
        }
    }
  }, [note]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [replyToCommentId, setReplyToCommentId] = useState<string | undefined>(undefined);
  const [replyToUsername, setReplyToUsername] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'default' | 'latest' | 'hot'>('default');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const swiperPointerState = useRef<{ startX: number; currentX: number; pointerId: number } | null>(null);

  // Pointer-based page-level left-swipe drag → author profile
  const dragState = useRef<{ startX: number; startY: number; pointerId: number; inImage: boolean; active: boolean } | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const DRAG_THRESHOLD = 8; // px before deciding drag direction
  const NAVIGATE_THRESHOLD = 0.3; // 30% of screen width

  const handlePagePointerDown = (e: React.PointerEvent) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || cameFromAuthorPage) return;
    const target = e.target as HTMLElement;
    const inImage = !!target.closest('[data-image-swiper]');
    dragState.current = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, inImage, active: false };
  };

  const handlePagePointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds || ds.inImage) return;

    const dx = ds.startX - e.clientX;
    const dy = Math.abs(e.clientY - ds.startY);

    if (!ds.active) {
      if (Math.abs(dx) < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
      // 判断方向：如果纵向滚动优先，则放弃拖拽
      if (dy > Math.abs(dx)) {
        dragState.current = null;
        return;
      }
      // 只处理左滑（dx > 0）
      if (dx <= 0) {
        dragState.current = null;
        return;
      }
      ds.active = true;
      setIsDragging(true);
      contentRef.current?.setPointerCapture(e.pointerId);
    }

    if (ds.active) {
      setDragOffsetX(Math.max(0, dx));
    }
  };

  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const handlePagePointerUp = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;

    if (contentRef.current?.hasPointerCapture(e.pointerId)) {
      contentRef.current.releasePointerCapture(e.pointerId);
    }

    if (ds.active && author) {
      const screenW = window.innerWidth || 360;
      if (dragOffsetX > screenW * NAVIGATE_THRESHOLD) {
        // 超过阈值：先动画滑到底，再跳转
        setIsDragging(false);
        setIsAnimatingOut(true);
        setDragOffsetX(screenW);
        // 等动画完成后导航，不重置状态（组件会随路由卸载）
        setTimeout(() => {
          go('user.open', { userId: author.id });
        }, 250);
      } else {
        // 回弹
        setDragOffsetX(0);
        setIsDragging(false);
      }
    }

    dragState.current = null;
  };

  const handlePagePointerCancel = handlePagePointerUp;

  const handleSwiperPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      swiperPointerState.current = { startX: e.clientX, currentX: e.clientX, pointerId: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleSwiperPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      const ps = swiperPointerState.current;
      if (!ps || ps.pointerId !== e.pointerId) return;
      ps.currentX = e.clientX;
  };

  const handleSwiperPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      const ps = swiperPointerState.current;
      if (!note || !ps || ps.pointerId !== e.pointerId) return;

      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
      }

      const distance = ps.startX - ps.currentX;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;

      const totalItems = note.images.length + (note.video ? 1 : 0);

      if (isLeftSwipe) {
          // Next
          setCurrentImageIndex(prev => Math.min(totalItems - 1, prev + 1));
      } else if (isRightSwipe) {
          // Prev
          setCurrentImageIndex(prev => Math.max(0, prev - 1));
      }

      swiperPointerState.current = null;
  };

  const handleSwiperPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
      }
      swiperPointerState.current = null;
  };

  if (!note) {
    return <div className="h-full w-full flex items-center justify-center">{s.note_not_found}</div>;
  }
  const hasMedia = !!note.video || !!(note.images && note.images.length > 0);
  const textCardValue = note.content || note.title || s.write_a_post;
  const getDetailTextCardClass = (text: string) => {
    const len = (text || '').trim().length;
    if (len <= 8) return 'text-[34px] leading-[1.15]';
    if (len <= 16) return 'text-[30px] leading-[1.2]';
    if (len <= 28) return 'text-[26px] leading-[1.25]';
    if (len <= 48) return 'text-[22px] leading-[1.35]';
    return 'text-[18px] leading-[1.45]';
  };

  const handleSendComment = () => {
      if (!commentInput.trim()) return;
      addComment(note.id, commentInput, replyToCommentId);
      setCommentInput('');
      setReplyToCommentId(undefined);
      setReplyToUsername(undefined);
      // 提交后主动让输入失焦：移动端会据此收起键盘
      inputRef.current?.blur();
  };

  const handleReply = (commentId: string, username: string) => {
      setReplyToCommentId(commentId);
      setReplyToUsername(username);
      setCommentInput('');
      inputRef.current?.focus();
  };

  return (
    <div className="h-full w-full relative overflow-hidden">
      {/* Actual author page rendered behind, revealed on drag */}
      {(isDragging || isAnimatingOut || dragOffsetX > 0) && author && (
        <div
          className="absolute top-0 bottom-0 z-0 pointer-events-none"
          style={{
            left: '100%',
            width: '100%',
            transform: `translateX(-${dragOffsetX}px)`,
            transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          }}
        >
          <UserPagePreview userId={author.id} />
        </div>
      )}

      {/* Main page content — slides left on drag */}
      <div
        className="h-full flex flex-col bg-app-surface relative z-10"
        style={{
          transform: dragOffsetX > 0 ? `translateX(-${dragOffsetX}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          boxShadow: dragOffsetX > 0 ? '-4px 0 16px rgba(0,0,0,0.15)' : undefined,
        }}
      >
      {/* Custom Header - Persistent */}
      <div
        className="flex-shrink-0 z-10 pt-12 px-4 pb-4 flex items-center justify-between bg-app-surface border-b border-gray-100 min-h-(--app-detail-header-min-height)"
      >
        <div className="flex items-center gap-3">
            <div
                className="w-10 h-10 rounded-full flex items-center justify-center active:scale-90 transition-all bg-transparent"
                {...bindBack()}
            >
                <ChevronLeft size={28} className="text-gray-900" />
            </div>
            {/* User Info in Header - Always Visible */}
            <div className="flex items-center gap-3">
                {author && (
                    <>
                       <div
                           className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 cursor-pointer"
                           {...bindTap('user.open', { params: { userId: author.id } })}
                       >
                           <img src={author.avatar} className="w-full h-full object-cover" />
                       </div>
                       <span className="text-gray-900 text-[15px] font-medium truncate max-w-[120px]">{author.name}</span>
                    </>
                )}
           </div>
        </div>

        <div className="flex items-center gap-2">
            {author && (
                <button
                    className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors mr-1 ${
                        isFollowingAuthor
                        ? 'bg-transparent border border-gray-200 text-gray-400'
                        : 'bg-app-surface border border-app-primary text-app-primary active:bg-red-50'
                    }`}
                    {...bindTap(
                      { kind: 'action', id: 'note.detail.authorFollow.toggle' },
                      { params: { userId: author.id, to: !isFollowingAuthor }, onTrigger: () => followUser(author.id) },
                    )}
                >
                    {isFollowingAuthor ? s.following_2 : s.following}
                </button>
            )}
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all bg-transparent cursor-pointer"
                {...bindTap('note.share.open', { params: { id: id || '' } })}
            >
                <Reply size={28} className="text-gray-900 transform -scale-x-100" />
            </div>
        </div>
      </div>

      <ShareModal isOpen={isShareOpen} />

      {/* Content Scrollable Area */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto no-scrollbar bg-app-surface min-h-0"
        data-scroll-container="main"
        data-scroll-direction="vertical"
        style={{ touchAction: isDragging ? 'none' : undefined }}
        onPointerDown={handlePagePointerDown}
        onPointerMove={handlePagePointerMove}
        onPointerUp={handlePagePointerUp}
        onPointerCancel={handlePagePointerCancel}
      >
        {/* Image/Video Swiper */}
        <div
            className={`w-full aspect-[3/4] relative ${hasMedia ? 'bg-black' : 'bg-[#fffbe6]'}`}
            data-image-swiper
            style={{ touchAction: 'pan-y' }}
            onPointerDown={handleSwiperPointerDown}
            onPointerMove={handleSwiperPointerMove}
            onPointerUp={handleSwiperPointerUp}
            onPointerCancel={handleSwiperPointerCancel}
        >
            {!hasMedia ? (
                <div className="w-full h-full flex items-center justify-center p-8">
                    <div className={`w-[86%] mx-auto text-left overflow-y-auto max-h-full font-semibold text-[#333] whitespace-pre-wrap break-words ${getDetailTextCardClass(textCardValue)}`}>
                        {textCardValue}
                    </div>
                </div>
            ) : note.video && currentImageIndex === 0 ? (
                <video
                    src={note.videoUrl || note.video}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                    loop
                    playsInline
                    poster={note.cover || note.images[0]}
                />
            ) : (
                <img
                    src={note.images[note.video ? currentImageIndex - 1 : currentImageIndex]}
                    className="w-full h-full object-contain"
                    alt={`Image ${currentImageIndex + 1}`}
                />
            )}

            {/* Image Indicators */}
            {hasMedia && (note.images.length + (note.video ? 1 : 0)) > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10">
                    {Array.from({ length: note.images.length + (note.video ? 1 : 0) }).map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                                idx === currentImageIndex ? 'bg-app-primary w-3' : 'bg-white/50'
                            }`}
                        />
                    ))}
                </div>
            )}

            {/* Navigation Areas (Invisible) - Keep for desktop click support */}
            {hasMedia && (
                <>
                    <div
                        className="absolute top-0 bottom-0 left-0 w-1/4 z-0 cursor-pointer"
                        onClick={() => setCurrentImageIndex(prev => Math.max(0, prev - 1))}
                    />
                    <div
                        className="absolute top-0 bottom-0 right-0 w-1/4 z-0 cursor-pointer"
                        onClick={() => setCurrentImageIndex(prev => Math.min((note.images.length + (note.video ? 1 : 0)) - 1, prev + 1))}
                    />
                </>
            )}
        </div>

        <div className="p-4 relative bg-app-surface">
            {note.title && (
                <h2 className="text-[18px] font-medium text-app-text mb-3 leading-[1.5]">
                    {note.title}
                </h2>
            )}

            {/* Content */}
            <p className="text-[16px] leading-[1.8] text-app-text whitespace-pre-wrap mb-6 font-normal">
                {note.content}
            </p>

            {/* Tags */}
            {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {note.tags.map((tag, idx) => (
                        <span key={idx} className="text-[#13386c] text-[15px]">#{tag}</span>
                    ))}
                </div>
            )}

            {/* Date & Location & Dislike */}
            <div className="flex items-center justify-between mb-6">
                <div className="text-[12px] text-gray-400">
                    {`${formatPostTime(note.createdAt)} ${author?.location || s.unknown}`}
                </div>
                <div className="flex items-center gap-1 text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">
                    <Frown size={12} />
                    <span className="text-[11px]">{s.not_interested}</span>
                </div>
            </div>

            <hr className="border-gray-100 mb-6" />

            {/* Comments Area */}
            <div className="mb-20">
                <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="text-[13px] text-gray-900 font-bold">{s.total_prefix} {note.comments} {s.comments_suffix}</div>
                        <div
                          className="relative"
                          {...bindTap(
                            { kind: 'action', id: 'note.comment.sortMenu.toggle' },
                            { params: { to: !showSortMenu }, stopPropagation: true, onTrigger: () => setShowSortMenu(!showSortMenu) },
                          )}
                        >
                            <ListFilter size={16} className="text-gray-400 cursor-pointer" />

                            {/* Sort Menu */}
                            {showSortMenu && (
                                <div className="absolute top-6 left-0 bg-app-surface rounded-lg shadow-xl border border-gray-100 py-2 w-[120px] z-20 flex flex-col">
                                    {[
                                        { label: s.default, value: 'default' },
                                        { label: s.latest, value: 'latest' },
                                        { label: s.most_liked, value: 'hot' }
                                    ].map((option) => (
                                        <div
                                            key={option.value}
                                            className={`px-4 py-2.5 text-[14px] flex items-center justify-between cursor-pointer active:bg-gray-50 ${sortOrder === option.value ? 'text-app-text font-medium' : 'text-[#666]'}`}
                                            {...(option.value === 'default'
                                              ? bindTap({ kind: 'action', id: 'note.comment.sort.select.default' }, { stopPropagation: true, onTrigger: () => { setSortOrder('default'); setShowSortMenu(false); } })
                                              : option.value === 'latest'
                                                ? bindTap({ kind: 'action', id: 'note.comment.sort.select.latest' }, { stopPropagation: true, onTrigger: () => { setSortOrder('latest'); setShowSortMenu(false); } })
                                                : bindTap({ kind: 'action', id: 'note.comment.sort.select.hot' }, { stopPropagation: true, onTrigger: () => { setSortOrder('hot'); setShowSortMenu(false); } }))}
                                        >
                                            <span>{option.label}</span>
                                            {sortOrder === option.value && <Check size={14} className="text-app-primary" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Backdrop for closing menu */}
                {showSortMenu && <div className="fixed inset-0 z-0" onClick={() => setShowSortMenu(false)} />}

                {/* Inline Comment Input Trigger */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-(--app-detail-comment-avatar-size) h-(--app-detail-comment-avatar-size) rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
                        <img src={user.avatar} className="w-full h-full object-cover" />
                    </div>
                    <div
                        className="flex-1 h-[36px] bg-[#f5f5f5] rounded-full px-4 flex items-center justify-between cursor-pointer active:bg-gray-200 transition-colors"
                        onClick={() => inputRef.current?.focus()}
                    >
                        <span className="text-app-text-muted text-[13px]">{s.share_your_thoughts}</span>
                        <div className="flex items-center gap-3 text-[#666]">
                             <AtSign size={18} strokeWidth={1.5} />
                             <Smile size={18} strokeWidth={1.5} />
                             <ImageIcon size={18} strokeWidth={1.5} />
                        </div>
                    </div>
                </div>

                {(() => {
                    // Use 'any' for map values to avoid complex type inference issues in this inline block
                    const commentMap = new Map<string, any>(note.commentList?.map(c => [c.id, c]) || []);
                    let roots = note.commentList?.filter(c => !c.replyToId) || [];

                    // Sorting Logic
                    if (sortOrder === 'latest') {
                        roots = [...roots].sort((a, b) => Number(b.time) - Number(a.time));
                    } else if (sortOrder === 'hot') {
                        roots = [...roots].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
                    }

                    // Helper to find thread root
                    const getThreadRootId = (commentId: string): string => {
                        let currentId = commentId;
                        const visited = new Set<string>();
                        while (true) {
                            if (visited.has(currentId)) return currentId;
                            visited.add(currentId);
                            const c = commentMap.get(currentId);
                            if (!c || !c.replyToId) return currentId;
                            currentId = c.replyToId;
                        }
                    };

                    // Group replies
                    const repliesMap = new Map<string, any[]>();
                    note.commentList?.forEach(c => {
                        if (c.replyToId) {
                            const rootId = getThreadRootId(c.id);
                            if (!repliesMap.has(rootId)) repliesMap.set(rootId, []);
                            repliesMap.get(rootId)?.push(c);
                        }
                    });

                    return roots.map(root => (
                        <div key={root.id} className="mb-6">
                            {/* Root Comment */}
                            <div className="flex gap-3">
                                <div
                                    className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden cursor-pointer"
                                    {...(root.userId ? bindTap('user.open', { params: { userId: root.userId, name: root.username, avatar: root.avatar || '' } }) : {})}
                                >
                                    {root.avatar ? (
                                        <img src={root.avatar} className="w-full h-full object-cover" loading="eager" />
                                    ) : (
                                        <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-500 text-xs font-bold">{root.username[0]}</div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[13px] text-app-text-muted">{root.username}</span>
                                    </div>
                                    <p
                                      className="text-[14px] text-app-text leading-[140%] mt-0.5"
                                      {...bindTap({ kind: 'action', id: 'note.comment.reply.start' }, { params: { commentId: root.id, username: root.username }, onTrigger: () => handleReply(root.id, root.username) })}
                                    >
                                        {root.content}
                                    </p>
                                    <div className="flex gap-3 text-[11px] text-app-text-muted mt-2">
                                        <span>{formatCommentTime(root.time)} {root.location || s.unknown}</span>
                                        <span
                                          className="font-medium text-app-text ml-1"
                                          {...bindTap({ kind: 'action', id: 'note.comment.reply.start' }, { params: { commentId: root.id, username: root.username }, onTrigger: () => handleReply(root.id, root.username) })}
                                        >
                                          {s.reply}
                                        </span>
                                    </div>
                                </div>
                                <div
                                  className="flex flex-col items-center gap-0.5 p-1 cursor-pointer"
                                  {...bindTap(
                                    { kind: 'action', id: 'note.comment.item.like.toggle' },
                                    { params: { commentId: root.id, to: !isCommentLiked(root.id) }, stopPropagation: true, onTrigger: () => toggleCommentLike(note.id, root.id) },
                                  )}
                                >
                                    <Heart
                                      size={14}
                                      className={isCommentLiked(root.id) ? 'text-app-primary' : ''}
                                      fill={isCommentLiked(root.id) ? 'currentColor' : 'none'}
                                      stroke={isCommentLiked(root.id) ? 'currentColor' : '#999'}
                                    />
                                    <span className="text-[10px] text-gray-400">{root.likes}</span>
                                </div>
                            </div>

                            {/* Replies - Folded Once (Flat list indented) */}
                            {repliesMap.has(root.id) && (
                                <div className="ml-[42px] mt-3 space-y-4">
                                    {repliesMap.get(root.id)?.map(reply => (
                                        <div key={reply.id} className="flex gap-2">
                                            <div
                                                className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden cursor-pointer"
                                                {...(reply.userId ? bindTap('user.open', { params: { userId: reply.userId, name: reply.username, avatar: reply.avatar || '' } }) : {})}
                                            >
                                                {reply.avatar ? (
                                                    <img src={reply.avatar} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-500 text-[10px] font-bold">{reply.username[0]}</div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[13px] text-app-text-muted">{reply.username}</span>
                                                </div>
                                                <p
                                                  className="text-[14px] text-app-text leading-[140%] mt-0.5"
                                                  {...bindTap({ kind: 'action', id: 'note.comment.reply.start' }, { params: { commentId: reply.id, username: reply.username }, onTrigger: () => handleReply(reply.id, reply.username) })}
                                                >
                                                    {reply.replyToId && (() => {
                                                        const target = commentMap.get(reply.replyToId);
                                                        return (target && target.id !== root.id) ? (
                                                            <span>{s.reply} <span className="text-[#666]">{target.username}</span> : </span>
                                                        ) : null;
                                                    })()}
                                                    {reply.content}
                                                </p>
                                                <div className="flex gap-3 text-[11px] text-app-text-muted mt-2">
                                                    <span>{formatCommentTime(reply.time)} {reply.location || s.unknown}</span>
                                                    <span
                                                      className="font-medium text-app-text ml-1"
                                                      {...bindTap({ kind: 'action', id: 'note.comment.reply.start' }, { params: { commentId: reply.id, username: reply.username }, onTrigger: () => handleReply(reply.id, reply.username) })}
                                                    >
                                                      {s.reply}
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                              className="flex flex-col items-center gap-0.5 p-1 cursor-pointer"
                                              {...bindTap(
                                                { kind: 'action', id: 'note.comment.item.like.toggle' },
                                                { params: { commentId: reply.id, to: !isCommentLiked(reply.id) }, stopPropagation: true, onTrigger: () => toggleCommentLike(note.id, reply.id) },
                                              )}
                                            >
                                                <Heart
                                                  size={12}
                                                  className={isCommentLiked(reply.id) ? 'text-app-primary' : ''}
                                                  fill={isCommentLiked(reply.id) ? 'currentColor' : 'none'}
                                                  stroke={isCommentLiked(reply.id) ? 'currentColor' : '#999'}
                                                />
                                                <span className="text-[10px] text-gray-400">{reply.likes}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ));
                })()}
            </div>
        </div>
      </div>

      {/* Bottom Action Bar - flex-shrink-0 for adjustResize (keyboard) compatibility */}
      <div className="flex-shrink-0 bg-app-surface border-t border-gray-100 z-50 pb-[20px]" data-keep-keyboard="true">
        {/* Reply Indicator */}
        {replyToUsername && (
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <span>{s.replying}: <span className="text-app-text font-medium">{replyToUsername}</span></span>
                <span
                    className="text-app-text-muted cursor-pointer px-2"
                    {...bindTap({ kind: 'action', id: 'note.comment.reply.cancel' }, { onTrigger: () => { setReplyToCommentId(undefined); setReplyToUsername(undefined); } })}
                >
                    {s.cancel}
                </span>
            </div>
        )}

        <div className="h-(--app-detail-bottom-bar-height) px-4 flex items-center justify-between">
            {/* Input Placeholder */}
            <div className="flex-1 h-(--app-detail-bottom-bar-input-height) bg-gray-100 rounded-full px-4 flex items-center mr-4 focus-within:ring-1 ring-red-100 transition-all">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={replyToUsername ? `${s.reply} ${replyToUsername}...` : s.say_something}
                    className="bg-transparent w-full text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none"
                    value={commentInput}
                    onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                />
            </div>

            {/* Actions */}
            {commentInput.trim() ? (
                <button
                    {...bindTap(
                      { kind: 'action', id: 'note.comment.submit' },
                      { params: { value: commentInput.trim(), replyToCommentId: replyToCommentId ?? '' }, onTrigger: handleSendComment },
                    )}
                    className="text-app-primary font-medium text-sm px-2"
                >
                    {s.detailpage_send}
                </button>
            ) : (
                <div className="flex items-center gap-6">
                    <div
                      className="flex flex-col items-center gap-0.5"
                      {...bindTap(
                        { kind: 'action', id: 'note.item.like.toggle' },
                        { params: { noteId: note.id, to: !isLiked }, onTrigger: () => toggleLike(note.id) },
                      )}
                    >
                        <Heart
                          size={28}
                          className={`transition-transform active:scale-125 ${isLiked ? 'text-app-primary' : ''}`}
                          fill={isLiked ? 'currentColor' : 'none'}
                          stroke={isLiked ? 'currentColor' : '#333'}
                          strokeWidth={1.5}
                        />
                        <span className="text-[11px] text-gray-500 font-medium">{note.likes}</span>
                    </div>
                    <div
                      className="flex flex-col items-center gap-0.5"
                      {...bindTap(
                        { kind: 'action', id: 'note.item.collect.toggle' },
                        { params: { noteId: note.id, to: !isCollected }, onTrigger: () => toggleCollect(note.id) },
                      )}
                    >
                        <Star size={28} fill={isCollected ? '#f6c444' : 'none'} stroke={isCollected ? '#f6c444' : '#333'} strokeWidth={1.5} className="transition-transform active:scale-125" />
                        <span className="text-[11px] text-gray-500 font-medium">{note.collections}</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                        <MessageCircle size={28} stroke="#333" strokeWidth={1.5} />
                        <span className="text-[11px] text-gray-500 font-medium">{note.comments}</span>
                    </div>
                </div>
            )}
        </div>
      </div>
      </div>
    </div>
  );
};
