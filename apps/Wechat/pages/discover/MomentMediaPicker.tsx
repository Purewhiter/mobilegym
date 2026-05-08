import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { dimens } from '../../res/dimens';
import { IcExpand, IcCollapse, IcSearch, IcClose, IcCheck, IcNavBack } from '../../res/icons';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import * as MediaService from '../../../../os/MediaService';
import type { Album, MediaItem } from '../../../../os/types';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { WechatSmartImage } from '../../components/WechatSmartImage';

const MAX_SELECT = 9;
const SWIPE_THRESHOLD = 40;

export const MomentMediaPickerPage: React.FC = () => {
  const t = useWechatStrings();
  const location = useLocation();
  const { id: targetWxid } = useParams<{ id?: string }>();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const menu = searchParams.get('menu');
  const albumId = searchParams.get('albumId') || 'all';
  const scope = searchParams.get('scope') || 'all';
  const urlIndex = Number(searchParams.get('index') || '0');
  const isChatMediaPicker = /^\/chat\/[^/]+\/media-picker$/.test(location.pathname);

  const { bindTap, bindBack, go, back } = useWechatGestures();
  const { momentDraft, updateMomentDraft, sendImages } = useWechatStore(useShallow(s => ({
    momentDraft: s.momentDraft,
    updateMomentDraft: s.updateMomentDraft,
    sendImages: s.sendImages,
  })));

  const [albums, setAlbums] = useState<Album[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingAlbumId, setPendingAlbumId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showPreviewChrome, setShowPreviewChrome] = useState(true);
  const swipeStartXRef = useRef<number | null>(null);

  const currentAlbum = useMemo(() => albums.find(a => a.id === albumId) || null, [albums, albumId]);
  const currentAlbumName = currentAlbum?.id === 'all' ? t.moment_media_album_all : currentAlbum?.name || t.moment_media_album_all;

  useEffect(() => {
    setAlbums(MediaService.getAlbums());
  }, []);

  useEffect(() => {
    if (menu === 'albums' || menu === 'preview') return;
    if (searchParams.get('albumId')) return;
    if (isChatMediaPicker && targetWxid) {
      go('chat.mediaPicker.defaultAlbum.replace', { id: targetWxid, albumId: 'all' });
      return;
    }
    go('moments.mediaPicker.defaultAlbum.replace', { albumId: 'all' });
  }, [go, isChatMediaPicker, menu, searchParams, targetWxid]);

  useEffect(() => {
    const loadedItems = MediaService.getMediaItems({ albumId, type: 'image' });
    loadedItems.sort((a, b) => b.createdAt - a.createdAt);
    setItems(loadedItems);
    setSelectedIds([]);
  }, [albumId]);

  useEffect(() => {
    if (!pendingAlbumId) return;
    if (menu === 'albums') return;
    if (isChatMediaPicker && targetWxid) {
      go('chat.mediaPicker.album.switch', { id: targetWxid, albumId: pendingAlbumId });
    } else {
      go('moments.mediaPicker.album.switch', { albumId: pendingAlbumId });
    }
    setPendingAlbumId(null);
  }, [go, isChatMediaPicker, menu, pendingAlbumId, targetWxid]);

  const selectedItems = useMemo(() => {
    const map = new Map(items.map(i => [i.id, i]));
    return selectedIds.map(id => map.get(id)).filter(Boolean) as MediaItem[];
  }, [items, selectedIds]);

  const previewList = useMemo(() => {
    if (menu !== 'preview') return [];
    if (scope === 'selected' && selectedItems.length > 0) return selectedItems;
    return items;
  }, [items, menu, scope, selectedItems]);

  useEffect(() => {
    if (menu !== 'preview') return;
    const safe = Number.isFinite(urlIndex) ? Math.max(0, urlIndex) : 0;
    const max = Math.max(0, previewList.length - 1);
    setPreviewIndex(Math.min(safe, max));
    setShowPreviewChrome(true);
  }, [menu, previewList.length, urlIndex]);

  const toggleSelect = (item: MediaItem) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(item.id);
      if (idx >= 0) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      }
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, item.id];
    });
  };

  const appendImagesToMomentDraft = () => {
    const pickedPaths = selectedItems.map(i => i.path);
    if (pickedPaths.length === 0) return false;
    const merged = [...momentDraft.selectedImages, ...pickedPaths].filter(Boolean);
    const uniq = Array.from(new Set(merged)).slice(0, MAX_SELECT);
    updateMomentDraft({ selectedImages: uniq });
    return true;
  };

  const sendImagesToChat = () => {
    if (!targetWxid || selectedItems.length === 0) return false;
    sendImages(targetWxid, selectedItems.map(item => item.path));
    return true;
  };

  const handlePrimaryAction = () => {
    if (isChatMediaPicker) {
      if (sendImagesToChat()) back();
      return;
    }
    appendImagesToMomentDraft();
  };

  const handlePreviewPrimaryAction = () => {
    if (isChatMediaPicker) {
      if (sendImagesToChat()) back();
      return;
    }
    if (appendImagesToMomentDraft()) {
      go('moments.post.open.fromMediaPicker');
    }
  };

  const openPreview = (index: number, previewScope: 'all' | 'selected') => {
    if (isChatMediaPicker && targetWxid) {
      go('chat.mediaPicker.preview.open', { id: targetWxid, index, scope: previewScope });
      return;
    }
    go('moments.mediaPicker.preview.open', { index, scope: previewScope });
  };

  const toggleSelectByPreviewIndex = () => {
    const item = previewList[previewIndex];
    if (!item) return;
    toggleSelect(item);
  };

  const handleSwipeStart = (x: number) => {
    swipeStartXRef.current = x;
  };

  const handleSwipeEnd = (x: number) => {
    const start = swipeStartXRef.current;
    swipeStartXRef.current = null;
    if (start === null) return;
    const delta = x - start;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) {
      setPreviewIndex(i => Math.min(i + 1, previewList.length - 1));
    } else {
      setPreviewIndex(i => Math.max(i - 1, 0));
    }
  };

  const overlayTop = 'top-[92px]';
  const centerLabel = isChatMediaPicker ? t.chat_original_image : t.moment_media_make_video;
  const primaryLabel = isChatMediaPicker ? t.chat_send : t.moment_media_done;
  const previewCloseProps =
    isChatMediaPicker && targetWxid
      ? bindTap<HTMLButtonElement>('chat.mediaPicker.preview.close', {
          params: { id: targetWxid },
          stopPropagation: true,
        })
      : bindTap<HTMLButtonElement>('moments.mediaPicker.preview.close', { stopPropagation: true });
  const albumMenuOpenProps =
    isChatMediaPicker && targetWxid
      ? bindTap<HTMLButtonElement>('chat.mediaPicker.albumMenu.open', { params: { id: targetWxid } })
      : bindTap<HTMLButtonElement>('moments.mediaPicker.albumMenu.open');

  return (
    <div className="relative w-full h-full bg-black flex flex-col" data-status-bar-foreground="light">
      {menu === 'preview' ? (
        <div className="relative w-full h-full bg-black">
          <div
            className="absolute inset-0 z-0 select-none"
            onClick={() => setShowPreviewChrome(v => !v)}
            onPointerDown={e => handleSwipeStart(e.clientX)}
            onPointerUp={e => handleSwipeEnd(e.clientX)}
            onPointerCancel={e => handleSwipeEnd(e.clientX)}
          >
            {previewList[previewIndex] ? (
              <WechatSmartImage
                src={previewList[previewIndex].path}
                className="w-full h-full object-contain"
                alt=""
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/50">{t.moment_media_no_content}</div>
            )}
          </div>

          {showPreviewChrome && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="pointer-events-auto absolute top-0 left-0 right-0 pt-10 px-4 pb-3 flex items-center justify-between bg-black/60">
                <button
                  {...previewCloseProps}
                  className="w-10 h-10 flex items-center justify-center"
                >
                  <IcNavBack size={dimens.icSizeNav} className="text-white" />
                </button>

                <div className="text-white text-(--app-title-text-size-18) font-medium">
                  {previewList.length === 0 ? '0/0' : `${previewIndex + 1}/${previewList.length}`}
                </div>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    toggleSelectByPreviewIndex();
                  }}
                  className="flex items-center gap-2 h-10 px-2 active:opacity-80"
                >
                  <span className="text-white text-(--app-chat-bubble-text-size)">{t.moment_media_select}</span>
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                      (() => {
                        const item = previewList[previewIndex];
                        const selected = item ? selectedIds.includes(item.id) : false;
                        return selected ? 'bg-app-primary border-app-primary' : 'border-white/70 bg-black/20';
                      })()
                    }`}
                  >
                    {(() => {
                      const item = previewList[previewIndex];
                      const selected = item ? selectedIds.includes(item.id) : false;
                      return selected ? <IcCheck size={dimens.icSizeChevronSm} className="text-white" /> : null;
                    })()}
                  </div>
                </button>
              </div>

              <div className="pointer-events-auto absolute left-0 right-0 bottom-0">
                {selectedItems.length > 0 && (
                  <div className="h-(--app-card-height-78) bg-black/40 px-2 flex items-center overflow-x-auto no-scrollbar gap-2">
                    {selectedItems.map(si => {
                      const idxInPreview = previewList.findIndex(x => x.id === si.id);
                      const isActive = previewList[previewIndex]?.id === si.id;
                      return (
                        <button
                          key={si.id}
                          onClick={e => {
                            e.stopPropagation();
                            if (idxInPreview >= 0) setPreviewIndex(idxInPreview);
                          }}
                          className={`relative w-(--app-card-width-60) h-(--app-item-height-60) rounded-[4px] overflow-hidden flex-shrink-0 ${
                            isActive ? 'ring-2 ring-app-primary' : ''
                          }`}
                        >
                          <WechatSmartImage src={si.path} className="w-full h-full object-cover" alt="" />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="h-(--app-settings-item-height) bg-black/60 flex items-center px-4 border-t border-white/10 relative">
                  <button
                    onClick={e => e.stopPropagation()}
                    className="text-(--app-chat-bubble-text-size) text-white/70"
                    disabled
                  >
                    {t.moment_media_edit}
                  </button>

                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 pointer-events-none">
                    <div className="w-4 h-4 rounded-full border border-white/40" />
                    <span className="text-white/60 text-(--app-chat-bubble-text-size)">{centerLabel}</span>
                  </div>

                  {isChatMediaPicker && targetWxid ? (
                    <button
                      {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'chat.mediaPicker.preview.send' }, {
                        params: { id: targetWxid },
                        onTrigger: handlePreviewPrimaryAction,
                        stopPropagation: true,
                      })}
                      disabled={selectedIds.length === 0}
                      className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                        selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                      }`}
                    >
                      {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
                    </button>
                  ) : (
                    <button
                      {...bindTap<HTMLButtonElement>('moments.post.open.fromMediaPicker', {
                        onTrigger: handlePreviewPrimaryAction,
                        stopPropagation: true,
                      })}
                      disabled={selectedIds.length === 0}
                      className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                        selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                      }`}
                    >
                      {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="pt-10 px-4 pb-3 flex items-center justify-between bg-black/95">
            <button
              {...bindBack<HTMLButtonElement>()}
              className="w-10 h-10 flex items-center justify-center"
            >
              <IcClose size={dimens.icSizeClose} className="text-white" />
            </button>

            {menu === 'albums' ? (
              <button
                {...bindBack<HTMLButtonElement>()}
                className="flex items-center gap-1 text-white text-(--app-settings-item-text-size) font-medium"
              >
                <span className="max-w-[11rem] truncate">{currentAlbumName}</span>
                <IcCollapse size={dimens.icSizeCheck} className="text-white/70" />
              </button>
            ) : (
              <button
                {...albumMenuOpenProps}
                className="flex items-center gap-1 text-white text-(--app-settings-item-text-size) font-medium"
              >
                <span className="max-w-[11rem] truncate">{currentAlbumName}</span>
                <IcExpand size={dimens.icSizeChevronLg} className="text-white/70" />
              </button>
            )}

            <button className="w-10 h-10 flex items-center justify-center active:opacity-80">
              <IcSearch size={dimens.icSizeToolbar} className="text-white" />
            </button>
          </div>

          {menu === 'albums' && (
            <div className="absolute inset-0 z-[300]">
              <div
                {...bindBack<HTMLDivElement>({ stopPropagation: true })}
                className={`absolute inset-0 ${overlayTop} bg-black/40`}
              />
              <div className={`absolute left-0 right-0 ${overlayTop} bg-(--app-c-common-text-primary)`}>
                {albums.map(album => {
                  const title = album.id === 'all' ? t.moment_media_album_all : album.name;
                  const isCurrent = album.id === albumId;
                  const albumSwitchProps =
                    isChatMediaPicker && targetWxid
                      ? bindTap<HTMLButtonElement>('chat.mediaPicker.album.switch', {
                          params: { id: targetWxid, albumId: album.id },
                          onTrigger: () => {
                            setPendingAlbumId(album.id);
                            back();
                          },
                        })
                      : bindTap<HTMLButtonElement>('moments.mediaPicker.album.switch', {
                          params: { albumId: album.id },
                          onTrigger: () => {
                            setPendingAlbumId(album.id);
                            back();
                          },
                        });

                  return (
                    <button
                      key={album.id}
                      {...albumSwitchProps}
                      className="w-full flex items-center px-5 py-4 active:bg-white/5"
                    >
                      <div className="flex-1 text-left">
                        <div className="text-white text-(--app-title-text-size-18) leading-none break-words [overflow-wrap:anywhere]">
                          {title}{' '}
                          <span className="text-white/40 text-(--app-chat-bubble-text-size)">({album.count})</span>
                        </div>
                      </div>
                      {isCurrent && <IcCheck size={dimens.icSizeToolbar} className="text-app-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-(--app-discover-moment-media-picker-gap-2) p-(--app-discover-moment-media-picker-padding-2)">
              {items.map((item, idx) => {
                const order = selectedIds.indexOf(item.id);
                const isSelected = order >= 0;
                return (
                  <div
                    key={item.id}
                    className="relative aspect-square bg-(--app-c-overlay-dark-bg) overflow-hidden"
                    onClick={() => openPreview(idx, 'all')}
                  >
                    <WechatSmartImage
                      src={item.path}
                      className="w-full h-full object-cover"
                      alt={item.name}
                    />

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        toggleSelect(item);
                      }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full border-2 border-white/70 bg-black/20 flex items-center justify-center"
                    >
                      {isSelected && (
                        <div className="w-full h-full rounded-full bg-app-primary flex items-center justify-center">
                          <span className="text-white text-(--app-chat-time-label-text-size) font-semibold">{order + 1}</span>
                        </div>
                      )}
                    </button>

                    {isSelected && <div className="absolute inset-0 bg-black/20 pointer-events-none" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-(--app-settings-item-height) bg-(--app-c-common-text-primary) flex items-center px-4 border-t border-white/10 relative">
            <button
              disabled={selectedIds.length === 0}
              onClick={() => openPreview(0, 'selected')}
              className={`text-(--app-chat-bubble-text-size) ${
                selectedIds.length > 0 ? 'text-white' : 'text-white/30'
              }`}
            >
          {t.moment_media_preview}{selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 pointer-events-none">
              <div className="w-4 h-4 rounded-full border border-white/40" />
              <span className="text-white/60 text-(--app-chat-bubble-text-size)">{centerLabel}</span>
            </div>

            {isChatMediaPicker && targetWxid ? (
              <button
                {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'chat.mediaPicker.base.send' }, {
                  params: { id: targetWxid },
                  onTrigger: handlePrimaryAction,
                })}
                disabled={selectedIds.length === 0}
                className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                  selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                }`}
              >
                {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
              </button>
            ) : (
              <button
                {...bindTap<HTMLButtonElement>('moments.post.open.fromMediaPicker', {
                  beforeTrigger: () => handlePrimaryAction(),
                })}
                disabled={selectedIds.length === 0}
                className={`ml-auto px-4 py-1.5 rounded-[4px] text-(--app-chat-bubble-text-size) font-medium ${
                  selectedIds.length > 0 ? 'bg-app-primary text-white' : 'bg-app-surface/15 text-white/40'
                }`}
              >
                {selectedIds.length > 0 ? `${primaryLabel}(${selectedIds.length})` : primaryLabel}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
