/**
 * Ebay 商品目录读取
 *
 * 商品和分类在 device server 上 (apps/Ebay/device)，页面用 catalog query 读取；
 * 图片地址依赖本页的 CDN base，在这里解析，每份查询结果只解析一次。
 */

import { useMemo } from 'react';
import { prefetchDeviceQuery, useDeviceQuery } from '../../../os/device/deviceStore';
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

// ============ 各数据类型 ============

export interface CategoryDef {
  id: string;
  label: string;
  types: { id: string; label: string; image: string; brands: string[] }[];
}

const withImage = (item: ProductItem): ProductItem => ({ ...item, image: localImageFor(item) });

const resolvedProducts = new WeakMap<ProductItem[], ProductItem[]>();
const resolvedCategories = new WeakMap<CategoryDef[], CategoryDef[]>();

function resolveCategoryImages(cats: CategoryDef[]): CategoryDef[] {
  return cats.map(c => ({
    ...c,
    types: c.types.map(t => ({ ...t, image: resolveEbayImage(t.image) })),
  }));
}

const EMPTY_PRODUCTS: ProductItem[] = [];
const EMPTY_CATEGORIES: CategoryDef[] = [];

/** All catalog products (empty while loading). */
export function useEbayProducts(): ProductItem[] {
  const { data } = useDeviceQuery<ProductItem[]>('ebay', 'products', {}, true, { catalog: true });
  return useMemo(() => {
    if (!data) return EMPTY_PRODUCTS;
    let out = resolvedProducts.get(data);
    if (!out) resolvedProducts.set(data, (out = data.map(withImage)));
    return out;
  }, [data]);
}

/** One catalog product; `undefined` while loading, `null` if there is none. */
export function useEbayProduct(id: string | undefined): ProductItem | null | undefined {
  const { data, loading } = useDeviceQuery<ProductItem | null>('ebay', 'product', { id }, Boolean(id), { catalog: true });
  return useMemo(() => (data ? withImage(data) : loading ? undefined : data ?? null), [data, loading]);
}

/** Category tree (empty while loading). */
export function useEbayCategories(): CategoryDef[] {
  const { data } = useDeviceQuery<CategoryDef[]>('ebay', 'categories', {}, true, { catalog: true });
  return useMemo(() => {
    if (!data) return EMPTY_CATEGORIES;
    let out = resolvedCategories.get(data);
    if (!out) resolvedCategories.set(data, (out = resolveCategoryImages(data)));
    return out;
  }, [data]);
}

// ============ 预加载 ============

/** OS `waitForData` 入口: 同步 store 与本页的 device session, 并预取商品目录（页面挂载时数据已就绪）。 */
export async function preload(): Promise<void> {
  // 动态 import: state → data/index → loader 静态 import 会成环。
  const { useEbayStore } = await import('../state');
  await useEbayStore.ensureSynced();
  await Promise.all([
    prefetchDeviceQuery('ebay', 'products', {}, { catalog: true }),
    prefetchDeviceQuery('ebay', 'categories', {}, { catalog: true }),
  ]);
}
