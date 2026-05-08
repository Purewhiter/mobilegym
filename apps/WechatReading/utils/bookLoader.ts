import { parseBook } from './bookParser';
import type { ParsedBook } from '../data/types';

const bookModules = import.meta.glob<string>(
  '../assets/books/*.txt',
  { query: '?raw', import: 'default' },
);

const cache = new Map<string, ParsedBook>();

function findModuleKey(filename: string): string | undefined {
  const suffix = `/${filename}`;
  return Object.keys(bookModules).find((k) => k.endsWith(suffix));
}

export async function loadBook(filename: string): Promise<ParsedBook | null> {
  const cached = cache.get(filename);
  if (cached) return cached;

  const key = findModuleKey(filename);
  if (!key) return null;

  const raw = await bookModules[key]();
  const parsed = parseBook(raw);
  cache.set(filename, parsed);
  return parsed;
}

export function getCachedBook(filename: string): ParsedBook | null {
  return cache.get(filename) ?? null;
}
