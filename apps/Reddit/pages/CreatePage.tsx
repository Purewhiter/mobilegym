import React, { useState } from 'react';
import { IcClose, IcExpand, IcCollapse, IcLinkSimple, IcImage, IcPlayCircle, IcList, IcSend, IcSearch, IcShield, IcTag } from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { useRedditStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import * as MediaService from '../../../os/MediaService';
import * as TimeService from '../../../os/TimeService';
import { getUserAvatar } from '../utils/userIdentity';

/* ── flair data per community ── */
const COMMUNITY_FLAIRS: Record<string, string[]> = {
  games: [
    'Announcement', 'Release', 'Update', 'Mod News', 'Trailer', 'Review',
    'Preview', 'Overview', 'Patchnotes', 'Opinion Piece', 'Retrospective',
    'Industry News', 'Sale Event', 'Discussion', 'Impression Thread', 'Indie Sunday',
  ],
  music: [
    'Discussion', 'New Release', 'Article', 'AMA', 'Playlist',
    'Music Video', 'Live Performance', 'Album Review', 'Throwback', 'Recommendation',
  ],
  china_irl: [
    '新闻', '讨论', '观点', '科技', '历史', '文化',
    '生活', '娱乐', '政治', '经济', '教育', '问答',
  ],
  otherside: [
    'Discussion', 'Question', 'Story',
    'Rant', 'Advice', 'Wholesome',
  ],
};

const DEFAULT_FLAIR_COUNT = 6;

const TOOL_ITEMS = [
  { icon: IcLinkSimple, label: 'Link' },
  { icon: IcImage, label: 'Image' },
  { icon: IcPlayCircle, label: 'Video' },
  { icon: IcList, label: 'List' },
] as const;

/* ── Add Tags Bottom Sheet ── */
const AddTagsSheet: React.FC<{
  communityId: string;
  communityName: string;
  existingFlairs: string[];
  onApply: (flair: string | null) => void;
  onClose: () => void;
}> = ({ communityId, communityName, existingFlairs, onApply, onClose }) => {
  const flairs = COMMUNITY_FLAIRS[communityId] ?? [];
  const available = flairs.filter((f) => !existingFlairs.includes(f));
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const matchedBySearch = search.trim()
    ? available.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : available;

  // When searching, always show all matches; otherwise respect showAll toggle
  const filtered = search.trim() || showAll
    ? matchedBySearch
    : matchedBySearch.slice(0, DEFAULT_FLAIR_COUNT);
  const hasMore = !search.trim() && !showAll && matchedBySearch.length > DEFAULT_FLAIR_COUNT;

  // Strip the 'r/' prefix for display
  const displayName = communityName.replace(/^r\//, '');

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-app-surface rounded-t-2xl max-h-[80%] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <span className="text-lg font-bold text-app-text">Add tags</span>
          <button
            className={`text-base font-semibold ${
              selected ? 'text-app-text' : 'text-gray-400'
            }`}
            onClick={() => onApply(selected)}
          >
            Apply
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4">
          {/* Flair section */}
          <p className="text-base font-bold text-app-text mb-1">{displayName} flair</p>
          <p className="text-sm text-app-text-muted mb-3">
            Give this post community-specific context or categorization
          </p>

          {/* Search */}
          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 mb-4">
            <IcSearch className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
            />
          </div>

          {/* Radio list */}
          <div className="flex flex-col gap-3 mb-4">
            {/* None option */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selected === null ? 'border-blue-600' : 'border-gray-300'
                }`}
              >
                {selected === null && (
                  <div className="w-3 h-3 rounded-full bg-blue-600" />
                )}
              </div>
              <span className="text-base text-app-text">None</span>
            </label>

            {filtered.map((flair) => (
              <label
                key={flair}
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setSelected(flair)}
              >
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selected === flair ? 'border-blue-600' : 'border-gray-300'
                  }`}
                >
                  {selected === flair && (
                    <div className="w-3 h-3 rounded-full bg-blue-600" />
                  )}
                </div>
                <span className="bg-gray-100 rounded-full px-3 py-1 text-sm font-medium text-gray-700">
                  {flair}
                </span>
              </label>
            ))}
          </div>

          {hasMore && (
            <button
              className="text-sm font-medium text-blue-600 mb-6"
              onClick={() => setShowAll(true)}
            >
              View all flair
            </button>
          )}

          {/* Universal tags */}
          <p className="text-base font-bold text-app-text mb-4">Universal tags</p>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <IcShield className="w-5 h-5 text-app-text-muted" />
              <div>
                <p className="text-base text-app-text">Spoiler</p>
                <p className="text-sm text-app-text-muted">Tag posts that may ruin a surprise</p>
              </div>
            </div>
            <div className="w-11 h-6 rounded-full bg-gray-300 relative">
              <div className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-app-surface shadow" />
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <IcTag className="w-5 h-5 text-app-text-muted" />
              <div>
                <p className="text-base text-app-text">Brand affiliate</p>
                <p className="text-sm text-app-text-muted">Made for a brand or business</p>
              </div>
            </div>
            <div className="w-11 h-6 rounded-full bg-gray-300 relative">
              <div className="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-app-surface shadow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── CreatePage ── */
