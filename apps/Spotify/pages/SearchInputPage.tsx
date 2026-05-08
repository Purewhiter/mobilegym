import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/os/locale';
import { useSearchParams } from 'react-router-dom';
import { IcAddCircle, IcLikedIndicator, IcMoreVertical, IcNavBack, IcSearch } from '../res/icons';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';
import { useSpotifyStore, selectLikedSongIds } from '../state';
import type { SpotifyTrack } from '../types';
import * as TimeService from '../../../os/TimeService';
import { setJsonpCallback, removeJsonpCallback, type ITunesResponse, type ITunesResult } from '../utils/jsonp';
import { TrackMenuSheet } from '../components/TrackMenuSheet';
import { AddToPlaylistSheet } from '../components/AddToPlaylistSheet';
import { localizeSpotifyText } from '../utils/localizeSpotifyText';
import { loadSearchResults } from '../data/loader';
import { openSaveLocation } from '../components/LikedToast';

const FILTER_CHIPS = ['歌曲', '歌单', '专辑', '播客', '视频', '艺人'];

function toTrackFromItunes(result: any): SpotifyTrack {
  const millis = Number(result?.trackTimeMillis ?? 0);
  const totalSeconds = Number.isFinite(millis) && millis > 0 ? Math.floor(millis / 1000) : 180;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    id: `it_${String(result?.trackId ?? result?.collectionId ?? Math.random())}`,
    title: String(result?.trackName ?? ''),
    artist: String(result?.artistName ?? ''),
    cover: String(result?.artworkUrl100 ?? ''),
    duration: `${minutes}:${String(seconds).padStart(2, '0')}`,
  } as SpotifyTrack;
}

