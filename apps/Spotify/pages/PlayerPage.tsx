import React, { useState, useEffect } from 'react';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { IcExpand, IcMoreVertical, IcMore, IcPlay, IcPause, IcSkipPrev, IcSkipNext, IcShuffle, IcRepeat, IcMic, IcShare, IcQueue, IcAddCircle, IcLikedIndicator } from '../res/icons';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { PlayingIndicator } from '../components/PlayingIndicator';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import * as TimeService from '../../../os/TimeService';
import { setJsonpCallback, removeJsonpCallback, type ITunesResponse } from '../utils/jsonp';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import { QueueSheetPanel } from '../components/QueueSheetPanel';
import { SleepTimerSheet } from '../components/SleepTimerSheet';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { openSaveLocation } from '../components/LikedToast';
export const PlayerPage: React.FC = () => {
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [searchParams, setSearchParams] = useSearchParams();
    const { bindTap, bindBack, back } = useSpotifyGestures();
    const s = useSpotifyStrings();
    const { currentTrack, isPlaying, shuffle, repeat, queue, customPlaylists } = useSpotifyStore(useShallow(s => ({
        currentTrack: s.currentTrack, isPlaying: s.isPlaying, shuffle: s.shuffle, repeat: s.repeat, queue: s.queue, customPlaylists: s.customPlaylists,
    })));
    const togglePlay = useSpotifyStore(s => s.togglePlay);
    const playTrack = useSpotifyStore(s => s.playTrack);
    const toggleShuffle = useSpotifyStore(s => s.toggleShuffle);
    const toggleRepeat = useSpotifyStore(s => s.toggleRepeat);
    const skipToNext = useSpotifyStore(s => s.skipToNext);
    const skipToPrevious = useSpotifyStore(s => s.skipToPrevious);
    const toggleLike = useSpotifyStore(s => s.toggleLike);
    const likedSongIds = useSpotifyStore(selectLikedSongIds);
    const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
    const updateTrackCover = useSpotifyStore(s => s.updateTrackCover);
    const addTrackToPlaylist = useSpotifyStore(s => s.addTrackToPlaylist);
    const removeTrackFromPlaylist = useSpotifyStore(s => s.removeTrackFromPlaylist);
    const showQueue = searchParams.get('sheet') === 'queue';
    const showMenu = searchParams.get('sheet') === 'track_menu';
    const showAddPlaylist = searchParams.get('sheet') === 'add_playlist';
    const showSleepTimer = searchParams.get('sheet') === 'timer';
    const menuTrackId = searchParams.get('trackId');
    const updateSettings = useSpotifyStore(st => st.updateSettings);
    const [progress, setProgress] = useState(0);
    
    // Progressive Image Loading State
    const [highResCover, setHighResCover] = useState<string | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Duration Logic
    const parseDuration = (d: string) => {
        if (!d) return 180;
        const parts = d.split(':');
        if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        return 180;
    };
    const duration = currentTrack ? parseDuration(currentTrack.duration) : 180;

    // Effect: Update cover when track changes using caching strategy
    useEffect(() => {
        if (!currentTrack) return;

        // 1. Check if we already have the High Res version in the track data
        //    (Persisted from previous fetch)
        const isAlreadyHighRes = currentTrack.cover && currentTrack.cover.includes('1000x1000');

        if (isAlreadyHighRes) {
            setHighResCover(currentTrack.cover);
            setImageLoaded(true); // Instant load, no blur transition needed
            return;
        }

        // 2. If not high res, reset state for transition (Fade In)
        setHighResCover(null);
        setImageLoaded(false);

        const fetchCoverJSONP = () => {
            if (!currentTrack.title) return;

            const callbackName = `itunes_cb_${TimeService.now()}_${Math.floor(Math.random() * 10000)}`;
            const query = `${currentTrack.title} ${currentTrack.artist || ''}`;

            const script = document.createElement('script');
            script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5&callback=${callbackName}`;

            setJsonpCallback<ITunesResponse>(callbackName, (data) => {
                if (data.results?.length > 0) {
                    const match = data.results.find((item) =>
                        item.trackName.toLowerCase().includes(currentTrack.title.toLowerCase()) ||
                        currentTrack.title.toLowerCase().includes(item.trackName.toLowerCase())
                    ) || data.results[0];

                    const highRes = match.artworkUrl100.replace('100x100', '1000x1000');
                    setHighResCover(highRes);
                    updateTrackCover(currentTrack.id, highRes);
                }
                if (script.parentNode) document.body.removeChild(script);
                removeJsonpCallback(callbackName);
            });

            script.onerror = () => {
                if (script.parentNode) document.body.removeChild(script);
                removeJsonpCallback(callbackName);
            };

            document.body.appendChild(script);
        };

        fetchCoverJSONP();

    }, [currentTrack]);

    // Effect: Progress Timer
    useEffect(() => {
        let interval: any;
        if (isPlaying) {
            interval = setInterval(() => {
                setProgress(p => (p >= duration ? 0 : p + 1));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPlaying, duration]);

    // Effect: Redirect if no track
    useEffect(() => {
        if (!currentTrack) {
            // 尽力回退到来源页；若无来源，保持空渲染即可
            back();
        }
    }, [currentTrack, back]);

    if (!currentTrack) return null;

    const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);
    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };

    const isLikedTrack = isLiked(currentTrack.id, currentTrack);

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#775544] to-app-surface relative overflow-hidden text-white font-sans">
            {/* Main Player Content */}
            <div className={`flex flex-col h-full p-6 ${showQueue ? 'scale-95 opacity-50' : ''}`} style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-6 pt-4">
                    <button {...bindBack()} className="cursor-pointer">
                        <IcExpand size={28} />
                    </button>
                    <div className="flex flex-col items-center">
                        <span className="text-base tracking-widest text-white/70 uppercase">{s.player_playing_from}</span>
                        <span className="font-bold text-base">{displayText(currentTrack.artist)} {s.player_radio_suffix}</span>
                    </div>
                    <button
                        {...bindTap('player.trackMenu.open', {
                            params: { trackId: currentTrack.id },
                        })}
                        className="cursor-pointer"
                    >
                        <IcMoreVertical size={28} />
                    </button>
                </div>

                {/* Art - Moved down significantly & Progressive Loading */}
                <div className="flex-1 flex items-center justify-center mt-4 mb-2 w-full max-h-(--app-player-album-art-max-height) self-center relative">
                    <div className="w-full aspect-square shadow-2xl rounded-md overflow-hidden bg-gray-800 relative">
                        {/* 1. Low Res Base Layer (Visible until High Res loads) */}
                        <img
                            src={currentTrack.cover}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}
                        />

                        {/* 2. High Res Layer (Fade In) */}
                        {highResCover && (
                            <img
                                src={highResCover}
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                                onLoad={() => setImageLoaded(true)}
                            />
                        )}
                        {!currentTrack.cover && !highResCover && (
                            <div className="w-full h-full flex items-center justify-center bg-gray-700"><IcMic size={48} className="text-gray-500" /></div>
                        )}
                    </div>
                </div>

                {/* Lyrics snippet - centered between album art and track info */}
                <div className="flex-1 flex items-center pt-6">
                    <div className="text-white text-lg font-bold text-left">
                        这是{displayText(currentTrack.title)}歌曲的歌词
                    </div>
                </div>

                {/* Bottom Section Wrapper to push controls down */}
                <div>
                    {/* Info */}
                    <div className="flex justify-between items-center mb-8">
                        <div className="flex-1 min-w-0 pr-4">
                            <h1 className="text-2xl font-bold mb-1 truncate">{displayText(currentTrack.title)}</h1>
                            <p className="text-gray-300 text-lg truncate">{displayText(currentTrack.artist)}</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <button
                                {...bindTap(
                                    { kind: 'action', id: 'track.like.toggle' },
                                    {
                                        params: { trackId: currentTrack.id, to: !isLikedTrack },
                                        onTrigger: () => {
                                            if (isLikedTrack) {
                                                openSaveLocation(currentTrack, setSearchParams);
                                            } else {
                                                toggleLike(currentTrack);
                                            }
                                        },
                                    },
                                )}
                            >
                                {isLikedTrack ? <IcLikedIndicator size={40} /> : <IcAddCircle size={40} />}
                            </button>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mb-6">
                        <div className="w-full bg-white/20 h-1 rounded-full mb-2 relative group cursor-pointer">
                            <div className="absolute top-0 left-0 bg-white h-1 rounded-full" style={{ width: `${(progress / duration) * 100}%` }} />
                            <div className="absolute top-1/2 -mt-1.5 bg-white w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 shadow" style={{ left: `${(progress / duration) * 100}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 font-medium">
                            <span>{formatTime(progress)}</span>
                            <span>{currentTrack.duration}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex justify-between items-center mb-8 px-2">
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.shuffle.toggle' },
                                { params: { to: !shuffle }, onTrigger: toggleShuffle },
                            )}
                            className="cursor-pointer"
                        >
                            <IcShuffle size={28} className={shuffle ? 'text-app-primary' : 'text-white/70 hover:text-white'} />
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.control.skipPrevious' },
                                { onTrigger: skipToPrevious },
                            )}
                            className="active:scale-90 transition-transform cursor-pointer"
                        >
                            <IcSkipPrev size={40} fill="white" />
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'track.play.toggle' },
                                {
                                    params: { trackId: currentTrack.id, to: !isPlaying },
                                    onTrigger: togglePlay,
                                },
                            )}
                            className="w-18 h-18 bg-white rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer shadow-lg"
                        >
                            {isPlaying ? <IcPause size={36} fill="black" /> : <IcPlay size={36} fill="black" className="translate-x-0.5" />}
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.control.skipNext' },
                                { onTrigger: skipToNext },
                            )}
                            className="active:scale-90 transition-transform cursor-pointer"
                        >
                            <IcSkipNext size={40} fill="white" />
                        </button>
                        <button
                            {...bindTap(
                                { kind: 'action', id: 'player.repeat.toggle' },
                                { params: { to: repeat !== 'off' }, onTrigger: toggleRepeat },
                            )}
                            className="cursor-pointer relative"
                        >
                            <IcRepeat size={28} className={repeat !== 'off' ? 'text-app-primary' : 'text-white/70 hover:text-white'} />
                            {repeat === 'track' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] font-bold text-app-primary pt-0.5">1</div>}
                        </button>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex justify-between items-center px-2">
                        <IcMic size={24} className="text-white/70 cursor-pointer" />
                        <div className="flex gap-6">
                            <IcShare size={24} className="text-white/70 cursor-pointer" />
                            <button
                                {...bindTap('player.queue.open')}
                                className="text-white/70 cursor-pointer"
                            >
                                <IcQueue size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Queue Sheet Overlay */}
            {showQueue && (
                <QueueSheetPanel
                    backdropProps={bindBack({ stopPropagation: true })}
                    onClose={() => back()}
                    coverOverride={highResCover || undefined}
                />
            )}
            
            {/* Track Menu Overlay */}
            {currentTrack && (
                <PlayerPageMenuOverlay
                    currentTrack={currentTrack}
                    isOpen={showMenu && !!menuTrackId}
                    liked={isLiked(currentTrack.id, currentTrack)}
                    bindBack={bindBack}
                    bindTap={bindTap}
                    toggleLike={toggleLike}
                    back={back}
                />
            )}
            
            {currentTrack && (
                <AddToPlaylistSheet
                    isOpen={showAddPlaylist && !!menuTrackId}
                    track={currentTrack}
                    backdropProps={bindBack({ stopPropagation: true })}
                    onSelect={() => {}}
                    onRemoveFromPlaylist={() => {}}
                    onLike={() => {}}
                    onClose={() => back()}
                />
            )}

            {showSleepTimer && (
                <SleepTimerSheet backdropProps={bindBack({ stopPropagation: true })} onClose={() => back()} />
            )}
        </div>
    );
};

