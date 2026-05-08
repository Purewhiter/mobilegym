import React, { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/os/locale';
import { useParams, useSearchParams } from 'react-router-dom';
import { IcNavBackArrow, IcPlay, IcShuffle, IcMoreVertical } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { selectLikedSongIds, useSpotifyStore } from '../state';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import type { SpotifyTrack } from '../types';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { loadArtistTracks } from '../data/loader';
interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    cover: string;
    duration: string;
    playCount: string;
}

export const ArtistPage: React.FC = () => {
    const { name } = useParams<{ name: string }>();
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const { bindBack, bindTap, back } = useSpotifyGestures();
    const s = useSpotifyStrings();
    const currentTrack = useSpotifyStore(s => s.currentTrack);
    const playTrack = useSpotifyStore(s => s.playTrack);
    const followedArtists = useSpotifyStore(s => s.followedArtists);
    const toggleFollowArtist = useSpotifyStore(s => s.toggleFollowArtist);
    const setArtistTopAlbum = useSpotifyStore(s => s.setArtistTopAlbum);
    const setArtistKeywordCount = useSpotifyStore(s => s.setArtistKeywordCount);
    const setArtistPopularTracks = useSpotifyStore(s => s.setArtistPopularTracks);
    const addToQueue = useSpotifyStore(s => s.addToQueue);
    const showQueueToast = useSpotifyStore(s => s.showQueueToast);
    const toggleLike = useSpotifyStore(s => s.toggleLike);
    const likedSongIds = useSpotifyStore(selectLikedSongIds);

    const [searchParams] = useSearchParams();
    const [tracks, setTracks] = useState<Track[]>([]);
    const [artistImage, setArtistImage] = useState<string>('');
    const [listeners, setListeners] = useState<string>('0');
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const stickyHeaderRef = useRef<HTMLDivElement>(null);
    const [showHeaderTitle, setShowHeaderTitle] = useState(false);

    const isMenuOpen = searchParams.get('sheet') === 'track_menu';
    const showAddPlaylist = searchParams.get('sheet') === 'add_playlist';
    const menuTrackId = searchParams.get('trackId');
    const menuTrack: SpotifyTrack | null = React.useMemo(() => {
        if ((!isMenuOpen && !showAddPlaylist) || !menuTrackId) return null;
        const t = tracks.find(t => t.id === menuTrackId);
        if (!t) return null;
        return { id: t.id, title: t.title, artist: t.artist, cover: t.cover, duration: t.duration };
    }, [isMenuOpen, showAddPlaylist, menuTrackId, tracks]);
    const isFollowed = followedArtists.some(
        artistName => artistName.trim().toLowerCase() === (name ?? '').trim().toLowerCase(),
    );
    const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);
    const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);

    useEffect(() => {
        const randomListeners = Math.floor(Math.random() * (5000000 - 1000000) + 1000000);
        setListeners(
            isEnglish
                ? randomListeners.toLocaleString('en-US')
                : `${(randomListeners / 10000).toFixed(1)}万`,
        );
    }, [isEnglish, name]);

    useEffect(() => {
        if (!name) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 先查本地离线数据，miss 才走 iTunes API
                const offline = await loadArtistTracks().catch(() => null);
                const offlineTracks = offline?.[name.toLowerCase()];
                if (offlineTracks) {
                    console.log(`[Spotify] ArtistPage: offline hit for "${name}" (${offlineTracks.length} tracks)`);
                } else {
                    console.log(`[Spotify] ArtistPage: offline miss for "${name}", fetching iTunes API`);
                }
                const results: any[] = offlineTracks
                    ? offlineTracks.map(t => ({
                        trackId: t.id,
                        trackName: t.title,
                        artistName: t.artist,
                        collectionName: t.album || '',
                        artworkUrl100: t.cover,
                        trackTimeMillis: 0,  // duration already formatted, not needed
                        _preformatted: t,
                    }))
                    : await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=song&limit=10&country=TW`)
                        .then(r => r.json())
                        .then(d => d.results || []);

                if (results.length > 0) {
                    const bigImage = results[0].artworkUrl100?.replace('100x100bb', '600x600bb');
                    setArtistImage(bigImage);

                    const fmt = (ms: number) => {
                        const s = Math.floor(ms / 1000);
                        const m = Math.floor(s / 60);
                        const ss = s % 60;
                        return `${m}:${ss < 10 ? '0' : ''}${ss}`;
                    };
                    const mappedTracks = results.map((track: any) => {
                        // 离线数据已格式化，直接用；在线数据走原有映射
                        if (track._preformatted) {
                            return { ...track._preformatted, playCount: Math.floor(Math.random() * 100000000 + 1000000).toLocaleString() };
                        }
                        return {
                            id: String(track.trackId),
                            title: track.trackName,
                            artist: track.artistName,
                            album: track.collectionName,
                            cover: track.artworkUrl100,
                            duration: fmt(track.trackTimeMillis ?? 0),
                            playCount: Math.floor(Math.random() * 100000000 + 1000000).toLocaleString(),
                        };
                    });
                    setTracks(mappedTracks);
                    // Persist the artist page "Popular Tracks" top-N list into global state,
                    // so judge tasks can verify queue content without re-fetching.
                    const topN = Math.min(10, mappedTracks.length);
                    setArtistPopularTracks(
                        name || '',
                        mappedTracks.slice(0, topN).map(t => ({
                            id: String(t.id),
                            title: t.title,
                            artist: t.artist,
                            cover: t.cover,
                            duration: t.duration,
                        })),
                        topN,
                    );
                    // 计算前10首出现次数最多的专辑（并列取先出现）
                    const n = Math.min(10, mappedTracks.length);
                    const counts: Record<string, number> = {};
                    const firstIdx: Record<string, number> = {};
                    for (let i = 0; i < n; i++) {
                        const alb = mappedTracks[i].album || 'Unknown';
                        counts[alb] = (counts[alb] ?? 0) + 1;
                        if (firstIdx[alb] === undefined) firstIdx[alb] = i;
                    }
                    let bestAlb = 'Unknown', bestCnt = -1, bestFirst = Number.MAX_SAFE_INTEGER;
                    Object.keys(counts).forEach(alb => {
                        const cnt = counts[alb], fi = firstIdx[alb];
                        if (cnt > bestCnt || (cnt === bestCnt && fi < bestFirst)) {
                            bestAlb = alb; bestCnt = cnt; bestFirst = fi;
                        }
                    });
                    // 写入分析结果到状态，供任务判定读取
                    setArtistTopAlbum(name || '', bestAlb, n);

                    // 统计前10首包含关键词“Love”的歌曲数量并写入状态
                    const kw = 'Love';
                    const n2 = Math.min(10, mappedTracks.length);
                    let cnt = 0;
                    for (let i = 0; i < n2; i++) {
                        const title = (mappedTracks[i].title || '').toLowerCase();
                        if (title.includes(kw.toLowerCase())) cnt += 1;
                    }
                    setArtistKeywordCount(name || '', kw, cnt, n2);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [name]);

    useEffect(() => {
        const titleEl = titleRef.current;
        const scrollEl = scrollRef.current;
        const headerEl = stickyHeaderRef.current;
        if (!titleEl || !scrollEl || !headerEl) return;

        const headerHeight = headerEl.getBoundingClientRect().height;
        const observer = new IntersectionObserver(
            ([entry]) => setShowHeaderTitle(!entry.isIntersecting),
            {
                root: scrollEl,
                threshold: 0,
                rootMargin: `-${headerHeight}px 0px 0px 0px`,
            },
        );

        observer.observe(titleEl);
        return () => observer.disconnect();
    }, [name, artistImage, tracks.length]);

    const artistSource = { type: 'artist' as const, id: name || '', title: name || '', cover: artistImage };

    const handlePlay = () => {
        if (tracks.length > 0) {
            const t = tracks[0];
            playTrack({
                id: t.id,
                title: t.title,
                artist: t.artist,
                cover: t.cover,
                duration: t.duration,
            }, artistSource);
        }
    };

    const handlePlayTrack = (track: Track) => {
        playTrack({
            id: track.id,
            title: track.title,
            artist: track.artist,
            cover: track.cover,
            duration: track.duration,
        }, artistSource);
    };

    if (loading) {
        return <div className="h-full bg-app-bg text-white flex items-center justify-center">{s.artist_loading}</div>;
    }

    return (
        <div
            ref={scrollRef}
            data-scroll-container="main"
            data-scroll-direction="vertical"
            className="h-full bg-app-bg text-white overflow-y-auto pb-40 relative no-scrollbar"
        >
            <div className="sticky top-0 z-20 h-0">
                <div
                    ref={stickyHeaderRef}
                    className={`flex items-center gap-3 px-4 pt-10 pb-2 transition-colors duration-200 ${showHeaderTitle ? 'bg-black/90' : 'bg-transparent'}`}
                >
                    <button
                        {...bindBack()}
                        className={`rounded-full p-4 -ml-2 text-white transition-colors ${showHeaderTitle ? 'hover:bg-black/30 active:bg-black/40' : 'bg-black/40 backdrop-blur-md hover:bg-black/60 active:bg-black/70'}`}
                    >
                        <IcNavBackArrow size={28} />
                    </button>
                    {showHeaderTitle && (
                        <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-white">
                            {displayText(name)}
                        </h2>
                    )}
                </div>
            </div>

            {/* Hero Section - Image and Name Only */}
            <div
                className="relative w-full h-[45vh] bg-cover bg-center flex flex-col justify-end p-4 flex-shrink-0"
                style={{ backgroundImage: `url(${artistImage})` }}
            >
                {/* Subtle gradient for text readability only */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none" />

                {/* Header Content - Name Only */}
                <div className="relative z-10 pl-2 pb-2">
                    <h1
                        ref={titleRef}
                        className="text-6xl font-extrabold shadow-black drop-shadow-2xl tracking-tight leading-none"
                    >
                        {displayText(name)}
                    </h1>
                </div>
            </div>

            {/* Body Section: Brown fading to Black */}
            {/* Divider line is naturally created by the change in background from Image to Brown */}
            {/* Compact gradient using arbitrary values to match request */}
            <div className="bg-[linear-gradient(to_bottom,#3E2723_0%,#121212_120px)] pt-4 px-4 pb-40 min-h-[60vh]">

                {/* Listeners Count - Now in the "Brown" area */}
                <div className="text-gray-200 font-medium text-base mb-6 px-2 drop-shadow-md">
                    {s.artist_monthly_listeners.replace('{count}', listeners)}
                </div>

                {/* Action Row */}
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-4">
                        {/* Small Avatar */}
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-800 border border-white/10 shadow-sm">
                            <img src={artistImage} alt={displayText(name)} className="w-full h-full object-cover" />
                        </div>

                        <button
                            {...bindTap(
                                { kind: 'action', id: 'artist.follow.toggle' },
                                {
                                    params: { artist: name ?? '', to: !isFollowed },
                                    onTrigger: () => {
                                        if (name) toggleFollowArtist(name);
                                    },
                                },
                            )}
                            className="px-5 py-1.5 rounded-lg border-2 border-gray-400 text-base font-bold text-white hover:border-white hover:scale-105 transition-all"
                        >
                            {isFollowed ? s.artist_following : isEnglish ? 'Follow' : '关注'}
                        </button>
                        <button>
                            <IcMoreVertical size={28} className="text-gray-400" />
                        </button>
                    </div>

                    <div className="flex items-center gap-6">
                        <IcShuffle size={32} className="text-gray-400" />
                        <button
                            onClick={handlePlay}
                            className="w-14 h-14 bg-app-primary rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-green-900/20"
                        >
                            <IcPlay size={28} fill="black" className="ml-1 text-black" />
                        </button>
                    </div>
                </div>

                {/* Popular Tracks Section */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 px-2">{s.artist_popular}</h2>

                    <div className="space-y-1">
                        {tracks.map((track, index) => (
                            <div
                                key={track.id}
                                onClick={() => handlePlayTrack(track)}
                                className="flex items-center gap-4 active:bg-white/10 p-2 rounded-md transition-colors"
                            >
                                {/* Index */}
                                <div className="w-6 text-center text-gray-400 font-bold text-lg">
                                    {index + 1}
                                </div>

                                {/* Cover - Enlarged */}
                                <div className="w-16 h-16 flex-shrink-0 bg-gray-800 rounded mx-1 shadow-md">
                                    <img src={track.cover} alt={displayText(track.title)} className="w-full h-full object-cover rounded" />
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                    <div className={`text-lg font-bold truncate ${currentTrack?.id === track.id ? 'text-app-primary' : 'text-white'}`}>
                                        {displayText(track.title)}
                                    </div>
                                    {/* Play Count */}
                                    {index < 5 && (
                                        <div className="text-sm text-gray-400 font-medium">
                                            {track.playCount}
                                        </div>
                                    )}
                                </div>

                                {/* Menu */}
                                <button
                                    {...bindTap('artist.trackMenu.open', {
                                        params: { trackId: track.id, name: name ?? '' },
                                        stopPropagation: true,
                                    })}
                                    className="p-2"
                                >
                                    <IcMoreVertical size={24} className="text-gray-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Track Menu Sheet (opened by the per-track "more" button) */}
            {menuTrack && (
                <TrackMenuSheet
                    track={menuTrack}
                    isOpen={isMenuOpen}
                    liked={isLiked(menuTrack.id, menuTrack)}
                    likedTrackMenuVariant="otherPlaylistsOnly"
                    onClose={() => back()}
                    backdropProps={bindBack({ stopPropagation: true })}
                    shareProps={bindTap(
                        { kind: 'action', id: 'track.share.invoke' },
                        { params: { trackId: menuTrack.id }, onTrigger: () => back() },
                    )}
                    likeProps={bindTap(
                        { kind: 'action', id: 'track.like.toggle' },
                        {
                            params: { trackId: menuTrack.id, to: !isLiked(menuTrack.id, menuTrack) },
                            onTrigger: () => {
                                toggleLike(menuTrack);
                                back();
                            },
                        },
                    )}
                    addToPlaylistProps={bindTap('artist.addPlaylist.open', { params: { trackId: menuTrack.id, name: name ?? '' }, stopPropagation: true })}
                    createJamProps={bindTap('tab.premium')}
                    addToQueueProps={bindTap(
                        { kind: 'action', id: 'track.queue.add' },
                        {
                            params: { trackId: menuTrack.id },
                            onTrigger: () => {
                                addToQueue(menuTrack);
                                showQueueToast(menuTrack);
                                back();
                            },
                        },
                    )}
                    goToAlbumProps={bindTap('playlist.open', { params: { id: String(menuTrack.id) } })}
                    goToArtistProps={bindTap('artist.open', { params: { name: String(menuTrack.artist) } })}
                />
            )}
            {menuTrack && (
                <AddToPlaylistSheet
                    isOpen={showAddPlaylist}
                    track={menuTrack}
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
