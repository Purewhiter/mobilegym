import React from 'react';
import { useLocale } from '@/os/locale';
import { IcNavBackArrow, IcPlay, IcPause, IcAddCircle, IcCheckCircle, IcMoreVertical, IcCheck } from '../res/icons';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { useSearchParams } from 'react-router-dom';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { openSaveLocation } from '../components/LikedToast';
// Mock Data with specific covers matching description roughly or placeholders
const NEW_RELEASES = [
    {
        id: 'nr1',
        date: '1月1日',
        title: '點亮亮點2026',
        artist: '王錚亮',
        type: '单曲',
        cover: '/cdn/spotify/images/artists/c3bf8ff998066b75.jpg',
        coverLarge: '/cdn/spotify/images/tracks/2eaf98d871e232c1.jpg',
        trackId: 't1' // should map to a real track if possible or mock play
    },
    {
        id: 'nr2',
        date: '12月15日',
        title: '垃圾别烦我',
        artist: '周深',
        type: '单曲',
        cover: '/cdn/spotify/images/artists/a526975805839c04.jpg',
        coverLarge: '/cdn/spotify/images/tracks/cd0f56d240376385.jpg',
        trackId: 't2'
    },
    {
        id: 'nr3',
        date: '12月8日',
        title: '万里晴空',
        artist: '张杰',
        type: '单曲', // Screenshot says single for most
        cover: '/cdn/spotify/images/artists/e00ceda949dcac14.jpg',
        coverLarge: '/cdn/spotify/images/tracks/82a469fed484412f.jpg',
        trackId: 't3'
    },
];

const NewItem: React.FC<{ item: typeof NEW_RELEASES[0] }> = ({ item }) => {
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [, setSearchParams] = useSearchParams();
    const { bindTap } = useSpotifyGestures();
    const s = useSpotifyStrings();
    const { currentTrack, isPlaying: storeIsPlaying } = useSpotifyStore(useShallow(s => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying })));
    const playTrack = useSpotifyStore(s => s.playTrack);
    const togglePlay = useSpotifyStore(s => s.togglePlay);
    const toggleLike = useSpotifyStore(s => s.toggleLike);
    const likedSongIds = useSpotifyStore(selectLikedSongIds);
    const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
    const artwork = item.coverLarge || item.cover;

    // Mock track object for playback context
    const track = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        cover: item.cover,
        coverLarge: artwork,
        duration: '3:30' // Mock
    };

    const added = isLiked(item.id, item);
    const isCurrentTrack = currentTrack?.id === track.id;
    const isPlaying = isCurrentTrack && storeIsPlaying;
    const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);

    const handlePlayForMe = () => {
        if (isCurrentTrack) {
            togglePlay();
        } else {
            playTrack(track); // Will use the high-res artwork
        }
    };

    const handleAdd = () => {
        if (added) {
            openSaveLocation(track, setSearchParams);
        } else {
            toggleLike(track);
        }
    };

    return (
        <div
            className="flex flex-col mb-8"
            {...bindTap('player.open', {
                beforeTrigger: () => {
                    if (!isCurrentTrack) {
                        playTrack(track);
                    }
                },
            })}
        >
            <div className="flex gap-4 mb-2">
                <img
                    src={artwork}
                    alt={displayText(item.title)}
                    className="w-32 h-32 rounded-md bg-[#333] object-cover flex-shrink-0"
                    style={{ transition: 'opacity var(--app-duration-medium) var(--app-easing-standard)' }}
                    onError={(e) => {
                        e.currentTarget.src = '/cdn/spotify/images/artists/c3bf8ff998066b75.jpg';
                    }}
                />
                <div className="flex flex-col pt-1 min-w-0">
                    <div className="text-app-text-muted text-xs mb-1 font-medium">{item.date}</div>
                    <div className="text-white text-xl font-bold leading-tight mb-1 line-clamp-2">{displayText(item.title)}</div>
                    <div className="text-app-text-muted text-sm">{displayText(item.artist)}</div>
                </div>
            </div>

            <div className="text-app-text-muted text-xs font-medium mb-3 mt-1">
                {item.type === '单曲' ? s.whats_new_type_single : item.type}
            </div>

            <div className="flex items-center justify-between pl-1 pr-2">
                <div className="flex items-center gap-6">
                    <button
                        {...bindTap(
                            { kind: 'action', id: 'track.like.toggle' },
                            {
                                params: { trackId: track.id, to: !added },
                                onTrigger: handleAdd,
                                stopPropagation: true,
                            },
                        )}
                    >
                        {added ? (
                            <div className="w-7 h-7 rounded-full bg-app-primary flex items-center justify-center">
                                <IcCheck size={16} className="text-black" strokeWidth={3} />
                            </div>
                        ) : (
                            <IcAddCircle size={28} className="text-app-text-muted" strokeWidth={1.5} />
                        )}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); /* show menu */ }}>
                        <IcMoreVertical size={24} className="text-app-text-muted" />
                    </button>
                </div>

                <button
                    {...bindTap(
                        { kind: 'action', id: 'track.play.toggle' },
                        {
                            params: { trackId: track.id, to: isCurrentTrack ? !isPlaying : true },
                            onTrigger: handlePlayForMe,
                            stopPropagation: true,
                        },
                    )}
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                >
                    {isPlaying ? (
                        <IcPause size={20} className="text-black fill-black" />
                    ) : (
                        <IcPlay size={20} className="text-black fill-black ml-0.5" />
                    )}
                </button>
            </div>
        </div>
    );
};

export const WhatsNewPage: React.FC = () => {
    const { bindBack } = useSpotifyGestures();
    const s = useSpotifyStrings();

    return (
        <div
            data-scroll-container="main"
            data-scroll-direction="vertical"
            className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 font-sans overflow-y-auto pb-40"
        >
            {/* Header */}
            <div className="mb-6 mt-2">
                <div className="flex items-center gap-4 mb-4">
                    <button {...bindBack()}>
                        <IcNavBackArrow className="text-white" size={24} />
                    </button>
                </div>
                <h1 className="text-3xl font-bold mb-2">{s.whats_new_title}</h1>
                <p className="text-app-text-muted text-xs">{s.whats_new_subtitle}</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-3 mb-8">
                <button className="bg-[#2A2A2A] hover:bg-[#3E3E3E] active:bg-[#222] transition-colors border-0 text-white px-4 py-1.5 rounded-full text-sm font-medium">{s.whats_new_filter_music}</button>
                <button className="bg-[#2A2A2A] hover:bg-[#3E3E3E] active:bg-[#222] transition-colors border-0 text-white px-4 py-1.5 rounded-full text-sm font-medium">{s.whats_new_filter_podcasts}</button>
            </div>

            <h2 className="text-lg font-bold mb-4">{s.whats_new_earlier}</h2>

            <div className="flex flex-col gap-4">
                {NEW_RELEASES.map(item => (
                    <NewItem key={item.id} item={item} />
                ))}
            </div>
        </div>
    );
};
