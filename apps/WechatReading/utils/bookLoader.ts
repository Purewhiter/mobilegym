import { parseBook } from './bookParser';
import type { ParsedBook } from '../data/types';

// 书籍 .txt 体积大（0.7~2.6MB/本），不能用 `?raw` import——那会走 Vite ESM 模块管线，
// 把整本书文本打进 JS chunk（dev 首次转换阻塞、build 产出巨型 JS）。改用 `?url` 只取
// 静态资源地址（dev 下为源码路径、build 下由 Vite 发射为独立 .txt 资源，两种模式均可达，
// 中文文件名由 URL 编码自动处理），再 fetch + res.text() 取文本，
// 模式同 apps/Bilibili/data/loader.ts 的 createLoader。
const bookUrls = import.meta.glob<string>(
  '../assets/books/*.txt',
  { query: '?url', import: 'default', eager: true },
);

const cache = new Map<string, ParsedBook>();
// 进行中的加载；失败时移除对应条目，允许下次调用重试
const inflight = new Map<string, Promise<ParsedBook>>();

function findBookUrl(filename: string): string | undefined {
  const suffix = `/${filename}`;
  const key = Object.keys(bookUrls).find((k) => k.endsWith(suffix));
  return key ? bookUrls[key] : undefined;
}

export async function loadBook(filename: string): Promise<ParsedBook | null> {
  const cached = cache.get(filename);
  if (cached) return cached;

  const url = findBookUrl(filename);
  if (!url) return null;

  let loading = inflight.get(filename);
  if (!loading) {
    loading = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        return res.text();
      })
      .then((raw) => {
        const parsed = parseBook(raw);
        cache.set(filename, parsed);
        inflight.delete(filename);
        return parsed;
      })
      .catch((err) => {
        inflight.delete(filename);
        throw err;
      });
    inflight.set(filename, loading);
  }
  return loading;
}

export function getCachedBook(filename: string): ParsedBook | null {
  return cache.get(filename) ?? null;
}
