import React, { useEffect, useState } from 'react';
import { useLocale } from '@/os/locale';
import { IcSearch, IcAdd, IcSort, IcGrid, IcHeart, IcPin, IcDownload, IcNavForward, IcCheck, IcNavBackArrow } from '../res/icons';
import { useSearchParams } from 'react-router-dom';
import { SPOTIFY_CONFIG } from '../data';
import { useSpotifyStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyArtistName, localizeSpotifyText } from '../utils/localizeSpotifyText';
interface LibraryItem {
  id: string;
  name: string;
  type: 'artist' | 'playlist' | 'button';
  subtitle: string;
  image?: string;
  pinned?: boolean;
}

const INITIAL_ARTISTS: LibraryItem[] = [
  { id: 'liked', name: '已点赞的歌曲', type: 'playlist', subtitle: '歌单 • 7 首歌曲', image: '', pinned: true },
  { id: 'xs', name: '许嵩', type: 'artist', subtitle: '艺人', image: '' },
  { id: 'jj', name: '林俊杰', type: 'artist', subtitle: '艺人', image: '' },
  { id: 'jay', name: '周杰伦', type: 'artist', subtitle: '艺人', image: '' },
  { id: 'add', name: '添加艺人', type: 'button', subtitle: '', image: '' },
];

const SUGGESTED_NAMES = [
  "孙燕姿", "薛之谦", "陈奕迅", "张惠妹", "莫文蔚", "BTS", "NewJeans",
  "周深", "谭维维", "陆虎", "王铮亮", "刘宇宁", "李琦", "杨坤", "张杰", "Taylor Swift", "邓紫棋", "李荣浩"
];

