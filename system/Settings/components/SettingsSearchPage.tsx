import React, { useMemo, useState } from 'react';
import { IcNavBack, IcSearch, IcClose } from '../res/icons';
import { SETTINGS_PAGE_OVERRIDES } from '../data/settingsOverrides';
import { PreferenceItem } from './PreferenceItem';
import type { SettingsPage } from '../types';
import { useSettingsStrings } from '../res/useSettingsStrings';
import { useSettingsStore, selectPagesData, selectPagesLoading, selectPagesError } from '../state';
import { useSettingsGestures } from '../hooks/useSettingsGestures';
type SearchResult = {
  pageId: string;
  title: string;
  preview?: string;
  score: number;
};

function includesInsensitive(haystack: string, needle: string) {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export const SettingsSearchPage: React.FC = () => {
  const { bindTap, bindBack } = useSettingsGestures();
  const { s, t } = useSettingsStrings();
  const [query, setQuery] = useState('');
  const data = useSettingsStore(selectPagesData);
  const loading = useSettingsStore(selectPagesLoading);
  const error = useSettingsStore(selectPagesError);
  const mainSections = data?.mainSections ?? null;
  const pages = data?.pages ?? null;

  const allPages: Record<string, SettingsPage> = useMemo(() => {
    // Prefer hand-written overrides when present.
    return { ...(pages || {}), ...SETTINGS_PAGE_OVERRIDES };
  }, [pages]);

  const mainTargetPageTitleMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    if (!mainSections) return map;
    for (const section of mainSections) {
      for (const item of section.items) {
        if (item.targetPage && item.title && !map[item.targetPage]) {
          map[item.targetPage] = item.title;
        }
      }
    }
    return map;
  }, [mainSections]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim();
    if (!q) return [];

    const out: SearchResult[] = [];

    for (const [pageId, page] of Object.entries(allPages)) {
      const title = mainTargetPageTitleMap[pageId] || page.title || pageId;
      let score = 0;
      let preview = '';

      if (includesInsensitive(title, q) || includesInsensitive(pageId, q)) {
        score = 100;
      } else {
        // Try match within items
        for (const cat of page.categories || []) {
          for (const item of cat.items || []) {
            if (item.title && includesInsensitive(item.title, q)) {
              score = 60;
              preview = item.title;
              break;
            }
            if (item.summary && includesInsensitive(item.summary, q)) {
              score = 40;
              preview = item.summary;
              break;
            }
          }
          if (score) break;
        }
      }

      if (score) {
        out.push({
          pageId,
          title,
          preview: preview || undefined,
          score,
        });
      }
    }

    out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-Hans-CN'));
    return out.slice(0, 60);
  }, [allPages, query]);

  const hasQuery = query.trim().length > 0;
  const hasData = !!pages;

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <div className="sticky top-0 z-20 bg-app-bg">
        <div className="h-10" />
        <div className="flex items-center h-11 px-2 gap-2">
          <button
            {...bindBack<HTMLButtonElement>()}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
            aria-label={s.back}
            type="button"
          >
            <IcNavBack size={24} className="text-gray-800" />
          </button>

          <div className="flex-1 bg-white/80 backdrop-blur rounded-full flex items-center px-4 py-2.5 gap-2">
            <IcSearch size={16} className="text-gray-400 flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.search_settings}
              className="flex-1 bg-transparent outline-none text-[14px] text-app-text placeholder:text-gray-400"
              autoFocus
            />
            {hasQuery && (
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
                aria-label={s.clear}
                onClick={() => setQuery('')}
              >
                <IcClose size={14} className="text-app-text-muted" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {!hasQuery ? (
          <div className="px-6 py-10 text-[13px] text-gray-400">{s.enter_keywords_to_search}</div>
        ) : !hasData ? (
          <div className="px-6 py-10 text-[13px] text-gray-400">
            {error ? s.settings_data_load_failed : (loading ? s.loading_settings_data : s.settings_data_not_ready)}
          </div>
        ) : results.length === 0 ? (
          <div className="px-6 py-10 text-[13px] text-gray-400">{s.no_matching_settings_found}</div>
        ) : (
          <div className="px-4 mt-2">
            <div className="bg-app-surface rounded-2xl overflow-hidden">
              {results.map((r, idx) => (
                <PreferenceItem
                  key={r.pageId}
                  title={t(r.title)}
                  summary={r.preview ? t(r.preview) : undefined}
                  showDivider={idx < results.length - 1}
                  showChevron={true}
                  itemProps={bindTap<HTMLDivElement>('page.open', { params: { pageId: r.pageId } })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