export const SearchInputPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [searchParams, setSearchParams] = useSearchParams();
  const { bindBack, bindTap, go, back } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const currentTrack = useSpotifyStore(state => state.currentTrack);
  const playTrack = useSpotifyStore(state => state.playTrack);
  const addToQueue = useSpotifyStore(state => state.addToQueue);
  const showQueueToast = useSpotifyStore(state => state.showQueueToast);
  const likedSongIds = useSpotifyStore(selectLikedSongIds);
  const toggleLike = useSpotifyStore(state => state.toggleLike);
  const setSearchResults = useSpotifyStore(state => state.setSearchResults);
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const searchTermRef = useRef(searchTerm);
  searchTermRef.current = searchTerm;
  const followedArtists = useSpotifyStore(state => state.followedArtists);
  const toggleFollowArtist = useSpotifyStore(state => state.toggleFollowArtist);
  const lastCallbackRef = useRef<string | null>(null);
  const pendingScriptsRef = useRef<HTMLScriptElement[]>([]);
  const pendingCallbackNamesRef = useRef<string[]>([]);
  const batchResultsRef = useRef<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [addPlaylistTitleVariant, setAddPlaylistTitleVariant] = useState<'default' | 'saveLocation'>('default');

  const isMenuOpen = searchParams.get('sheet') === 'track_menu';
  const showAddPlaylist = searchParams.get('sheet') === 'add_playlist';
  const menuTrackId = searchParams.get('trackId');
  const menuTrack: SpotifyTrack | null = React.useMemo(() => {
    if (!menuTrackId) return null;
    const raw = results.find(r => String(r.trackId || r.id) === menuTrackId);
    if (!raw) return null;
    return raw.source === 'local' && raw._track ? raw._track : toTrackFromItunes(raw);
  }, [menuTrackId, results]);
  const menuAlbumTitle = React.useMemo(() => {
    if (!menuTrackId) return undefined;
    const raw = results.find(r => String(r.trackId || r.id) === menuTrackId);
    return raw?.collectionName as string | undefined;
  }, [menuTrackId, results]);

  const displayText = (value: string | undefined) => localizeSpotifyText(value, isEnglish);
  const isLiked = (trackId: string, track?: { title: string; artist: string }) => likedSongIds.has(trackId, track);
  const filterLabel = (chip: string) => {
    switch (chip) {
      case '歌曲':
        return s.search_filter_songs;
      case '歌单':
        return s.search_filter_playlists;
      case '专辑':
        return s.search_filter_albums;
      case '播客':
        return s.search_filter_podcasts;
      case '视频':
        return s.search_filter_videos;
      case '艺人':
        return s.search_filter_artists;
      default:
        return chip;
    }
  };

  const getResultTypeLabel = (track: any) => {
    if (track.kind === 'album') return `${s.search_result_album} • ${displayText(track.artistName)}`;
    if (track.kind === 'artist') return s.search_result_artist;
    return `${s.search_result_song} • ${displayText(track.artistName || track.artist)}`;
  };

  const syncSearchResultsToStore = (query: string, allResults: any[]) => {
    const songs = allResults.filter((result: any) => result.kind === 'song' || result.source === 'local');
    const tracks: SpotifyTrack[] = songs.map((result: any) =>
      result.source === 'local' && result._track ? result._track : toTrackFromItunes(result),
    );
    setSearchResults(query, tracks);
  };

  const removePendingCallback = useCallback((callbackName: string) => {
    pendingCallbackNamesRef.current = pendingCallbackNamesRef.current.filter(name => name !== callbackName);
    removeJsonpCallback(callbackName);
  }, []);

  const cleanupPendingRequests = useCallback(() => {
    for (const script of pendingScriptsRef.current) {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    }
    pendingScriptsRef.current = [];
    for (const callbackName of pendingCallbackNamesRef.current) {
      removeJsonpCallback(callbackName);
    }
    pendingCallbackNamesRef.current = [];
    batchResultsRef.current = [];
  }, []);

  const handleSearch = useCallback(async () => {
    const query = searchTermRef.current.trim();
    if (!query) return;

    const batchId = `${TimeService.now()}_${Math.floor(Math.random() * 10000)}`;
    lastCallbackRef.current = batchId;
    cleanupPendingRequests();
    setResults([]);
    setLoading(true);

    const offlineMap = await loadSearchResults().catch(() => null);
    if (lastCallbackRef.current !== batchId) return;

    const offlineEntry = offlineMap?.[query.toLowerCase()];
    if (offlineEntry && (offlineEntry.songs.length > 0 || offlineEntry.artists.length > 0 || offlineEntry.albums.length > 0)) {
      const { songs: offlineSongs, artists: offlineArtists, albums: offlineAlbums } = offlineEntry;
      console.log(
        `[Spotify] SearchInputPage: offline hit for "${query}" (${offlineSongs.length} songs, ${offlineArtists.length} artists, ${offlineAlbums.length} albums)`,
      );
      const songItems = offlineSongs.map(track => ({
        source: 'local' as const,
        kind: 'song',
        trackId: track.id,
        collectionId: track.id,
        trackName: track.title,
        artistName: track.artist,
        artworkUrl100: track.cover,
        _track: track,
      }));
      const artistItems = offlineArtists.map(artist => ({
        source: 'itunes' as const,
        kind: 'artist',
        artistId: artist.artistId,
        artistName: artist.artistName,
        artworkUrl100: artist.artworkUrl100,
      }));
      const albumItems = offlineAlbums.map(album => ({
        source: 'itunes' as const,
        kind: 'album',
        collectionId: album.collectionId,
        collectionName: album.collectionName,
        artistName: album.artistName,
        artworkUrl100: album.artworkUrl100,
      }));
      const fullResults = [...songItems, ...artistItems, ...albumItems];
      syncSearchResultsToStore(query, fullResults);
      setResults(fullResults);
      setLoading(false);
      return;
    }

    console.log(`[Spotify] SearchInputPage: offline miss for "${query}", fetching iTunes API`);
    const filter = activeFilter;
    const entityList: { entity: string; media: string }[] = [];
    if (!filter) {
      entityList.push(
        { entity: 'song', media: 'music' },
        { entity: 'musicArtist', media: 'music' },
        { entity: 'album', media: 'music' },
      );
    } else {
      const entity =
        filter === '歌曲'
          ? 'song'
          : filter === '专辑'
            ? 'album'
            : filter === '艺人'
              ? 'musicArtist'
              : filter === '视频'
                ? 'musicVideo'
                : filter === '播客'
                  ? 'podcast'
                  : 'song';
      const media = entity === 'podcast' ? 'podcast' : 'music';
      entityList.push({ entity, media });
    }

    const kindOf = (result: ITunesResult) => {
      if (result.wrapperType === 'collection') return 'album';
      if (result.wrapperType === 'artist') return 'artist';
      if (result.wrapperType === 'track') {
        if (result.kind === 'song') return 'song';
        if (result.kind === 'music-video') return 'video';
      }
      if (result.kind === 'podcast') return 'podcast';
      return 'unknown';
    };

    let pendingCount = entityList.length;
    for (const { entity, media } of entityList) {
      const callbackName = `itunes_cb_${entity}_${batchId}`;
      const script = document.createElement('script');
      const fetchLimit = filter ? 30 : 10;
      script.src =
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}` +
        `&media=${media}&entity=${entity}&limit=${fetchLimit}&country=TW&callback=${callbackName}`;
      pendingCallbackNamesRef.current.push(callbackName);

      setJsonpCallback<ITunesResponse>(callbackName, (data) => {
        if (lastCallbackRef.current !== batchId) {
          if (script.parentNode) {
            document.body.removeChild(script);
          }
          pendingScriptsRef.current = pendingScriptsRef.current.filter(item => item !== script);
          removePendingCallback(callbackName);
          return;
        }

        const mapped = (data.results ?? []).map(result => ({
          ...result,
          source: 'itunes' as const,
          kind: kindOf(result),
        }));
        batchResultsRef.current = [...batchResultsRef.current, ...mapped];
        pendingCount -= 1;

        if (pendingCount <= 0) {
          const fullResults = [...batchResultsRef.current];
          syncSearchResultsToStore(query, fullResults);
          setResults(fullResults);
          setLoading(false);
        }

        if (script.parentNode) {
          document.body.removeChild(script);
        }
        pendingScriptsRef.current = pendingScriptsRef.current.filter(item => item !== script);
        removePendingCallback(callbackName);
      });

      script.onerror = () => {
        pendingCount -= 1;
        if (lastCallbackRef.current === batchId && pendingCount <= 0) {
          const fullResults = [...batchResultsRef.current];
          syncSearchResultsToStore(query, fullResults);
          setResults(fullResults);
          setLoading(false);
        }
        if (script.parentNode) {
          document.body.removeChild(script);
        }
        pendingScriptsRef.current = pendingScriptsRef.current.filter(item => item !== script);
        removePendingCallback(callbackName);
      };

      pendingScriptsRef.current.push(script);
      document.body.appendChild(script);
    }
  }, [activeFilter, cleanupPendingRequests, removePendingCallback, setSearchResults]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    const urlQ = searchParams.get('q') ?? '';
    if (trimmed !== urlQ) {
      setSearchParams(prev => {
        if (trimmed) {
          prev.set('q', trimmed);
        } else {
          prev.delete('q');
        }
        return prev;
      }, { replace: true });
    }

    if (!trimmed) {
      cleanupPendingRequests();
      setResults([]);
      setLoading(false);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      void handleSearch();
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [cleanupPendingRequests, handleSearch, searchTerm]); // searchTerm triggers debounce, handleSearch is stable

  useEffect(() => {
    return () => {
      lastCallbackRef.current = null;
      cleanupPendingRequests();
    };
  }, [cleanupPendingRequests]);

  return (
    <div className="flex h-full flex-col bg-app-bg text-white pt-10">
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3">
          <button {...bindBack()} className="flex h-10 w-10 items-center justify-center rounded-full text-white">
            <IcNavBack size={30} />
          </button>
          <div className="relative flex-1">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <IcSearch size={20} />
            </div>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  inputRef.current?.blur();
                  void handleSearch();
                }
              }}
              placeholder={s.search_placeholder}
              className="h-12 w-full rounded bg-[#2A2A2A] pl-10 pr-4 text-base text-white placeholder:text-gray-400 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="flex-1 overflow-y-auto px-4 pb-40"
      >
        {searchTerm ? (
          <div className="pb-6">
            <div className="mb-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {FILTER_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => setActiveFilter(prev => (prev === chip ? null : chip))}
                  className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                    activeFilter === chip
                      ? 'bg-app-primary text-black'
                      : 'border border-transparent bg-[#2A2A2A] text-white'
                  }`}
                >
                  {filterLabel(chip)}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="mt-10 text-center text-gray-400">{s.search_loading}</div>
            ) : (
              <div className="space-y-2">
                {results.length === 0 ? (
                  <div className="mt-10 text-center text-gray-400">{s.search_no_results}</div>
                ) : (() => {
                  const artistResults = results.filter((result: any) => result.kind === 'artist');
                  const songResults = results.filter((result: any) => result.kind === 'song' || result.source === 'local');
                  const albumResults = results.filter((result: any) => result.kind === 'album');
                  const topArtistName = songResults.length > 0 ? String(songResults[0].artistName || songResults[0].artist || '') : '';
                  const topArtistImg = songResults.length > 0 ? String(songResults[0].artworkUrl100 || '') : '';
                  const isFollowed = (name: string) =>
                    followedArtists.some(artist => artist.trim().toLowerCase() === name.trim().toLowerCase());
                  const showArtists = !activeFilter || activeFilter === '艺人';
                  const showSongs = !activeFilter || activeFilter === '歌曲';
                  const showAlbums = !activeFilter || activeFilter === '专辑';
                  const showInferredArtistCard = !activeFilter && artistResults.length === 0 && topArtistName && songResults.length > 0;

                  return (
                    <>
                      {showArtists && (showInferredArtistCard || artistResults.length > 0) && (
                        <div className="mb-4">
                          {artistResults.slice(0, 3).map((artist: any) => (
                            <div
                              key={artist.artistId}
                              {...bindTap('artist.open', { params: { name: String(artist.artistName) } })}
                              className="mx-[-8px] flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-white/10"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-gray-800">
                                  {artist.artworkUrl100 && <img src={artist.artworkUrl100} className="h-full w-full object-cover" />}
                                </div>
                                <div>
                                  <div className="text-base font-bold text-white">{displayText(artist.artistName)}</div>
                                  <div className="text-sm text-gray-400">{s.search_result_artist}</div>
                                </div>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFollowArtist(artist.artistName);
                                }}
                                className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
                                  isFollowed(artist.artistName) ? 'border-white text-white' : 'border-gray-500 text-white'
                                }`}
                              >
                                {isFollowed(artist.artistName) ? s.artist_following : isEnglish ? 'Follow' : '关注'}
                              </button>
                            </div>
                          ))}
                          {showInferredArtistCard && (
                            <div
                              {...bindTap('artist.open', { params: { name: topArtistName } })}
                              className="mx-[-8px] flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-white/10"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-gray-800">
                                  {topArtistImg && <img src={topArtistImg} className="h-full w-full object-cover" />}
                                </div>
                                <div>
                                  <div className="text-base font-bold text-white">{displayText(topArtistName)}</div>
                                  <div className="text-sm text-gray-400">{s.search_result_artist}</div>
                                </div>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFollowArtist(topArtistName);
                                }}
                                className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
                                  isFollowed(topArtistName) ? 'border-white text-white' : 'border-gray-500 text-white'
                                }`}
                              >
                                {isFollowed(topArtistName) ? s.artist_following : isEnglish ? 'Follow' : '关注'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {showAlbums && albumResults.length > 0 && (
                        <div className="mb-4">
                          {!activeFilter && (
                            <h3 className="mb-2 text-lg font-bold text-white">
                              {isEnglish ? `Featuring ${displayText(searchTerm)}` : `精选 ${displayText(searchTerm)}`}
                            </h3>
                          )}
                          {!activeFilter ? (
                            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                              {albumResults.slice(0, 6).map((album: any) => (
                                <div
                                  key={album.collectionId}
                                  {...bindTap('playlist.open', { params: { id: String(album.collectionId) } })}
                                  className="w-36 flex-shrink-0 cursor-pointer"
                                >
                                  <div className="mb-2 h-36 w-36 overflow-hidden rounded bg-gray-800">
                                    <img
                                      src={album.artworkUrl100}
                                      alt={displayText(album.collectionName)}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="truncate text-sm font-bold text-white">{displayText(album.collectionName)}</div>
                                  <div className="truncate text-xs text-gray-400">{displayText(album.artistName)}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            albumResults.map((album: any) => (
                              <div
                                key={album.collectionId}
                                {...bindTap('playlist.open', { params: { id: String(album.collectionId) } })}
                                className="mx-[-8px] flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-white/10"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-3">
                                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-800">
                                    <img
                                      src={album.artworkUrl100}
                                      alt={displayText(album.collectionName)}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-base font-bold text-white">{displayText(album.collectionName)}</div>
                                    <div className="truncate text-sm text-gray-400">
                                      {s.search_result_album} • {displayText(album.artistName)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {showSongs &&
                        songResults.map((track: any) => (
                          <div
                            key={String(track.trackId || track.id || Math.random())}
                            {...bindTap(
                              { kind: 'action', id: 'search.track.play' },
                              {
                                params: { trackId: String(track.trackId || track.id) },
                                onTrigger: () => {
                                  const normalizedTrack: SpotifyTrack =
                                    track.source === 'local' && track._track ? track._track : toTrackFromItunes(track);
                                  playTrack(normalizedTrack);
                                },
                              },
                            )}
                            className="mx-[-8px] flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-white/10"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-800">
                                <img
                                  src={track.artworkUrl100 || track.cover}
                                  alt={displayText(track.trackName || track.title)}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-0.5 truncate text-lg font-bold text-white">
                                  {displayText(track.trackName || track.title)}
                                </div>
                                <div className="truncate text-base text-gray-400">{getResultTypeLabel(track)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-5 pl-2 text-gray-400">
                              <button
                                {...bindTap('search.input.trackMenu.open', {
                                  params: { trackId: String(track.trackId || track.id) },
                                  stopPropagation: true,
                                })}
                                className="hover:text-white"
                              >
                                <IcMoreVertical size={22} />
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const normalizedTrack: SpotifyTrack =
                                    track.source === 'local' && track._track ? track._track : toTrackFromItunes(track);
                                  const alreadyLiked = isLiked(normalizedTrack.id, normalizedTrack);
                                  if (alreadyLiked) {
                                    openSaveLocation(normalizedTrack, setSearchParams);
                                    return;
                                  }
                                  toggleLike(normalizedTrack);
                                }}
                                className="hover:text-white"
                              >
                                {isLiked(String(track.trackId || track.id), {
                                  title: String(track.trackName || track.title || ''),
                                  artist: String(track.artistName || track.artist || ''),
                                }) ? (
                                  <IcLikedIndicator size={26} />
                                ) : (
                                  <IcAddCircle size={26} strokeWidth={1.5} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
            <h2 className="text-3xl font-bold text-white">{s.search_empty_title}</h2>
            <p className="mt-3 text-lg text-gray-400">{s.search_empty_subtitle}</p>
          </div>
        )}
      </div>

      {menuTrack && (
        <TrackMenuSheet
          track={menuTrack}
          albumTitle={menuAlbumTitle}
          isOpen={isMenuOpen}
          liked={isLiked(menuTrack.id, menuTrack)}
          likedTrackMenuVariant="otherPlaylistsOnly"
          onClose={() => back()}
          backdropProps={bindBack({ stopPropagation: true })}
          shareProps={{ onClick: () => back() }}
          likeProps={{
            onClick: () => {
              toggleLike(menuTrack);
              back();
            },
          }}
          addToPlaylistProps={bindTap('search.input.addPlaylist.open', {
            params: { trackId: menuTrack.id },
            stopPropagation: true,
            beforeTrigger: () => {
              setAddPlaylistTitleVariant(
                isLiked(menuTrack.id, menuTrack) ? 'saveLocation' : 'default',
              );
            },
          })}
          createJamProps={{ onClick: () => back() }}
          addToQueueProps={{
            onClick: () => {
              addToQueue(menuTrack);
              showQueueToast(menuTrack);
              back();
            },
          }}
          goToAlbumProps={bindTap('playlist.open', { params: { id: String(menuTrack.id) } })}
          goToArtistProps={bindTap('artist.open', { params: { name: String(menuTrack.artist) } })}
        />
      )}

      {menuTrack && (
        <AddToPlaylistSheet
          isOpen={showAddPlaylist}
          track={menuTrack}
          titleVariant={addPlaylistTitleVariant}
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
