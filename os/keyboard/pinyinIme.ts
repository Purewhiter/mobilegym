import { PINYIN_PHRASES, PINYIN_SYLLABLES, PINYIN_TO_HANZI } from './pinyinData';
import { getPinyinDictSync, loadPinyinDict } from './pinyinLargeDict';

const SYLLABLE_SET = new Set(PINYIN_SYLLABLES);

// Build a map from initial letter to syllables starting with that letter
const INITIAL_TO_SYLLABLES: Record<string, string[]> = {};
for (const syl of PINYIN_SYLLABLES) {
  const initial = syl[0];
  if (!INITIAL_TO_SYLLABLES[initial]) {
    INITIAL_TO_SYLLABLES[initial] = [];
  }
  INITIAL_TO_SYLLABLES[initial].push(syl);
}

// Check if a character is a valid pinyin initial (consonant that can start a syllable)
const VALID_INITIALS = new Set('bpmfdtnlgkhjqxzhcsrzyw'.split(''));
function isValidInitial(ch: string): boolean {
  return VALID_INITIALS.has(ch);
}

function syllablePopularityScore(syl: string): number {
  // Heuristic: more mapped hanzi => more common.
  // Also slightly prefer shorter syllables (often higher frequency).
  const hanziCount = PINYIN_TO_HANZI[syl]?.length ?? 0;
  return hanziCount * 10 - syl.length;
}

function topSyllablesForInitial(initial: string, n: number): string[] {
  const list = INITIAL_TO_SYLLABLES[initial] || [];
  // Copy & sort once per call; n is small so this is fine.
  return list
    .slice()
    .sort((a, b) => syllablePopularityScore(b) - syllablePopularityScore(a))
    .slice(0, n);
}

export function normalizePinyin(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 32);
}

