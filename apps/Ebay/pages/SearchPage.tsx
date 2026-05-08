import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IcCamera, IcNavBack, IcCart, IcHeart, IcSort, IcFilter, IcSearch } from '../res/icons';
import { useEbayGestures } from '../navigation';
import TabBar from '../components/TabBar';
import SortModal, { type SortOptionType } from '../components/SortModal';
import FilterDrawer, { type BuyingFormatFilter, type ViewMode } from '../components/FilterDrawer';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { loadProducts, getProductsSync, loadCategories, getCategoriesSync, type CategoryDef } from '../data/loader';
import type { ProductItem } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEbayStore } from '../state';
import { useEbayStrings } from '../hooks/useEbayStrings';
import { useLocale } from '../../../os/locale';
import {
  buildEbaySearchHaystack,
  localizeEbayBuyingFormatLabel,
  localizeEbayCategories,
  localizeEbayCategoryLabel,
  localizeEbayConditionLabel,
  localizeEbayLocationLabel,
  localizeEbayProductTitle,
} from '../utils/localize';

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

// ── Unified filter utility (replaces 3 near-identical useMemos) ──

interface FilterState {
  buyingFormat: BuyingFormatFilter;
  selectedCategoryId: string | null;
  selectedBrands: Set<string>;
  selectedLocation: string | null;
  freeShippingOnly: boolean;
  selectedConditions: string[];
  priceRange: { min: string; max: string };
  searchQuery: string;
}

