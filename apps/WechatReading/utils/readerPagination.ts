import type { ParsedBook } from '../data/types';
import { dimens } from '../res/dimens';

export interface ReaderLayoutKey {
  width: number;
  height: number;
  fontSize: number;
  lineHeightMultiplier: number;
  marginPx: number;
  firstLineIndent: boolean;
}

export interface ReaderPageBlock {
  key: string;
  text: string;
  indent: boolean;
  continuedFromPrevious: boolean;
  continuedToNext: boolean;
}

export interface ReaderPaginationPage {
  chapterIndex: number;
  chapterTitle: string;
  pageIndexInChapter: number;
  globalPageIndex: number;
  startCharOffset: number;
  endCharOffset: number;
  isChapterStart: boolean;
  blocks: ReaderPageBlock[];
}

export interface ReaderPaginationResult {
  pages: ReaderPaginationPage[];
  pagesByChapter: ReaderPaginationPage[][];
  totalPages: number;
  totalChars: number;
}

type PreparedParagraph = {
  text: string;
  index: number;
  startCharOffset: number;
  endCharOffset: number;
};

type PreparedChapter = {
  title: string;
  chapterIndex: number;
  paragraphs: PreparedParagraph[];
  startCharOffset: number;
  totalChars: number;
};

type PreparedBook = {
  chapters: PreparedChapter[];
  totalChars: number;
};

const PARAGRAPH_GAP_PX = 16;
const CHAPTER_TITLE_GAP_PX = 24;
const PAGE_LABEL_GAP_PX = 16;
const PAGE_INFO_GAP_PX = 8;
const NATURAL_BREAK_SCAN = 24;
const NATURAL_BREAK_CHARS = new Set([
  '。',
  '！',
  '？',
  '；',
  '：',
  '，',
  '、',
  '.',
  '!',
  '?',
  ';',
  ':',
  ',',
  ')',
  '）',
  ']',
  '】',
  '》',
  '"',
  '\'',
  '”',
  '’',
  ' ',
]);

const paginationCache = new Map<string, ReaderPaginationResult>();
const preparedBookCache = new WeakMap<ParsedBook, PreparedBook>();

type TextMetricsContext = {
  ctx: CanvasRenderingContext2D;
  fontFamily: string;
  charWidthCache: Map<string, number>;
  lineHeightPx: number;
  bodyWidthPx: number;
  firstLineIndentPx: number;
  letterSpacingPx: number;
  baseBodyHeightPx: number;
  chapterTitleHeightPx: number;
  chapterLabelHeightPx: number;
};

function normalizeReaderParagraph(text: string): string {
  return text.replace(/^[\s\u3000]+/, '');
}

