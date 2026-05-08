import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { WECHAT_READING_CONFIG } from '../data';
import { useWechatReadingStore } from '../state';
import { useWechatReadingGestures } from '../hooks/useWechatReadingGestures';
import { useWechatReadingStrings } from '../hooks/useWechatReadingStrings';
import {
    LocalizedContentView,
    LocalizedDoorLeafView,
    LocalizedReaderMenu,
    LocalizedReaderShelfModal,
    LocalizedTocPanel,
} from '../components/LocalizedReaderUI';
import { AppNavigatorRegistry } from '../../../os/AppNavigatorRegistry';
import { loadBook } from '../utils/bookLoader';
import type { ParsedBook } from '../data/types';
import { useReaderTheme } from '../hooks/useReaderTheme';
import {
    LINE_HEIGHT_VALUES,
    MARGIN_PX_VALUES,
    normalizeLineHeightIndex,
    normalizeMarginIndex,
} from '../constants';
import {
    externalToInternalCharOffset,
    findPageForCharOffset,
    getBookTotalChars,
    getChapterStartOffset,
    internalToExternalCharOffset,
    paginateBook,
    type ReaderLayoutKey,
} from '../utils/readerPagination';

function normalizeReaderParagraph(text: string): string {
    return text.replace(/^[\s\u3000]+/, '');
}

