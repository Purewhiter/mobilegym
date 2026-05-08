import type { BookChapter, ParsedBook } from '../data/types';

type ChapterMatch = {
  title: string;
  pos: number;
  contentStart: number;
};

/**
 * 多模式章节解析器。
 * 按优先级依次尝试匹配，命中即返回。
 * 如果全部不命中，整本书作为单一章节返回。
 */
export function parseBook(raw: string): ParsedBook {
  const text = raw.replace(/\r\n/g, '\n').trim();

  const strategies: Array<() => BookChapter[] | null> = [
    // 红楼梦: "第一回　甄士隐梦幻识通灵..."
    () => parseByPattern(text, /^(第[一二三四五六七八九十百零〇\d]+回[　\s]+.+)$/gm),
    // 国富论: "第一篇　论..." + "第一章  论分工"
    () => parseInlineChapters(text),
    // 人类简史 / 忏悔录: "第一章" (standalone line, optional subtitle on next line)
    () => parseStandaloneChapters(text),
    // 理想国: "第　一　卷"
    () => parseSpacedVolumes(text),
    // 苏菲的世界: short title lines
    () => parseSophie(text),
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result && result.length >= 2) {
      return { chapters: result, totalChars: text.length };
    }
  }

  return {
    chapters: [{ index: 0, title: '全文', content: text, startOffset: 0 }],
    totalChars: text.length,
  };
}

/** "第X篇/章　TITLE" on same line (国富论 style) */
function parseInlineChapters(text: string): BookChapter[] | null {
  const pattern = /^(第[一二三四五六七八九十百零〇\d]+[篇章][　\s]+.+)$/gm;
  const matches = collectLineMatches(text, pattern);
  return matches.length >= 3 ? buildChapters(text, matches) : null;
}

/** "第X章" standalone, subtitle on next non-empty line (人类简史 / 忏悔录) */
function parseStandaloneChapters(text: string): BookChapter[] | null {
  const pattern = /^\s*(第[一二三四五六七八九十百零〇\d]+章)\s*$/gm;
  const matches: ChapterMatch[] = [];
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(text)) !== null) {
    const pos = m.index;
    const title = m[1].trim();
    const afterTitle = advanceToNextLine(text, pos);
    const subtitleStart = skipBlankLines(text, afterTitle);
    const subtitle = readLine(text, subtitleStart).trim();
    const hasSubtitle = subtitle.length > 0;

    matches.push({
      title: hasSubtitle ? `${title} ${subtitle}` : title,
      pos,
      contentStart: hasSubtitle
        ? skipBlankLines(text, advanceToNextLine(text, subtitleStart))
        : skipBlankLines(text, afterTitle),
    });
  }

  if (matches.length < 2) return null;

  return buildChapters(text, matches);
}

/** "第　一　卷" with ideographic spaces between chars (理想国) */
function parseSpacedVolumes(text: string): BookChapter[] | null {
  const pattern = /^\s*(第[\s　]+[一二三四五六七八九十]+[\s　]+卷)\s*$/gm;
  const rawMatches = collectLineMatches(text, pattern);
  if (rawMatches.length < 2) return null;

  const seen = new Set<string>();
  const dedupedMatches = rawMatches.filter((m) => {
    const normalized = m.title.replace(/[\s　]+/g, '');
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).map((m) => ({
    ...m,
    title: m.title.replace(/[\s　]+/g, ''),
  }));

  return dedupedMatches.length >= 2 ? buildChapters(text, dedupedMatches) : null;
}

/** 苏菲的世界: chapter titles are short standalone lines before an empty line then indented content */
function parseSophie(text: string): BookChapter[] | null {
  const lines = text.split('\n');
  const matches: ChapterMatch[] = [];
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevEmpty = i === 0 || lines[i - 1].trim() === '';
    const nextEmpty = i + 1 < lines.length && lines[i + 1].trim() === '';
    const hasContent = i + 2 < lines.length && lines[i + 2].trim().length > 0;

    if (
      prevEmpty && nextEmpty && hasContent &&
      line.length > 0 && line.length <= 20 &&
      !/^[　\s]/.test(lines[i])
    ) {
      matches.push({
        title: line,
        pos: offset,
        contentStart: skipBlankLines(text, advanceToNextLine(text, offset)),
      });
    }
    offset += lines[i].length + 1;
  }

  return matches.length >= 5 ? buildChapters(text, matches) : null;
}

function parseByPattern(
  text: string,
  pattern: RegExp,
): BookChapter[] | null {
  const matches = collectLineMatches(text, pattern);
  return matches.length >= 2 ? buildChapters(text, matches) : null;
}

function collectLineMatches(
  text: string,
  pattern: RegExp,
): ChapterMatch[] {
  const matches: ChapterMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const pos = m.index;
    matches.push({
      title: m[1].trim(),
      pos,
      contentStart: skipBlankLines(text, advanceToNextLine(text, pos)),
    });
  }
  return matches;
}

function advanceToNextLine(text: string, start: number): number {
  let i = start;
  while (i < text.length && text[i] !== '\n') {
    i += 1;
  }
  return i < text.length ? i + 1 : i;
}

function skipBlankLines(text: string, start: number): number {
  let i = start;
  while (i < text.length) {
    const line = readLine(text, i);
    if (line.trim().length > 0) {
      return i;
    }
    const next = advanceToNextLine(text, i);
    if (next === i) {
      break;
    }
    i = next;
  }
  return i;
}

function readLine(text: string, start: number): string {
  const end = text.indexOf('\n', start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

function buildChapters(
  text: string,
  matches: ChapterMatch[],
): BookChapter[] {
  return matches.map((m, i) => {
    const start = m.pos;
    const end = i + 1 < matches.length ? matches[i + 1].pos : text.length;
    return {
      index: i,
      title: m.title,
      // 章节标题由 title 单独承载，正文从标题后的实际内容开始。
      content: text.substring(m.contentStart, end).trim(),
      startOffset: start,
    };
  });
}
