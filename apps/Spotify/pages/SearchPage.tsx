import React from 'react';
import { useLocale } from '@/os/locale';
import { IcCamera, IcSearch } from '../res/icons';
import { SPOTIFY_CONFIG } from '../data';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyCategoryTitle, localizeSpotifyDiscoverTitle } from '../utils/localizeCategoryTitle';

interface SearchCategory {
  id: string;
  title: string;
  image: string;
  bg: string;
}

export const SearchPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();

  return (
    <div className="flex h-full flex-col bg-app-bg pt-10 text-white">
      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="flex-1 overflow-y-auto px-4 pb-40"
      >
        <header className="mb-6 flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <div
              {...bindTap('search.sidebar.open')}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-amber-700 text-sm font-bold transition-transform active:scale-95"
            >
              {SPOTIFY_CONFIG.user.initial}
            </div>
            <h1 className="text-2xl font-bold">{s.search_title}</h1>
          </div>
          <button className="text-white">
            <IcCamera size={26} />
          </button>
        </header>

        <div
          {...bindTap('search.input.open')}
          className="sticky top-0 z-40 isolate -mx-4 mb-8 cursor-pointer bg-app-bg px-4 pb-4"
        >
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <IcSearch size={20} />
            </div>
            <div className="flex h-12 items-center rounded bg-white pl-10 pr-4 text-base text-gray-400">
              {s.search_placeholder}
            </div>
          </div>
        </div>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-extrabold text-white">{s.search_section_discover}</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {(SPOTIFY_CONFIG as any).searchDiscover?.map((item: SearchCategory) => {
              const localizedTitle = localizeSpotifyDiscoverTitle(item.id, item.title, isEnglish);
              return (
                <div
                  key={item.id}
                  {...bindTap('video.open', { params: { id: item.id } })}
                  className={`relative aspect-[3/5] w-32 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg ${item.bg}`}
                >
                  <img src={item.image} alt={localizedTitle} className="absolute inset-0 z-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-3 right-3 z-20">
                    <div className="break-words text-lg font-bold leading-tight">{localizedTitle}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-extrabold text-white">{s.search_section_browse_all}</h2>
          <div className="grid grid-cols-2 gap-3">
            {SPOTIFY_CONFIG.searchCategories.map(item => {
              const localizedTitle = localizeSpotifyCategoryTitle(item.id, item.title, isEnglish);
              return (
                <div
                  key={item.id}
                  {...bindTap('category.open', { params: { id: item.id } })}
                  className={`relative h-28 cursor-pointer overflow-hidden rounded ${item.bg}`}
                >
                  <div className="absolute left-3 top-3 z-10 whitespace-pre-line text-lg font-bold leading-tight">
                    {localizedTitle}
                  </div>
                  <div className="absolute -bottom-2 -right-4 h-20 w-20 rotate-[25deg] transform shadow-lg">
                    <img src={item.image} alt={localizedTitle} className="h-full w-full rounded object-cover shadow" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
