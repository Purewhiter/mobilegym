import React from 'react';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { IcMoreVertical, IcPlay, IcAddCircle, IcHeadphone } from '../res/icons';
import { SPOTIFY_CONFIG } from '../data';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import { PlayingIndicator } from '../components/PlayingIndicator';
import type { SpotifyTrack } from '../types';
import { PODCAST_DATA, WRAPPED_DATA } from '../data';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
type TabType = 'all' | 'wrapped' | 'music' | 'podcast';

export const HomePage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [searchParams] = useSearchParams();
  const { bindTap, bindBack, back, go } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const { currentTrack, isPlaying, queue, recentPlays, likedSongs, customPlaylists } = useSpotifyStore(useShallow(s => ({
    currentTrack: s.currentTrack, isPlaying: s.isPlaying,
    queue: s.queue, recentPlays: s.recentPlays, likedSongs: s.likedSongs, customPlaylists: s.customPlaylists,
  })));
  const playTrack = useSpotifyStore(s => s.playTrack);
  const toggleLike = useSpotifyStore(s => s.toggleLike);
  const likedSongIds = useSpotifyStore(selectLikedSongIds);
  const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
  const addToQueue = useSpotifyStore(s => s.addToQueue);
  const showQueueToast = useSpotifyStore(s => s.showQueueToast);
  const addTrackToPlaylist = useSpotifyStore(s => s.addTrackToPlaylist);
  const removeTrackFromPlaylist = useSpotifyStore(s => s.removeTrackFromPlaylist);
  const tabParam = searchParams.get('tab');
  const activeTab: TabType =
    tabParam === 'wrapped' || tabParam === 'music' || tabParam === 'podcast' ? tabParam : 'all';
  const isMenuOpen = searchParams.get('sheet') === 'track_menu';
  const showAddPlaylist = searchParams.get('sheet') === 'add_playlist';
  const menuTrackId = searchParams.get('trackId');
  const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);

  const handleTrackClick = (track: SpotifyTrack) => {
    playTrack(track);
  };
  
  const selectedTrack: SpotifyTrack | null = React.useMemo(() => {
    if ((!isMenuOpen && !showAddPlaylist) || !menuTrackId) return null;
    const pool: SpotifyTrack[] = [
      ...SPOTIFY_CONFIG.recommendedTracks,
      ...SPOTIFY_CONFIG.startListening,
      ...queue,
      ...recentPlays,
      ...likedSongs,
    ].filter(Boolean as any);
    return pool.find(t => t.id === menuTrackId) ?? null;
  }, [isMenuOpen, showAddPlaylist, menuTrackId, likedSongs, queue, recentPlays]);

  const getTabStyle = (tab: TabType) => {
    const isActive = activeTab === tab;
    const base = "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors";

    if (tab === 'wrapped') {
      if (isActive) return `${base} bg-app-accent text-black border border-transparent`;
      return `${base} bg-[#2A2A2A] text-white border-2 border-white`;
    }

    if (isActive) {
      return `${base} bg-app-accent text-black border border-transparent`;
    }
    return `${base} bg-[#2A2A2A] text-white border border-transparent`;
  };

  const CARD_COLORS = [
    'bg-[#783F20]', 'bg-[#064e3b]', 'bg-[#581c87]', 'bg-[#7c2d12]', 'bg-[#1e3a8a]',
  ];

  const renderPodcastTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-extrabold mb-4">{s.home_podcast_hot}</h2>
      {PODCAST_DATA.map((pod, idx) => (
        <div key={pod.id} className={`${CARD_COLORS[idx % CARD_COLORS.length]} rounded-xl p-4 flex flex-col gap-4 relative`}>
          <div className="flex gap-4">
            <img src={pod.cover} className="w-24 h-24 rounded-lg bg-gray-800 object-cover flex-shrink-0 shadow-md" />
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold line-clamp-2 leading-tight mb-1 text-white pr-6">{displayText(pod.title)}</h3>
                <button className="text-gray-200"><IcMoreVertical size={24} /></button>
              </div>
              <div className="text-sm text-gray-300 truncate mt-1">
                {displayText(pod.podcastName)} • {pod.date} • {pod.duration}
              </div>
            </div>
          </div>
          <div className="px-0">
            <div className="text-sm text-gray-200/90 line-clamp-2 leading-relaxed">{displayText(pod.description)}</div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <button className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-colors">
              <IcHeadphone size={18} /> {s.home_podcast_listen_episode}
            </button>
            <div className="flex items-center gap-4">
              <button className="text-gray-200 hover:text-white"><IcAddCircle size={32} strokeWidth={1.5} /></button>
              <button className="bg-white text-black p-3 rounded-full hover:scale-105 transition-transform flex items-center justify-center">
                <IcPlay size={24} fill="black" className="ml-1" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderWrappedTab = () => (
    <div className="space-y-10">
      <section>
        <h2 className="text-3xl font-extrabold mb-6">{s.home_wrapped_top_artists_tracks}</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {WRAPPED_DATA.map((item, idx) => (
            <div key={item.id} className="flex-shrink-0 w-44 group cursor-pointer">
              <div className="w-44 h-44 rounded-md overflow-hidden bg-gray-800 shadow-lg relative mb-3">
                <img src={item.cover} className="w-full h-full object-cover group-hover:scale-105" style={{ transition: 'transform var(--app-duration-long) var(--app-easing-standard)' }} />
                <div className="absolute inset-0 border-[3px] border-white/10 pointer-events-none"></div>
                <div className="absolute top-0 right-0 p-1">
                  <span className="text-[#8B5CF6] font-black text-4xl rotate-90 origin-top-right block drop-shadow-md" style={{ writingMode: 'vertical-rl' }}>2025</span>
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-white/90 backdrop-blur-sm text-black text-[10px] font-bold px-2 py-1 inline-block rounded-sm transform -rotate-1 shadow-sm">
                    2025 {idx % 2 === 0 ? s.home_wrapped_most_popular : s.home_wrapped_curated}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-white font-bold text-base leading-tight line-clamp-2 mb-1">{displayText(item.title)}</div>
                <div className="text-gray-400 text-sm line-clamp-2">{displayText(item.subtitle)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-3xl font-extrabold mb-6">{s.home_wrapped_global_shows}</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          <div className="flex-shrink-0 w-44 cursor-pointer group">
            <div className="w-44 h-44 bg-[#00468C] rounded-md relative overflow-hidden mb-3 p-4 flex flex-col justify-end shadow-lg">
              <div className="absolute top-0 right-2 text-yellow-400 font-extrabold text-5xl opacity-80" style={{ writingMode: 'vertical-rl' }}>2025</div>
              <h3 className="text-white font-bold text-xl relative z-10 w-3/4 leading-tight group-hover:scale-105 transition-transform">Top shows of 2025 Global</h3>
            </div>
            <div>
              <div className="text-gray-400 text-sm line-clamp-2">The most streamed podcasts this year. Epis...</div>
            </div>
          </div>
          <div className="flex-shrink-0 w-44 cursor-pointer group">
            <div className="w-44 h-44 bg-[#8C2800] rounded-md relative overflow-hidden mb-3 p-4 flex flex-col justify-end shadow-lg">
              <div className="absolute top-0 right-2 text-red-500 font-extrabold text-5xl opacity-80" style={{ writingMode: 'vertical-rl' }}>2025</div>
              <h3 className="text-white font-bold text-xl relative z-10 w-3/4 leading-tight group-hover:scale-105 transition-transform">Top Podcast Argentina</h3>
            </div>
            <div>
              <div className="text-gray-400 text-sm line-clamp-2">Estos son los podcast más escuchados en Arg...</div>
            </div>
          </div>
          <div className="flex-shrink-0 w-44 cursor-pointer group">
            <div className="w-44 h-44 bg-[#212121] rounded-md relative overflow-hidden mb-3 p-4 flex flex-col justify-end shadow-lg">
              <div className="absolute top-0 right-2 text-white font-extrabold text-5xl opacity-80" style={{ writingMode: 'vertical-rl' }}>2025</div>
              <h3 className="text-white font-bold text-xl relative z-10 w-3/4 leading-tight group-hover:scale-105 transition-transform">Top Artists Australia</h3>
            </div>
            <div>
              <div className="text-gray-400 text-sm line-clamp-2">The most streamed artists in Australia...</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderMusicTab = () => (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_daily_picks}</h2>
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.dailyPicks.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_guess_you_like}</h2>
        <div className="grid grid-cols-2 gap-4">
          {SPOTIFY_CONFIG.personalizedPlaylists.slice(0, 4).map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="bg-[#282828] rounded-md flex overflow-hidden cursor-pointer"
            >
              <img src={pl.cover} className="w-16 h-16 object-cover flex-shrink-0" />
              <div className="p-2 flex items-center min-w-0">
                <span className="text-sm font-bold text-white truncate">{displayText(pl.title)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_start_listening}</h2>
        <div className="space-y-0">
          {SPOTIFY_CONFIG.startListening.map(track => {
            const isCurrent = currentTrack?.id === track.id;
            const isPlayingCurrent = isCurrent && isPlaying;
            return (
              <div key={track.id} onClick={() => handleTrackClick(track)} className="w-full flex items-center justify-between py-3 px-0 hover:bg-[#181818] cursor-pointer">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                    <img src={track.cover} alt={displayText(track.title)} className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate mb-1 flex items-center gap-2 ${isCurrent ? 'text-app-accent' : 'text-white'}`}>
                      {isPlayingCurrent && <PlayingIndicator />} {displayText(track.title)}
                    </div>
                    <div className="text-sm text-gray-400 truncate">{displayText(track.artist)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderAllContent = () => (
    <>
      <p className="text-sm text-gray-400 mb-6">{s.home_personalized_subtitle}</p>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_start_listening}</h2>
        <div className="space-y-0">
          {SPOTIFY_CONFIG.startListening.map(track => {
            const isCurrent = currentTrack?.id === track.id;
            const isPlayingCurrent = isCurrent && isPlaying;
            return (
              <div
                key={track.id}
                onClick={() => handleTrackClick(track)}
                className="w-full flex items-center justify-between py-3 px-0 hover:bg-[#181818] active:bg-[#181818] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-14 h-14 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                    <img src={track.cover} alt={displayText(track.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate mb-1 flex items-center gap-2 ${isCurrent ? 'text-app-accent' : 'text-white'}`}>
                      {isPlayingCurrent && <PlayingIndicator />} {displayText(track.title)}
                    </div>
                    <div className="text-sm text-gray-400 truncate">{displayText(track.artist)}</div>
                  </div>
                </div>
                <button
                  {...bindTap('home.trackMenu.open', {
                    params: { trackId: track.id },
                    stopPropagation: true,
                  })}
                  className="p-2 hover:bg-[#222] rounded-full flex-shrink-0"
                >
                  <IcMoreVertical size={18} className="text-gray-400" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="mb-8">
        <h1 className="text-2xl font-extrabold mb-4">{s.home_section_guess_you_like}</h1>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.personalizedPlaylists.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      {/* 3. 今日推荐 */}
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_daily_picks}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.dailyPicks.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      {/* 4. 与**相似的更多艺人 - 多个部分 */}
      {SPOTIFY_CONFIG.similarArtistSections.map(section => (
        <section key={section.id} className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
              <img src={section.avatar} alt={section.anchor} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <div className="text-xs text-gray-400">{s.home_similar_artists_label}</div>
              <div className="text-2xl font-extrabold text-white">{displayText(section.anchor)}</div>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {section.playlists.map(playlist => (
              <div
                key={playlist.id}
                {...bindTap('playlist.open', { params: { id: playlist.id } })}
                className="flex-shrink-0 w-48 cursor-pointer"
              >
                <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                  <img src={playlist.cover} alt={displayText(playlist.title)} className="w-full h-full object-cover" />
                </div>
                <div className="text-xs text-gray-400 mb-1">{playlist.type === 'album' ? s.home_type_album : s.home_type_playlist}</div>
                <div className="text-sm font-semibold truncate">{displayText(playlist.title)}</div>
                {playlist.subtitle && <div className="text-xs text-gray-400 line-clamp-2">{displayText(playlist.subtitle)}</div>}
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_charts}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.charts.map(chart => (
            <div
              key={chart.id}
              {...bindTap('playlist.open', { params: { id: chart.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={chart.cover} alt={displayText(chart.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(chart.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(chart.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_featured_charts}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.featuredCharts.map(chart => (
            <div
              key={chart.id}
              {...bindTap('playlist.open', { params: { id: chart.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={chart.cover} alt={displayText(chart.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(chart.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(chart.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_recommended_artists}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.recommendedArtists.map(artist => (
            <div
              key={artist.id}
              {...bindTap('playlist.open', { params: { id: artist.id } })}
              className="flex-shrink-0 text-center w-24 cursor-pointer"
            >
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 mb-2 mx-auto">
                <img src={artist.avatar} alt={displayText(artist.name)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(artist.name)}</div>
              {artist.subtitle && <div className="text-xs text-gray-400 truncate">{displayText(artist.subtitle)}</div>}
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">Throwback</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.throwback.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_new_hot_selections}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.newHotSelections.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_hottest_today}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.hottestToday.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_all_new_music}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.allNewMusic.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_party}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.party.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_joyful}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.joyful.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_sad_songs}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.sadSongs.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_sing_along}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.singAlong.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_trending_for_you}</h2>
        <div className="space-y-0">
          {SPOTIFY_CONFIG.trendingForYou.map(track => (
            <div key={track.id} onClick={() => handleTrackClick(track)} className="w-full flex items-center justify-between py-3 px-0 hover:bg-[#181818] active:bg-[#181818] transition-colors cursor-pointer">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-14 h-14 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                  <img src={track.cover} alt={displayText(track.title)} className="w-full h-full object-cover" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{displayText(track.title)}</div>
                  <div className="text-sm text-gray-400 truncate">{displayText(track.artist)}</div>
                </div>
              </div>
              <button
                {...bindTap('home.trackMenu.open', {
                  params: { trackId: track.id },
                  stopPropagation: true,
                })}
                className="p-2 hover:bg-[#222] rounded-full flex-shrink-0"
              >
                <IcMoreVertical size={18} className="text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_chill}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.chill.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-extrabold mb-4">{s.home_section_instrumentals}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {SPOTIFY_CONFIG.instrumentals.map(pl => (
            <div
              key={pl.id}
              {...bindTap('playlist.open', { params: { id: pl.id } })}
              className="flex-shrink-0 w-48 cursor-pointer"
            >
              <div className="w-48 h-48 rounded-md overflow-hidden bg-gray-700 mb-2">
                <img src={pl.cover} alt={displayText(pl.title)} className="w-full h-full object-cover" />
              </div>
              <div className="text-sm font-semibold truncate">{displayText(pl.title)}</div>
              <div className="text-xs text-gray-400 line-clamp-2">{displayText(pl.subtitle)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <div
      data-scroll-container="main"
      data-scroll-direction="vertical"
      className="flex flex-col h-full overflow-y-auto bg-app-bg text-white"
    >
      <div className="sticky top-0 z-10 bg-app-bg px-4 pt-10 pb-3">
        <header className="flex items-center gap-3">
          <div
            {...bindTap('home.sidebar.open')}
            className="w-9 h-9 rounded-full bg-amber-700 flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
          >
            {SPOTIFY_CONFIG.user.initial}
          </div>
          <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar mask-linear-fade">
            <button {...bindTap('home.tab.all')} className={getTabStyle('all')}>{s.home_tab_all}</button>
            <button {...bindTap('home.tab.wrapped')} className={getTabStyle('wrapped')}>{s.home_tab_wrapped}</button>
            <button {...bindTap('home.tab.music')} className={getTabStyle('music')}>{s.home_tab_music}</button>
            <button {...bindTap('home.tab.podcast')} className={getTabStyle('podcast')}>{s.home_tab_podcast}</button>
          </div>
        </header>
      </div>

      <div className="px-4 pt-5 pb-40">
        {activeTab === 'all' && renderAllContent()}
        {activeTab === 'wrapped' && renderWrappedTab()}
        {activeTab === 'music' && renderMusicTab()}
        {activeTab === 'podcast' && renderPodcastTab()}
      </div>

      {selectedTrack && (
        <TrackMenuSheet
          track={selectedTrack}
          isOpen={isMenuOpen}
          liked={isLiked(selectedTrack.id, selectedTrack)}
          likedTrackMenuVariant="otherPlaylistsOnly"
          onClose={() => back()}
          backdropProps={bindBack({ stopPropagation: true })}
          shareProps={bindTap(
            { kind: 'action', id: 'track.share.invoke' },
            { params: { trackId: selectedTrack.id }, onTrigger: () => back() },
          )}
          likeProps={bindTap(
            { kind: 'action', id: 'track.like.toggle' },
            {
              params: { trackId: selectedTrack.id, to: !isLiked(selectedTrack.id, selectedTrack) },
              onTrigger: () => {
                toggleLike(selectedTrack);
                back();
              },
            },
          )}
          addToPlaylistProps={bindTap('home.addPlaylist.open', { params: { trackId: selectedTrack.id }, stopPropagation: true })}
          createJamProps={bindTap('tab.premium')}
          addToQueueProps={bindTap(
            { kind: 'action', id: 'track.queue.add' },
            {
              params: { trackId: selectedTrack.id },
              onTrigger: () => {
                addToQueue(selectedTrack);
                showQueueToast(selectedTrack);
                back();
              },
            },
          )}
          goToAlbumProps={bindTap('playlist.open', { params: { id: selectedTrack.id } })}
          goToArtistProps={bindTap('artist.open', { params: { name: selectedTrack.artist } })}
        />
      )}
      {selectedTrack && (
        <AddToPlaylistSheet
          isOpen={showAddPlaylist && !!menuTrackId}
          track={selectedTrack}
          backdropProps={bindBack({ stopPropagation: true })}
          onSelect={() => {}}
          onRemoveFromPlaylist={() => {}}
          onLike={() => {}}
          onClose={() => back()}
        />
      )}
    </div>
  );
};
