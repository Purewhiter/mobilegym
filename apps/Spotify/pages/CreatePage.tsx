import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IcAperture, IcMusic, IcUsers } from '../res/icons';
import { useSearchParams } from 'react-router-dom';
import { useSpotifyStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { useSpotifyGestures } from '../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../hooks/useSpotifyStrings';

export const CreatePage: React.FC = () => {
  const { customPlaylists } = useSpotifyStore(useShallow(s => ({ customPlaylists: s.customPlaylists })));
  const createPlaylist = useSpotifyStore(s => s.createPlaylist);
  const pendingTrack = useSpotifyStore(s => s.pendingPlaylistTrack);
  const { bindTap, bindBack, back, go } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const [searchParams] = useSearchParams();

  const view = searchParams.get('view') ?? 'menu';
  const source = searchParams.get('source'); // 'library' or null
  const isNaming = view === 'naming';
  const isLibrarySource = source === 'library';

  const defaultName = useMemo(() => {
    const count = customPlaylists?.length ?? 0;
    return count === 0 ? s.create_naming_default : `${s.create_naming_default} ${count + 1}`;
  }, [customPlaylists, s.create_naming_default]);

  const [playlistName, setPlaylistName] = useState(defaultName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNaming) {
      setPlaylistName(defaultName);
      setError('');
    }
  }, [defaultName, isNaming]);

  const handleCreate = () => {
    const name = playlistName.trim();
    if (!name) return;

    const exists = customPlaylists?.some(p => ('title' in p ? p.title : p.name) === name);
    if (exists) {
      setError(s.create_naming_error_exists);
      return;
    }

    const newPlaylist = createPlaylist(name, pendingTrack);
    if (pendingTrack) {
      useSpotifyStore.setState({ pendingPlaylistTrack: null });
    }

    go('playlist.open', { id: newPlaylist.id }, { mode: 'replace' });
  };

  // ── Drag-to-dismiss (menu view only, but hooks must run every render) ──
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragOffsetRef = useRef(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const isDragging = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const DISMISS_THRESHOLD = 80;
  const DRAG_START_THRESHOLD = 8;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = false;
    dragStartY.current = e.clientY;
    dragOffsetRef.current = 0;
    pointerIdRef.current = e.pointerId;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current === null) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    if (!isDragging.current) {
      if (dy < DRAG_START_THRESHOLD) return;
      isDragging.current = true;
      sheetRef.current?.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    dragOffsetRef.current = dy;
    setDragOffsetY(dy);
  }, []);

  const onPointerUp = useCallback(() => {
    pointerIdRef.current = null;
    if (!isDragging.current) return;
    isDragging.current = false;
    if (dragOffsetRef.current >= DISMISS_THRESHOLD) {
      back();
    } else {
      dragOffsetRef.current = 0;
      setDragOffsetY(0);
    }
  }, [back]);

  if (isNaming) {
    return (
      <div className="absolute inset-0 z-[80] bg-[#3E3E3E] flex flex-col items-center justify-center animate-in fade-in duration-200" data-keep-keyboard>
        <h2 className="text-xl font-bold mb-12 text-white">{s.create_naming_title}</h2>

        <div className="w-full px-12 mb-8 relative">
          <input
            value={playlistName}
            onChange={e => {
              setPlaylistName(e.target.value);
              if (error) setError('');
            }}
            className="w-full bg-transparent text-center text-3xl font-bold text-white border-b border-gray-500 focus:border-white outline-none pb-2 selection:bg-green-500 selection:text-white"
            autoFocus
          />
          {error && (
            <div className="absolute left-0 right-0 text-center mt-4 text-[#ff5a5f] text-sm font-medium animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-8">
          <button
            {...bindBack()}
            className="px-8 py-3 rounded-full border border-gray-500 text-white font-bold hover:scale-105 transition-transform text-sm"
          >
            {s.create_cancel}
          </button>
          <button
            {...bindTap(
              { kind: 'action', id: 'create.playlist.submit' },
              {
                params: { name: playlistName.trim() },
                onTrigger: handleCreate,
              },
            )}
            className="px-8 py-3 rounded-full bg-app-primary text-black font-bold hover:scale-105 transition-transform text-sm"
          >
            {s.create_submit}
          </button>
        </div>
      </div>
    );
  }

  // Menu view — overlay bottom sheet
  return (
    <div
      className="absolute inset-0 flex flex-col justify-end z-[70]"
      style={isLibrarySource ? undefined : { bottom: 'var(--app-tab-bar-height)' }}
    >
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        {...bindBack({ stopPropagation: true })}
      />

      {/* Bottom sheet — full rounded rectangle */}
      <div
        ref={sheetRef}
        className="relative rounded-2xl bg-[#282828] mx-2 mb-6 px-6 shadow-2xl pt-2 pb-8 animate-in slide-in-from-bottom-4 duration-200"
        style={{
          touchAction: 'none',
          transform: `translateY(${dragOffsetY}px)`,
          transition: isDragging.current ? 'none' : 'transform 200ms ease-out',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="w-10 h-1 rounded-full bg-gray-500/70 mx-auto mb-5" />

        <div className="space-y-7">
          <button
            {...bindTap('create.naming.open')}
            className="flex items-center gap-5 group active:opacity-70 transition-opacity cursor-pointer w-full text-left"
          >
            <div className="w-16 h-16 rounded-full bg-[#3E3E3E] flex items-center justify-center text-gray-300">
              <IcMusic size={32} />
            </div>
            <div>
              <div className="text-white text-[22px] font-bold">{s.create_playlist}</div>
              <div className="text-gray-400 text-base">{s.create_playlist_desc}</div>
            </div>
          </button>

          <div className="flex items-center gap-5 group active:opacity-70 transition-opacity cursor-pointer">
            <div className="w-16 h-16 rounded-full bg-[#3E3E3E] flex items-center justify-center text-gray-300">
              <IcUsers size={32} />
            </div>
            <div>
              <div className="text-white text-[22px] font-bold">{s.create_collaborative}</div>
              <div className="text-gray-400 text-base">{s.create_collaborative_desc}</div>
            </div>
          </div>

          <div className="flex items-center gap-5 group active:opacity-70 transition-opacity cursor-pointer">
            <div className="w-16 h-16 rounded-full bg-[#3E3E3E] flex items-center justify-center text-gray-300">
              <IcAperture size={32} />
            </div>
            <div>
              <div className="text-white text-[22px] font-bold">{s.create_blend}</div>
              <div className="text-gray-400 text-base">{s.create_blend_desc}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
