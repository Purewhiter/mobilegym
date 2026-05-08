import React from 'react';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { IcNavBackArrow, IcPlay, IcShuffle, IcMoreVertical, IcHeart, IcAdd, IcDownloadCircle } from '../res/icons';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import type { SpotifyTrack } from '../types';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';

export const LikedSongsPage: React.FC = () => {
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [searchParams] = useSearchParams();
    const { bindTap, bindBack, back, go } = useSpotifyGestures();
    const s = useSpotifyStrings();
    const { currentTrack, likedSongs, customPlaylists } = useSpotifyStore(useShallow(s => ({
        currentTrack: s.currentTrack, likedSongs: s.likedSongs, customPlaylists: s.customPlaylists,
    })));
    const playTrack = useSpotifyStore(s => s.playTrack);
    const toggleLike = useSpotifyStore(s => s.toggleLike);
    const likedSongIds = useSpotifyStore(selectLikedSongIds);
    const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
    const addToQueue = useSpotifyStore(s => s.addToQueue);
    const showQueueToast = useSpotifyStore(s => s.showQueueToast);
    const addTrackToPlaylist = useSpotifyStore(s => s.addTrackToPlaylist);
    const removeTrackFromPlaylist = useSpotifyStore(s => s.removeTrackFromPlaylist);

    const isMenuOpen = searchParams.get('sheet') === 'track_menu';
    const showAddPlaylist = searchParams.get('sheet') === 'add_playlist';
    const menuTrackId = searchParams.get('trackId');

    const selectedTrack: SpotifyTrack | null = React.useMemo(() => {
        if ((!isMenuOpen && !showAddPlaylist) || !menuTrackId) return null;
        return likedSongs.find(t => t.id === menuTrackId) ?? null;
    }, [isMenuOpen, showAddPlaylist, menuTrackId, likedSongs]);

    const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);
    const likedSource = { type: 'playlist' as const, id: 'liked_songs', title: s.liked_songs_title };

    const handlePlayLiked = () => {
        if (likedSongs.length > 0) {
            playTrack(likedSongs[0], likedSource);
        }
    };

    const getLatestCover = () => {
        if (likedSongs.length > 0) return likedSongs[0].cover;
        return '';
    };

    const cover = getLatestCover();

    return (
        <div className="h-full flex flex-col relative">
            <div
                data-scroll-container="main"
                data-scroll-direction="vertical"
                className="flex-1 bg-app-bg text-white overflow-y-auto pb-40 relative no-scrollbar"
            >
                {/* Back Button */}
                <button
                    {...bindBack()}
                    className="fixed top-6 left-6 z-50 bg-black/40 backdrop-blur-md p-3 rounded-full hover:bg-black/60 transition-colors"
                >
                    <IcNavBackArrow size={28} className="text-white" />
                </button>

                {/* Background Gradient */}
                <div className="absolute inset-0 h-[30vh] bg-gradient-to-b from-[#2a2a72] to-black pointer-events-none" />

                {/* Content Container */}
                <div className="relative pt-[12vh] px-4">
                    {/* Title Area */}
                    <div className="mb-6 pl-2">
                        <h1 className="text-3xl font-extrabold mb-2 leading-tight">{s.liked_songs_title}</h1>
                        <div className="text-gray-300 font-medium text-sm flex items-center gap-2">
                            <span>{s.liked_songs_count.replace('{count}', String(likedSongs.length))}</span>
                        </div>
                    </div>

                    {/* Action Row */}
                    <div className="flex items-center justify-between mb-2 px-2">
                        <div className="flex items-center gap-4">
                            {cover ? (
                                <div className="w-10 h-10 rounded overflow-hidden">
                                    <img src={cover} alt={s.liked_songs_title} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded bg-[#2a2a72] flex items-center justify-center">
                                    <IcHeart size={20} fill="white" />
                                </div>
                            )}
                            <button>
                                <IcDownloadCircle size={28} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="flex items-center gap-6">
                            <IcShuffle size={32} className="text-gray-400" />
                            <button
                                onClick={handlePlayLiked}
                                className="w-14 h-14 bg-app-primary rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-green-900/20"
                            >
                                <IcPlay size={28} fill="black" className="ml-1 text-black" />
                            </button>
                        </div>
                    </div>

                    {/* "Join this playlist" Button Row */}
                    <div className="flex items-center gap-4 py-3 px-2 active:bg-white/10 rounded-md mb-2">
                        <div className="w-14 h-14 bg-[#2A2A2A] rounded flex items-center justify-center flex-shrink-0">
                            <IcAdd size={32} className="text-gray-400" />
                        </div>
                        <div className="text-white font-bold text-lg">{s.liked_songs_join}</div>
                    </div>

                    {/* Song List */}
                    <div className="space-y-0">
                        {likedSongs.map((track) => (
                            <div
                                key={track.id}
                                onClick={() => playTrack(track, likedSource)}
                                className="flex items-center gap-4 active:bg-white/10 p-2 rounded-md transition-colors"
                            >
                                <div className="w-14 h-14 flex-shrink-0 bg-gray-800 rounded mx-1 flex items-center justify-center">
                                    {track.cover ? (
                                        <img src={track.cover} alt={displayText(track.title)} className="w-full h-full object-cover rounded" />
                                    ) : (
                                        <IcHeart size={20} className="text-gray-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                    <div className={`text-lg font-bold truncate ${currentTrack?.id === track.id ? 'text-app-primary' : 'text-white'}`}>
                                        {displayText(track.title)}
                                    </div>
                                    <div className="text-sm text-gray-400 font-medium">
                                        {displayText(track.artist)}
                                    </div>
                                </div>
                                <button
                                    {...bindTap('likedSongs.trackMenu.open', {
                                        params: { trackId: track.id },
                                        stopPropagation: true,
                                    })}
                                    className="p-2 hover:bg-[#222] rounded-full flex-shrink-0"
                                >
                                    <IcMoreVertical size={24} className="text-gray-400" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {likedSongs.length === 0 && (
                        <div className="text-center text-gray-400 mt-20 whitespace-pre-line">
                            {s.liked_songs_empty}
                        </div>
                    )}
                </div>
            </div>

            {selectedTrack && (
                <TrackMenuSheet
                    track={selectedTrack}
                    isOpen={isMenuOpen}
                    liked={isLiked(selectedTrack.id, selectedTrack)}
                    variant="likedSongs"
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
                    addToPlaylistProps={bindTap('likedSongs.addPlaylist.open', { params: { trackId: selectedTrack.id }, stopPropagation: true })}
                    removeFromPlaylistProps={bindTap(
                        { kind: 'action', id: 'track.like.toggle' },
                        {
                            params: { trackId: selectedTrack.id, to: false },
                            onTrigger: () => {
                                toggleLike(selectedTrack);
                                back();
                            },
                        },
                    )}
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
