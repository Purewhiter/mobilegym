import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEntryState } from '../hooks/useEntryState';
import { IcCamera, IcNavBack, IcCart, IcHeart, IcSort, IcFilter, IcSearch } from '../res/icons';
import { useEbayGestures } from '../hooks/useEbayGestures';
import TabBar from '../components/TabBar';
import SortModal, { type SortOptionType } from '../components/SortModal';
import FilterDrawer, { type BuyingFormatFilter, type ViewMode } from '../components/FilterDrawer';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { useEbayCategories, useEbaySearch } from '../data/loader';
import type { ProductItem } from '../types';
import { useLocation } from 'react-router-dom';
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
import { routes } from '../routes';

// ── Main component ────────────────────────────────────────────

const SearchPage: React.FC = () => {
  const { bindBack, bindNav, bindTap, nav } = useEbayGestures();
  const s = useEbayStrings();
  const locale = useLocale();
  const isEn = locale === 'en';
  const numberLocale = isEn ? 'en-US' : 'zh-CN';
  const locationRouter = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTabBarVisible = useScrollDirection();
  const addRecentSearch = useEbayStore(st => st.addRecentSearch);
  const setSearchCurrent = useEbayStore(st => st.setSearchCurrent);
  const recordSearchSnapshot = useEbayStore(st => st.recordSearchSnapshot);

  // Async data
  const allCategories = useEbayCategories();

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
  const [selectedCategoryId, setSelectedCategoryId] = useEntryState<string | null>('category', initCategory);
  // Filters, sort and view survive opening an item and coming back (saved per history entry).
  const [selectedBrands, setSelectedBrands] = useEntryState<Set<string>>('brands', () => new Set());
  const [priceRange, setPriceRange] = useEntryState<{ min: string; max: string }>('price', { min: '', max: '' });
  const [selectedConditions, setSelectedConditions] = useEntryState<string[]>('conditions', []);
  const [selectedLocation, setSelectedLocation] = useEntryState<string | null>('location', null);
  const [freeShippingOnly, setFreeShippingOnly] = useEntryState('freeShipping', false);

  // UI state
  const [sortOption, setSortOption] = useEntryState<SortOptionType>('sort', 'bestMatch');
  const sheet = initParams.get('sheet');
  const isSortModalOpen = sheet === 'sort';
  const isFilterDrawerOpen = sheet === 'filter';
  const [viewMode, setViewMode] = useEntryState<ViewMode>('view', 'list');
  const [buyingFormat, setBuyingFormat] = useEntryState<BuyingFormatFilter>('buyingFormat', 'all');
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState(initQuery);

  // URL params sync (handles in-page navigation changes, e.g. category chip clicks).
  // Keyed on q / category only: opening or closing a sheet must not undo filter edits.
  // Not on mount: the initial state already came from the URL, or from the entry's saved filters.
  const urlSyncMounted = useRef(false);
  useEffect(() => {
    if (!urlSyncMounted.current) { urlSyncMounted.current = true; return; }
    if (initCategory) { setSelectedCategoryId(initCategory); setSearchStep('results'); }
    if (initQuery) { setSearchQuery(initQuery); setSearchStep('results'); }
  }, [initCategory, initQuery]);

  // Results and filter-drawer counts come from the device server (utils/search.ts).
  const searchParams = useMemo(() => ({
    searchQuery, buyingFormat, selectedCategoryId,
    selectedBrands: Array.from(selectedBrands).sort(),
    selectedLocation, freeShippingOnly, selectedConditions, priceRange, sortOption,
    // While typing only the count and first item are needed (they go into search.current).
    ...(searchStep === 'results' ? {} : { limit: 1 }),
  }), [buyingFormat, freeShippingOnly, priceRange, searchQuery, searchStep, selectedBrands, selectedCategoryId, selectedConditions, selectedLocation, sortOption]);
  const { result: searchResult, ready: resultsReady } = useEbaySearch(searchParams);
  const filteredProducts = searchResult.products;
  const buyingFormatCounts = searchResult.buyingFormatCounts;
  const conditionCountsByValue = searchResult.conditionCounts;
  const pricePresets = searchResult.pricePresets;

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
      resultsCount: searchResult.total,
      firstTitle: first?.title ?? null,
      firstTotalCents: totalCents,
    };
  }, [filteredProducts, searchResult.total]);

  const resultsDisplayCount = derived.resultsCount.toLocaleString(numberLocale);

  // Store sync: only once the results for exactly these params are in, so the
  // recorded count and first item never belong to the previous params.
  useEffect(() => {
    if (!resultsReady) return;
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
  }, [buyingFormat, derived.firstTitle, derived.firstTotalCents, derived.resultsCount, freeShippingOnly, priceRange.max, priceRange.min, resultsReady, searchQuery, selectedBrands, selectedCategoryId, selectedConditions, selectedLocation, setSearchCurrent, sortOption]);

  // Snapshots record result counts: only once the results for the current params are in
  // (search.current has been written for them by the effect above). A snapshot asked for
  // before that waits for them.
  const resultsReadyRef = useRef(resultsReady);
  useEffect(() => { resultsReadyRef.current = resultsReady; });
  const snapshotPending = useRef(false);
  const requestSnapshot = React.useCallback(() => {
    if (resultsReadyRef.current) recordSearchSnapshot();
    else snapshotPending.current = true;
  }, [recordSearchSnapshot]);
  useEffect(() => {
    if (resultsReady && snapshotPending.current) {
      snapshotPending.current = false;
      recordSearchSnapshot();
    }
  }, [recordSearchSnapshot, resultsReady]);

  const lastRecordedQueryRef = useRef<string>('');
  useEffect(() => {
    if (resultsReady && searchStep === 'results' && searchQuery.trim() && lastRecordedQueryRef.current !== searchQuery) {
      lastRecordedQueryRef.current = searchQuery;
      recordSearchSnapshot();
    }
  }, [resultsReady, recordSearchSnapshot, searchQuery, searchStep]);

  const lastRecordedSortRef = useRef<SortOptionType>(sortOption);
  useEffect(() => {
    if (resultsReady && searchStep === 'results' && lastRecordedSortRef.current !== sortOption) {
      lastRecordedSortRef.current = sortOption;
      recordSearchSnapshot();
    }
  }, [resultsReady, recordSearchSnapshot, searchStep, sortOption]);

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
  // The 500 ms run from the change itself; if the results are not in by then, the
  // snapshot is taken as soon as they are.
  useEffect(() => {
    if (searchStep !== 'results' || !searchQuery.trim()) return;
    const t = window.setTimeout(requestSnapshot, 500);
    return () => window.clearTimeout(t);
  }, [
    buyingFormat,
    brandsKey,
    conditionsKey,
    freeShippingOnly,
    priceRange.max,
    priceRange.min,
    requestSnapshot,
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
    nav.replace(routes.search, {}, { search: { q: nextQuery } });
  };

  const closeSortModal = () => nav.back();

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
    nav.back();
    requestSnapshot();
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
              {...bindTap({ kind: 'action', id: 'ebay.search.submit' }, { params: { q: s.search_sample_query }, onTrigger: () => handleSearch(s.search_sample_query) })}
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

  // Back and the search box both return to typing the query.
  const editQuery = bindNav(routes.search, { replace: true, beforeTrigger: () => setSearchStep('input') });

  return (
    <div className="h-full bg-app-surface flex flex-col relative">
      {/* Header */}
      <div className="bg-app-surface z-20 flex-shrink-0">
        <div className="px-3 py-2 pt-10 flex items-center space-x-3">
          <div {...editQuery} className="cursor-pointer">
            <IcNavBack size={24} className="text-black" />
          </div>
          <div
            className="flex-1 bg-gray-100 rounded-full h-10 flex items-center px-3 relative cursor-text"
            {...editQuery}
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
              {...bindNav(routes.search, { search: { sheet: 'sort' }, keep: ['q', 'category'] })}
            >
              <span className="text-sm font-bold">{s.search_sort}</span>
              <IcSort size={14} />
            </button>
            <button
              className="flex items-center text-blue-600 space-x-1"
              {...bindNav(routes.search, { search: { sheet: 'filter' }, keep: ['q', 'category'] })}
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
              {...bindNav(routes.item, { params: { id: product.id } })}
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
        onClose={() => nav.back()}
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
        brandCounts={searchResult.brandCounts}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        freeShippingOnly={freeShippingOnly}
        setFreeShippingOnly={setFreeShippingOnly}
        viewMode={viewMode}
        setViewMode={setViewMode}
        resultsDisplayCount={resultsDisplayCount}
        filteredProductsCount={searchResult.total}
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