function normalizePinyinWithSep(raw: string): string {
  if (!raw) return '';
  // Keep apostrophe (syllable separator), drop other chars.
  const s = raw
    .toLowerCase()
    .replace(/[^a-z']/g, '')
    .replace(/'+/g, "'")
    // Keep trailing apostrophe so UI can immediately reflect a just-inserted separator.
    // (We still drop leading apostrophes.)
    .replace(/^'+/g, '')
    .slice(0, 32);
  return s;
}

function segmentForcedBySep(rawWithSep: string): string[] | null {
  const s = normalizePinyinWithSep(rawWithSep);
  if (!s.includes("'")) return null;
  const parts = s.split("'").filter(Boolean);
  if (parts.length === 0) return null;
  const syllables: string[] = [];
  for (const p of parts) {
    const seg = segmentPinyinTop(p, 1)[0];
    if (!seg) return [];
    syllables.push(...seg);
  }
  return syllables;
}

// Kick off async dictionary load

loadPinyinDict();

type Seg = { syllables: string[]; score: number };

/**
 * Beam-search segmentation for pinyin buffer.
 * Returns up to `k` segmentations from best to worst.
 */
export function segmentPinyinTop(raw: string, k = 3): string[][] {
  const s = normalizePinyin(raw);
  if (!s) return [];

  const n = s.length;
  const dp: Array<Seg[] | null> = Array.from({ length: n + 1 }, () => null);
  dp[n] = [{ syllables: [], score: 0 }];

  const MAX = 6; // max pinyin syllable length
  // Prefer fewer, longer syllables when multiple segmentations exist.
  // This avoids cases like "hao" being segmented as "ha" + "o" for display.
  const SYLLABLE_PENALTY = 5;

  for (let i = n - 1; i >= 0; i--) {
    const candidates: Seg[] = [];
    for (let len = 1; len <= MAX && i + len <= n; len++) {
      const sub = s.slice(i, i + len);
      if (!SYLLABLE_SET.has(sub)) continue;
      const tails = dp[i + len];
      if (!tails) continue;
      const weight = (PINYIN_TO_HANZI[sub]?.length ?? 0) > 0 ? 4 : 2;
      for (const t of tails) {
        const seg: Seg = {
          syllables: [sub, ...t.syllables],
          // Longer syllables get more credit; each syllable pays a fixed penalty.
          score: t.score + weight + len * 2 - SYLLABLE_PENALTY,
        };
        candidates.push(seg);
      }
    }

    if (candidates.length === 0) {
      dp[i] = null;
      continue;
    }

    candidates.sort((a, b) => b.score - a.score || a.syllables.length - b.syllables.length);
    dp[i] = candidates.slice(0, k);
  }

  return (dp[0] || []).map(x => x.syllables);
}

function combineSyllablesToCandidates(syllables: string[], limit: number): string[] {
  const options: string[][] = syllables.map(syl => (PINYIN_TO_HANZI[syl] || []).slice(0, 3));
  if (options.some(arr => arr.length === 0)) return [];

  let acc: string[] = [''];
  for (const opts of options) {
    const next: string[] = [];
    for (const prefix of acc) {
      for (const ch of opts) {
        next.push(prefix + ch);
        if (next.length >= limit) break;
      }
      if (next.length >= limit) break;
    }
    acc = next;
    if (acc.length >= limit) break;
  }
  return acc.slice(0, limit);
}

/**
 * Format pinyin with apostrophe separators for display
 * e.g. "xian" -> "xi'an" if segmented as xi + an
 * For abbreviations like "ky", display as "k'y"
 */
export function formatPinyinDisplay(raw: string): string {
  const s = normalizePinyin(raw);
  if (!s) return raw;
  
  const segs = segmentPinyinTop(s, 1);
  if (segs.length > 0) {
    return segs[0].join("'");
  }
  
  // If no valid segmentation, check if it's all initials (abbreviation)
  if (s.split('').every(isValidInitial)) {
    return s.split('').join("'");
  }
  
  return raw;
}

/**
 * Try to match abbreviated pinyin (initials only, e.g., "ky" -> "可以")
 * Returns candidate words that match the abbreviation pattern
 */
function getAbbreviationCandidates(abbrev: string, limit: number): string[] {
  // Check if all characters are valid initials
  const initials = abbrev.split('');
  if (!initials.every(isValidInitial)) return [];
  if (initials.length < 2) return []; // Need at least 2 initials for abbreviation
  
  const dict = getPinyinDictSync();
  const results: string[] = [];
  const seen = new Set<string>();
  
  // Generate pinyin candidates by combining top syllables for each initial,
  // then directly lookup dict/phrases. This matches the "k'k" mental model.
  // Keep the search space small for performance.
  const TOP = initials.length === 2 ? 14 : 10;

  const sylLists = initials.map(i => topSyllablesForInitial(i, TOP));
  const pushWordsForPinyin = (pinyinKey: string) => {
    const phraseHit = PINYIN_PHRASES[pinyinKey];
    if (phraseHit) {
      for (const w of phraseHit) {
        if (!seen.has(w)) {
          seen.add(w);
          results.push(w);
          if (results.length >= limit) return true;
        }
      }
    }
    if (dict) {
      const words = dict[pinyinKey] as string[] | undefined;
      if (words) {
        for (const w of words) {
          const ws = String(w);
          if (!seen.has(ws)) {
            seen.add(ws);
            results.push(ws);
            if (results.length >= limit) return true;
          }
        }
      }
    }
    return false;
  };

  if (initials.length === 2) {
    const [aList, bList] = sylLists;
    for (const a of aList) {
      for (const b of bList) {
        if (pushWordsForPinyin(a + b)) return results;
      }
    }
  } else if (initials.length === 3) {
    const [aList, bList, cList] = sylLists;
    for (const a of aList) {
      for (const b of bList) {
        for (const c of cList) {
          if (pushWordsForPinyin(a + b + c)) return results;
        }
      }
    }
  }
  
  // Also check built-in phrases (smaller, faster to scan)
  for (const [pinyin, words] of Object.entries(PINYIN_PHRASES)) {
    if (matchesAbbreviation(pinyin, initials)) {
      for (const w of words) {
        if (!seen.has(w)) {
          seen.add(w);
          results.push(w);
          if (results.length >= limit) return results;
        }
      }
    }
  }
  
  return results;
}

/**
 * Check if a pinyin string matches an abbreviation pattern
 * e.g., "keyi" matches ["k", "y"], "nihao" matches ["n", "h"]
 */
function matchesAbbreviation(pinyin: string, initials: string[]): boolean {
  let pos = 0;
  for (const initial of initials) {
    // Find the next syllable starting with this initial
    let found = false;
    while (pos < pinyin.length) {
      if (pinyin[pos] === initial) {
        // Check if this is the start of a syllable
        // Either at position 0, or the previous position ended a syllable
        found = true;
        pos++;
        // Skip to the end of this syllable (next consonant or end)
        while (pos < pinyin.length && !'bpmfdtnlgkhjqxzhcsrzyw'.includes(pinyin[pos])) {
          pos++;
        }
        break;
      }
      pos++;
    }
    if (!found) return false;
  }
  return true;
}

export function getZhCandidates(raw: string, limit = 9): { normalized: string; candidates: string[]; display: string } {
  const sWithSep = normalizePinyinWithSep(raw);
  if (!sWithSep) return { normalized: '', candidates: [], display: '' };
  const s = sWithSep.replace(/'/g, '');

  const out: string[] = [];
  const seen = new Set<string>();
  
  const push = (w: string) => {
    if (!w) return;
    if (seen.has(w)) return;
    seen.add(w);
    out.push(w);
  };

  // If user inserted separators, force segmentation on boundaries.
  const forced = segmentForcedBySep(sWithSep);
  const segs = forced ? [forced] : segmentPinyinTop(s, 3);
  let display = forced && forced.length > 0 ? forced.join("'") : segs.length > 0 ? segs[0].join("'") : sWithSep;
  // Preserve trailing separator for immediate visual feedback.
  if (sWithSep.endsWith("'") && !display.endsWith("'")) display += "'";

  // 1) Exact phrase matches first
  const phrases = PINYIN_PHRASES[s];
  if (phrases) {
    for (const p of phrases) {
      push(p);
      if (out.length >= limit) return { normalized: s, candidates: out, display };
    }
  }

  // 2) Large prebuilt dictionary - exact match
  const dict = getPinyinDictSync();
  const fromDict = dict ? dict[s] : undefined;
  if (fromDict && Array.isArray(fromDict)) {
    for (const w of fromDict) {
      push(String(w));
      if (out.length >= limit) return { normalized: s, candidates: out, display };
    }
  }

  // 2.5) Partial-tail prediction (does NOT require big dict)
  // e.g. "nih" -> "ni" + "hao/han/he..." -> suggests "你好..."
  // This fixes the common UX where users type an incomplete last syllable.
  if (out.length < limit && segs.length === 0) {
    // Try splits: s = completed + tail, where completed can be segmented into syllables,
    // and tail is a prefix of a valid syllable.
    for (let split = s.length - 1; split >= 1; split--) {
      const completed = s.slice(0, split);
      const tail = s.slice(split);

      const completedSegs = segmentPinyinTop(completed, 1);
      if (completedSegs.length === 0) continue;

      const firstChar = tail[0];
      if (!isValidInitial(firstChar)) continue;

      const matching = (INITIAL_TO_SYLLABLES[firstChar] || []).filter(syl => syl.startsWith(tail));
      if (matching.length === 0) continue;

      const baseSyllables = completedSegs[0];
      for (const syl of matching.slice(0, 12)) {
        const syllables = [...baseSyllables, syl];

        // Prefer dict/phrases if available (higher quality)
        const pinyinKey = syllables.join('');
        const phraseHit = PINYIN_PHRASES[pinyinKey];
        if (phraseHit) {
          for (const w of phraseHit) {
            push(w);
            if (out.length >= limit) return { normalized: s, candidates: out, display };
          }
        }
        if (dict) {
          const words = dict[pinyinKey] as string[] | undefined;
          if (words) {
            for (const w of words) {
              push(String(w));
              if (out.length >= limit) return { normalized: s, candidates: out, display };
            }
          }
        }

        // Always provide a fallback using per-syllable hanzi mapping.
        const gen = combineSyllablesToCandidates(syllables, limit);
        for (const g of gen) {
          push(g);
          if (out.length >= limit) return { normalized: s, candidates: out, display };
        }
      }

      // Only use the longest split that yields matches (closest to user's intent)
      break;
    }
  }

  // 3) Abbreviation matching (e.g., "ky" -> "可以")
  const abbrevCandidates = getAbbreviationCandidates(s, limit);
  for (const w of abbrevCandidates) {
    push(w);
    if (out.length >= limit) return { normalized: s, candidates: out, display };
  }

  // 4) Segmentation-based generation
  for (const seg of segs) {
    const gen = combineSyllablesToCandidates(seg, limit);
    for (const g of gen) {
      push(g);
      if (out.length >= limit) return { normalized: s, candidates: out, display };
    }
  }

  // 5) Single character candidates for the first syllable
  if (segs.length > 0 && segs[0].length > 0) {
    const firstSyl = segs[0][0];
    const firstChars = PINYIN_TO_HANZI[firstSyl];
    if (firstChars) {
      for (const ch of firstChars) {
        push(ch);
        if (out.length >= limit) return { normalized: s, candidates: out, display };
      }
    }
  }
  
  // 6) If still no results and input looks like initials, try single char for each initial
  if (out.length === 0 && s.split('').every(isValidInitial)) {
    for (const initial of s.split('')) {
      const syllables = INITIAL_TO_SYLLABLES[initial];
      if (syllables && syllables.length > 0) {
        // Get first char from most common syllable
        const chars = PINYIN_TO_HANZI[syllables[0]];
        if (chars && chars.length > 0) {
          push(chars[0]);
        }
      }
    }
  }

  return { normalized: s, candidates: out.slice(0, limit), display };
}