function filterProducts(
  products: ProductItem[],
  filters: FilterState,
  exclude?: keyof FilterState,
): ProductItem[] {
  return products.filter(p => {
    if (exclude !== 'buyingFormat' && filters.buyingFormat !== 'all' && p.buyingFormat !== filters.buyingFormat) return false;
    if (exclude !== 'selectedCategoryId' && filters.selectedCategoryId && p.categoryId !== filters.selectedCategoryId) return false;
    if (exclude !== 'selectedBrands' && filters.selectedBrands.size && !filters.selectedBrands.has(p.brand)) return false;
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

// ── Main component ────────────────────────────────────────────

const SearchPage: React.FC = () => {
  const { bindBack, bindTap } = useEbayGestures();
  const s = useEbayStrings();
  const locale = useLocale();
  const isEn = locale === 'en';
  const numberLocale = isEn ? 'en-US' : 'zh-CN';
  const locationRouter = useLocation();
  const routerNavigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTabBarVisible = useScrollDirection();
  const addRecentSearch = useEbayStore(st => st.addRecentSearch);
  const setSearchCurrent = useEbayStore(st => st.setSearchCurrent);
  const recordSearchSnapshot = useEbayStore(st => st.recordSearchSnapshot);

  // Async data
  const [allProducts, setAllProducts] = useState<ProductItem[]>(getProductsSync() ?? []);
  const [allCategories, setAllCategories] = useState<CategoryDef[]>(getCategoriesSync() ?? []);
  useEffect(() => {
    if (!allProducts.length) loadProducts().then(setAllProducts);
    if (!allCategories.length) loadCategories().then(setAllCategories);
  }, []);

  const localizedCategories = useMemo(() => localizeEbayCategories(allCategories, locale), [allCategories, locale]);
  const categoryChips = useMemo(() => localizedCategories.map(c => c.label), [localizedCategories]);

  // Derive initial state from URL params (avoids input→results flicker on back navigation)
  const initParams = useMemo(() => new URLSearchParams(locationRouter.search), [locationRouter.search]);
  const initQuery = initParams.get('q') ?? '';
  const initCategory = initParams.get('category') ?? null;
  const hasUrlState = !!(initQuery || initCategory);

  // Search state
  const [searchStep, setSearchStep] = useState<'input' | 'results'>(hasUrlState ? 'results' : 'input');
  const [searchQuery, setSearchQuery] = useState(initQuery);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initCategory);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);

  // UI state
  const [sortOption, setSortOption] = useState<SortOptionType>('bestMatch');
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [buyingFormat, setBuyingFormat] = useState<BuyingFormatFilter>('all');
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState(initQuery);

  // URL params sync (handles in-page navigation changes, e.g. category chip clicks)
  useEffect(() => {
    const params = new URLSearchParams(locationRouter.search);
    const catParam = params.get('category');
    const queryParam = params.get('q');
    if (catParam) { setSelectedCategoryId(catParam); setSearchStep('results'); }
    if (queryParam) { setSearchQuery(queryParam); setSearchStep('results'); }
  }, [locationRouter.search]);

  // Shared filter state object
  const filters: FilterState = useMemo(() => ({
    buyingFormat, selectedCategoryId, selectedBrands, selectedLocation,
    freeShippingOnly, selectedConditions, priceRange, searchQuery,
  }), [buyingFormat, selectedCategoryId, selectedBrands, selectedLocation, freeShippingOnly, selectedConditions, priceRange, searchQuery]);

  // Sorted products
  const sortedProducts = useMemo(() => {
    const sorted = [...allProducts];
    switch (sortOption) {
      case 'priceLow':  sorted.sort((a, b) => (a.price + a.shipping) - (b.price + b.shipping)); break;
      case 'priceHigh': sorted.sort((a, b) => (b.price + b.shipping) - (a.price + a.shipping)); break;
      case 'newlyListed': sorted.sort((a, b) => b.dateListed - a.dateListed); break;
      case 'endingSoon':  sorted.sort((a, b) => a.endingSoon - b.endingSoon); break;
      case 'distance':    sorted.sort((a, b) => a.distanceKm - b.distanceKm); break;
    }
    return sorted;
  }, [sortOption, allProducts]);

  // Filtered products (all filters applied)
  const filteredProducts = useMemo(
    () => filterProducts(sortedProducts, filters),
    [sortedProducts, filters],
  );

  // Excluding buyingFormat → for buying format counts
  const baseFilteredProducts = useMemo(
    () => filterProducts(sortedProducts, filters, 'buyingFormat'),
    [sortedProducts, filters],
  );

  // Excluding brands → for brand list counts
  const brandBaseProducts = useMemo(
    () => filterProducts(sortedProducts, filters, 'selectedBrands'),
    [sortedProducts, filters],
  );

  // Buying format counts
  const buyingFormatCounts = useMemo(() => {
    const counts: Record<BuyingFormatFilter, number> = { all: baseFilteredProducts.length, auction: 0, buyItNow: 0, offer: 0 };
    for (const p of baseFilteredProducts) {
      if (p.buyingFormat === 'auction') counts.auction += 1;
      else if (p.buyingFormat === 'buyItNow') counts.buyItNow += 1;
      else if (p.buyingFormat === 'offer') counts.offer += 1;
    }
    return counts;
  }, [baseFilteredProducts]);

  // Condition counts (excluding condition filter)
  const conditionCountsByValue = useMemo(() => {
    const condBase = filterProducts(sortedProducts, filters, 'selectedConditions');
    const counts: Record<string, number> = { '全新': 0, '二手': 0, '翻新': 0 };
    for (const p of condBase) {
      if (p.condition in counts) counts[p.condition] += 1;
      else counts['翻新'] += 1;
    }
    return counts;
  }, [sortedProducts, filters]);

  // Price presets (excluding price filter)
  const pricePresets = useMemo(() => {
    const priceBase = filterProducts(sortedProducts, filters, 'priceRange');
    const values = priceBase.map(p => p.price + p.shipping).sort((a, b) => a - b);
    if (!values.length) return { low: 0, high: 0 };
    const percentile = (q: number) => {
      const idx = Math.floor(q * (values.length - 1));
      return values[Math.max(0, Math.min(values.length - 1, idx))];
    };
    let low = percentile(0.1);
    let high = percentile(0.45);
    if (!(high > low)) { low = values[0]; high = values[values.length - 1]; }
    return { low, high };
  }, [sortedProducts, filters]);

  // Display labels
  const buyingFormatLabel = useMemo(() => {
    return localizeEbayBuyingFormatLabel(buyingFormat, locale);
  }, [buyingFormat, locale]);

  const conditionLabel = useMemo(() => {
    if (!selectedConditions.length) return s.search_any;
    return selectedConditions.map(c => localizeEbayConditionLabel(c, locale)).join(isEn ? ', ' : '、');
  }, [isEn, locale, s.search_any, selectedConditions]);

  const priceLabel = useMemo(() => {
    if (!priceRange.min && !priceRange.max) return s.search_any;
    if (priceRange.min && priceRange.max) return `${priceRange.min} - ${priceRange.max}`;
    if (priceRange.min) return `≥ ${priceRange.min}`;
    return `≤ ${priceRange.max}`;
  }, [priceRange.max, priceRange.min, s.search_any]);

  const categoryLabel = useMemo(() => {
    if (!selectedCategoryId) return s.search_all_categories;
    const rawLabel = allCategories.find(c => c.id === selectedCategoryId)?.label ?? s.search_all_categories;
    return localizeEbayCategoryLabel(rawLabel, locale);
  }, [allCategories, locale, s.search_all_categories, selectedCategoryId]);

  const derived = useMemo(() => {
    const first = filteredProducts.length ? filteredProducts[0] : null;
    const totalCents = first ? Math.round((first.price + first.shipping) * 100) : null;
    return {
      resultsCount: filteredProducts.length,
      firstTitle: first?.title ?? null,
      firstTotalCents: totalCents,
    };
  }, [filteredProducts]);

  const resultsDisplayCount = derived.resultsCount.toLocaleString(numberLocale);

  // Store sync
  useEffect(() => {
    setSearchCurrent({
      query: searchQuery, sortOption, buyingFormat,
      categoryId: selectedCategoryId,
      brand: selectedBrands.size ? Array.from(selectedBrands).join(',') : null,
      location: selectedLocation, freeShippingOnly,
      conditions: [...selectedConditions].sort(),
      priceMin: priceRange.min, priceMax: priceRange.max,
      resultsCount: derived.resultsCount,
      firstTitle: derived.firstTitle, firstTotalCents: derived.firstTotalCents,
    });
  }, [buyingFormat, derived.firstTitle, derived.firstTotalCents, derived.resultsCount, freeShippingOnly, priceRange.max, priceRange.min, searchQuery, selectedBrands, selectedCategoryId, selectedConditions, selectedLocation, setSearchCurrent, sortOption]);

  const lastRecordedQueryRef = useRef<string>('');
  useEffect(() => {
    if (searchStep === 'results' && searchQuery.trim() && lastRecordedQueryRef.current !== searchQuery) {
      lastRecordedQueryRef.current = searchQuery;
      recordSearchSnapshot();
    }
  }, [recordSearchSnapshot, searchQuery, searchStep]);

  const lastRecordedSortRef = useRef<SortOptionType>(sortOption);
  useEffect(() => {
    if (searchStep === 'results' && lastRecordedSortRef.current !== sortOption) {
      lastRecordedSortRef.current = sortOption;
      recordSearchSnapshot();
    }
  }, [recordSearchSnapshot, searchStep, sortOption]);

  const brandsKey = useMemo(
    () => Array.from(selectedBrands).sort().join(','),
    [selectedBrands],
  );
  const conditionsKey = useMemo(
    () => [...selectedConditions].sort().join(','),
    [selectedConditions],
  );

  // Debounced: record snapshot whenever query/filters settle on results so ``search.history``
  // contains both searches for compare tasks (current alone only reflects the last view).
  useEffect(() => {
    if (searchStep !== 'results' || !searchQuery.trim()) return;
    const t = window.setTimeout(() => {
      recordSearchSnapshot();
    }, 500);
    return () => window.clearTimeout(t);
  }, [
    buyingFormat,
    brandsKey,
    conditionsKey,
    freeShippingOnly,
    priceRange.max,
    priceRange.min,
    recordSearchSnapshot,
    searchQuery,
    searchStep,
    selectedCategoryId,
    selectedLocation,
    sortOption,
  ]);

  const handleSearch = (query: string) => {
    const nextQuery = query.trim();
    const keepFilters = nextQuery === lastSubmittedQuery;
    if (!keepFilters) {
      // New query: reset all search filters/sort to defaults.
      setSortOption('bestMatch');
      setBuyingFormat('all');
      setSelectedCategoryId(null);
      setSelectedBrands(new Set());
      setSelectedLocation(null);
      setFreeShippingOnly(false);
      setSelectedConditions([]);
      setPriceRange({ min: '', max: '' });
      setViewMode('list');
    }
    setSearchQuery(nextQuery);
    setLastSubmittedQuery(nextQuery);
    setSearchStep('results');
    addRecentSearch(nextQuery);
    routerNavigate(`/search?q=${encodeURIComponent(nextQuery)}`, { replace: true });
  };

  const closeSortModal = () => {
    setIsSortModalOpen(false);
  };

  const handleFilterReset = () => {
    setSortOption('bestMatch');
    setBuyingFormat('all');
    setSelectedCategoryId(null);
    setSelectedBrands(new Set());
    setSelectedLocation(null);
    setFreeShippingOnly(false);
    setSelectedConditions([]);
    setPriceRange({ min: '', max: '' });
    setViewMode('list');
  };

  const handleFilterApply = () => {
    setIsFilterDrawerOpen(false);
    recordSearchSnapshot();
  };

  // ── Input step ──

  if (searchStep === 'input') {
    return (
      <div className="h-full bg-app-surface flex flex-col relative">
        <div className="bg-app-surface z-20 flex-shrink-0 px-3 py-2 pt-10 flex items-center space-x-3 border-b border-gray-100">
          <div {...bindBack()} className="cursor-pointer">
            <IcNavBack size={24} className="text-black" />
          </div>
          <div className="flex-1 bg-gray-100 rounded-full h-10 flex items-center px-4 relative">
            <IcSearch size={18} className="text-app-text-muted mr-2" />
            <input
              type="text"
              placeholder={s.search_placeholder}
              className="bg-transparent w-full outline-none text-black text-base placeholder-gray-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(e.currentTarget.value)}
              onChange={(e) => setSearchQuery(e.target.value)}
              value={searchQuery}
            />
            <div className="absolute right-3 flex items-center">
              <IcCamera size={20} className="text-app-text-muted" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-app-surface">
          <div className="flex px-4 mt-2 border-b border-gray-100">
            <div className="pb-3 border-b-2 border-blue-600 mr-6 cursor-pointer">
              <span className="text-blue-600 font-medium">{s.search_recent}</span>
            </div>
            <div className="pb-3 mr-6 cursor-pointer">
              <span className="text-app-text-muted font-medium">{s.search_saved}</span>
            </div>
          </div>
          <div className="px-4 py-4">
            <div
              className="py-3 text-base text-black font-normal cursor-pointer active:bg-gray-50"
              onClick={() => handleSearch(s.search_sample_query)}
            >
              {s.search_sample_query}
            </div>
            <button className="text-blue-600 mt-4 text-sm font-medium">
              {s.search_clear_recent}
            </button>
          </div>
        </div>

        <TabBar />
      </div>
    );
  }

  // ── Results step ──

  return (
    <div className="h-full bg-app-surface flex flex-col relative">
      {/* Header */}
      <div className="bg-app-surface z-20 flex-shrink-0">
        <div className="px-3 py-2 pt-10 flex items-center space-x-3">
          <div onClick={() => { setSearchStep('input'); routerNavigate('/search', { replace: true }); }} className="cursor-pointer">
            <IcNavBack size={24} className="text-black" />
          </div>
          <div
            className="flex-1 bg-gray-100 rounded-full h-10 flex items-center px-3 relative cursor-text"
            onClick={() => { setSearchStep('input'); routerNavigate('/search', { replace: true }); }}
          >
            <IcSearch size={18} className="text-black mr-2" />
            <span className="text-black text-base font-normal truncate flex-1">{searchQuery || s.search_placeholder}</span>
            <IcCamera size={20} className="text-app-text-muted" />
          </div>
          <div className="relative p-1">
            <IcCart size={24} className="text-black" />
          </div>
        </div>

        <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
          <button className="flex items-center text-blue-600 space-x-1">
            <IcHeart size={18} />
            <span className="text-sm font-bold">{s.search_save_search}</span>
          </button>
          <div className="flex items-center space-x-6">
            <button
              className="flex items-center text-blue-600 space-x-1"
              onClick={() => setIsSortModalOpen(true)}
            >
              <span className="text-sm font-bold">{s.search_sort}</span>
              <IcSort size={14} />
            </button>
            <button
              className="flex items-center text-blue-600 space-x-1"
              onClick={() => setIsFilterDrawerOpen(true)}
            >
              <span className="text-sm font-bold">{s.search_filters}</span>
              <IcFilter size={14} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3">
          <h2 className="text-black font-bold mb-3">{s.search_shop_by_category}</h2>
          <div className="flex space-x-2 overflow-x-auto no-scrollbar">
            {categoryChips.map(cat => (
              <div key={cat} className="px-4 py-1.5 bg-gray-100 rounded-full border border-app-border whitespace-nowrap">
                <span className="text-sm text-black">{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Product list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar bg-gray-50 pb-20"
        data-scroll-container="search_results"
        data-scroll-direction="vertical"
      >
        <div className="px-4 py-2">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              {...bindTap('search.item.open', { id: product.id })}
              className="cursor-pointer"
            >
              <ProductCard
                product={product}
                viewMode={viewMode}
                locale={locale}
                numberLocale={numberLocale}
                shippingLabel={s.search_shipping}
                sponsoredLabel={s.search_sponsored}
              />
            </div>
          ))}
        </div>
        <div className="py-6 text-center">
          <span className="text-app-text-muted text-sm">
            {`${resultsDisplayCount} ${s.search_results}`}
          </span>
        </div>
      </div>

      <TabBar visible={isTabBarVisible} />

      <SortModal
        isOpen={isSortModalOpen}
        sortOption={sortOption}
        onSelect={setSortOption}
        onClose={closeSortModal}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        sortOption={sortOption}
        setSortOption={setSortOption}
        buyingFormat={buyingFormat}
        setBuyingFormat={setBuyingFormat}
        buyingFormatLabel={buyingFormatLabel}
        buyingFormatCounts={buyingFormatCounts}
        selectedConditions={selectedConditions}
        setSelectedConditions={setSelectedConditions}
        conditionLabel={conditionLabel}
        conditionCountsByValue={conditionCountsByValue}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        priceLabel={priceLabel}
        priceLow={pricePresets.low}
        priceHigh={pricePresets.high}
        selectedCategoryId={selectedCategoryId}
        setSelectedCategoryId={setSelectedCategoryId}
        categoryLabel={categoryLabel}
        allCategories={localizedCategories}
        selectedBrands={selectedBrands}
        setSelectedBrands={setSelectedBrands}
        brandBaseProducts={brandBaseProducts}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        freeShippingOnly={freeShippingOnly}
        setFreeShippingOnly={setFreeShippingOnly}
        viewMode={viewMode}
        setViewMode={setViewMode}
        resultsDisplayCount={resultsDisplayCount}
        filteredProductsCount={filteredProducts.length}
      />
    </div>
  );
};

// ── ProductCard ──────────────────────────────────────────────

const ProductCard = ({
  product,
  viewMode,
  locale,
  numberLocale,
  shippingLabel,
  sponsoredLabel,
}: {
  product: ProductItem;
  viewMode: ViewMode;
  locale: 'zh-Hans' | 'en';
  numberLocale: 'zh-CN' | 'en-US';
  shippingLabel: string;
  sponsoredLabel: string;
}) => {
  const title = localizeEbayProductTitle(product.title, locale);
  const condition = localizeEbayConditionLabel(product.condition, locale);
  const location = product.location ? localizeEbayLocationLabel(product.location, locale) : (product.sales || '');
  if (viewMode === 'grid') {
    return (
      <div className="bg-app-surface rounded-lg p-2 mb-3 shadow-sm inline-block w-[48%] mr-[2%] align-top">
        <div className="aspect-square bg-gray-100 rounded-md mb-2 relative overflow-hidden">
          <img src={product.image} className="w-full h-full object-cover" alt={title} />
          <button className="absolute top-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
            <IcHeart size={16} className="text-black" />
          </button>
        </div>
        <h3 className="text-sm text-black line-clamp-2 mb-1 leading-tight">{title}</h3>
        <div className="text-lg font-bold text-black">¥{product.price.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        {product.originalPrice && (
          <div className="text-xs text-app-text-muted line-through">~ ¥{product.originalPrice.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-app-surface rounded-xl p-3 mb-3 flex relative shadow-sm">
      <div className="w-36 h-36 bg-gray-100 rounded-lg flex-shrink-0 relative overflow-hidden">
        <img src={product.image} className="w-full h-full object-cover" alt={title} />
        <button className="absolute top-2 right-2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center">
          <IcHeart size={14} className="text-black" />
        </button>
        <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-1">
          <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-white/70 rounded-full"></div>
        </div>
      </div>
      <div className="ml-3 flex-1 flex flex-col justify-between py-1">
        <div>
          <h3 className="text-base text-black line-clamp-2 mb-1 leading-snug font-normal">{title}</h3>
          <p className="text-app-text-muted text-xs mb-2">{condition}</p>
        </div>
        <div>
          <div className="text-xl font-bold text-black">¥{product.price.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          {product.originalPrice && (
            <div className="text-sm text-app-text-muted line-through mb-0.5">~ ¥{product.originalPrice.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          )}
          <div className="text-sm text-app-text-muted">+ ¥{product.shipping.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {shippingLabel}</div>
          <div className="flex justify-between items-end mt-1">
            <span className="text-xs text-gray-400">{location}</span>
            {product.isSponsored && <span className="text-xs text-gray-400">{sponsoredLabel}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
