/**
 * eBay search over the product catalog: filters, sort order and the counts
 * the filter drawer shows. Pure; the device server's `search` query runs it,
 * so the page fetches the results instead of the whole catalog.
 */

import type { ProductItem } from '../types';

export type EbaySortOption = 'bestMatch' | 'priceLow' | 'priceHigh' | 'endingSoon' | 'newlyListed' | 'distance';
export type EbayBuyingFormat = 'all' | 'auction' | 'buyItNow' | 'offer';

export interface EbaySearchParams {
  searchQuery: string;
  buyingFormat: EbayBuyingFormat;
  selectedCategoryId: string | null;
  selectedBrands: string[];
  selectedLocation: string | null;
  freeShippingOnly: boolean;
  selectedConditions: string[];
  priceRange: { min: string; max: string };
  sortOption: EbaySortOption;
}

export interface EbaySearchResult {
  /** Products passing every filter, in sort order. */
  products: ProductItem[];
  buyingFormatCounts: Record<EbayBuyingFormat, number>;
  conditionCounts: Record<string, number>;
  pricePresets: { low: number; high: number };
  /** [brand, count] in order of first appearance, ignoring the brand filter. */
  brandCounts: Array<[string, number]>;
}

// ── Location → continent mapping (Bug A fix) ──────────────────

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  '中国': '亚洲',
  '日本': '亚洲',
  '韩国': '亚洲',
  '印度': '亚洲',
  '美国': '北美洲',
  '加拿大': '北美洲',
  '墨西哥': '北美洲',
  '英国': '欧洲',
  '德国': '欧洲',
  '法国': '欧洲',
  '意大利': '欧洲',
  '西班牙': '欧洲',
  '澳大利亚': '大洋洲',
  '新西兰': '大洋洲',
  '巴西': '南美洲',
};

function matchesLocation(productLocation: string, selectedLocation: string): boolean {
  if (selectedLocation === productLocation) return true;
  return COUNTRY_TO_CONTINENT[productLocation] === selectedLocation;
}

function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

type FilterKey =
  | 'buyingFormat' | 'selectedCategoryId' | 'selectedBrands' | 'selectedLocation'
  | 'freeShippingOnly' | 'selectedConditions' | 'priceRange' | 'searchQuery';

/** Products passing every filter except `exclude` (the drawer counts each facet without its own filter). */
function filterProducts(products: ProductItem[], filters: EbaySearchParams, exclude?: FilterKey): ProductItem[] {
  const brands = new Set(filters.selectedBrands);
  return products.filter(p => {
    if (exclude !== 'buyingFormat' && filters.buyingFormat !== 'all' && p.buyingFormat !== filters.buyingFormat) return false;
    if (exclude !== 'selectedCategoryId' && filters.selectedCategoryId && p.categoryId !== filters.selectedCategoryId) return false;
    if (exclude !== 'selectedBrands' && brands.size && !brands.has(p.brand)) return false;
    if (exclude !== 'selectedLocation' && filters.selectedLocation && !matchesLocation(p.location, filters.selectedLocation)) return false;
    if (exclude !== 'freeShippingOnly' && filters.freeShippingOnly && !p.freeShipping) return false;
    if (exclude !== 'selectedConditions' && filters.selectedConditions.length && !filters.selectedConditions.includes(p.condition)) return false;
    if (exclude !== 'priceRange') {
      const min = filters.priceRange.min ? parseFloat(filters.priceRange.min) : undefined;
      const max = filters.priceRange.max ? parseFloat(filters.priceRange.max) : undefined;
      const priceWithShip = p.price + p.shipping;
      if (min !== undefined && priceWithShip < min) return false;
      if (max !== undefined && priceWithShip > max) return false;
    }
    if (exclude !== 'searchQuery' && filters.searchQuery) {
      const q = normalizeSearchText(filters.searchQuery);
      const hay = normalizeSearchText(`${p.title} ${p.brand} ${p.typeLabel} ${p.categoryLabel}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortProducts(products: ProductItem[], sortOption: EbaySortOption): ProductItem[] {
  const sorted = [...products];
  switch (sortOption) {
    case 'priceLow':  sorted.sort((a, b) => (a.price + a.shipping) - (b.price + b.shipping)); break;
    case 'priceHigh': sorted.sort((a, b) => (b.price + b.shipping) - (a.price + a.shipping)); break;
    case 'newlyListed': sorted.sort((a, b) => b.dateListed - a.dateListed); break;
    case 'endingSoon':  sorted.sort((a, b) => a.endingSoon - b.endingSoon); break;
    case 'distance':    sorted.sort((a, b) => a.distanceKm - b.distanceKm); break;
  }
  return sorted;
}

export function searchEbayProducts(catalog: ProductItem[], params: EbaySearchParams): EbaySearchResult {
  const sorted = sortProducts(catalog, params.sortOption);

  const formatBase = filterProducts(sorted, params, 'buyingFormat');
  const buyingFormatCounts: Record<EbayBuyingFormat, number> = { all: formatBase.length, auction: 0, buyItNow: 0, offer: 0 };
  for (const p of formatBase) {
    if (p.buyingFormat === 'auction') buyingFormatCounts.auction += 1;
    else if (p.buyingFormat === 'buyItNow') buyingFormatCounts.buyItNow += 1;
    else if (p.buyingFormat === 'offer') buyingFormatCounts.offer += 1;
  }

  const conditionCounts: Record<string, number> = { '全新': 0, '二手': 0, '翻新': 0 };
  for (const p of filterProducts(sorted, params, 'selectedConditions')) {
    if (p.condition in conditionCounts) conditionCounts[p.condition] += 1;
    else conditionCounts['翻新'] += 1;
  }

  const values = filterProducts(sorted, params, 'priceRange').map(p => p.price + p.shipping).sort((a, b) => a - b);
  let pricePresets = { low: 0, high: 0 };
  if (values.length) {
    const percentile = (q: number) => {
      const idx = Math.floor(q * (values.length - 1));
      return values[Math.max(0, Math.min(values.length - 1, idx))];
    };
    let low = percentile(0.1);
    let high = percentile(0.45);
    if (!(high > low)) { low = values[0]; high = values[values.length - 1]; }
    pricePresets = { low, high };
  }

  const brandCountMap = new Map<string, number>();
  for (const p of filterProducts(sorted, params, 'selectedBrands')) {
    if (p.brand) brandCountMap.set(p.brand, (brandCountMap.get(p.brand) || 0) + 1);
  }

  return {
    products: filterProducts(sorted, params),
    buyingFormatCounts,
    conditionCounts,
    pricePresets,
    brandCounts: Array.from(brandCountMap.entries()),
  };
}