export const CreatePage: React.FC = () => {
  const { bindBack, bindTap, back } = useRedditGestures();
  const { createDraft, user } = useRedditStore(useShallow((s) => ({ createDraft: s.createDraft, user: s.user })));
  const storeAddFlair = useRedditStore((s) => s.addFlair);
  const storeCreatePost = useRedditStore((s) => s.createPost);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showTagSheet, setShowTagSheet] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [pickingImage, setPickingImage] = useState(false);

  const { selectedCommunity, selectedFlairs } = createDraft;
  const canPost = title.trim().length > 0 && (body.trim().length > 0 || imageUris.length > 0);

  const handlePickImage = async () => {
    if (pickingImage) return;
    setPickingImage(true);
    try {
      const result = await MediaService.pickMedia({ type: 'image', multiple: true, maxSelect: 20 });
      if (!result.cancelled && result.selected.length > 0) {
        setImageUris((prev) => {
          const existing = new Set(prev);
          const added = result.selected.map((i) => i.uri).filter((u) => !existing.has(u));
          return [...prev, ...added];
        });
      }
    } finally {
      setPickingImage(false);
    }
  };

  const removeImage = (uri: string) => {
    setImageUris((prev) => prev.filter((u) => u !== uri));
  };

  const handleApplyFlair = (flair: string | null) => {
    if (flair) {
      storeAddFlair(flair);
    }
    setShowTagSheet(false);
  };

  const handlePost = () => {
    if (!canPost) return;
    const id = `user_post_${TimeService.now()}`;
    storeCreatePost({
      id,
      subreddit: selectedCommunity?.name ?? 'r/self',
      subredditIcon: undefined,
      author: user.username,
      authorAvatar: getUserAvatar(user.username),
      timeAgo: 'now',
      title: title.trim(),
      content: body.trim(),
      image: imageUris[0],
      images: imageUris.length > 0 ? imageUris : undefined,
      upvotes: '1',
      comments: '0',
      shares: 0,
      isAd: false,
      commentsData: [],
    });
    back();
  };

  return (
    <div className="flex flex-col h-full bg-app-surface relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3">
        <div {...bindBack()} className="p-1">
          <IcClose className="w-6 h-6 text-gray-700" />
        </div>
        <div className="flex-1" />
        <button
          className={`px-5 py-2 rounded-full text-sm font-bold ${
            canPost
              ? 'bg-[#0045AC] text-white active:opacity-90'
              : 'bg-gray-100 text-gray-400'
          }`}
          disabled={!canPost}
          onClick={handlePost}
        >
          Post
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-20">
        {/* Community selector row */}
        <div className="flex items-center mb-4">
          <button
            {...bindTap('create.community.open')}
            className="flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2"
          >
            {selectedCommunity ? (
              <>
                <div
                  className={`w-6 h-6 rounded-full ${selectedCommunity.iconBg} flex items-center justify-center`}
                >
                  {selectedCommunity.iconText && (
                    <span className={`text-xs font-bold ${selectedCommunity.iconTextColor}`}>
                      {selectedCommunity.iconText}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-app-text">
                  {selectedCommunity.name}
                </span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
                  <span className="text-white text-xs font-bold">r/</span>
                </div>
                <span className="text-sm font-medium text-gray-700">Select a community</span>
              </>
            )}
            <div className="flex flex-col items-center ml-1">
              <IcCollapse className="w-3 h-3 text-app-text-muted -mb-0.5" />
              <IcExpand className="w-3 h-3 text-app-text-muted -mt-0.5" />
            </div>
          </button>

          {selectedCommunity && (
            <span className="ml-auto text-sm font-bold text-blue-600">RULES</span>
          )}
        </div>

        {/* Title input */}
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-3xl font-bold text-gray-800 placeholder-gray-300 outline-none mb-3"
        />

        {/* Selected flairs */}
        {selectedFlairs.map((flair, idx) => (
          <div
            key={`${flair}-${idx}`}
            className="inline-block bg-gray-200 rounded-full px-4 py-2 text-sm font-medium text-gray-700 mr-2 mb-2"
          >
            {flair}
          </div>
        ))}

        {/* Add tags & flair */}
        <div className="mb-5">
          <button
            className="flex items-center bg-gray-200 rounded-full px-4 py-2"
            onClick={() => selectedCommunity && setShowTagSheet(true)}
          >
            <span className="text-sm font-bold text-gray-600">
              Add tags & flair (optional)
            </span>
          </button>
        </div>

        {/* Attached images preview */}
        {imageUris.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {imageUris.map((uri, idx) => (
              <div key={`${uri}-${idx}`} className="relative flex-shrink-0 w-[140px] h-[140px] rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={uri}
                  alt={`Attached ${idx + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
                <button
                  type="button"
                  onClick={() => removeImage(uri)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center active:bg-black/70"
                  aria-label="Remove image"
                >
                  <IcClose className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </button>
                {imageUris.length > 1 && (
                  <div className="absolute bottom-1.5 left-1.5 bg-black/50 rounded-full px-1.5 py-0.5">
                    <span className="text-[10px] text-white font-bold">{idx + 1}/{imageUris.length}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body text */}
        <div>
          <textarea
            placeholder={selectedCommunity ? '' : 'body text (optional)'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full min-h-[200px] text-lg text-gray-600 placeholder-gray-300 outline-none resize-none"
          />
          {selectedCommunity && !body && imageUris.length === 0 && (
            <div className="absolute pointer-events-none text-lg text-gray-300" style={{ marginTop: '-216px' }}>
              body text<span className="text-orange-400">*</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-5">
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-8">
            {TOOL_ITEMS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="p-1"
                onClick={label === 'Image' ? handlePickImage : undefined}
              >
                <Icon className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button className="p-2">
            <IcSend className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Flair sheet */}
      {showTagSheet && selectedCommunity && (
        <AddTagsSheet
          communityId={selectedCommunity.id}
          communityName={selectedCommunity.name}
          existingFlairs={selectedFlairs}
          onApply={handleApplyFlair}
          onClose={() => setShowTagSheet(false)}
        />
      )}
    </div>
  );
};
