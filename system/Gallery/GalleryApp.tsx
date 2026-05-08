/**
 * Gallery App
 * 
 * A modern photo gallery app inspired by iOS Photos / Google Photos.
 * Features:
 * - Timeline view with date grouping
 * - Albums view with beautiful grid
 * - Favorites collection
 * - Photo viewer with swipe navigation and zoom
 * - Multi-select mode for batch operations
 */
import React, { useCallback, useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { MemoryRouter, Routes, Route, useParams, useLocation, useNavigate, UNSAFE_NavigationContext } from 'react-router-dom';
import { AppNavigatorRegistry } from '../../os/AppNavigatorRegistry';
import {
  IcNavBack, IcNavForward, IcClose,
  IcMoreVert, IcMoreHoriz,
  IcSearch, IcFilter, IcSelectAll,
  IcShare, IcDelete, IcEdit,
  IcHeart, IcImage, IcVideo, IcCheck,
  IcAddPhoto, IcGrid, IcSparkles, IcScissors, IcFile, IcUser, IcCamera,
  IcRefresh,
  IcAddTo, IcWallpaper, IcInfo, IcGeneratePdf, IcExtract,
  IcDocEdit, IcWatermark, IcClipboard, IcRename
} from './res/icons';
import * as MediaService from '../../os/MediaService';
import * as FileSystem from '../../os/FileSystemService';
import { Toast } from '../../os/components/Toast';
import { MediaItem, Album, FSNode } from '../../os/types';
import { useActivityContext } from '../../os/ActivityContext';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import ContentResolver from '../../os/ContentResolver';
import { CollapsingToolbar, CollapsingLargeTitle, TOOLBAR_SPACER_HEIGHT } from '../../os/components/CollapsingToolbar';
import * as TimeService from '@/os/TimeService';
import { useGalleryGestures } from './hooks/useGalleryGestures';
import { ensureMediaProviderRegistered } from '../../os/providers/MediaProvider';

// ============================================================================
// Favorites Storage (backed by MediaProvider)
// ============================================================================

function buildFavoritePaths(): string[] {
  try {
    ensureMediaProviderRegistered();
    return ContentResolver.query<{ path?: string }>('content://media/favorites').items
      .map((item) => String(item.path || '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

let _favoritePathsSnapshot = buildFavoritePaths();

function subscribeFavorites(listener: () => void): () => void {
  return ContentResolver.registerContentObserver('content://media', () => {
    _favoritePathsSnapshot = buildFavoritePaths();
    listener();
  });
}

function useFavorites(): Set<string> {
  const favoritePaths = useSyncExternalStore(subscribeFavorites, () => _favoritePathsSnapshot, () => _favoritePathsSnapshot);
  return useMemo(() => new Set(favoritePaths), [favoritePaths]);
}

function setFavorite(path: string, favorite: boolean): boolean {
  ensureMediaProviderRegistered();
  const image = ContentResolver.query<MediaItem>('content://media/images').items.find((item) => item.path === path);
  const video = image ? null : ContentResolver.query<MediaItem>('content://media/videos').items.find((item) => item.path === path);
  const target = image ?? video;
  if (!target) return false;
  const kind = target.type === 'video' ? 'videos' : 'images';
  ContentResolver.update(`content://media/${kind}/${target.id}`, { favorite });
  return favorite;
}

// ============================================================================
// Date Label Helpers (MIUI-like)
// ============================================================================
function startOfDay(ts: number): number {
  const d = TimeService.fromTimestamp(ts);
  return TimeService.fromLocalParts(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatDateLabel(
  ts: number,
  dateToday: string,
  dateYesterday: string,
  monthSuffix: string,
  daySuffix: string,
  yearSuffix: string,
): string {
  const now = TimeService.now();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const dayStart = startOfDay(ts);

  if (dayStart === todayStart) return dateToday;
  if (dayStart === yesterdayStart) return dateYesterday;

  const d = TimeService.fromTimestamp(ts);
  const thisYear = TimeService.fromTimestamp(now).getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  return d.getFullYear() === thisYear ? `${month}${monthSuffix}${date}${daySuffix}` : `${d.getFullYear()}${yearSuffix}${month}${monthSuffix}${date}${daySuffix}`;
}

function getDateRangeLabel(
  items: MediaItem[],
  dateToday: string,
  dateYesterday: string,
  monthSuffix: string,
  daySuffix: string,
  yearSuffix: string,
  rangeSeparator: string,
): string {
  if (!items.length) return '';
  const timestamps = items.map(i => i.createdAt).filter(t => Number.isFinite(t));
  if (timestamps.length === 0) return '';
  const newest = Math.max(...timestamps);
  const oldest = Math.min(...timestamps);
  return `${formatDateLabel(newest, dateToday, dateYesterday, monthSuffix, daySuffix, yearSuffix)}${rangeSeparator}${formatDateLabel(oldest, dateToday, dateYesterday, monthSuffix, daySuffix, yearSuffix)}`;
}

// ============================================================================
// Shared Top Bar (tabs share layout; blur on scroll)
// ============================================================================
const GalleryTopBar: React.FC<{
  scrollTop: number;
  rightSlots: [React.ReactNode | null, React.ReactNode | null, React.ReactNode | null];
}> = ({ scrollTop, rightSlots }) => {
  const blurProgress = Math.max(0, Math.min(1, (scrollTop - 12) / 36));
  const isBlurred = blurProgress > 0;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 pt-10 px-5 transition-colors duration-200 ${
        isBlurred ? 'backdrop-blur-xl' : ''
      }`}
      style={{
        backgroundColor: `rgba(255, 255, 255, ${0.92 * blurProgress})`,
        borderBottom: `1px solid rgba(226, 232, 240, ${0.65 * blurProgress})`, // slate-200
      }}
    >
      <div className="h-(--app-topbar-height) flex items-center justify-between">
        {/* Left side is intentionally empty (shared top bar across tabs) */}
        <div className="w-10 h-10" />

        {/* Right aligned icon slots (positions aligned across tabs) */}
        <div className="flex items-center gap-2">
          {rightSlots.map((node, idx) => (
            <div

              key={idx}
              className="w-10 h-10 flex items-center justify-center"
            >
              {node ?? <div className="w-6 h-6 opacity-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Confirm Dialog Component
// ============================================================================
const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmText, cancelText, danger, onConfirm, onCancel }) => {
  const s = useAppStrings(strings, stringsEn);
  const effectiveConfirmText = confirmText ?? s.dialog_confirm;
  const effectiveCancelText = cancelText ?? s.dialog_cancel;
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-app-surface rounded-2xl w-(--app-dialog-width) overflow-hidden shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="pt-6 pb-4 px-5 text-center">
          <h3 className="text-[17px] font-semibold text-slate-900 mb-2">{title}</h3>
          <p className="text-[14px] text-slate-500 leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-slate-200">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 text-[16px] font-medium text-blue-500 active:bg-slate-50 border-r border-slate-200"
          >
            {effectiveCancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-[16px] font-semibold active:bg-slate-50 ${
              danger ? 'text-red-500' : 'text-blue-500'
            }`}
          >
            {effectiveConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Async Image Component - handles IndexedDB files
// ============================================================================
const AsyncImage: React.FC<{
  path: string;
  fallbackUri?: string;
  className?: string;
  alt?: string;
  onClick?: () => void;
}> = ({ path, fallbackUri, className, alt, onClick }) => {
  const [src, setSrc] = useState<string | null>(fallbackUri || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      // First try sync version
      const syncUri = FileSystem.getFileUri(path);
      if (syncUri) {
        if (mounted) {
          setSrc(syncUri);
          setLoading(false);
        }
        return;
      }
      
      // Fall back to async version
      const asyncUri = await FileSystem.getFileUriAsync(path);
      if (mounted) {
        setSrc(asyncUri || fallbackUri || null);
        setLoading(false);
      }
    };
    
    loadImage();
    
    return () => { mounted = false; };
  }, [path, fallbackUri]);
  
  if (loading || !src) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center`}>
        <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`${className} bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center`}>
        <IcImage size={24} className="text-slate-400" />
      </div>
    );
  }
  
  return (
    <img
      src={src}
      className={className}
      alt={alt}
      loading="lazy"
      draggable={false}
      onClick={onClick}
      onError={() => setError(true)}
    />
  );
};

// ============================================================================
// Navigation Handler
// ============================================================================
const GalleryNavigationHandler: React.FC = () => {
  const { back } = useGalleryGestures();
  const navigate = useNavigate();
  const { activityId } = useActivityContext();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  const handleBack = useCallback((): boolean => {
    const index = (navigator as any).index || 0;
    if (index > 0) {
      back();
      return true;
    }
    return false;
  }, [back, navigator]);

  useEffect(() => {
    const navFn = (path: string, opts?: { replace?: boolean }) => {
      navigate(path, { replace: opts?.replace ?? true });
    };
    AppNavigatorRegistry.registerActivity(activityId, { navigate: navFn, back: handleBack }, 'gallery');
    return () => {
      AppNavigatorRegistry.unregisterActivity(activityId);
    };
  }, [activityId, handleBack, navigate]);

  useAppNavigationHandler('gallery', { onBack: handleBack });

  return null;
};

// ============================================================================
// Floating Tab Pill (MIUI-like)
// ============================================================================
type HomeTab = 'photos' | 'albums';

const FloatingTabPill: React.FC<{ activeTab: HomeTab; onTabChange: (tab: HomeTab) => void }> = ({
  activeTab,
  onTabChange
}) => {
  const s = useAppStrings(strings, stringsEn);
  const tabs: { id: HomeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'photos', label: s.tab_photos, icon: <IcImage size={22} strokeWidth={dimens.icStrokeWidth} /> },
    { id: 'albums', label: s.tab_albums, icon: <IcAddPhoto size={22} strokeWidth={dimens.icStrokeWidth} /> },
  ];

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-(--app-tab-pill-bottom) z-40">
      <div className="bg-white/92 backdrop-blur-xl rounded-full shadow-lg border border-slate-200/70 px-2 py-1 flex items-center gap-1">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              onClick={() => onTabChange(tab.id)}
              className={`w-14 h-11 rounded-full flex items-center justify-center transition-colors ${
                isActive
                  ? 'text-slate-900 bg-slate-100/80'
                  : 'text-slate-400 active:bg-slate-100/60'
              }`}
            >
              {tab.icon}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Photo Grid Item
// ============================================================================
const PhotoGridItem: React.FC<{
  item: MediaItem;
  onClick: () => void;
  isSelected?: boolean;
  isSelectMode?: boolean;
  onSelect?: () => void;
  onLongPress?: () => void;
  showFavorite?: boolean;
}> = ({ item, onClick, isSelected, isSelectMode, onSelect, onLongPress, showFavorite }) => {
  const favorites = useFavorites();
  const favorite = favorites.has(item.path);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  
  const handlePointerDown = () => {
    isLongPress.current = false;
    clearTimer();
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onLongPress?.();
    }, 500);
  };
  
  const handlePointerUp = () => {
    clearTimer();
  };
  
  const handleClick = () => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    if (isSelectMode) {
      onSelect?.();
    } else {
      onClick();
    }
  };
  
  return (
    <div 
      className="relative aspect-square overflow-hidden group"
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <AsyncImage
        path={item.path}
        fallbackUri={item.thumbnailUri || item.uri}
        className="w-full h-full object-cover transition-transform duration-200 group-active:scale-95"
        alt={item.name}
      />
      
      {/* Video indicator */}
      {item.type === 'video' && (
        <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
          <IcVideo size={10} className="text-white" />
          {item.duration && (
            <span className="text-white text-[9px] font-medium">
              {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      )}
      
      {/* Favorite indicator */}
      {showFavorite && favorite && !isSelectMode && (
        <div className="absolute top-1 right-1">
          <IcHeart size={14} className="text-red-500 fill-red-500 drop-shadow-lg" />
        </div>
      )}
      
      {/* Selection indicator */}
      {isSelectMode && (
        <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          isSelected 
            ? 'bg-blue-500 border-blue-500' 
            : 'border-white bg-black/20'
        }`}>
          {isSelected && <IcCheck size={12} className="text-white" strokeWidth={3} />}
        </div>
      )}
      
      {/* Selection overlay */}
      {isSelectMode && isSelected && (
        <div className="absolute inset-0 bg-blue-500/20" />
      )}
    </div>
  );
};

// ============================================================================
// Photos Page (MIUI-like)
// ============================================================================
const PhotosPage: React.FC<{ onSelectModeChange?: (active: boolean) => void }> = ({ onSelectModeChange }) => {
  const { go } = useGalleryGestures();
  const s = useAppStrings(strings, stringsEn);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    onSelectModeChange?.(selectMode);
  }, [selectMode, onSelectModeChange]);

  useEffect(() => {
    const loadedItems = MediaService.getMediaItems({ type: 'all' });
    // Sort by date, newest first
    loadedItems.sort((a, b) => b.createdAt - a.createdAt);
    setItems(loadedItems);
  }, []);

  const subtitle = useMemo(() => getDateRangeLabel(items, s.date_today, s.date_yesterday, s.gallery_month_suffix, s.gallery_day_suffix, s.gallery_year_suffix, s.date_range_separator), [items, s]);
  
  const handleSelect = (path: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelected(newSelected);
  };
  
  const handleBatchDelete = () => {
    if (selected.size === 0) return;
    setShowDeleteConfirm(true);
  };
  
  const confirmBatchDelete = async () => {
    for (const path of selected) {
      await MediaService.deleteMedia(path);
    }
    setItems(items.filter(i => !selected.has(i.path)));
    setSelected(new Set());
    setSelectMode(false);
    setShowDeleteConfirm(false);
  };
  
  const handleBatchFavorite = () => {
    for (const path of selected) {
      setFavorite(path, true);
    }
    setSelected(new Set());
    setSelectMode(false);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.path)));
    }
  };

  const isAllSelected = items.length > 0 && selected.size === items.length;

  const selectTitle = selected.size > 0
    ? `${s.select_prefix}${selected.size}${s.select_suffix}`
    : s.select_prompt;
  
  return (
    <div className="h-full bg-app-surface flex flex-col relative overflow-hidden">
      {/* Top bar: CollapsingToolbar in select mode, GalleryTopBar otherwise */}
      {selectMode ? (
        <CollapsingToolbar
          title={selectTitle}
          scrollTop={scrollTop}
          alwaysShowSmallTitle={false}
          bgClass="bg-app-surface"
          leftContent={
            <button onClick={exitSelectMode} className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60">
              <IcClose size={28} className="text-slate-900" />
            </button>
          }
          rightContent={
            <button onClick={toggleSelectAll} className="w-10 h-10 flex items-center justify-center active:opacity-60">
              <IcSelectAll size={28} className={isAllSelected ? 'text-blue-500' : 'text-slate-400'} />
            </button>
          }
        />
      ) : (
        <GalleryTopBar
          scrollTop={scrollTop}
          rightSlots={[
            <button type="button" className="w-10 h-10 flex items-center justify-center active:opacity-60" aria-label={s.search_label}>
              <IcSearch size={22} className="text-slate-900" />
            </button>,
            <button
              type="button"
              onClick={() => go('favorites.open')}
              className="w-10 h-10 flex items-center justify-center active:opacity-60"
              aria-label={s.filter_label}
            >
              <IcFilter size={22} className="text-slate-900" />
            </button>,
            <button type="button" className="w-10 h-10 flex items-center justify-center active:opacity-60" aria-label={s.more_label}>
              <IcMoreVert size={22} className="text-slate-900" />
            </button>
          ]}
        />
      )}
      
      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto pb-32 no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
        onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
      >
        {selectMode ? (
          <>
            <div style={{ height: TOOLBAR_SPACER_HEIGHT }} />
            <CollapsingLargeTitle title={selectTitle} scrollTop={scrollTop} />
          </>
        ) : (
          <>
            <div style={{ height: dimens.home_topbar_total_height }} />
            <div className="px-5 pt-3 pb-3 bg-app-surface">
              <h1 className="text-[34px] font-semibold text-slate-900 leading-none">{s.photos_title}</h1>
              <div className="mt-2 text-[15px] text-slate-500 font-medium">
                {subtitle || `${items.length}${s.photos_item_count_suffix}`}
              </div>
            </div>
          </>
        )}

        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <IcImage size={40} className="text-slate-300" />
            </div>
            <span className="text-lg font-medium">{s.photos_empty_title}</span>
            <span className="text-sm text-slate-400 mt-1">{s.photos_empty_desc}</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-(--app-grid-gap) bg-app-surface px-(--app-grid-padding)">
            {items.map(item => (
              <PhotoGridItem
                key={item.id}
                item={item}
                onClick={() => go('photo.open', { path: encodeURIComponent(item.path) })}
                isSelectMode={selectMode}
                isSelected={selected.has(item.path)}
                onSelect={() => handleSelect(item.path)}
                onLongPress={() => {
                  if (!selectMode) {
                    setSelectMode(true);
                    setSelected(new Set([item.path]));
                  }
                }}
                showFavorite
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Select mode bottom action bar */}
      {selectMode && (
        <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-slate-100 flex items-center justify-around py-3 z-40 animate-in slide-in-from-bottom-10 duration-200">
          <button
            onClick={handleBatchFavorite}
            className="flex flex-col items-center gap-1.5 px-4 active:opacity-60"
          >
            <IcHeart size={22} className="text-slate-700" />
            <span className="text-[11px] text-slate-700">{s.action_favorite}</span>
          </button>
          <button
            onClick={() => {
              const paths = Array.from(selected);
              if (paths.length === 0) return;
              shareImagesAsIntent(paths);
            }}
            className="flex flex-col items-center gap-1.5 px-4 active:opacity-60"
            data-action="gallery.select.share"
            data-action-type="open"
          >
            <IcShare size={22} className="text-slate-700" />
            <span className="text-[11px] text-slate-700">{s.action_share}</span>
          </button>
          <button
            onClick={handleBatchDelete}
            className="flex flex-col items-center gap-1.5 px-4 active:opacity-60"
          >
            <IcDelete size={22} className="text-red-500" />
            <span className="text-[11px] text-red-500">{s.action_delete}</span>
          </button>
        </div>
      )}
      
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title={s.delete_photo_title}
        message={`${s.gallery_delete_batch_prefix}${selected.size}${s.gallery_delete_batch_suffix}`}
        confirmText={s.action_delete}
        cancelText={s.dialog_cancel}
        danger
        onConfirm={confirmBatchDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};

// ============================================================================
// Albums Page
// ============================================================================
const AlbumsPage: React.FC = () => {
  const { go } = useGalleryGestures();
  const s = useAppStrings(strings, stringsEn);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [moreCounts, setMoreCounts] = useState({
    recentlyDeleted: 0,
    documents: 0,
    people: 0,
    selfie: 0,
  });
  const [scrollTop, setScrollTop] = useState(0);
  
  useEffect(() => {
    const loadedAlbums = MediaService.getAlbums();
    setAlbums(loadedAlbums);

    // Best-effort counts (we don't have full MIUI classification in sim)
    const screenshotCount = MediaService.getMediaItems({ albumId: 'screenshots' }).length;
    const cameraCount = MediaService.getMediaItems({ albumId: 'camera' }).length;
    setMoreCounts(prev => ({
      ...prev,
      documents: screenshotCount,
      selfie: cameraCount,
    }));
  }, []);
  
  // Separate into main albums and app albums
  const systemAlbums = albums.filter(a => a.type === 'system');
  const appAlbums = albums.filter(a => a.type === 'app');
  
  return (
    <div className="h-full bg-app-bg flex flex-col">
      {/* Shared TopBar (icons row) */}
      <GalleryTopBar
        scrollTop={scrollTop}
        rightSlots={[
          <button type="button" className="w-10 h-10 flex items-center justify-center active:opacity-60" aria-label={s.search_label}>
            <IcSearch size={22} className="text-slate-900" />
          </button>,
          null,
          <button type="button" className="w-10 h-10 flex items-center justify-center active:opacity-60" aria-label={s.more_label}>
            <IcMoreVert size={22} className="text-slate-900" />
          </button>
        ]}
      />

      {/* Content */}
      <div
        className="px-4 pb-32 flex-1 overflow-y-auto no-scrollbar"
        style={{ paddingTop: dimens.home_topbar_total_height }}
        data-scroll-container="main"
        data-scroll-direction="vertical"
        onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
      >
        {/* Albums grid */}
        <div className="bg-app-surface rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="text-[18px] font-semibold text-slate-900">{s.albums_title}</div>
            <IcNavForward size={18} className="text-slate-400" />
          </div>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {systemAlbums.map(album => (
                <button
                  key={album.id}
                  onClick={() => go('album.open', { albumId: album.id })}
                  className="text-left active:scale-[0.98] transition-transform"
                >
                  <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
                    {album.coverUri ? (
                      <AsyncImage
                        path={album.coverPath || ''}
                        fallbackUri={album.coverUri}
                        className="w-full h-full object-cover"
                        alt={album.name}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <IcImage size={28} className="text-slate-300" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 px-0.5">
                    <div className="text-[15px] font-medium text-slate-900 truncate">
                      {album.name}
                    </div>
                    <div className="text-[12px] text-slate-500">
                      {album.count}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {appAlbums.length > 0 && (
              <div className="mt-5">
                <div className="text-[13px] font-semibold text-slate-500 mb-3">{s.albums_app_albums}</div>
                <div className="grid grid-cols-2 gap-3">
                  {appAlbums.map(album => (
                    <button
                      key={album.id}
                      onClick={() => go('album.open', { albumId: album.id })}
                      className="text-left active:scale-[0.98] transition-transform"
                    >
                      <div className="aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
                        {album.coverUri ? (
                          <AsyncImage
                            path={album.coverPath || ''}
                            fallbackUri={album.coverUri}
                            className="w-full h-full object-cover"
                            alt={album.name}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            <IcImage size={28} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                      <div className="mt-2 px-0.5">
                        <div className="text-[15px] font-medium text-slate-900 truncate">
                          {album.name}
                        </div>
                        <div className="text-[12px] text-slate-500">
                          {album.count}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tools / More list (MIUI-like) */}
        <div className="mt-4 bg-app-surface rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          {/* Section: 创作 */}
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="text-[18px] font-semibold text-slate-900">{s.creation_title}</div>
            <IcNavForward size={18} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <IcGrid size={18} className="text-slate-600" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.creation_collage}</div>
              </div>
              <IcNavForward size={18} className="text-slate-300" />
            </button>

            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-orange-100 flex items-center justify-center">
                  <IcScissors size={18} className="text-orange-500" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.creation_video_edit}</div>
              </div>
              <IcNavForward size={18} className="text-slate-300" />
            </button>

            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <IcSparkles size={18} className="text-blue-500" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.creation_smart_clip}</div>
              </div>
              <IcNavForward size={18} className="text-slate-300" />
            </button>

            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <IcVideo size={18} className="text-purple-500" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.creation_photo_movie}</div>
              </div>
              <IcNavForward size={18} className="text-slate-300" />
            </button>
          </div>

          {/* Section: 更多 */}
          <div className="px-4 pt-5 pb-2 flex items-center justify-between">
            <div className="text-[18px] font-semibold text-slate-900">{s.more_title}</div>
            <IcNavForward size={18} className="text-slate-400" />
          </div>
          <div className="divide-y divide-slate-100">
            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <IcDelete size={18} className="text-slate-700" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.more_recently_deleted}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-medium text-slate-400">{moreCounts.recentlyDeleted || ''}</div>
                <IcNavForward size={18} className="text-slate-300" />
              </div>
            </button>

            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <IcFile size={18} className="text-slate-700" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.more_documents}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-medium text-slate-400">{moreCounts.documents || ''}</div>
                <IcNavForward size={18} className="text-slate-300" />
              </div>
            </button>

            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <IcUser size={18} className="text-slate-700" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.more_people}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-medium text-slate-400">{moreCounts.people || ''}</div>
                <IcNavForward size={18} className="text-slate-300" />
              </div>
            </button>

            <button type="button" className="w-full px-4 py-3 flex items-center justify-between active:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <IcCamera size={18} className="text-slate-700" />
                </div>
                <div className="text-[15px] font-medium text-slate-900">{s.more_selfie}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[14px] font-medium text-slate-400">{moreCounts.selfie || ''}</div>
                <IcNavForward size={18} className="text-slate-300" />
              </div>
            </button>
          </div>
        </div>

        {/* Bottom button */}
        <button
          type="button"
          className="mt-4 w-full h-12 rounded-2xl bg-slate-200/80 text-slate-800 font-semibold active:bg-slate-200"
        >
          {s.more_customize}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Favorites Page
// ============================================================================
const FavoritesPage: React.FC = () => {
  const { go } = useGalleryGestures();
  const s = useAppStrings(strings, stringsEn);
  const favorites = useFavorites();
  const [items, setItems] = useState<MediaItem[]>([]);
  
  useEffect(() => {
    const allItems = MediaService.getMediaItems({ type: 'all' });
    const favoriteItems = allItems.filter(i => favorites.has(i.path));
    favoriteItems.sort((a, b) => b.createdAt - a.createdAt);
    setItems(favoriteItems);
  }, [favorites]);
  
  return (
    <div className="h-full bg-app-surface flex flex-col">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 bg-gradient-to-b from-white to-slate-50/50">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-pink-500 bg-clip-text text-transparent flex items-center gap-2">
          <IcHeart size={24} className="text-red-500 fill-red-500" />
          {s.favorites_title}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">{items.length}{s.favorites_count_suffix}</p>
      </div>
      
      {/* Content */}
      <div 
        className="flex-1 overflow-y-auto pb-24 no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center mb-4">
              <IcHeart size={36} className="text-red-200" />
            </div>
            <span className="text-lg font-medium text-slate-500">{s.favorites_empty_title}</span>
            <span className="text-sm text-slate-400 mt-1">{s.favorites_empty_desc}</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-(--app-grid-gap)">
            {items.map(item => (
              <PhotoGridItem
                key={item.id}
                item={item}
                onClick={() => go('photo.open', { path: encodeURIComponent(item.path), from: 'favorites' })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Album Detail Page
// ============================================================================
const AlbumDetailPage: React.FC = () => {
  const { go, back, bindBack } = useGalleryGestures();
  const { albumId } = useParams<{ albumId: string }>();
  const s = useAppStrings(strings, stringsEn);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [albumName, setAlbumName] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const albums = MediaService.getAlbums();
    const album = albums.find(a => a.id === albumId);
    setAlbumName(album?.name || s.album_default_name);
    
    const loadedItems = MediaService.getMediaItems({ albumId });
    loadedItems.sort((a, b) => b.createdAt - a.createdAt);
    setItems(loadedItems);
  }, [albumId]);
  
  const handleSelect = (path: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelected(newSelected);
  };
  
  // Group by date, sorted newest first
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { timestamp: number; items: MediaItem[] }>();

    items.forEach(item => {
      const date = TimeService.fromTimestamp(item.createdAt);
      const dateKey = `${date.getMonth() + 1}${s.gallery_month_suffix}${date.getDate()}${s.gallery_day_suffix}`;
      
      if (!groups.has(dateKey)) {
        const dayStart = TimeService.fromLocalParts(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        groups.set(dateKey, { timestamp: dayStart, items: [] });
      }
      groups.get(dateKey)!.items.push(item);
    });
    
    return Array.from(groups.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map(([date, { items }]) => ({ date, items }));
  }, [items, s]);
  
  return (
    <div className="h-full bg-app-surface flex flex-col">
      {/* Header */}
      <div className="pt-10 px-2 pb-2 flex items-center justify-between bg-app-surface border-b border-slate-100">
        <div className="flex items-center gap-1">
          <button 
            {...bindBack()}
            className="w-10 h-10 flex items-center justify-center active:bg-slate-100 rounded-full"
          >
            <IcNavBack size={26} className="text-slate-900" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{albumName}</h1>
            <span className="text-xs text-slate-500">{items.length}{s.photos_item_count_suffix}</span>
          </div>
        </div>
        <button 
          onClick={() => {
            setSelectMode(!selectMode);
            setSelected(new Set());
          }}
          className={`px-3 py-1.5 rounded-full text-sm font-medium mr-2 transition-all ${
            selectMode 
              ? 'bg-blue-500 text-white' 
              : 'text-blue-500 active:bg-slate-100'
          }`}
        >
          {selectMode ? s.album_done : s.album_select}
        </button>
      </div>
      
      {/* Photos grid */}
      <div 
        className="flex-1 overflow-y-auto no-scrollbar"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <IcImage size={40} className="text-slate-300" />
            </div>
            <span className="text-lg font-medium">{s.album_empty}</span>
          </div>
        ) : (
          <div className="pb-6">
            {groupedItems.map(({ date, items: dateItems }) => (
              <div key={date}>
                <div className="sticky top-0 z-10 px-4 py-2 bg-white/90 backdrop-blur-sm border-b border-slate-50">
                  <span className="text-sm font-medium text-slate-600">{date}</span>
                </div>
                <div className="grid grid-cols-4 gap-(--app-grid-gap)">
                  {dateItems.map(item => (
                    <PhotoGridItem
                      key={item.id}
                      item={item}
                      onClick={() => go('photo.open', { path: encodeURIComponent(item.path), album: albumId || '' })}
                      isSelectMode={selectMode}
                      isSelected={selected.has(item.path)}
                      onSelect={() => handleSelect(item.path)}
                      onLongPress={() => {
                        if (!selectMode) {
                          setSelectMode(true);
                          setSelected(new Set([item.path]));
                        }
                      }}
                      showFavorite
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Intent-launched single-image helpers
// ============================================================================
function fsNodeToMediaItem(node: FSNode): MediaItem {
  return {
    id: node.id,
    type: node.mimeType?.startsWith('video/') ? 'video' : 'image',
    uri: FileSystem.getFileUri(node.path) || '',
    thumbnailUri: node.thumbnailUri,
    name: node.name,
    mimeType: node.mimeType || 'image/jpeg',
    size: node.size,
    width: node.width,
    height: node.height,
    duration: node.duration,
    createdAt: node.createdAt,
    path: node.path,
  };
}

function readIntentImagePath(activityId: string): string | null {
  const os = window.__OS__;
  const payload = os?.getIntentPayload?.(activityId);
  if (!payload || payload.action !== 'ACTION_VIEW') return null;
  if (payload.type && !payload.type.startsWith('image/')) return null;
  const data = payload.data || {};
  const stream = data.stream ?? data.path ?? data.uri;
  if (Array.isArray(stream)) {
    return typeof stream[0] === 'string' && stream[0].length > 0 ? stream[0] : null;
  }
  return typeof stream === 'string' && stream.length > 0 ? stream : null;
}

function listSiblingImages(targetPath: string): MediaItem[] {
  const lastSlash = targetPath.lastIndexOf('/');
  if (lastSlash <= 0) return [];
  const dir = targetPath.slice(0, lastSlash);
  const siblings = FileSystem.listDirectory(dir).filter(
    (n) => n.type === 'file' && (n.mimeType?.startsWith('image/') || n.mimeType?.startsWith('video/')),
  );
  // If the target itself isn't picked up (e.g. transient or unsupported mimeType), include it explicitly.
  if (!siblings.some((n) => n.path === targetPath)) {
    const target = FileSystem.getNode(targetPath);
    if (target && target.type === 'file') siblings.push(target);
  }
  return siblings
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .map(fsNodeToMediaItem);
}

// ============================================================================
// Share helper — fires implicit ACTION_SEND image/*
// ============================================================================
function shareImagesAsIntent(paths: string[]): void {
  if (paths.length === 0) return;
  const os = window.__OS__;
  if (!os?.startActivityForResult) return;
  os.startActivityForResult(
    {
      action: 'ACTION_SEND',
      type: 'image/*',
      data: {
        stream: paths.length === 1 ? paths[0] : paths,
        mimeType: 'image/jpeg',
      },
    },
    () => {
      // resultCode handled by caller — no-op; if user wants a toast on OK, hook it here.
    },
  );
}

// ============================================================================
// More Menu Popup (anchored above the bottom action bar, like MIUI)
// ============================================================================
type MoreMenuItem = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  hasMore?: boolean;
};

const MorePopup: React.FC<{
  open: boolean;
  onClose: () => void;
  sections: MoreMenuItem[][];
}> = ({ open, onClose, sections }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end pb-[calc(var(--app-bottom-action-bar-height,80px)+8px)] pr-3 pointer-events-none">
      <div
        className="fixed inset-0 bg-black/30 pointer-events-auto"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-[13px] w-[182px] overflow-hidden shadow-[0_6px_22px_rgba(0,0,0,0.18)] animate-in fade-in slide-in-from-bottom-4 duration-200 pointer-events-auto">
        {sections.map((section, sectionIdx) => (
          <React.Fragment key={sectionIdx}>
            {sectionIdx > 0 && <div className="mx-3 h-[0.5px] bg-slate-200" />}
            <div className="py-1">
              {section.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={opt.onClick}
                  className="w-full px-3 py-1 flex items-center gap-2.5 active:bg-slate-100 transition-colors"
                >
                  <div className="w-7 h-7 flex items-center justify-center text-slate-700 shrink-0">
                    {opt.icon}
                  </div>
                  <div className="flex-1 text-left text-[15px] text-slate-900">{opt.label}</div>
                  {opt.hasMore && <IcNavForward size={18} className="text-slate-400" />}
                </button>
              ))}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Photo Details Dialog (拍摄时间 / 文件信息 / 文件路径)
// ============================================================================
const PhotoDetailsDialog: React.FC<{
  open: boolean;
  item: MediaItem | null;
}> = ({ open, item }) => {
  const s = useAppStrings(strings, stringsEn);
  const { bindBack } = useGalleryGestures();
  if (!open || !item) return null;

  const d = TimeService.fromTimestamp(item.createdAt);
  const dateStr = `${d.getFullYear()}${s.gallery_year_suffix}${d.getMonth() + 1}${s.gallery_month_suffix}${d.getDate()}${s.gallery_day_suffix}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const weekdayLabels = [s.details_weekday_sun, s.details_weekday_mon, s.details_weekday_tue, s.details_weekday_wed, s.details_weekday_thu, s.details_weekday_fri, s.details_weekday_sat];
  const weekday = `${s.details_weekday_prefix}${weekdayLabels[d.getDay()]}`.trim();

  const sizeStr = (() => {
    const mb = item.size / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)}MB`;
    const kb = item.size / 1024;
    return `${kb.toFixed(0)}KB`;
  })();
  const dimsStr = item.width && item.height ? `${item.width}x${item.height}px` : '';

  const visualPath = (() => {
    const raw = item.path;
    const stripped = raw.replace(/^\/sdcard\/?/, '').replace(/^\/storage\/emulated\/0\/?/, '');
    return `${s.details_internal_storage}/${stripped}`;
  })();

  return (
    <div className="absolute inset-0 z-[60] bg-app-surface flex flex-col" data-status-bar-foreground="dark">
      {/* Header */}
      <div className="pt-10 px-2 pb-2 relative flex items-center bg-app-surface">
        <button
          type="button"
          {...bindBack()}
          className="relative z-10 w-10 h-10 flex items-center justify-center active:opacity-60"
          aria-label={s.viewer_back}
        >
          <IcNavBack size={28} className="text-slate-900" />
        </button>
        <div className="absolute inset-x-0 text-center text-[18px] font-semibold text-slate-900 pointer-events-none">
          {s.details_title}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
        <div className="space-y-7 text-[15px]">
          <div className="flex items-start gap-3">
            <span className="text-slate-400 shrink-0 w-[80px] leading-relaxed">{s.details_capture_time}</span>
            <div className="text-blue-500 leading-relaxed">
              <div>{dateStr}</div>
              <div className="mt-1">{weekday}{weekday && <span>&nbsp;&nbsp;&nbsp;&nbsp;</span>}{timeStr}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-slate-400 shrink-0 w-[80px] leading-relaxed">{s.details_file_info}</span>
            <div className="text-blue-500 leading-relaxed flex-1 min-w-0">
              <div className="break-all">{item.name}</div>
              <div className="mt-1 text-slate-400">
                {sizeStr}{dimsStr ? <>&nbsp;&nbsp;&nbsp;&nbsp;{dimsStr}</> : null}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-slate-400 shrink-0 w-[80px] leading-relaxed">{s.details_file_path}</span>
            <div className="text-blue-500 leading-relaxed flex-1 min-w-0 break-all">
              {visualPath}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Rename Dialog
// ============================================================================
const RenameDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  defaultValue: string;
  onConfirm: (value: string) => void;
}> = ({ open, onClose, defaultValue, onConfirm }) => {
  const s = useAppStrings(strings, stringsEn);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  if (!open) return null;

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-app-surface rounded-2xl w-full max-w-[320px] overflow-hidden shadow-2xl animate-scale-in">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-[17px] font-semibold text-slate-900 text-center mb-4">{s.rename_title}</h3>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={s.rename_placeholder}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-[15px] text-slate-900 focus:outline-none focus:border-blue-500"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
          />
        </div>
        <div className="flex border-t border-slate-200">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 text-[16px] font-medium text-blue-500 active:bg-slate-50 border-r border-slate-200"
          >
            {s.dialog_cancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="flex-1 py-3.5 text-[16px] font-semibold text-blue-500 active:bg-slate-50 disabled:opacity-50"
          >
            {s.dialog_confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Photo Viewer Page
// ============================================================================
const PhotoViewerPage: React.FC = () => {
  const { go, back, bindBack, navigateTo } = useGalleryGestures();
  const location = useLocation();
  const { path } = useParams<{ path: string }>();
  const { activityId } = useActivityContext();
  const s = useAppStrings(strings, stringsEn);
  const favorites = useFavorites();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [allItems, setAllItems] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [toast, setToast] = useState({ message: '', visible: false });
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Intent-launched mode: route is /intent/view, no :path param; read from intent payload.
  const isIntentMode = location.pathname.startsWith('/intent/');
  const intentPath = useMemo(
    () => (isIntentMode ? readIntentImagePath(activityId) : null),
    [isIntentMode, activityId],
  );
  const decodedPath = isIntentMode
    ? intentPath || ''
    : (path ? decodeURIComponent(path) : '');

  // Parse query params
  const searchParams = new URLSearchParams(location.search);
  const albumId = searchParams.get('album');
  const from = searchParams.get('from');
  const modal = searchParams.get('modal') as 'more' | 'details' | 'rename' | null;

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2000);
  };

  // useParams returns the URL-decoded :path segment; transitions expect the
  // encoded form (matching photo.open's `encodeURIComponent(item.path)` convention).
  const encodedPath = decodedPath ? encodeURIComponent(decodedPath) : '';
  const openMore = () => {
    if (isIntentMode) {
      go('photo.intent.modal.more.open');
      return;
    }
    if (!encodedPath) return;
    go('photo.modal.more.open', { path: encodedPath });
  };
  const openDetails = () => {
    if (isIntentMode) {
      go('photo.intent.modal.details.open');
      return;
    }
    if (!encodedPath) return;
    go('photo.modal.details.open', { path: encodedPath });
  };
  const openRename = () => {
    if (isIntentMode) {
      go('photo.intent.modal.rename.open');
      return;
    }
    if (!encodedPath) return;
    go('photo.modal.rename.open', { path: encodedPath });
  };
  const closeModal = () => back();

  const doRename = async (newName: string) => {
    if (!item) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed.includes('/') || trimmed === '.' || trimmed === '..') {
      showToast(s.rename_invalid_name);
      return;
    }
    if (trimmed === item.name) {
      closeModal();
      return;
    }
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
    const newPath = `${parentPath}/${trimmed}`;
    const result = await FileSystem.moveNode(item.path, newPath);
    if (!result) {
      showToast(s.rename_failed);
      return;
    }
    showToast(s.rename_success);
    if (isIntentMode) {
      // In ACTION_VIEW mode there's no :path segment to update, and the intent
      // payload is fixed. Just close the rename modal — the loaded image stays
      // visible (item state is in memory); user can back out to FileManager.
      back();
      return;
    }
    // Replace the rename modal entry with the renamed photo URL in two steps:
    // 1) back() pops the rename modal (history entry: modal=rename → original /photo/{old})
    // 2) navigateTo replaces the now-stale /photo/{old} entry with /photo/{new}
    back();
    setTimeout(() => {
      const query = new URLSearchParams();
      if (albumId) query.set('album', albumId);
      if (from) query.set('from', from);
      const queryStr = query.toString();
      const target = `/photo/${encodeURIComponent(newPath)}${queryStr ? `?${queryStr}` : ''}`;
      navigateTo(target, { replace: true });
    }, 0);
  };

  useEffect(() => {
    // Load all items for navigation
    let items: MediaItem[];
    if (isIntentMode) {
      // External ACTION_VIEW: scope swipe to images in the same directory (matches real Android).
      items = decodedPath ? listSiblingImages(decodedPath) : [];
    } else if (from === 'favorites') {
      const allMedia = MediaService.getMediaItems({ type: 'all' });
      items = allMedia.filter(i => favorites.has(i.path));
    } else if (albumId) {
      items = MediaService.getMediaItems({ albumId });
    } else {
      items = MediaService.getMediaItems({ type: 'all' });
    }
    if (!isIntentMode) items.sort((a, b) => b.createdAt - a.createdAt);
    setAllItems(items);

    const index = items.findIndex(i => i.path === decodedPath);
    setCurrentIndex(index >= 0 ? index : 0);
  }, [decodedPath, albumId, favorites, from, isIntentMode]);
  
  useEffect(() => {
    if (allItems.length > 0 && currentIndex >= 0 && currentIndex < allItems.length) {
      const currentItem = allItems[currentIndex];
      setItem(currentItem);
      setIsFav(favorites.has(currentItem.path));
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [allItems, currentIndex, favorites]);
  
  const handleToggleFavorite = () => {
    if (item) {
      const newState = setFavorite(item.path, !favorites.has(item.path));
      setIsFav(newState);
    }
  };
  
  const handleDelete = () => {
    if (item) {
      setShowDeleteConfirm(true);
    }
  };
  
  const confirmDelete = async () => {
    if (item) {
      await MediaService.deleteMedia(item.path);
      setShowDeleteConfirm(false);
      if (allItems.length <= 1) {
        back();
      } else {
        const newItems = allItems.filter(i => i.path !== item.path);
        setAllItems(newItems);
        setCurrentIndex(Math.min(currentIndex, newItems.length - 1));
      }
    }
  };
  
  const goToPhoto = (index: number) => {
    if (index >= 0 && index < allItems.length) {
      setCurrentIndex(index);
    }
  };
  
  const handleDoubleTap = (e: React.MouseEvent) => {
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scale > 1) return; // when zoomed, drag is reserved for pan (not handled here yet)
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goToPhoto(currentIndex + 1);
    else goToPhoto(currentIndex - 1);
  };

  const handlePointerCancel = () => {
    swipeStartRef.current = null;
  };
  
  if (!item) {
    return (
      <div className="h-full bg-app-surface flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
      </div>
    );
  }
  
  const d = TimeService.fromTimestamp(item.createdAt);
  const dateTitle = `${d.getFullYear()}${s.gallery_year_suffix}${d.getMonth() + 1}${s.gallery_month_suffix}${d.getDate()}${s.gallery_day_suffix}`;
  const timeTitle = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="h-full bg-app-surface flex flex-col relative">
      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 pt-10 px-4 pb-3 flex items-start justify-between z-20 bg-white/92 backdrop-blur-xl transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          {...bindBack()}
          className="w-10 h-10 flex items-center justify-start -ml-2 active:opacity-60"
          aria-label={s.viewer_back}
        >
          <IcNavBack size={30} className="text-slate-900" />
        </button>

        <div className="flex-1 pl-1">
          <div className="text-[22px] font-semibold text-slate-900 leading-tight">{dateTitle}</div>
          <div className="text-[14px] text-slate-500 mt-0.5">{timeTitle}</div>
        </div>

        <button
          type="button"
          className="w-10 h-10 flex items-center justify-end -mr-2 active:opacity-60"
          aria-label={s.viewer_rotate}
        >
          <IcRefresh size={22} className="text-slate-900" />
        </button>
      </div>

      {/* Image */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden touch-none select-none"
        onClick={() => setShowControls(!showControls)}
        onDoubleClick={handleDoubleTap}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          style={{ transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`, transition: 'transform var(--app-duration-short) var(--app-easing-standard)' }}
        >
          <AsyncImage
            path={item.path}
            fallbackUri={item.uri}
            className="max-w-full max-h-full object-contain"
            alt={item.name}
          />
        </div>
      </div>

      {/* Bottom actions */}
      <div
        className={`absolute bottom-0 left-0 right-0 pb-6 pt-3 px-6 bg-white/92 backdrop-blur-xl border-t border-slate-200/60 z-20 transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-end justify-between">
          <button
            type="button"
            onClick={() => { if (item) shareImagesAsIntent([item.path]); }}
            className="flex flex-col items-center gap-1 text-slate-800 active:opacity-60"
            data-action="gallery.viewer.share"
            data-action-type="open"
          >
            <IcShare size={22} />
            <span className="text-[11px] font-medium">{s.viewer_send}</span>
          </button>
          <button type="button" className="flex flex-col items-center gap-1 text-slate-800 active:opacity-60">
            <IcEdit size={22} />
            <span className="text-[11px] font-medium">{s.viewer_edit}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`flex flex-col items-center gap-1 active:opacity-60 ${
              isFav ? 'text-rose-500' : 'text-slate-800'
            }`}
          >
            <IcHeart size={22} className={isFav ? 'fill-rose-500' : ''} />
            <span className="text-[11px] font-medium">{s.viewer_favorite}</span>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex flex-col items-center gap-1 text-slate-800 active:text-red-500"
          >
            <IcDelete size={22} />
            <span className="text-[11px] font-medium">{s.viewer_delete}</span>
          </button>
          <button
            type="button"
            onClick={openMore}
            className="flex flex-col items-center gap-1 text-slate-800 active:opacity-60"
            aria-label={s.viewer_more}
          >
            <IcMoreHoriz size={22} />
            <span className="text-[11px] font-medium">{s.viewer_more}</span>
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title={s.delete_photo_title}
        message={s.delete_photo_confirm_single}
        confirmText={s.action_delete}
        cancelText={s.dialog_cancel}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* More menu popup */}
      <MorePopup
        open={modal === 'more'}
        onClose={closeModal}
        sections={[
          [
            { icon: <IcAddTo size={22} strokeWidth={1.6} />, label: s.more_menu_add_to, onClick: closeModal },
            { icon: <IcWallpaper size={22} strokeWidth={1.6} />, label: s.more_menu_set_wallpaper, onClick: closeModal },
            { icon: <IcInfo size={22} strokeWidth={1.6} />, label: s.more_menu_details, onClick: openDetails },
          ],
          [
            { icon: <IcGeneratePdf size={22} strokeWidth={1.6} />, label: s.more_menu_generate_pdf, onClick: closeModal },
            { icon: <IcExtract size={22} strokeWidth={1.6} />, label: s.more_menu_extract, hasMore: true, onClick: closeModal },
          ],
          [
            { icon: <IcDocEdit size={22} strokeWidth={1.6} />, label: s.more_menu_doc_edit, onClick: closeModal },
            { icon: <IcWatermark size={22} strokeWidth={1.6} />, label: s.more_menu_watermark, onClick: closeModal },
          ],
          [
            { icon: <IcClipboard size={22} strokeWidth={1.6} />, label: s.more_menu_clipboard, onClick: closeModal },
            { icon: <IcRename size={22} strokeWidth={1.6} />, label: s.more_menu_rename, onClick: openRename },
          ],
        ]}
      />

      {/* Photo details fullscreen */}
      <PhotoDetailsDialog
        open={modal === 'details'}
        item={item}
      />

      {/* Rename dialog */}
      <RenameDialog
        open={modal === 'rename'}
        onClose={closeModal}
        defaultValue={item.name}
        onConfirm={doRename}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

// ============================================================================
// Main Home Page (with tabs)
// ============================================================================
const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HomeTab>('photos');
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  const renderContent = () => {
    switch (activeTab) {
      case 'photos':
        return <PhotosPage onSelectModeChange={setIsSelectMode} />;
      case 'albums':
        return <AlbumsPage />;
      default:
        return <PhotosPage onSelectModeChange={setIsSelectMode} />;
    }
  };
  
  return (
    <div className="h-full relative">
      {renderContent()}
      {!isSelectMode && <FloatingTabPill activeTab={activeTab} onTabChange={setActiveTab} />}
    </div>
  );
};

// ============================================================================
// Main App
// ============================================================================

export const GalleryApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };
  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
    <MemoryRouter>
      <GalleryNavigationHandler />
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/album/:albumId" element={<AlbumDetailPage />} />
        <Route path="/intent/view" element={<PhotoViewerPage />} />
        <Route path="/photo/:path" element={<PhotoViewerPage />} />
      </Routes>
    </MemoryRouter>
    </div>
  );
};

export default GalleryApp;
