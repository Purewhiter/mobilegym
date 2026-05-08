import React, { useState } from 'react';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { IcNavBackArrow, IcMore, IcMic, IcExpand } from '../res/icons';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import type { SpotifyTrack, PlayHistoryEntry } from '../types';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';

interface HistoryGroup {
    sourceType: string;
    sourceId: string;
    sourceTitle: string;
    sourceCover?: string;
    tracks: SpotifyTrack[];
}

function buildGroups(history: PlayHistoryEntry[], fallbackTracks: SpotifyTrack[]): HistoryGroup[] {
    const groupMap = new Map<string, HistoryGroup>();
    const order: string[] = [];

    for (const entry of history) {
        const key = entry.sourceId;
        let group = groupMap.get(key);
        if (!group) {
            group = {
                sourceType: entry.sourceType,
                sourceId: entry.sourceId,
                sourceTitle: entry.sourceTitle,
                sourceCover: entry.sourceCover,
                tracks: [],
            };
            groupMap.set(key, group);
            order.push(key);
        }
        // avoid duplicate tracks in same group
        if (!group.tracks.some(t => t.id === entry.track.id)) {
            group.tracks.push(entry.track);
        }
    }

    // Merge fallback recentPlays (old data without source) into standalone group
    const standaloneKey = 'standalone';
    let standalone = groupMap.get(standaloneKey);
    if (!standalone) {
        standalone = { sourceType: 'standalone', sourceId: standaloneKey, sourceTitle: '', tracks: [] };
    }
    // Add recentPlays tracks not already in any group
    const allTrackedIds = new Set<string>();
    for (const g of groupMap.values()) {
        for (const t of g.tracks) allTrackedIds.add(t.id);
    }
    for (const t of fallbackTracks) {
        if (!allTrackedIds.has(t.id)) {
            standalone.tracks.push(t);
        }
    }
    if (standalone.tracks.length > 0 && !groupMap.has(standaloneKey)) {
        groupMap.set(standaloneKey, standalone);
        order.push(standaloneKey);
    }

    return order.filter(k => groupMap.get(k)!.tracks.length > 0).map(k => groupMap.get(k)!);
}