function prepareBook(parsedBook: ParsedBook): PreparedBook {
  const cached = preparedBookCache.get(parsedBook);
  if (cached) {
    return cached;
  }

  const chapters: PreparedChapter[] = [];
  let totalChars = 0;

  parsedBook.chapters.forEach((chapter, chapterIndex) => {
    let chapterOffset = 0;
    const paragraphs = chapter.content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map(normalizeReaderParagraph)
      .filter(Boolean)
      .map((text, paragraphIndex) => {
        const startCharOffset = totalChars + chapterOffset;
        const next: PreparedParagraph = {
          text,
          index: paragraphIndex,
          startCharOffset,
          endCharOffset: startCharOffset + text.length,
        };
        chapterOffset += text.length;
        return next;
      });

    const chapterChars = paragraphs.reduce((sum, paragraph) => sum + paragraph.text.length, 0);
    chapters.push({
      title: chapter.title,
      chapterIndex,
      paragraphs,
      startCharOffset: totalChars,
      totalChars: chapterChars,
    });
    totalChars += chapterChars;
  });

  const prepared = { chapters, totalChars };
  preparedBookCache.set(parsedBook, prepared);
  return prepared;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function externalToInternalCharOffset(
  externalCharOffset: number,
  totalWords: number,
  internalTotalChars: number,
): number {
  if (internalTotalChars <= 0) return 0;
  if (totalWords <= 0) {
    return Math.max(0, Math.min(internalTotalChars, Math.round(externalCharOffset)));
  }
  const ratio = clampRatio(externalCharOffset / totalWords);
  return Math.max(0, Math.min(internalTotalChars, Math.round(ratio * internalTotalChars)));
}

export function internalToExternalCharOffset(
  internalCharOffset: number,
  totalWords: number,
  internalTotalChars: number,
): number {
  if (totalWords <= 0) return 0;
  if (internalTotalChars <= 0) {
    return Math.max(0, Math.min(totalWords, Math.round(internalCharOffset)));
  }
  const ratio = clampRatio(internalCharOffset / internalTotalChars);
  return Math.max(0, Math.min(totalWords, Math.round(ratio * totalWords)));
}

function preferNaturalBreak(text: string, length: number): number {
  const capped = Math.max(1, Math.min(text.length, length));
  const floor = Math.max(1, capped - NATURAL_BREAK_SCAN);
  for (let i = capped; i >= floor; i -= 1) {
    if (NATURAL_BREAK_CHARS.has(text[i - 1])) {
      return i;
    }
  }
  return capped;
}

function buildCacheKey(bookId: string, layout: ReaderLayoutKey): string {
  return [
    bookId,
    layout.width,
    layout.height,
    layout.fontSize,
    layout.lineHeightMultiplier,
    layout.marginPx,
    layout.firstLineIndent ? 1 : 0,
  ].join('|');
}

function locateOffset(
  preparedBook: PreparedBook,
  internalCharOffset: number,
): {
  chapter: PreparedChapter;
  paragraphIndex: number;
  offsetInParagraph: number;
  normalizedOffset: number;
} {
  const normalizedOffset = Math.max(0, Math.min(preparedBook.totalChars, internalCharOffset));

  for (let chapterIndex = 0; chapterIndex < preparedBook.chapters.length; chapterIndex += 1) {
    const chapter = preparedBook.chapters[chapterIndex];
    const chapterEnd = chapter.startCharOffset + chapter.totalChars;
    if (normalizedOffset >= chapterEnd && chapterIndex < preparedBook.chapters.length - 1) {
      continue;
    }

    if (chapter.paragraphs.length === 0) {
      return {
        chapter,
        paragraphIndex: 0,
        offsetInParagraph: 0,
        normalizedOffset: chapter.startCharOffset,
      };
    }

    if (normalizedOffset <= chapter.startCharOffset) {
      return { chapter, paragraphIndex: 0, offsetInParagraph: 0, normalizedOffset: chapter.startCharOffset };
    }

    for (let paragraphIndex = 0; paragraphIndex < chapter.paragraphs.length; paragraphIndex += 1) {
      const paragraph = chapter.paragraphs[paragraphIndex];
      if (normalizedOffset < paragraph.endCharOffset) {
        return {
          chapter,
          paragraphIndex,
          offsetInParagraph: Math.max(0, normalizedOffset - paragraph.startCharOffset),
          normalizedOffset,
        };
      }
    }

    const lastParagraphIndex = chapter.paragraphs.length - 1;
    return {
      chapter,
      paragraphIndex: lastParagraphIndex,
      offsetInParagraph: chapter.paragraphs[lastParagraphIndex].text.length,
      normalizedOffset,
    };
  }

  const lastChapter = preparedBook.chapters[preparedBook.chapters.length - 1];
  const lastParagraphIndex = Math.max(0, lastChapter.paragraphs.length - 1);
  return {
    chapter: lastChapter,
    paragraphIndex: lastParagraphIndex,
    offsetInParagraph: lastChapter.paragraphs[lastParagraphIndex]?.text.length ?? 0,
    normalizedOffset,
  };
}

function createTextMetricsContext(layout: ReaderLayoutKey): TextMetricsContext {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for reader pagination');
  }

  const fontSansVar = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
  const fontFamily = fontSansVar || getComputedStyle(document.body).fontFamily || 'sans-serif';
  ctx.font = `${layout.fontSize}px ${fontFamily}`;

  const lineHeightPx = layout.fontSize * layout.lineHeightMultiplier;
  const bodyWidthPx = Math.max(1, layout.width - layout.marginPx * 2);
  const footerHeightPx = dimens.reader_page_footer_size * 1.2 + PAGE_INFO_GAP_PX;
  const baseBodyHeightPx = Math.max(
    lineHeightPx,
    layout.height - dimens.reader_content_padding_top - dimens.reader_content_padding - footerHeightPx,
  );

  return {
    ctx,
    fontFamily,
    charWidthCache: new Map<string, number>(),
    lineHeightPx,
    bodyWidthPx,
    firstLineIndentPx: layout.firstLineIndent ? layout.fontSize * 2 : 0,
    letterSpacingPx: layout.fontSize * 0.025,
    baseBodyHeightPx,
    chapterTitleHeightPx: Math.round(layout.fontSize * 1.25 * 1.2) + CHAPTER_TITLE_GAP_PX,
    chapterLabelHeightPx: Math.round(dimens.reader_page_header_size / 0.75) + PAGE_LABEL_GAP_PX,
  };
}

