import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStrings } from '@/os/useAppStrings';
import { IcArrowBack, IcClose, IcComment, IcSearch, IcUpvote } from '../res/icons';
import { useRedditGestures } from '../hooks/useRedditGestures';
import { useRedditStore } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import type { RedditCommunity, RedditPost } from '../types';
import { REDDIT_COMMUNITIES } from '../data';
import { useRedditPosts } from '../hooks/useRedditPosts';

const TRENDING_TOPICS = [
  { title: 'Arc Raiders Shrouded Sky Update', subtitle: 'Based on your interests' },
  { title: 'Huntarr Security Vulnerability', subtitle: 'Based on your interests' },
  { title: 'XG Producer Arrested', subtitle: 'Based on your interests' },
  { title: 'Anthropic Pentagon Conflict', subtitle: 'Based on your interests' },
  { title: 'Mexico Cartel Leader Killed', subtitle: 'Based on your interests' },
  { title: 'Puerto Vallarta Cartel Violence', subtitle: 'Based on your interests' },
];

const normalizeForSearch = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

const matchesWord = (text: string, query: string): boolean => {
  if (!text || !query) return false;
  const trimmed = query.trim();
  if (!trimmed) return false;

  const hasNonAscii = /[^\x00-\x7F]/.test(trimmed);
  if (hasNonAscii || /\s/.test(trimmed)) {
    const normalizedText = normalizeForSearch(text);
    const normalizedQuery = normalizeForSearch(trimmed);
    return normalizedQuery.length > 0 && normalizedText.includes(normalizedQuery);
  }

  const escapedQuery = trimmed.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedQuery}`, 'i').test(text);
};

export const SearchPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack, bindTap } = useRedditGestures();
  const posts = useRedditPosts();
  const communities = REDDIT_COMMUNITIES;
  const { user } = useRedditStore(useShallow((state) => ({
    user: state.user,
  })));
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'communities' | 'comments'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 150);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    inputRef.current?.focus();
  }, []);

  const searchedPosts = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const query = debouncedQuery.trim();
    const results: RedditPost[] = [];
    for (const post of posts) {
      if (
        matchesWord(post.title || '', query) ||
        matchesWord(post.content || '', query) ||
        matchesWord(post.author || '', query) ||
        matchesWord(post.subreddit || '', query)
      ) {
        results.push(post);
        if (results.length >= 50) break;
      }
    }
    return results;
  }, [debouncedQuery, posts]);

  const searchedCommunities = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const query = debouncedQuery.trim();
    const results: RedditCommunity[] = [];
    for (const community of communities) {
      if (matchesWord(community.name || '', query)) {
        results.push(community);
        if (results.length >= 20) break;
      }
    }
    return results;
  }, [debouncedQuery, communities]);

  const showResults = debouncedQuery.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-app-surface">
      <div className="pt-10 px-3 pb-3 bg-app-surface border-b border-app-border">
        <div className="flex items-center gap-3">
          <button
            {...bindBack()}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100"
            aria-label={s.search_back}
          >
            <IcArrowBack className="w-6 h-6 text-app-text" strokeWidth={2} />
          </button>

          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5 border-2 border-gray-300">
            <IcSearch className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Reddit"
              className="flex-1 bg-transparent outline-none text-base text-app-text placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="w-6 h-6 flex items-center justify-center rounded-full active:bg-gray-200"
                aria-label={s.search_clear}
              >
                <IcClose className="w-5 h-5 text-app-text-muted" strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
            {user.avatar && (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        {!showResults ? (
          <div className="px-4 py-4">
            <h2 className="text-lg font-bold text-app-text mb-4">{s.search_trending}</h2>
            <div className="space-y-1">
              {TRENDING_TOPICS.map((topic, index) => (
                <button
                  key={index}
                  className="w-full flex items-start gap-3 px-3 py-3 rounded-lg active:bg-gray-100 text-left"
                >
                  <div className="pt-1">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-app-text-muted">
                      <path
                        d="M16 6L18.29 8.29L13.41 13.17L9.41 9.17L2 16.59L3.41 18L9.41 12L13.41 16L19.71 9.71L22 12V6H16Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[15px] text-app-text leading-tight">{topic.title}</h3>
                    <p className="text-sm text-app-text-muted mt-0.5">{topic.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center border-b border-app-border px-4 bg-app-surface sticky top-0 z-10">
              {([
                ['all', s.search_tab_all],
                ['posts', s.search_tab_posts],
                ['communities', s.search_tab_communities],
                ['comments', s.search_tab_comments],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-[15px] font-semibold relative ${activeTab === tab ? 'text-app-text' : 'text-app-text-muted'}`}
                >
                  {label}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-app-text" />
                  )}
                </button>
              ))}
            </div>

            {searchedCommunities.length > 0 && (activeTab === 'all' || activeTab === 'communities') && (
              <div className="px-4 py-3">
                <h3 className="text-base font-bold text-app-text-muted mb-3">{s.search_tab_communities}</h3>
                <div className="space-y-1">
                  {searchedCommunities.map((community) => (
                    <button
                      key={community.id}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg active:bg-gray-100 text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 relative">
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-app-text-muted">
                          r
                        </div>
                        {community.icon && (
                          <img
                            src={community.icon}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover"
                            alt=""
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[15px] text-app-text">{community.name}</h4>
                        <p className="text-xs text-app-text-muted">{community.members} {s.search_members}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchedPosts.length > 0 && (activeTab === 'all' || activeTab === 'posts') && (
              <div className="px-4 py-3">
                {activeTab === 'all' && searchedCommunities.length > 0 && (
                  <h3 className="text-base font-bold text-app-text mb-3">{s.search_tab_posts}</h3>
                )}
                <div className="space-y-3">
                  {searchedPosts.map((post) => {
                    const postRef = bindTap('post.comments.open', { params: { postId: post.id } });
                    return (
                      <div
                        key={post.id}
                        {...postRef}
                        className="bg-app-surface border border-app-border rounded-lg p-3 active:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0 relative">
                            <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-app-text-muted">r</div>
                            {post.subredditIcon && (
                              <img
                                src={post.subredditIcon}
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover"
                                alt=""
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-app-text">{post.subreddit}</span>
                          <span className="text-xs text-app-text-muted">· {post.timeAgo}</span>
                        </div>

                        <h3 className="text-[15px] font-semibold text-app-text mb-2 leading-tight">
                          {post.title}
                        </h3>

                        {post.image && (
                          <div className="mb-2 rounded-lg overflow-hidden bg-gray-100">
                            <img
                              src={post.image}
                              loading="lazy"
                              alt=""
                              className="w-full h-auto"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-app-text-muted">
                          <div className="flex items-center gap-1">
                            <IcUpvote className="w-5 h-5" strokeWidth={1.5} />
                            <span className="text-xs font-semibold">{post.upvotes}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <IcComment className="w-4 h-4" strokeWidth={2} />
                            <span className="text-xs font-semibold">{post.comments}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {searchedPosts.length === 0 && searchedCommunities.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-app-text-muted text-sm">{s.search_no_results}</p>
                <p className="text-gray-400 text-xs mt-1">{s.search_try_other}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