// Bottom sheet menu for current track
export const PlayerPageMenuOverlay: React.FC<{ currentTrack: any; isOpen: boolean; liked: boolean; bindBack: any; bindTap: any; toggleLike: any; back?: () => void }> = ({ currentTrack, isOpen, liked, bindBack, bindTap, toggleLike, back }) => {
    const lyricsEnabled = useSpotifyStore(st => st.settings.playback.lyricsEnabled);
    const updateSettings = useSpotifyStore(st => st.updateSettings);

    if (!currentTrack) return null;
    return (
        <TrackMenuSheet
            track={currentTrack}
            isOpen={isOpen}
            liked={liked}
            likedTrackMenuVariant="otherPlaylistsOnly"
            onClose={() => back?.()}
            backdropProps={bindBack({ stopPropagation: true })}
            shareProps={bindTap(
                { kind: 'action', id: 'track.share.invoke' },
                { params: { trackId: currentTrack.id }, onTrigger: () => back?.(), stopPropagation: true },
            )}
            lyricsOn={lyricsEnabled}
            lyricsProps={{
                onClick: () => {
                    updateSettings('playback', { lyricsEnabled: !lyricsEnabled });
                },
            }}
            sleepTimerProps={bindTap('player.timer.openFromMenu')}
            likeProps={bindTap(
                { kind: 'action', id: 'track.like.toggle' },
                { onTrigger: () => toggleLike(currentTrack), stopPropagation: true }
            )}
            addToPlaylistProps={bindTap('player.addPlaylist.open', { params: { trackId: currentTrack.id }, stopPropagation: true })}
            addToQueueProps={bindTap(
                { kind: 'action', id: 'track.queue.add' },
                {
                    params: { trackId: currentTrack.id },
                    stopPropagation: true,
                    onTrigger: () => {
                        useSpotifyStore.getState().addToQueue(currentTrack);
                        useSpotifyStore.getState().showQueueToast(currentTrack);
                        back?.();
                    },
                }
            )}
            goToAlbumProps={bindTap('playlist.open', { params: { id: currentTrack.id } })}
            goToArtistProps={bindTap('artist.open', { params: { name: String(currentTrack.artist) } })}
            createJamProps={bindTap('tab.premium')}
        />
    );
}