function measureCharWidth(metrics: TextMetricsContext, char: string): number {
  const cached = metrics.charWidthCache.get(char);
  if (cached !== undefined) {
    return cached;
  }
  const width = metrics.ctx.measureText(char).width;
  metrics.charWidthCache.set(char, width);
  return width;
}

function getBodyHeightForPage(metrics: TextMetricsContext, isChapterStart: boolean): number {
  const reserved = isChapterStart ? metrics.chapterTitleHeightPx : metrics.chapterLabelHeightPx;
  return Math.max(metrics.lineHeightPx, metrics.baseBodyHeightPx - reserved);
}

function fitLineCount(
  metrics: TextMetricsContext,
  text: string,
  startIndex: number,
  maxWidthPx: number,
): number {
  let width = 0;
  let endIndex = startIndex;

  while (endIndex < text.length) {
    const char = text[endIndex];
    const charW = measureCharWidth(metrics, char);
    const contentWidth = width + charW;
    if (contentWidth > maxWidthPx + 0.5) {
      break;
    }
    width = contentWidth + metrics.letterSpacingPx;
    endIndex += 1;
  }

  if (endIndex === startIndex) {
    return 1;
  }

  const rawCount = endIndex - startIndex;
  if (rawCount <= 1) {
    return rawCount;
  }

  return preferNaturalBreak(text.slice(startIndex, endIndex), rawCount);
}

function consumeParagraphSegment(
  metrics: TextMetricsContext,
  text: string,
  indent: boolean,
  remainingHeightPx: number,
): { text: string; consumedChars: number; usedHeightPx: number } | null {
  if (remainingHeightPx < metrics.lineHeightPx - 0.5) {
    return null;
  }

  let consumedChars = 0;
  let usedHeightPx = 0;
  let firstLine = true;

  while (consumedChars < text.length) {
    const nextLineHeight = usedHeightPx + metrics.lineHeightPx;
    if (nextLineHeight > remainingHeightPx + 0.5) {
      break;
    }

    const maxWidthPx = Math.max(
      metrics.lineHeightPx,
      metrics.bodyWidthPx - (firstLine && indent ? metrics.firstLineIndentPx : 0),
    );
    const lineCount = fitLineCount(metrics, text, consumedChars, maxWidthPx);
    consumedChars += Math.max(1, lineCount);
    usedHeightPx = nextLineHeight;
    firstLine = false;
  }

  if (consumedChars <= 0) {
    return null;
  }

  usedHeightPx += PARAGRAPH_GAP_PX;

  return {
    text: text.slice(0, consumedChars),
    consumedChars,
    usedHeightPx,
  };
}