// Helper to fetch image
const fetchArtistImage = async (name: string): Promise<string | undefined> => {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=album&limit=1&country=TW`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].artworkUrl100?.replace('100x100bb', '400x400bb');
    }
  } catch (e) {
    console.error(e);
  }
  return undefined;
};

const AddArtistView: React.FC<{ onAdd: (items: LibraryItem[]) => void, existingNames: string[] }> = ({ onAdd, existingNames }) => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindBack, bindTap, back } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const [candidates, setCandidates] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<LibraryItem[] | null>(null);

  useEffect(() => {
    const load = async () => {
      // Filter out artists already in library
      const namesToLoad = SUGGESTED_NAMES.filter(n => !existingNames.includes(n));

      const promises = namesToLoad.map(async (name) => {
        const img = await fetchArtistImage(name);
        return {
          id: name,
          name: name,
          type: 'artist' as const,
          subtitle: '艺人',
          image: img
        };
      });

      const results = await Promise.all(promises);
      setCandidates(results);
    };
    load();
  }, []);

  const performSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=album&limit=20&country=TW`);
      const data = await res.json();
      const rawResults = data.results || [];

      // Deduplicate by artist name and map
      const uniqueArtists = new Map();
      rawResults.forEach((r: any) => {
        // Clean up artist name (sometimes has suffix)
        const name = r.artistName;
        if (!uniqueArtists.has(name)) {
          uniqueArtists.set(name, {
            id: name,
            name: name,
            type: 'artist',
            subtitle: '艺人',
            image: r.artworkUrl100?.replace('100x100bb', '400x400bb')
          });
        }
      });

      setSearchResults(Array.from(uniqueArtists.values()));
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') performSearch();
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  const handleDone = () => {
    // Collect from both candidates and searchResults
    const pool = [...candidates, ...(searchResults || [])];
    // Unique map by id to find full object
    const poolMap = new Map(pool.map(i => [i.id, i]));

    const selectedItems = Array.from(selected).map(id => poolMap.get(id)).filter(Boolean) as LibraryItem[];
    onAdd(selectedItems);
    back();
  };

  const listToRender = searchResults || candidates;

  return (
    <div className="absolute inset-0 bg-app-surface z-50 flex flex-col pt-10 pb-20 px-4 overflow-hidden animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center mb-4">
        <button {...bindBack()} className="p-2 -ml-2 rounded-full active:bg-white/10">
          <IcNavBackArrow size={22} />
        </button>
      </div>
      <div className="flex flex-col mb-4">
        <h1 className="text-3xl font-bold text-white mb-6 leading-tight whitespace-pre-line">{s.library_add_artist_title}</h1>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
            <IcSearch size={20} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              if (!e.target.value) setSearchResults(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={s.library_add_artist_search}
            className="w-full h-10 rounded bg-white text-black pl-10 pr-4 font-bold placeholder-gray-800 focus:outline-none"
          />
        </div>
      </div>

      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="flex-1 overflow-y-auto -mx-2 px-2 no-scrollbar grid grid-cols-3 gap-y-6 gap-x-2 pb-40"
      >
        {listToRender.map((item, idx) => {
          const isSelected = selected.has(item.id);
          return (
            <div
              key={`${item.id}-${idx}`}
              {...bindTap(
                { kind: 'action', id: 'library.addArtist.artist.toggle' },
                {
                  params: { artistId: item.id, to: !isSelected },
                  onTrigger: () => toggleSelection(item.id),
                },
              )}
              className="flex flex-col items-center gap-2 cursor-pointer relative group"
            >
              <div className={`w-24 h-24 rounded-full overflow-hidden relative transition-transform ${isSelected ? 'scale-95' : 'group-active:scale-95'}`}>
                {item.image ? (
                  <img src={item.image} className={`w-full h-full object-cover transition-opacity ${isSelected ? 'opacity-80' : ''}`} />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center text-2xl font-bold text-gray-500">{item.name[0]}</div>
                )}
                {/* Checkmark overlay */}
                {isSelected && (
                  <div className="absolute right-0 top-0 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-md">
                    <IcCheck size={16} color="black" strokeWidth={4} />
                  </div>
                )}
              </div>
              <div className="text-white font-bold text-sm text-center line-clamp-2 leading-tight">{localizeSpotifyArtistName(item.name, isEnglish)}</div>
            </div>
          );
        })}
      </div>

      {/* Floating Done Button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
        <button
          {...bindTap(
            { kind: 'action', id: 'library.addArtist.submit' },
            { onTrigger: handleDone },
        )}
        className="bg-white text-black text-lg font-bold px-10 py-3 rounded-full shadow-xl pointer-events-auto hover:scale-105 transition-transform"
      >
          {s.library_add_artist_done}
        </button>
      </div>
    </div>
  );
};

export const LibraryPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [searchParams, setSearchParams] = useSearchParams();
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const { likedSongs, customPlaylists, followedArtists } = useSpotifyStore(useShallow(s => ({
    likedSongs: s.likedSongs, customPlaylists: s.customPlaylists, followedArtists: s.followedArtists,
  })));
  const likedCount = likedSongs?.length || 0;
  const activeFilter = (searchParams.get('filter') ?? 'all') as 'all' | 'playlist' | 'artist';
  const setActiveFilter = (val: 'all' | 'playlist' | 'artist') =>
    setSearchParams(p => { if (val === 'all') p.delete('filter'); else p.set('filter', val); return p; }, { replace: true });

  // Artist images cache (fetched from iTunes)
  const [artistImages, setArtistImages] = useState<Record<string, string>>({});
  const showAddArtist = searchParams.get('sheet') === 'add_artist';

  useEffect(() => {
    const fetchImages = async () => {
      const toFetch = (followedArtists || []).filter(name => !artistImages[name]);
      for (const name of toFetch) {
        const img = await fetchArtistImage(name);
        if (img) {
          setArtistImages(prev => ({ ...prev, [name]: img }));
        }
      }
    };
    fetchImages();
  }, [followedArtists]);

  const toggleFollowArtist = useSpotifyStore(s => s.toggleFollowArtist);

  const handleAddArtists = (newItems: LibraryItem[]) => {
    for (const item of newItems) {
      if (item.type === 'artist' && !followedArtists.some(n => n.trim().toLowerCase() === item.name.trim().toLowerCase())) {
        toggleFollowArtist(item.name);
      }
    }
  };

  if (showAddArtist) {
    return <AddArtistView
      onAdd={handleAddArtists}
      existingNames={followedArtists || []}
    />;
  }

  const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);

  return (
    <div
      data-scroll-container="main"
      data-scroll-direction="vertical"
      className="flex flex-col h-full overflow-y-auto bg-app-bg text-white transition-all"
    >
      <div className="sticky top-0 z-10 bg-app-bg px-4 pt-10 pb-2">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              {...bindTap('library.sidebar.open')}
              className="w-9 h-9 rounded-full bg-amber-700 flex items-center justify-center text-sm font-bold cursor-pointer active:scale-95 transition-transform"
            >
              {SPOTIFY_CONFIG.user.initial}
            </div>
            <div className="text-2xl font-bold">{s.library_title}</div>
          </div>
          <div className="flex items-center gap-6">
            <IcSearch size={26} />
            <IcAdd
              size={28}
              {...(bindTap('library.create.open') as unknown as Record<string, unknown>)}
              className="cursor-pointer active:scale-95 transition-transform"
            />
          </div>
        </header>

        {/* Chips */}
        <div className="flex items-center gap-2">
          {activeFilter !== 'all' && (
            <button
              className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center text-white"
              onClick={() => setActiveFilter('all')}
            >
              ✕
            </button>
          )}
          {(activeFilter === 'all' || activeFilter === 'playlist') && (
            <button
              className={`px-4 py-1.5 rounded-full text-sm font-medium border border-transparent ${activeFilter === 'playlist' ? 'bg-app-primary text-black' : 'bg-[#2A2A2A] text-white'}`}
              onClick={() => setActiveFilter(activeFilter === 'playlist' ? 'all' : 'playlist')}
            >{s.library_chip_playlist}</button>
          )}
          {activeFilter === 'playlist' && (
            <button className="px-4 py-1.5 rounded-full bg-[#2A2A2A] text-white text-sm font-medium border border-transparent">
              {s.library_chip_creator_you}
            </button>
          )}
          {(activeFilter === 'all' || activeFilter === 'artist') && (
            <button
              className={`px-4 py-1.5 rounded-full text-sm font-medium border border-transparent ${activeFilter === 'artist' ? 'bg-app-primary text-black' : 'bg-[#2A2A2A] text-white'}`}
              onClick={() => setActiveFilter(activeFilter === 'artist' ? 'all' : 'artist')}
            >{s.library_chip_artist}</button>
          )}
        </div>
      </div>

      <div className="px-4 pb-40">
        {/* Sort / View */}
        <div className="mt-4 mb-4 flex items-center justify-between px-1 text-gray-400">
          <button className="flex items-center gap-1 text-sm font-medium text-white">
            <IcSort size={16} />
            <span>{s.library_sort_recent}</span>
          </button>
          <IcGrid size={20} />
        </div>

        {/* Content List */}
        <div className="space-y-3">

          {/* Import Card */}
          {activeFilter !== 'artist' && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-[#2A2A2A] p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center text-gray-400">
                <IcDownload size={24} />
              </div>
              <span className="text-base font-bold">{s.library_import_music}</span>
            </div>
            <IcNavForward size={20} className="text-gray-400" />
          </div>
          )}

        {/* Liked Songs */}
        {activeFilter !== 'artist' && (
        <div
          {...bindTap('likedSongs.open')}
          className="flex items-center gap-4 p-2 -mx-2 active:bg-black/20 rounded-md cursor-pointer transition-colors hover:bg-white/10"
        >
          <div className="w-[76px] h-[76px] bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center flex-shrink-0">
            <IcHeart size={30} fill="white" className="text-white" />
          </div>
          <div>
            <div className="text-[17px] font-bold text-app-primary mb-0.5">{s.library_liked_songs}</div>
            <div className="flex items-center gap-1 text-[13px] text-gray-400 font-medium">
              <IcPin size={12} fill="#1ED760" className="text-app-primary rotate-45" />
              <span>{s.library_playlist_count.replace('{count}', String(likedCount))}</span>
            </div>
          </div>
        </div>
        )}

        {/* Custom Playlists */}
        {activeFilter !== 'artist' && customPlaylists?.map((playlist) => (
          <div
            key={playlist.id}
            {...bindTap('playlist.open', { params: { id: playlist.id } })}
            className="flex items-center gap-4 p-2 -mx-2 active:bg-black/20 rounded-md cursor-pointer transition-colors hover:bg-white/10"
          >
            <div className="w-[76px] h-[76px] bg-[#282828] flex items-center justify-center flex-shrink-0">
              <span className="text-gray-500 text-2xl font-bold">{displayText(('title' in playlist ? playlist.title : playlist.name))[0]}</span>
            </div>
            <div>
              <div className="text-[17px] font-bold text-white mb-0.5">{displayText('title' in playlist ? playlist.title : playlist.name)}</div>
              <div className="text-[13px] text-gray-400 font-medium">{displayText('subtitle' in playlist ? playlist.subtitle : '')}</div>
            </div>
          </div>
        ))}

        {/* Followed Artists */}
        {activeFilter !== 'playlist' && (followedArtists || []).map((name, idx) => (
          <div
            key={`artist-${name}-${idx}`}
            {...bindTap('artist.open', { params: { name } })}
            className="flex items-center gap-4 p-2 -mx-2 active:bg-black/20 rounded-md cursor-pointer transition-colors hover:bg-white/10"
          >
            <div className="w-[76px] h-[76px] rounded-full overflow-hidden bg-[#2A2A2A] flex-shrink-0">
              {artistImages[name] ? (
                <img src={artistImages[name]} alt={localizeSpotifyArtistName(name, isEnglish)} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xl font-bold">
                  {localizeSpotifyArtistName(name, isEnglish)[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-bold text-white mb-0.5 truncate">{localizeSpotifyArtistName(name, isEnglish)}</div>
              <div className="text-[13px] text-gray-400 font-medium">{s.library_subtitle_artist}</div>
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};