export const RecentPlayedPage: React.FC = () => {
    const locale = useLocale();
    const isEnglish = locale === 'en';
    const [searchParams] = useSearchParams();
    const { bindTap, bindBack, back, go } = useSpotifyGestures();
    const s = useSpotifyStrings();
    const { currentTrack, recentPlays, customPlaylists, playHistory } = useSpotifyStore(useShallow(s => ({
        currentTrack: s.currentTrack, recentPlays: s.recentPlays,
        customPlaylists: s.customPlaylists, playHistory: s.playHistory,
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

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    const groups = React.useMemo(
        () => buildGroups(playHistory || [], recentPlays),
        [playHistory, recentPlays],
    );

    // Find selected track across all groups
    const selectedTrack: SpotifyTrack | null = React.useMemo(() => {
        if ((!isMenuOpen && !showAddPlaylist) || !menuTrackId) return null;
        for (const g of groups) {
            const found = g.tracks.find(t => t.id === menuTrackId);
            if (found) return found;
        }
        return recentPlays.find(t => t.id === menuTrackId) ?? null;
    }, [isMenuOpen, showAddPlaylist, menuTrackId, groups, recentPlays]);

    const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);
    const formatText = (template: string, values: Record<string, string | number>) =>
        Object.entries(values).reduce(
            (result, [key, value]) => result.replace(`{${key}}`, String(value)),
            template,
        );

    const sourceLabel = (g: HistoryGroup) => {
        const playedCount = formatText(s.recent_played_count, { count: g.tracks.length });
        switch (g.sourceType) {
            case 'playlist': return `${playedCount} • ${isEnglish ? 'Playlist' : '歌单'}`;
            case 'album': return `${playedCount} • ${isEnglish ? 'Album' : '专辑'} • ${displayText(g.tracks[0]?.artist ?? '')}`;
            case 'artist': return `${playedCount} • ${isEnglish ? 'Artist' : '艺人'}`;
            default: return '';
        }
    };

    // 2x2 grid thumbnail
    const GridCover = ({ tracks }: { tracks: SpotifyTrack[] }) => {
        const covers = tracks.slice(0, 4).map(t => t.cover).filter(Boolean);
        const slots = [...covers];
        while (slots.length < 4) slots.push('');
        return (
            <div className="w-16 h-16 rounded overflow-hidden grid grid-cols-2 flex-shrink-0">
                {slots.map((src, i) => (
                    src
                        ? <img key={i} src={src} className="w-full h-full object-cover" />
                        : <div key={i} className="w-full h-full bg-gray-700" />
                ))}
            </div>
        );
    };

    const GroupCover = ({ group }: { group: HistoryGroup }) => {
        if (group.sourceType === 'artist') {
            return (
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-700">
                    {group.sourceCover
                        ? <img src={group.sourceCover} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-500"><IcMic size={20} /></div>
                    }
                </div>
            );
        }
        if (group.sourceCover) {
            return (
                <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-gray-700">
                    <img src={group.sourceCover} className="w-full h-full object-cover" />
                </div>
            );
        }
        return <GridCover tracks={group.tracks} />;
    };

    const TrackItem = ({ track }: { track: SpotifyTrack }) => (
        <div
            className="flex items-center gap-3 py-2 pl-4 pr-0 active:bg-white/10 rounded-lg transition-colors cursor-pointer"
            {...bindTap('player.open', {
                beforeTrigger: () => {
                    if (currentTrack?.id !== track.id) playTrack(track);
                },
            })}
        >
            <div className="w-12 h-12 rounded bg-gray-800 overflow-hidden flex-shrink-0">
                {track.cover ? (
                    <img src={track.cover} alt={displayText(track.title)} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-700 text-gray-500">
                        <IcMic size={20} />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-bold text-base truncate text-white">{displayText(track.title)}</div>
                <div className="text-gray-400 text-xs truncate">{displayText(track.artist)}</div>
            </div>
            <button
                {...bindTap('history.trackMenu.open', {
                    params: { trackId: track.id },
                    stopPropagation: true,
                })}
                className="p-2 hover:bg-[#222] rounded-full flex-shrink-0"
            >
                <IcMore size={20} className="text-gray-400" />
            </button>
        </div>
    );

    return (
        <div
            data-scroll-container="main"
            data-scroll-direction="vertical"
            className="flex flex-col h-full bg-app-surface text-white p-4 pt-10 font-sans overflow-y-auto pb-24"
        >
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 relative">
                <button {...bindBack()} className="cursor-pointer z-10">
                    <IcNavBackArrow size={24} />
                </button>
                <h1 className="text-base font-bold absolute w-full text-center left-0">{s.recent_title}</h1>
            </div>

            {/* Filter chip */}
            <div className="flex gap-2 mb-6">
                <button className="bg-[#2A2A2A] px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap">{s.recent_filter_music}</button>
            </div>

            {/* 今天 */}
            <div className="mb-6">
                <h2 className="text-lg font-bold mb-4">{s.recent_today}</h2>

                {groups.length === 0 && (
                    <div className="text-gray-500 text-sm mb-4">{s.recent_no_records}</div>
                )}

                {groups.map(group => {
                    const isExpanded = expandedGroups.has(group.sourceId);
                    const isStandalone = group.sourceType === 'standalone';
                    const title = isStandalone
                        ? formatText(s.recent_played_count, { count: group.tracks.length })
                        : displayText(group.sourceTitle || s.recent_unknown_item);
                    const subtitle = isStandalone ? '' : sourceLabel(group);

                    return (
                        <div key={group.sourceId} className="mb-2">
                            {/* Group header */}
                            <div
                                onClick={() => toggleGroup(group.sourceId)}
                                className="flex items-center gap-3 p-2 -mx-2 rounded-lg active:bg-white/10 cursor-pointer"
                            >
                                <GroupCover group={group} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-base text-white truncate">{title}</div>
                                    {subtitle && (
                                        <div className="text-gray-400 text-xs truncate">{subtitle}</div>
                                    )}
                                </div>
                                <div className="p-2 flex-shrink-0">
                                    <IcExpand
                                        size={24}
                                        className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                </div>
                            </div>
                            {/* Expanded track list */}
                            {isExpanded && (
                                <div className="mt-1">
                                    {group.tracks.map(track => (
                                        <TrackItem key={track.id} track={track} />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* 昨天 (mock) */}
            <div className="mb-6">
                <h2 className="text-lg font-bold mb-4">{s.recent_yesterday}</h2>
                <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg">
                    <div className="w-16 h-16 bg-gray-600 rounded overflow-hidden grid grid-cols-2 gap-0.5 p-0.5 flex-shrink-0">
                        <div className="bg-gray-400" /><div className="bg-gray-500" />
                        <div className="bg-gray-500" /><div className="bg-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-base truncate text-white">{formatText(s.recent_played_count, { count: 4 })}</div>
                    </div>
                    <div className="p-2 flex-shrink-0">
                        <IcExpand size={24} className="text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Track Menu Sheet */}
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
                    addToPlaylistProps={bindTap('history.addPlaylist.open', { params: { trackId: selectedTrack.id }, stopPropagation: true })}
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