function paginatePreparedChapters(
  chapters: PreparedChapter[],
  totalChars: number,
  metrics: TextMetricsContext,
): ReaderPaginationResult {
  const pagesByChapter: ReaderPaginationPage[][] = [];
  const pages: ReaderPaginationPage[] = [];
  let globalPageIndex = 0;

  chapters.forEach((chapter) => {
    const chapterPages: ReaderPaginationPage[] = [];
    let paragraphIndex = 0;
    let offsetInParagraph = 0;
    let currentCharOffset = chapter.startCharOffset;

    if (chapter.paragraphs.length === 0) {
      const emptyPage: ReaderPaginationPage = {
        chapterIndex: chapter.chapterIndex,
        chapterTitle: chapter.title,
        pageIndexInChapter: 0,
        globalPageIndex,
        startCharOffset: currentCharOffset,
        endCharOffset: currentCharOffset,
        isChapterStart: true,
        blocks: [],
      };
      chapterPages.push(emptyPage);
      pages.push(emptyPage);
      globalPageIndex += 1;
      pagesByChapter.push(chapterPages);
      return;
    }

    while (paragraphIndex < chapter.paragraphs.length) {
      const isChapterStart = chapterPages.length === 0;
      const pageStartOffset = currentCharOffset;
      const blocks: ReaderPageBlock[] = [];
      let remainingHeightPx = getBodyHeightForPage(metrics, isChapterStart);

      while (paragraphIndex < chapter.paragraphs.length) {
        const paragraph = chapter.paragraphs[paragraphIndex];
        const remainingText = paragraph.text.slice(offsetInParagraph);
        if (!remainingText) {
          paragraphIndex += 1;
          offsetInParagraph = 0;
          continue;
        }

        const indent = offsetInParagraph === 0 && metrics.firstLineIndentPx > 0;
        const segment = consumeParagraphSegment(metrics, remainingText, indent, remainingHeightPx);
        if (!segment) {
          if (blocks.length === 0) {
            const forcedChars = Math.min(1, remainingText.length);
            blocks.push({
              key: `${chapter.chapterIndex}-${paragraph.index}-${offsetInParagraph}`,
              text: remainingText.slice(0, forcedChars),
              indent,
              continuedFromPrevious: offsetInParagraph > 0,
              continuedToNext: forcedChars < remainingText.length,
            });
            currentCharOffset += forcedChars;
            remainingHeightPx = 0;
            if (forcedChars < remainingText.length) {
              offsetInParagraph += forcedChars;
            } else {
              paragraphIndex += 1;
              offsetInParagraph = 0;
            }
          }
          break;
        }

        if (segment.consumedChars >= remainingText.length) {
          blocks.push({
            key: `${chapter.chapterIndex}-${paragraph.index}-${offsetInParagraph}`,
            text: remainingText,
            indent,
            continuedFromPrevious: offsetInParagraph > 0,
            continuedToNext: false,
          });
          currentCharOffset += remainingText.length;
          remainingHeightPx -= segment.usedHeightPx;
          paragraphIndex += 1;
          offsetInParagraph = 0;
          continue;
        }

        blocks.push({
          key: `${chapter.chapterIndex}-${paragraph.index}-${offsetInParagraph}`,
          text: segment.text,
          indent,
          continuedFromPrevious: offsetInParagraph > 0,
          continuedToNext: true,
        });
        currentCharOffset += segment.consumedChars;
        remainingHeightPx -= segment.usedHeightPx;
        offsetInParagraph += segment.consumedChars;
        break;
      }

      const pageEndOffset = currentCharOffset;
      const page: ReaderPaginationPage = {
        chapterIndex: chapter.chapterIndex,
        chapterTitle: chapter.title,
        pageIndexInChapter: chapterPages.length,
        globalPageIndex,
        startCharOffset: pageStartOffset,
        endCharOffset: pageEndOffset,
        isChapterStart,
        blocks,
      };
      chapterPages.push(page);
      pages.push(page);
      globalPageIndex += 1;
    }

    pagesByChapter.push(chapterPages);
  });

  return {
    pages,
    pagesByChapter,
    totalPages: pages.length,
    totalChars,
  };
}

