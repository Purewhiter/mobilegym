/**
 * Ebay 数据懒加载器
 *
 * 使用 fetch() + JSON.parse() 加载数据（避开 Vite ESM 转换管线，避免阻塞 dev server）。
 * 单例缓存：首次加载后后续调用直接返回缓存数据。
 */

import { cdn, resolveCdnUrl } from '../../../os/utils/cdn';
import type { ProductItem } from '../types';

// 使用 new URL() + import.meta.url 让 Vite 正确解析资源路径（dev 和 build 均兼容）
const productsUrl = new URL('./products.json', import.meta.url).href;
const categoriesUrl = new URL('./categories.json', import.meta.url).href;

// dev: /cdn/ebay/images（vite 中间件 → mobilegym-data/ebay/images）
// prod: https://cdn.mobilegym.dev/ebay/images（R2/CF）
const EBAY_CDN = cdn('ebay/images');

// JSON 数据里相对路径（'./images/foo.png'）解析成 CDN URL
export const resolveEbayImage = (s: string): string => resolveCdnUrl(s, 'ebay');

const LOCAL_TYPE_IMAGES: Record<string, string> = {
  fan: `${EBAY_CDN}/fan.jpg`,
  laptop: `${EBAY_CDN}/laptop.jpg`,
  tv: `${EBAY_CDN}/tv.jpg`,
  watch: `${EBAY_CDN}/watch.jpg`,
  sofa: `${EBAY_CDN}/sofa.jpg`,
  lamp: `${EBAY_CDN}/lamp.jpg`,
  sneaker: `${EBAY_CDN}/sneaker.jpg`,
  dress: `${EBAY_CDN}/dress.jpg`,
  sunglasses: `${EBAY_CDN}/sunglasses.jpg`,
  pickup: `${EBAY_CDN}/pickup.jpg`,
  'radiator-fan': `${EBAY_CDN}/radiator-fan.jpg`,
  dumbbell: `${EBAY_CDN}/dumbbell.jpg`,
  'yoga-mat': `${EBAY_CDN}/yoga-mat.jpg`,
  'pet-bed': `${EBAY_CDN}/pet-bed.jpg`,
  ticket: `${EBAY_CDN}/ticket.jpg`,
  'gift-card': `${EBAY_CDN}/gift-card.jpg`,
};

function slugifyBrand(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function localImageFor(item: ProductItem): string {
  const brandSlug = slugifyBrand(item.brand || '');
  const byBrandAndType = `${EBAY_CDN}/${item.typeId}__${brandSlug}.jpg`;
  if (brandSlug) return byBrandAndType;
  return LOCAL_TYPE_IMAGES[item.typeId] ?? item.image;
}

// 通用 fetch + 缓存模式（失败时清除 inflight promise 以允许重试）
function createLoader<T>(url: string) {
  let cache: T | null = null;
  let loading: Promise<T> | null = null;

  const load = (): Promise<T> => {
    if (cache) return Promise.resolve(cache);
    if (!loading) {
      loading = fetch(url)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
          return r.json();
        })
        .then(data => { cache = data as T; return cache; })
        .catch(err => { loading = null; throw err; });
    }
    return loading;
  };

  const getSync = (): T | null => cache;

  return { load, getSync };
}

// ============ 各数据类型 ============

export interface CategoryDef {
  id: string;
  label: string;
  types: { id: string; label: string; image: string; brands: string[] }[];
}

const products = createLoader<ProductItem[]>(productsUrl);
export const loadProducts = async (): Promise<ProductItem[]> => {
  const items = await products.load();
  return items.map((item) => ({
    ...item,
    image: localImageFor(item),
  }));
};
export const getProductsSync = (): ProductItem[] | null => {
  const items = products.getSync();
  if (!items) return null;
  return items.map((item) => ({
    ...item,
    image: localImageFor(item),
  }));
};

function resolveCategoryImages(cats: CategoryDef[]): CategoryDef[] {
  return cats.map(c => ({
    ...c,
    types: c.types.map(t => ({ ...t, image: resolveEbayImage(t.image) })),
  }));
}

const categories = createLoader<CategoryDef[]>(categoriesUrl);
export const loadCategories = async (): Promise<CategoryDef[]> =>
  resolveCategoryImages(await categories.load());
export const getCategoriesSync = (): CategoryDef[] | null => {
  const items = categories.getSync();
  return items ? resolveCategoryImages(items) : null;
};

// ============ 批量预加载 ============

/**
 * 预加载所有 Ebay 数据到缓存（供 bench waitForData 使用）
 */
export async function preload(): Promise<void> {
  await Promise.all([
    loadProducts(),
    loadCategories(),
  ]);
}
