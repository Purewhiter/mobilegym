import React from 'react';
import { useLocale } from '@/os/locale';
import { useParams } from 'react-router-dom';
import { IcAdd, IcMoreVertical, IcNavBackArrow, IcPlay, IcShare } from '../res/icons';
import { loadCategories } from '../data/loader';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';

export const CategoryPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindBack } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const { id } = useParams<{ id: string }>();
  const [categoryMap, setCategoryMap] = React.useState<Record<string, any> | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);

  React.useEffect(() => {
    let alive = true;
    loadCategories()
      .then((map) => {
        if (alive) setCategoryMap(map);
      })
      .catch((error) => {
        if (!alive) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      alive = false;
    };
  }, []);

  const staticContent = React.useMemo<Record<string, any>>(() => ({
    sc_2025: {
      type: '2025',
      title: s.category_2025_review,
      bg: 'bg-[#181818]',
      bannerText: s.category_2025_top_artists,
      items: [
        { title: s.category_2025_local, sub: `8,194 ${s.category_saves_count}`, img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80' },
        { title: s.category_2025_hk_artists, sub: `3,801 ${s.category_saves_count}`, img: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&q=80' },
        { title: s.category_2025_hk_songs, sub: `6,034 ${s.category_saves_count}`, img: 'https://images.unsplash.com/photo-1521156294747-d3eb0f576e31?w=300&q=80' },
      ],
    },
    sc_upcoming: {
      type: 'upcoming',
      title: s.category_upcoming_title,
      bg: 'bg-app-surface',
      subtitle: s.category_upcoming_subtitle,
      items: [
        { day: 'Feb 6', title: 'Piss In The Wind', artist: 'Joji', sub: `1.0287M ${s.category_pre_save_count}`, img: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80' },
        { day: 'Feb 27', title: 'The Mountain', artist: 'Gorillaz', sub: `889K ${s.category_pre_save_count}`, img: 'https://images.unsplash.com/photo-1459749411177-8c4750bb06bb?w=300&q=80' },
        { day: 'in 8 days', title: "Don't...", artist: 'A$AP Rocky', sub: '731K', img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&q=80' },
      ],
    },
  }), [
    s.category_2025_hk_artists,
    s.category_2025_hk_songs,
    s.category_2025_local,
    s.category_2025_review,
    s.category_2025_top_artists,
    s.category_pre_save_count,
    s.category_saves_count,
    s.category_upcoming_subtitle,
    s.category_upcoming_title,
  ]);

  const fetched = id && categoryMap ? categoryMap[id] : undefined;
  const content = fetched || (id && staticContent[id]) || {
    type: 'generic',
    title: s.category_detail,
    bg: 'bg-app-surface',
    items: [],
  };

  const renderContent = () => {
    if (id && !staticContent[id] && !fetched) {
      if (!categoryMap && !loadError) {
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg font-bold mb-2">{s.category_loading}</p>
            <p className="text-sm">{s.category_loading_content}</p>
          </div>
        );
      }
      if (loadError) {
        return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg font-bold mb-2">{s.category_load_failed}</p>
            <p className="text-sm">{loadError}</p>
          </div>
        );
      }
    }

    if (content.type === 'generic') {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <p className="text-lg font-bold mb-2">{s.category_more_developing}</p>
          <p className="text-sm">{s.category_no_data}</p>
        </div>
      );
    }

    if (content.type === 'podcast_grid') {
      return (
        <div className="pt-2">
          <h2 className="text-xl font-bold mb-4">{content.title}</h2>
          <div className="grid grid-cols-2 gap-4 pb-8">
            {content.items?.map((item: any, index: number) => (
              <div key={index} className="flex-col gap-2 relative group cursor-pointer">
                <div className="w-full aspect-square bg-gray-800 rounded-md overflow-hidden mb-2 shadow-lg">
                  <img src={item.img} className="w-full h-full object-cover group-hover:scale-105" style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
                </div>
                <div className="font-bold text-white text-sm line-clamp-2 leading-tight">{displayText(item.title)}</div>
                <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{displayText(item.sub)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (content.type === 'music' || content.type === 'live') {
      return (
        <div className="pt-2">
          {content.sections.map((section: any, index: number) => (
            <div key={index} className="mb-8">
              <h2 className="text-xl font-bold mb-4">{section.title}</h2>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                {section.items.map((item: any, itemIndex: number) => (
                  <div key={itemIndex} className={`flex-shrink-0 ${item.isLarge ? 'w-40' : 'w-36'} cursor-pointer group`}>
                    <div className={`w-full aspect-square bg-gray-800 mb-2 relative shadow-lg ${item.isCircle ? 'rounded-full' : 'rounded-md'} overflow-hidden`}>
                      <img src={item.img} className="w-full h-full object-cover group-hover:scale-105" style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
                      {content.type === 'live' && !item.isCircle && (
                        <div className="absolute top-2 left-2 bg-white/90 rounded-md px-2 py-1 flex flex-col items-center shadow-sm">
                          <span className="text-[10px] font-bold text-black uppercase leading-none">Jan</span>
                          <span className="text-base font-black text-black leading-none">{10 + itemIndex}</span>
                        </div>
                      )}
                    </div>
                    <div className={`font-bold text-white truncate ${item.isCircle ? 'text-center' : ''}`}>{displayText(item.title)}</div>
                    <div className={`text-xs text-gray-400 truncate ${item.isCircle ? 'text-center' : ''}`}>{displayText(item.sub)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (content.type === '2025') {
      return (
        <div className="pt-4">
          <h2 className="text-2xl font-bold mb-6 text-center">{content.bannerText}</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-6">
            {content.items.map((item: any, index: number) => (
              <div key={index} className="flex-shrink-0 w-40">
                <div className="w-40 h-40 bg-gray-800 mb-2 border-2 border-white/20 p-1 relative">
                  <div className="absolute top-2 left-2 border-l-2 border-white h-full opacity-50 z-0" />
                  <img src={item.img} className="w-full h-full object-cover grayscale contrast-125 z-10 relative" />
                  <div className="absolute bottom-0 bg-white text-black text-[10px] w-full p-1 font-bold leading-tight">
                    {displayText(item.title)}
                  </div>
                </div>
                <div className="font-bold text-white text-sm mt-3 leading-tight h-10 overflow-hidden">{displayText(item.title)}</div>
                <div className="text-xs text-gray-400 mt-1">{displayText(item.sub)}</div>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Stories from our Editors</h2>
            <div className="flex gap-4 overflow-x-auto">
              {[1, 2, 3].map((value) => (
                <div key={value} className="w-32 h-56 bg-gray-800 rounded-lg flex-shrink-0 flex items-end p-3 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                  <span className="relative z-10 font-bold text-sm">Best of 2025</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (content.type === 'upcoming') {
      return (
        <div className="pt-2">
          <h2 className="text-xl font-bold mb-4">{content.subtitle}</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {content.items.map((item: any, index: number) => (
              <div key={index} className="flex-shrink-0 w-40">
                <div className="w-40 h-40 bg-gray-800 mb-2 rounded-md overflow-hidden relative">
                  <img src={item.img} className="w-full h-full object-cover" />
                </div>
                <div className="text-xs text-gray-400 mb-1">{s.category_release_date} {item.day}</div>
                <div className="font-bold text-base text-white truncate">{displayText(item.title)}</div>
                <div className="text-sm text-gray-400 truncate">{displayText(item.artist)}</div>
                <div className="text-xs text-gray-500 mt-1">{displayText(item.sub)}</div>

                <div className="flex items-center justify-between mt-3 text-gray-400">
                  <IcAdd size={20} />
                  <IcShare size={20} />
                  <IcMoreVertical size={20} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <div className="text-center text-gray-500 mt-20">{s.category_no_content}</div>;
  };

  return (
    <div
      data-scroll-container="main"
      data-scroll-direction="vertical"
      className={`flex flex-col h-full bg-app-bg text-white px-4 pt-10 pb-40 overflow-y-auto ${content.type === '2025' ? 'bg-[#181818]' : ''}`}
    >
      <div className="flex items-center justify-between mb-6">
        <button {...bindBack()}><IcNavBackArrow size={24} /></button>
        {content.type !== '2025' && <h1 className="text-xl font-bold">{displayText(content.title)}</h1>}
        <div className="flex gap-4">
          {content.type === 'upcoming' ? <IcShare size={24} /> : null}
        </div>
      </div>

      {content.type === '2025' && (
        <div className="mb-8">
          <button {...bindBack()} className="mb-4">
            <IcNavBackArrow size={24} />
          </button>
          <h1 className="text-4xl font-extrabold leading-tight text-white mb-2 whitespace-pre-line">{s.category_2025_annual_review}</h1>
        </div>
      )}

      {renderContent()}
    </div>
  );
};