function buildPageFromLocation(
  chapter: PreparedChapter,
  paragraphIndex: number,
  offsetInParagraph: number,
  pageStartOffset: number,
  metrics: TextMetricsContext,
): ReaderPaginationPage {
  const isChapterStart = pageStartOffset <= chapter.startCharOffset;
  const blocks: ReaderPageBlock[] = [];
  let currentParagraphIndex = paragraphIndex;
  let currentOffsetInParagraph = offsetInParagraph;
  let currentCharOffset = pageStartOffset;
  let remainingHeightPx = getBodyHeightForPage(metrics, isChapterStart);

  while (currentParagraphIndex < chapter.paragraphs.length) {
    const paragraph = chapter.paragraphs[currentParagraphIndex];
    const remainingText = paragraph.text.slice(currentOffsetInParagraph);
    if (!remainingText) {
      currentParagraphIndex += 1;
      currentOffsetInParagraph = 0;
      continue;
    }

    const indent = currentOffsetInParagraph === 0 && metrics.firstLineIndentPx > 0;
    const segment = consumeParagraphSegment(metrics, remainingText, indent, remainingHeightPx);
    if (!segment) {
      if (blocks.length === 0) {
        const forcedChars = Math.min(1, remainingText.length);
        blocks.push({
          key: `${chapter.chapterIndex}-${paragraph.index}-${currentOffsetInParagraph}`,
          text: remainingText.slice(0, forcedChars),
          indent,
          continuedFromPrevious: currentOffsetInParagraph > 0,
          continuedToNext: forcedChars < remainingText.length,
        });
        currentCharOffset += forcedChars;
      }
      break;
    }

    blocks.push({
      key: `${chapter.chapterIndex}-${paragraph.index}-${currentOffsetInParagraph}`,
      text: segment.text,
      indent,
      continuedFromPrevious: currentOffsetInParagraph > 0,
      continuedToNext: segment.consumedChars < remainingText.length,
    });
    currentCharOffset += segment.consumedChars;
    remainingHeightPx -= segment.usedHeightPx;

    if (segment.consumedChars < remainingText.length) {
      currentOffsetInParagraph += segment.consumedChars;
      break;
    }

    currentParagraphIndex += 1;
    currentOffsetInParagraph = 0;
  }

  return {
    chapterIndex: chapter.chapterIndex,
    chapterTitle: chapter.title,
    pageIndexInChapter: 0,
    globalPageIndex: 0,
    startCharOffset: pageStartOffset,
    endCharOffset: currentCharOffset,
    isChapterStart,
    blocks,
  };
}

export function paginateBook(
  bookId: string,
  parsedBook: ParsedBook,
  layout: ReaderLayoutKey,
): ReaderPaginationResult {
  const cacheKey = buildCacheKey(bookId, layout);
  const cached = paginationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = prepareBook(parsedBook);
  const metrics = createTextMetricsContext(layout);
  const result = paginatePreparedChapters(prepared.chapters, prepared.totalChars, metrics);
  paginationCache.set(cacheKey, result);
  return result;
}

export function findPageForCharOffset(
  result: ReaderPaginationResult,
  charOffset: number,
): ReaderPaginationPage | null {
  if (result.pages.length === 0) return null;
  if (charOffset <= 0) return result.pages[0];
  if (charOffset >= result.totalChars) return result.pages[result.pages.length - 1];

  let lo = 0;
  let hi = result.pages.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (result.pages[mid].endCharOffset <= charOffset) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return result.pages[lo];
}

export function getChapterFirstPage(
  result: ReaderPaginationResult,
  chapterIndex: number,
): ReaderPaginationPage | null {
  return result.pagesByChapter[chapterIndex]?.[0] ?? null;
}

export function resolvePageAtOffset(
  parsedBook: ParsedBook,
  layout: ReaderLayoutKey,
  internalCharOffset: number,
): ReaderPaginationPage | null {
  const preparedBook = prepareBook(parsedBook);
  if (preparedBook.chapters.length === 0) return null;

  const location = locateOffset(preparedBook, internalCharOffset);
  const metrics = createTextMetricsContext(layout);
  return buildPageFromLocation(
    location.chapter,
    location.paragraphIndex,
    location.offsetInParagraph,
    location.normalizedOffset,
    metrics,
  );
}

export function getBookTotalChars(parsedBook: ParsedBook): number {
  return prepareBook(parsedBook).totalChars;
}

export function getChapterStartOffset(parsedBook: ParsedBook, chapterIndex: number): number {
  const prepared = prepareBook(parsedBook);
  return prepared.chapters[chapterIndex]?.startCharOffset ?? 0;
}