export const ReaderPage: React.FC = () => {
    const { bookId } = useParams();
    const location = useLocation();
    const addToBookshelf = useWechatReadingStore(s => s.addToBookshelf);
    const removeFromShelf = useWechatReadingStore(s => s.removeFromShelf);
    const shelf = useWechatReadingStore(s => s.shelf);
    const currentProgress = useWechatReadingStore(s => (bookId ? s.bookProgress[bookId] : undefined));
    const updateProgress = useWechatReadingStore(s => s.updateProgress);
    const readerPrefs = useWechatReadingStore(s => s.readerPrefs);
    const firstLineIndent = useWechatReadingStore(s => s.settings.firstLineIndent);
    const { bindBack, bindTap, go, back } = useWechatReadingGestures();
    const s = useWechatReadingStrings();
    const readerTheme = useReaderTheme();

    const [book, setBook] = useState<any>(null);
    const [parsedBook, setParsedBook] = useState<ParsedBook | null>(null);
    const [loading, setLoading] = useState(false);

    const [showDoorLeaf, setShowDoorLeaf] = useState(true);
    const [legacyPage, setLegacyPage] = useState(0);
    const [menuVisible, setMenuVisible] = useState(false);
    const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });
    const [readerFrameElement, setReaderFrameElement] = useState<HTMLDivElement | null>(null);

    const searchParams = new URLSearchParams(location.search);
    const showShelfModal = searchParams.get('modal') === 'shelf';
    const activeTool = searchParams.get('tool');
    const isTocOpen = activeTool === 'toc';

    const isInShelf = shelf.some(item => item.bookId === bookId);
    const toggleShelfBinding = isInShelf
        ? bindTap<HTMLButtonElement>('reader.modal.shelf.open', { params: { bookId: bookId! } })
        : bindTap<HTMLButtonElement>(
            { kind: 'action', id: 'reader.item.shelf.add.submit' },
            { params: { bookId: bookId! }, onTrigger: () => addToBookshelf(bookId!) },
        );

    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const isSwiping = useRef(false);
    const gesturePointerId = useRef<number | null>(null);

    const totalWords = typeof book?.totalWords === 'number' ? book.totalWords : 0;
    const marginPx = MARGIN_PX_VALUES[normalizeMarginIndex(readerPrefs.margin)];
    const lineHeightMultiplier = LINE_HEIGHT_VALUES[normalizeLineHeightIndex(readerPrefs.lineHeight)];
    const currentExternalOffset = Math.max(0, Math.min(totalWords, Number(currentProgress?.charOffset ?? 0)));
    const totalInternalChars = parsedBook ? getBookTotalChars(parsedBook) : 0;
    const layoutKey: ReaderLayoutKey | null = (() => {
        if (!parsedBook) return null;
        const width = Math.round(layoutSize.width);
        const height = Math.round(layoutSize.height);
        if (width <= 0 || height <= 0) return null;
        return {
            width,
            height,
            fontSize: readerPrefs.fontSize,
            lineHeightMultiplier,
            marginPx,
            firstLineIndent,
        };
    })();

    const currentInternalOffset = parsedBook
        ? externalToInternalCharOffset(currentExternalOffset, totalWords, totalInternalChars)
        : 0;

    const paginationResult = parsedBook && layoutKey && bookId
        ? paginateBook(bookId, parsedBook, layoutKey)
        : null;

    const currentPage = paginationResult
        ? findPageForCharOffset(paginationResult, currentInternalOffset)
        : null;

    const currentChapterIndex = currentPage?.chapterIndex ?? 0;
    const isRealBook = !!parsedBook && !!currentPage;

    useEffect(() => {
        const found = WECHAT_READING_CONFIG.store.find(b => b.id === bookId) ?? null;
        setBook(found);
        setParsedBook(null);
        setShowDoorLeaf(true);
        setLegacyPage(0);
        setLoading(false);

        if (found?.contentSource) {
            setLoading(true);
            loadBook(found.contentSource).then(parsed => {
                setParsedBook(parsed);
                setLoading(false);
            });
        }
    }, [bookId]);

    useEffect(() => {
        if (!readerFrameElement) return;

        const updateSize = () => {
            const ref = document.createElement('div');
            ref.style.cssText = 'position:absolute;width:200px;height:200px;visibility:hidden;pointer-events:none';
            readerFrameElement.appendChild(ref);
            const refRect = ref.getBoundingClientRect();
            readerFrameElement.removeChild(ref);
            const zx = refRect.width / 200;
            const zy = refRect.height / 200;

            const rect = readerFrameElement.getBoundingClientRect();
            const w = Math.round(zx > 0 ? rect.width / zx : rect.width);
            const h = Math.round(zy > 0 ? rect.height / zy : rect.height);
            setLayoutSize(prev => {
                if (prev.width === w && prev.height === h) return prev;
                return { width: w, height: h };
            });
        };

        updateSize();
        const observer = new ResizeObserver(() => updateSize());
        observer.observe(readerFrameElement);
        return () => observer.disconnect();
    }, [readerFrameElement]);

    useEffect(() => {
        if (!parsedBook) return;
        if (currentExternalOffset > 0) {
            setShowDoorLeaf(false);
        }
    }, [parsedBook, currentExternalOffset]);

    const jumpToExternalOffset = useCallback((nextOffset: number) => {
        if (!bookId) return;
        updateProgress(bookId, Math.max(0, Math.min(totalWords, nextOffset)));
    }, [bookId, totalWords, updateProgress]);

    const goNextPage = useCallback(() => {
        if (isRealBook && paginationResult && currentPage) {
            if (showDoorLeaf) {
                setShowDoorLeaf(false);
                return;
            }
            const nextIdx = currentPage.globalPageIndex + 1;
            if (nextIdx < paginationResult.totalPages) {
                const np = paginationResult.pages[nextIdx];
                const mid = Math.floor((np.startCharOffset + np.endCharOffset) / 2);
                jumpToExternalOffset(
                    internalToExternalCharOffset(mid, totalWords, totalInternalChars),
                );
            }
        } else {
            if (showDoorLeaf) {
                setShowDoorLeaf(false);
                setLegacyPage(1);
            } else {
                setLegacyPage(p => p + 1);
            }
        }
    }, [isRealBook, paginationResult, showDoorLeaf, currentPage, jumpToExternalOffset, totalWords, totalInternalChars]);

    const goPrevPage = useCallback(() => {
        if (isRealBook && paginationResult && currentPage) {
            if (showDoorLeaf) return;
            const prevIdx = currentPage.globalPageIndex - 1;
            if (prevIdx >= 0) {
                const pp = paginationResult.pages[prevIdx];
                const mid = Math.floor((pp.startCharOffset + pp.endCharOffset) / 2);
                jumpToExternalOffset(
                    internalToExternalCharOffset(mid, totalWords, totalInternalChars),
                );
            } else {
                setShowDoorLeaf(true);
                jumpToExternalOffset(0);
            }
        } else {
            if (showDoorLeaf) return;
            if (legacyPage <= 1) {
                setShowDoorLeaf(true);
            } else {
                setLegacyPage(p => p - 1);
            }
        }
    }, [isRealBook, paginationResult, showDoorLeaf, currentPage, jumpToExternalOffset, legacyPage, totalWords, totalInternalChars]);

    const jumpToChapter = useCallback((idx: number) => {
        if (parsedBook && bookId) {
            const targetOffset = getChapterStartOffset(parsedBook, idx);
            if (typeof targetOffset === 'number') {
                const nextOffset = internalToExternalCharOffset(targetOffset, totalWords, totalInternalChars);
                jumpToExternalOffset(nextOffset);
                setShowDoorLeaf(false);
            }
        }
        go('reader.tool.close', { bookId: bookId! });
        setMenuVisible(false);
    }, [parsedBook, bookId, totalWords, totalInternalChars, jumpToExternalOffset, go]);

    useEffect(() => {
        const handleBack = () => {
            const sp = new URLSearchParams(location.search);
            const isModalOpen = sp.get('modal') === 'shelf';
            const isToolOpen = sp.get('tool');

            if (isModalOpen) {
                back();
                return true;
            }

            if (isToolOpen) {
                go('reader.tool.close', { bookId: bookId! });
                setMenuVisible(false);
                return true;
            }

            if (menuVisible) {
                setMenuVisible(false);
                return true;
            }

            back();
            return true;
        };

        AppNavigatorRegistry.setBackOverride('wechat_reading', handleBack);
        return () => {
            AppNavigatorRegistry.setBackOverride('wechat_reading');
        };
    }, [menuVisible, back, go, bookId, location.search]);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        gesturePointerId.current = e.pointerId;
        touchStartX.current = e.clientX;
        touchStartY.current = e.clientY;
        isSwiping.current = false;
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
            // Ignore platforms that do not expose pointer capture here.
        }
    };

    const clearGesturePointer = (e: React.PointerEvent<HTMLDivElement>) => {
        if (gesturePointerId.current !== e.pointerId) return;
        gesturePointerId.current = null;
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // Ignore browsers that reject release after cancellation.
        }
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (gesturePointerId.current !== e.pointerId) return;
        if (touchStartX.current === null || touchStartY.current === null) return;

        const touchEndX = e.clientX;
        const touchEndY = e.clientY;
        const diffX = touchEndX - touchStartX.current;
        const diffY = touchEndY - touchStartY.current;
        const minSwipeDistance = 50;

        if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > minSwipeDistance) {
            if (diffY < 0) {
                if (!menuVisible && !activeTool) {
                    setMenuVisible(true);
                }
            } else if (diffY > 0 && menuVisible) {
                setMenuVisible(false);
            }
            isSwiping.current = true;
        } else if (Math.abs(diffX) > minSwipeDistance) {
            isSwiping.current = true;
            if (diffX > 0) {
                goPrevPage();
            } else {
                goNextPage();
            }
        }

        touchStartX.current = null;
        touchStartY.current = null;
        clearGesturePointer(e);
    };

    const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
        touchStartX.current = null;
        touchStartY.current = null;
        clearGesturePointer(e);
    };

    if (!book) {
        return <div className="h-full w-full" style={{ backgroundColor: readerTheme.pageBg }} />;
    }

    if (loading) {
        return (
            <div
                className="flex h-full w-full items-center justify-center"
                style={{ backgroundColor: readerTheme.pageBg, color: readerTheme.textMuted }}
            >
                <div className="text-sm animate-pulse">加载中...</div>
            </div>
        );
    }

    const currentChapter = parsedBook?.chapters[currentChapterIndex];
    const currentBlocks = currentPage?.blocks ?? [];
    const isChapterStart = currentPage?.isChapterStart ?? false;

    const pageInfo = (() => {
        if (!isRealBook || !currentPage || !paginationResult) return '';
        return `${currentPage.globalPageIndex + 1}/${paginationResult.totalPages}`;
    })();

    return (
        <div
            className="relative h-full w-full overflow-hidden font-sans select-none"
            style={{ backgroundColor: readerTheme.pageBg, color: readerTheme.textPrimary }}
        >
            <div
                className="absolute inset-0 z-10 touch-none"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onLostPointerCapture={() => {
                    gesturePointerId.current = null;
                }}
                onClick={e => {
                    if (isSwiping.current) {
                        isSwiping.current = false;
                        return;
                    }

                    const width = window.innerWidth;
                    const x = e.clientX;

                    if (x > width * 0.35 && x < width * 0.65) {
                        if (activeTool || menuVisible) {
                            setMenuVisible(false);
                            if (activeTool) {
                                go('reader.tool.close', { bookId: bookId! });
                            }
                        } else {
                            setMenuVisible(true);
                        }
                    } else if (x <= width * 0.35) {
                        goPrevPage();
                    } else {
                        goNextPage();
                    }
                }}
            />

            <div
                ref={setReaderFrameElement}
                className="h-full w-full"
                style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }}
            >
                {showDoorLeaf ? (
                    <LocalizedDoorLeafView book={book} />
                ) : parsedBook ? (
                    currentPage ? (
                        <LocalizedContentView
                            blocks={currentBlocks}
                            chapterTitle={currentChapter?.title ?? ''}
                            isChapterStart={isChapterStart}
                            pageInfo={pageInfo}
                        />
                    ) : (
                        <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ color: readerTheme.textMuted }}
                        >
                            <div className="text-sm animate-pulse">排版中...</div>
                        </div>
                    )
                ) : (
                    <LocalizedContentView
                        blocks={(book.content || s.reader_no_content)
                            .split('\n\n')
                            .slice((legacyPage - 1) * 3, (legacyPage - 1) * 3 + 3)
                            .map(normalizeReaderParagraph)
                            .map((text: string, index: number) => ({
                                key: `legacy-${legacyPage}-${index}`,
                                text,
                                indent: false,
                                continuedFromPrevious: false,
                                continuedToNext: false,
                            }))}
                        chapterTitle={s.reader_intro}
                        isChapterStart={legacyPage === 1}
                        pageInfo={`${legacyPage}`}
                    />
                )}
            </div>

            <LocalizedReaderMenu
                visible={menuVisible || !!activeTool}
                onBack={() => back()}
                isInShelf={isInShelf}
                toggleShelfBinding={toggleShelfBinding}
                bindTap={bindTap}
                bookId={bookId!}
                activeTool={activeTool}
                hasToc={!!parsedBook}
            />

            {isTocOpen && parsedBook && (
                <LocalizedTocPanel
                    chapters={parsedBook.chapters}
                    currentChapterIndex={currentChapterIndex}
                    onSelectChapter={jumpToChapter}
                    onClose={() => {
                        go('reader.tool.close', { bookId: bookId! });
                        setMenuVisible(false);
                    }}
                />
            )}

            {showShelfModal && (
                <LocalizedReaderShelfModal
                    bindBack={bindBack}
                    bindTap={bindTap}
                    bookId={bookId!}
                    onRemove={() => {
                        removeFromShelf(bookId!);
                        back();
                    }}
                />
            )}
        </div>
    );
};
