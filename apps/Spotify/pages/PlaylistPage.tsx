import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale } from '@/os/locale';
import { useParams, useSearchParams } from 'react-router-dom';
import { IcNavBackArrow, IcClock, IcHeart, IcMoreVertical, IcPlay, IcDownloadCircle, IcShuffle, IcPause } from '../res/icons';
import { SPOTIFY_CONFIG } from '../data';
import type { SpotifyArtist, SpotifyPlaylist, SpotifyTrack } from '../types';
import { loadPlaylistTracks } from '../data/loader';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { PlayingIndicator } from '../components/PlayingIndicator';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { SpotifyLogoIcon } from '../res/icons';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { useVirtualList } from '../../../os/hooks/useVirtualList';
// 扩充一些 Mock 歌曲数据以丰富详情页
const MOCK_TRACKS: SpotifyTrack[] = [
    ...SPOTIFY_CONFIG.startListening,
    ...(SPOTIFY_CONFIG.extraTracks || []),
];

export const PlaylistPage: React.FC = () => {
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const { bindTap, bindBack, back } = useSpotifyGestures();
    const s = useSpotifyStrings();
    const { currentTrack, isPlaying, customPlaylists, queue, recentPlays, likedSongs, shuffle } = useSpotifyStore(useShallow(s => ({
        currentTrack: s.currentTrack, isPlaying: s.isPlaying, customPlaylists: s.customPlaylists,
        queue: s.queue, recentPlays: s.recentPlays, likedSongs: s.likedSongs, shuffle: s.shuffle,
    })));
    const playTrack = useSpotifyStore(s => s.playTrack);
    const setQueueWithTracks = useSpotifyStore(s => s.setQueueWithTracks);
    const togglePlay = useSpotifyStore(s => s.togglePlay);
    const toggleLike = useSpotifyStore(s => s.toggleLike);
    const likedSongIds = useSpotifyStore(selectLikedSongIds);
    const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
    const addToQueue = useSpotifyStore(s => s.addToQueue);
    const showQueueToast = useSpotifyStore(s => s.showQueueToast);
    const setAlbumInfo = useSpotifyStore(s => s.setAlbumInfo);
    const removeTrackFromPlaylist = useSpotifyStore(s => s.removeTrackFromPlaylist);
    const toggleShuffle = useSpotifyStore(s => s.toggleShuffle);

    const [playlist, setPlaylist] = useState<SpotifyPlaylist | SpotifyArtist | null>(null);
    const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
    const [bgColor, setBgColor] = useState<string>('from-emerald-800');
    const isMenuOpen = searchParams.get('sheet') === 'track_menu';
    const showAddPlaylist = searchParams.get('sheet') === 'add_playlist';
    const menuTrackId = searchParams.get('trackId');
    const selectedTrack = React.useMemo(
        () => ((isMenuOpen || showAddPlaylist) && menuTrackId ? tracks.find(t => t.id === menuTrackId) ?? null : null),
        [isMenuOpen, showAddPlaylist, menuTrackId, tracks],
    );

    const fallbackToMock = (title: string, foundPlaylist?: any) => {
        // 模拟歌单内容：如果标题包含某些关键字，优先显示特定歌曲，否则打乱显示
        let pool = [...MOCK_TRACKS];
        if (title?.includes('周杰伦') || foundPlaylist?.subtitle?.includes('周杰伦')) {
            pool = pool.filter(t => t.artist === '周杰伦').concat(pool.filter(t => t.artist !== '周杰伦'));
        } else {
            pool.sort(() => Math.random() - 0.5);
        }
        setTracks(pool);
    };

    useEffect(() => {
        // 判断是否为纯数字 ID (iTunes ID)
        if (id && /^\d+$/.test(id)) {
            const fetchItunesData = async () => {
                try {
                    // 先查离线缓存（albumTracks.json），miss 才走 iTunes API
                    const { loadAlbumTracks } = await import('../data/loader');
                    const offlineMap = await loadAlbumTracks().catch(() => null);
                    const cached = offlineMap?.[id];
                    if (cached) {
                        console.log(`[Spotify] PlaylistPage: offline hit for album ${id} "${cached.albumInfo.title}" (${cached.tracks.length} tracks)`);
                        setPlaylist(cached.playlist as any);
                        setTracks(cached.tracks);
                        setAlbumInfo(cached.albumInfo.title, cached.albumInfo.trackCount, cached.albumInfo.year);
                        const colors = ['from-purple-800', 'from-blue-800', 'from-red-800', 'from-orange-800', 'from-emerald-800', 'from-yellow-800'];
                        setBgColor(colors[Math.floor(Math.random() * colors.length)]);
                        return;
                    }

                    // 获取专辑及歌曲详情
                    console.log(`[Spotify] PlaylistPage: offline miss for album ${id}, fetching iTunes API`);
                    const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=TW&limit=200`);
                    const data = await res.json();

                    if (data.resultCount > 0) {
                        const collection = data.results.find((item: any) => item.wrapperType === 'collection');
                        const songResults = data.results.filter((item: any) => item.wrapperType === 'track' && item.kind === 'song');

                        // 设置 Playlist 信息
                        if (collection) {
                            setPlaylist({
                                id: collection.collectionId.toString(),
                                title: collection.collectionName,
                                subtitle: collection.artistName + ' • ' + (collection.copyright || ''),
                                cover: collection.artworkUrl100?.replace('100x100bb', '600x600bb'),
                                type: collection.collectionType || 'Album'
                            } as any);
                        } else if (songResults.length > 0) {
                            // 如果只是单曲ID进来
                            const t = songResults[0];
                            setPlaylist({
                                id: t.trackId.toString(),
                                title: t.trackName,
                                subtitle: t.artistName,
                                cover: t.artworkUrl100?.replace('100x100bb', '600x600bb'),
                                type: 'Single'
                            } as any);
                        }

                        // 设置 Tracks
                        const mappedTracks: SpotifyTrack[] = songResults.map((t: any) => ({
                            id: t.trackId.toString(),
                            title: t.trackName,
                            artist: t.artistName,
                            cover: t.artworkUrl100, // 列表用小图
                            duration: Math.floor(t.trackTimeMillis / 1000).toString(), // 简单的转 string，或者 formatting 需要 number? MOCK check defines duration as string '3:20'.
                            // Wait, Mock tracks have duration string '3:20'. iTunes gives millis. 
                            // I need to format it.
                        }));

                        // Format duration
                        const fmt = (s: number) => {
                            const m = Math.floor(s / 60);
                            const sec = Math.floor(s % 60);
                            return `${m}:${sec < 10 ? '0' : ''}${sec}`;
                        };

                        setTracks(songResults.map((t: any) => ({
                            id: t.trackId.toString(),
                            title: t.trackName,
                            artist: t.artistName,
                            cover: t.artworkUrl100,
                            duration: fmt(t.trackTimeMillis / 1000)
                        })));
                        if (collection) {
                            const year = String(collection.releaseDate ?? '').slice(0, 4) || '';
                            setAlbumInfo(collection.collectionName, songResults.length, year);
                        }

                        // 随机背景
                        const colors = ['from-purple-800', 'from-blue-800', 'from-red-800', 'from-orange-800', 'from-emerald-800', 'from-yellow-800'];
                        setBgColor(colors[Math.floor(Math.random() * colors.length)]);
                        return;
                    }
                } catch (e) {
                    console.error("iTunes fetch error", e);
                }
            };
            fetchItunesData();
            return;
        }

        // 原有的 Mock 数据逻辑
        const findItem = async () => {
            const playlistTracksMap = await loadPlaylistTracks().catch(() => null);

            // Priority Check: Custom Playlists
            if (customPlaylists) {
                const foundCustom = customPlaylists.find(p => p.id === id);
                if (foundCustom) {
                    setPlaylist(foundCustom);
                    const storedTracks: SpotifyTrack[] = Array.isArray((foundCustom as any).storedTracks) ? (foundCustom as any).storedTracks : [];
                    const sources: SpotifyTrack[] = [
                        ...storedTracks,
                        ...queue,
                        ...recentPlays,
                        ...likedSongs,
                        ...SPOTIFY_CONFIG.startListening,
                        ...(SPOTIFY_CONFIG.extraTracks || []),
                    ];
                    const ids: string[] = Array.isArray((foundCustom as any).trackIds) ? (foundCustom as any).trackIds : [];
                    const resolved = ids.map(tid => sources.find(t => t.id === tid)).filter(Boolean) as SpotifyTrack[];
                    setTracks(resolved);
                    const colors = ['from-purple-800', 'from-blue-800', 'from-red-800', 'from-orange-800', 'from-emerald-800', 'from-yellow-800'];
                    setBgColor(colors[Math.floor(Math.random() * colors.length)]);
                    return;
                }
            }

            const allPlaylists: any[] = [
                ...SPOTIFY_CONFIG.personalizedPlaylists,
                ...SPOTIFY_CONFIG.dailyPicks,
                ...SPOTIFY_CONFIG.charts,
                ...SPOTIFY_CONFIG.featuredCharts,
                ...SPOTIFY_CONFIG.throwback,
                ...SPOTIFY_CONFIG.newHotSelections,
                ...SPOTIFY_CONFIG.hottestToday,
                ...SPOTIFY_CONFIG.allNewMusic,
                ...SPOTIFY_CONFIG.party,
                ...SPOTIFY_CONFIG.joyful,
                ...SPOTIFY_CONFIG.sadSongs,
                ...SPOTIFY_CONFIG.singAlong,
                ...SPOTIFY_CONFIG.chill,
                ...SPOTIFY_CONFIG.instrumentals,
                ...SPOTIFY_CONFIG.recommendedArtists, // Artist 也展示为类似页面
            ];

            // 添加 Section 里的歌单
            SPOTIFY_CONFIG.similarArtistSections.forEach(section => {
                allPlaylists.push(...section.playlists);
            });

            const found = allPlaylists.find(p => p.id === id);
            if (found) {
                setPlaylist(found);
                // 简单的随机背景色模拟
                const colors = ['from-purple-800', 'from-blue-800', 'from-red-800', 'from-orange-800', 'from-emerald-800', 'from-yellow-800'];
                setBgColor(colors[Math.floor(Math.random() * colors.length)]);

                // 优先使用预生成的离线数据
                const seededTracks = id ? playlistTracksMap?.[id] : undefined;
                if (seededTracks && seededTracks.length > 0) {
                    setTracks(seededTracks);
                } else {
                    // Fallback to mock
                    fallbackToMock(found.title || found.name, found);
                }
            } else {
                // 如果 ID 是 track ID (mt1..9, t1..3)，则显示该 track 所在的"模拟"专辑
                fallbackToMock('');

                // 尝试从 extraTracks/startListening 里找 info 设置为 playlist header
                const trackInfo = [...SPOTIFY_CONFIG.startListening, ...SPOTIFY_CONFIG.extraTracks].find(t => t.id === id);
                if (trackInfo) {
                    setPlaylist({
                        id: trackInfo.id,
                        title: trackInfo.title,
                        subtitle: trackInfo.artist, // 'Single',
                        cover: trackInfo.cover,
                        type: 'Single'
                    } as any);
                }
            }
        };

        findItem().catch(() => {});
    }, [id, customPlaylists]);

    const listContainerRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const stickyHeaderRef = useRef<HTMLDivElement>(null);
    const [scrollMargin, setScrollMargin] = useState(0);
    const [showHeaderTitle, setShowHeaderTitle] = useState(false);

    const { parentRef, virtualItems, totalSize } = useVirtualList({
        items: tracks,
        estimateSize: () => 72,
        overscan: 5,
        paddingEnd: 24,
        gap: 4,
        scrollMargin,
        getItemKey: (index, item) => `${item.id}-${index}`,
    });

    useLayoutEffect(() => {
        const listEl = listContainerRef.current;
        const scrollEl = parentRef.current;
        if (!listEl || !scrollEl) return;
        const listRect = listEl.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        const offset = listRect.top - scrollRect.top + scrollEl.scrollTop;
        if (offset !== scrollMargin) setScrollMargin(offset);
    }, [tracks, playlist, showHeaderTitle]);

    useEffect(() => {
        const titleEl = titleRef.current;
        const scrollEl = parentRef.current;
        const headerEl = stickyHeaderRef.current;
        if (!titleEl || !scrollEl || !headerEl) return;

        const headerHeight = headerEl.getBoundingClientRect().height;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setShowHeaderTitle(!entry.isIntersecting);
            },
            {
                root: scrollEl,
                threshold: 0,
                rootMargin: `-${headerHeight}px 0px 0px 0px`,
            },
        );

        observer.observe(titleEl);
        return () => observer.disconnect();
    }, [playlist, tracks.length, showHeaderTitle]);

    const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);
    const isCustomPlaylist = !!customPlaylists?.some(p => p.id === id);
    const isCurrentPlaylistPlaying = isPlaying && tracks.some(t => t.id === currentTrack?.id);
    const playlistTitle = playlist
        ? displayText(('title' in playlist ? playlist.title : playlist.name) || '')
        : '';

    const playSource = React.useMemo(() => {
        if (!playlist) return undefined;
        const title = (playlist as SpotifyPlaylist).title || (playlist as SpotifyArtist).name || '';
        const cover = (playlist as SpotifyPlaylist).cover || (playlist as SpotifyArtist).avatar || '';
        const plType = (playlist as any).type;
        const sourceType = plType === 'album' || plType === 'Album' ? 'album' as const : 'playlist' as const;
        return { type: sourceType, id: playlist.id, title, cover };
    }, [playlist]);

    const handleTrackClick = (track: SpotifyTrack) => {
        playTrack(track, playSource);
    };

    if (!playlist) {
        return (
            <div className="flex items-center justify-center h-full bg-app-bg text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative">
            <div
                ref={parentRef}
                data-scroll-container="main"
                data-scroll-direction="vertical"
                className="flex flex-col flex-1 bg-app-bg text-white overflow-y-auto relative"
            >
                {/* 顶部背景渐变 */}
                <div className={`absolute top-0 left-0 right-0 h-96 bg-gradient-to-b ${bgColor} to-black opacity-60 pointer-events-none z-0`} />

                {/* 顶部导航栏占位 + 返回按钮 */}
                <div
                    ref={stickyHeaderRef}
                    className={`sticky top-0 z-20 flex items-center gap-3 px-4 pt-10 pb-2 transition-colors duration-200 ${showHeaderTitle ? 'bg-black/90' : 'bg-gradient-to-b from-black/40 to-transparent'}`}
                >
                    <button {...bindBack()} className="p-4 -ml-2 rounded-full hover:bg-black/30 active:bg-black/40 text-white">
                        <IcNavBackArrow size={28} />
                    </button>
                    {showHeaderTitle && (
                        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-white">
                            {playlistTitle}
                        </h2>
                    )}
                </div>

                <div className="relative z-10 px-4 pt-4 pb-40">
                    {/* 封面与信息 */}
                    <div className="flex flex-col items-start text-left mb-6">
                        <div className="w-64 h-64 shadow-2xl mb-6 mx-auto">
                            <img src={(playlist as SpotifyPlaylist).cover || (playlist as SpotifyArtist).avatar} alt={displayText(('title' in playlist ? playlist.title : (playlist as SpotifyArtist).name) || '')} className="w-full h-full object-cover" />
                        </div>
                        <h1 ref={titleRef} className="text-3xl font-bold mb-2 leading-tight">
                            {playlistTitle}
                        </h1>
                        <div className="text-gray-300 text-sm font-medium mb-3">
                            {displayText((playlist as SpotifyPlaylist).subtitle) || s.playlist_subtitle_artist}
                        </div>

                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-app-primary">
                                <SpotifyLogoIcon size={20} fill="currentColor" />
                            </span>
                            <span className="font-bold text-white text-sm">Spotify</span>
                        </div>
                        <div className="text-gray-400 text-xs font-medium">
                            {s.playlist_track_count.replace('{count}', String(tracks.length))} • {Math.floor(tracks.reduce((acc, t) => {
                                const parts = t.duration.split(':');
                                const m = parseInt(parts[0]) || 0;
                                const s = parseInt(parts[1]) || 0;
                                return acc + m * 60 + s;
                            }, 0) / 60)} {s.playlist_duration_minutes}
                        </div>
                    </div>

                    {/* 操作栏 */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-6 text-gray-400">
                            <IcHeart size={28} className="hover:text-white transition-colors" />
                            <IcDownloadCircle size={28} className="hover:text-white transition-colors" />
                            <IcMoreVertical size={28} className="hover:text-white transition-colors" />
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                {...bindTap(
                                    { kind: 'action', id: 'player.shuffle.toggle' },
                                    { params: { to: !shuffle }, onTrigger: toggleShuffle },
                                )}
                            >
                                <IcShuffle size={28} className={shuffle ? 'text-app-primary' : 'text-gray-400 hover:text-white transition-colors'} />
                            </button>
                            <button
                                onClick={() => {
                                    if (isCurrentPlaylistPlaying) {
                                        togglePlay();
                                    } else if (tracks.length > 0) {
                                        const currentIdx = tracks.findIndex(t => t.id === currentTrack?.id);
                                        if (currentIdx >= 0 && !isPlaying) {
                                            togglePlay();
                                        } else {
                                            setQueueWithTracks(tracks, 0, playSource);
                                        }
                                    }
                                }}
                                className="w-14 h-14 rounded-full bg-app-accent flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-transform shadow-lg"
                            >
                                {isCurrentPlaylistPlaying ? <IcPause size={30} fill="black" /> : <IcPlay size={30} fill="black" className="translate-x-0.5" />}
                            </button>
                        </div>
                    </div>

                    {/* 歌曲列表 */}
                    <div ref={listContainerRef} style={{ height: totalSize, width: '100%', position: 'relative' }}>
                        {virtualItems.map((vItem) => {
                            const track = tracks[vItem.index];
                            if (!track) return null;
                            const index = vItem.index;
                            const isCurrent = currentTrack?.id === track.id;
                            const isPlayingCurrent = isCurrent && isPlaying;

                            return (
                                <div
                                    key={vItem.key}
                                    data-index={vItem.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${vItem.start - scrollMargin}px)`,
                                    }}
                                >
                                    <div
                                        onClick={() => handleTrackClick(track)}
                                        className="flex items-center justify-between py-4 pl-2 pr-0 hover:bg-white/10 active:bg-white/10 transition-colors cursor-pointer rounded-md"
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-12 text-center flex-shrink-0">
                                                {isCurrent && isPlaying ? (
                                                    <div className="flex justify-center"><PlayingIndicator /></div>
                                                ) : (
                                                    isCurrent ? <span className="text-app-accent text-base">{index + 1}</span> : <div className="w-12 h-12 bg-gray-800 rounded-sm overflow-hidden"><img src={track.cover} alt={displayText(track.title)} className="w-full h-full object-cover opacity-90" /></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className={`text-lg font-medium truncate mb-1 ${isCurrent ? 'text-app-accent' : 'text-white'}`}>
                                                    {displayText(track.title)}
                                                </div>
                                                <div className="text-sm text-gray-400 flex items-center gap-1 truncate">
                                                    {displayText(track.artist)}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            {...bindTap('playlist.trackMenu.open', {
                                                params: { id: id ?? '', trackId: track.id },
                                                stopPropagation: true,
                                            })}
                                            className="p-3 hover:bg-white/10 rounded-full flex-shrink-0 text-gray-400"
                                        >
                                            <IcMoreVertical size={20} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedTrack && (
                <TrackMenuSheet
                    track={selectedTrack}
                    isOpen={isMenuOpen}
                    liked={isLiked(selectedTrack.id, selectedTrack)}
                    variant={isCustomPlaylist ? 'ownPlaylist' : 'playlist'}
                    onClose={() => back()}
                    backdropProps={bindBack({ stopPropagation: true })}
                    shareProps={bindTap(
                      { kind: 'action', id: 'track.share.invoke' },
                      { params: { trackId: selectedTrack.id }, onTrigger: () => back() },
                    )}
                    likeProps={!isCustomPlaylist ? bindTap(
                      { kind: 'action', id: 'track.like.toggle' },
                      {
                        params: { trackId: selectedTrack.id, to: !isLiked(selectedTrack.id, selectedTrack) },
                        onTrigger: () => { toggleLike(selectedTrack); back(); },
                      },
                    ) : undefined}
                    removeFromPlaylistProps={isCustomPlaylist ? bindTap(
                      { kind: 'action', id: 'playlist.track.remove' },
                      {
                        params: { trackId: selectedTrack.id, id: id || '' },
                        onTrigger: () => {
                          const title = (playlist as any)?.title;
                          if (title) removeTrackFromPlaylist(title, selectedTrack.id);
                          back();
                        },
                      },
                    ) : undefined}
                    hideFromPlaylistProps={!isCustomPlaylist ? { onClick: () => back() } : undefined}
                    addToPlaylistProps={bindTap('playlist.addPlaylist.open', { params: { trackId: selectedTrack.id, id: id || '' }, stopPropagation: true })}
                    addToPlaylistLabel={isCustomPlaylist ? s.track_menu_add_to_other_playlists : undefined}
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
