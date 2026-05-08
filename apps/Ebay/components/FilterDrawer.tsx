import React, { useState, useMemo } from 'react';
import {
  IcClose, IcNavBack, IcNavForward, IcExpand, IcGrid, IcList,
  IcMonitor, IcCamera, IcSettings, IcCheck, IcSearch,
} from '../res/icons';
import { useEbayStrings } from '../hooks/useEbayStrings';
import { useLocale } from '../../../os/locale';
import type { SortOptionType } from './SortModal';
import { SORT_OPTION_IDS } from './SortModal';
import type { ProductItem } from '../types';
import type { CategoryDef } from '../data/loader';
import {
  localizeEbayBuyingFormatLabel,
  localizeEbayConditionLabel,
  localizeEbayLocationLabel,
  localizeEbaySortLabel,
} from '../utils/localize';

// ── Types ──────────────────────────────────────────────────────

export type BuyingFormatFilter = 'all' | 'auction' | 'buyItNow' | 'offer';
export type ViewMode = 'list' | 'grid' | 'large';

type FilterSubPage =
  | 'sort'
  | 'buyingFormat'
  | 'condition'
  | 'price'
  | 'category'
  | 'brand'
  | 'location'
  | 'shipping'
  | 'custom';

// ── Constants ──────────────────────────────────────────────────

// ── Helper components (file-level, stable identity) ────────────

const FilterItem = ({ label, value, onClick }: { label: string; value?: string; onClick?: () => void }) => (
  <div className="flex justify-between items-center px-4 py-4 border-b border-gray-100 cursor-pointer active:bg-gray-50" onClick={onClick}>
    <span className="text-base text-black">{label}</span>
    <div className="flex items-center">
      {value && <span className="text-app-text-muted text-sm mr-2">{value}</span>}
      <IcNavForward size={20} className="text-gray-400" />
    </div>
  </div>
);

const ViewIcon = ({ active, icon, onClick }: { active: boolean; icon: React.ReactNode; onClick: () => void }) => (
  <button className={`p-1 ${active ? 'text-black' : 'text-gray-400'}`} onClick={onClick}>
    {icon}
  </button>
);

const CustomToggleItem = ({ title, desc }: { title: string; desc: string }) => {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
      <div className="flex-1 mr-4">
        <div className="text-base text-black">{title}</div>
        <div className="text-sm text-gray-400 mt-0.5">{desc}</div>
      </div>
      <button
        className={`w-12 h-7 rounded-full relative transition-colors flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-800'}`}
        onClick={() => setOn(!on)}
      >
        <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
};

// ── Utilities ──────────────────────────────────────────────────

const formatMoney = (value: number, locale: 'zh-CN' | 'en-US') =>
  value.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const approxEq = (a: number, b: number, eps = 0.01) => Math.abs(a - b) <= eps;

// ── Props ──────────────────────────────────────────────────────

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;

  sortOption: SortOptionType;
  setSortOption: (v: SortOptionType) => void;

  buyingFormat: BuyingFormatFilter;
  setBuyingFormat: (v: BuyingFormatFilter) => void;
  buyingFormatLabel: string;
  buyingFormatCounts: Record<BuyingFormatFilter, number>;

  selectedConditions: string[];
  setSelectedConditions: (v: string[]) => void;
  conditionLabel: string;
  conditionCountsByValue: Record<string, number>;

  priceRange: { min: string; max: string };
  setPriceRange: (v: { min: string; max: string }) => void;
  priceLabel: string;
  priceLow: number;
  priceHigh: number;

  selectedCategoryId: string | null;
  setSelectedCategoryId: (v: string | null) => void;
  categoryLabel: string;
  allCategories: CategoryDef[];

  selectedBrands: Set<string>;
  setSelectedBrands: (v: Set<string>) => void;
  brandBaseProducts: ProductItem[];

  selectedLocation: string | null;
  setSelectedLocation: (v: string | null) => void;

  freeShippingOnly: boolean;
  setFreeShippingOnly: (v: boolean) => void;

  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;

  resultsDisplayCount: string;
  filteredProductsCount: number;
}

// ── Component ──────────────────────────────────────────────────

const FilterDrawer: React.FC<FilterDrawerProps> = (props) => {
  const {
    isOpen, onClose, onApply, onReset,
    sortOption, setSortOption,
    buyingFormat, setBuyingFormat, buyingFormatLabel, buyingFormatCounts,
    selectedConditions, setSelectedConditions, conditionLabel, conditionCountsByValue,
    priceRange, setPriceRange, priceLabel, priceLow, priceHigh,
    selectedCategoryId, setSelectedCategoryId, categoryLabel, allCategories,
    selectedBrands, setSelectedBrands, brandBaseProducts,
    selectedLocation, setSelectedLocation,
    freeShippingOnly, setFreeShippingOnly,
    viewMode, setViewMode,
    resultsDisplayCount, filteredProductsCount,
  } = props;
  const s = useEbayStrings();
  const locale = useLocale();
  const isEn = locale === 'en';
  const numberLocale = isEn ? 'en-US' : 'zh-CN';
  const locationOptions = useMemo(() => [
    { id: null, label: s.filter_location_preset },
    { id: '美国', label: s.filter_location_us_only },
    { id: '北美洲', label: localizeEbayLocationLabel('北美洲', locale) },
    { id: '欧洲', label: localizeEbayLocationLabel('欧洲', locale) },
    { id: '亚洲', label: localizeEbayLocationLabel('亚洲', locale) },
  ], [locale, s.filter_location_preset, s.filter_location_us_only]);

  const [activeFilterSubPage, setActiveFilterSubPage] = useState<FilterSubPage | null>(null);
  const [isMoreContentExpanded, setIsMoreContentExpanded] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState('');

  const sortLabel = localizeEbaySortLabel(sortOption, locale);

  const locationLabel = useMemo(() => {
    if (selectedLocation === '美国') {
      return locationOptions.find(o => o.id === selectedLocation)?.label ?? localizeEbayLocationLabel(selectedLocation, locale);
    }
    return localizeEbayLocationLabel(selectedLocation, locale);
  }, [locale, locationOptions, selectedLocation]);

  const closeSubPage = () => setActiveFilterSubPage(null);

  const handleReset = () => {
    onReset();
    setIsMoreContentExpanded(false);
    setActiveFilterSubPage(null);
    setBrandSearchQuery('');
  };

  if (!isOpen) return null;

  // ── Brand sub-page data ──
  const brandCounts = new Map<string, number>();
  for (const p of brandBaseProducts) {
    if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + 1);
  }
  const allBrands = Array.from(brandCounts.entries()).sort((a, b) => b[1] - a[1]);

  const filteredBrands = brandSearchQuery
    ? allBrands.filter(([name]) => name.toLowerCase().includes(brandSearchQuery.toLowerCase()))
    : allBrands;

  const hotBrands = allBrands.slice(0, 5);

  const brandGroups = new Map<string, [string, number][]>();
  for (const [name, count] of filteredBrands) {
    const ch = name.charAt(0).toUpperCase();
    if (!brandGroups.has(ch)) brandGroups.set(ch, []);
    brandGroups.get(ch)!.push([name, count]);
  }
  const sortedBrandGroups = Array.from(brandGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  // ── Sub-page title mapping ──
  const subPageTitle: Record<FilterSubPage, string> = {
    sort: s.filter_sort,
    buyingFormat: s.filter_buying_format,
    condition: s.filter_condition,
    price: s.filter_price,
    category: s.filter_category,
    brand: s.filter_brand,
    location: s.filter_location,
    shipping: s.filter_shipping,
    custom: s.filter_custom,
  };

  // ── Price presets ──
  const minVal = priceRange.min ? parseFloat(priceRange.min) : undefined;
  const maxVal = priceRange.max ? parseFloat(priceRange.max) : undefined;
  const isPreset1 =
    (minVal === undefined || Number.isNaN(minVal)) &&
    maxVal !== undefined && !Number.isNaN(maxVal) && approxEq(maxVal, priceLow);
  const isPreset2 =
    minVal !== undefined && maxVal !== undefined &&
    !Number.isNaN(minVal) && !Number.isNaN(maxVal) &&
    approxEq(minVal, priceLow) && approxEq(maxVal, priceHigh);
  const isPreset3 =
    minVal !== undefined && (maxVal === undefined || Number.isNaN(maxVal)) &&
    !Number.isNaN(minVal) && approxEq(minVal, priceHigh);

  const resultsButton = (onClick: () => void) => (
    <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-white">
      <button
        className="w-full py-3.5 bg-blue-600 text-white text-base font-bold rounded-full"
        onClick={onClick}
      >
        {`${s.filter_show_results} ${filteredProductsCount.toLocaleString(numberLocale)} ${s.filter_results}`}
      </button>
    </div>
  );

  return (
    <>
      {/* Main drawer */}
      <div className="absolute inset-0 z-[200] flex justify-end bg-black/50 animate-in fade-in duration-200" onClick={onClose}>
        <div className="w-[85%] h-full bg-app-surface flex flex-col animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between pt-10">
            <div className="flex items-center">
              <button onClick={onClose} className="mr-3">
                <IcClose size={24} className="text-black" />
              </button>
              <h2 className="text-xl font-bold text-black">{s.filter_title}</h2>
            </div>
            <button className="text-blue-600 font-bold text-base" onClick={handleReset}>
              {s.filter_reset}
            </button>
          </div>

          {/* Filter items */}
          <div className="flex-1 overflow-y-auto">
            <FilterItem label={s.filter_sort} value={sortLabel} onClick={() => setActiveFilterSubPage('sort')} />
            <FilterItem label={s.filter_buying_format} value={buyingFormatLabel} onClick={() => setActiveFilterSubPage('buyingFormat')} />
            <FilterItem label={s.filter_condition} value={conditionLabel} onClick={() => setActiveFilterSubPage('condition')} />
            <FilterItem label={s.filter_price} value={priceLabel} onClick={() => setActiveFilterSubPage('price')} />
            <FilterItem label={s.filter_category} value={categoryLabel} onClick={() => setActiveFilterSubPage('category')} />
            <FilterItem label={s.filter_brand} value={selectedBrands.size ? Array.from(selectedBrands).join(', ') : ''} onClick={() => { setActiveFilterSubPage('brand'); setBrandSearchQuery(''); }} />
            <FilterItem label={s.filter_location} value={locationLabel} onClick={() => setActiveFilterSubPage('location')} />
            <FilterItem label={s.filter_shipping} onClick={() => setActiveFilterSubPage('shipping')} />

            <div className="py-4 text-center border-t border-gray-100">
              <button
                className="text-blue-600 font-bold flex items-center justify-center w-full"
                onClick={() => setIsMoreContentExpanded(v => !v)}
              >
                {s.filter_show_more}
                <IcExpand size={16} className={`ml-1 ${isMoreContentExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-base text-black">{s.filter_browse}</span>
              <div className="flex space-x-4">
                <ViewIcon active={viewMode === 'grid'} icon={<IcGrid size={24} />} onClick={() => setViewMode('grid')} />
                <ViewIcon active={viewMode === 'list'} icon={<IcList size={24} />} onClick={() => setViewMode('list')} />
                <ViewIcon active={viewMode === 'large'} icon={<IcMonitor size={24} />} onClick={() => setViewMode('large')} />
              </div>
            </div>

            <div className="px-4 py-4 border-t border-gray-100 flex items-center justify-between cursor-pointer" onClick={() => setActiveFilterSubPage('custom')}>
              <span className="text-base text-black">{s.filter_custom}</span>
              <IcSettings size={24} className="text-app-text-muted" />
            </div>

            <div className="px-8 py-6 text-center border-t border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <IcCamera size={24} className="text-blue-600" />
              </div>
              <p className="text-app-text-muted text-sm">{s.filter_camera_hint}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-app-surface">
            <button
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-full"
              onClick={onApply}
            >
              {`${s.filter_show_results} ${resultsDisplayCount} ${s.filter_results}`}
            </button>
          </div>
        </div>
      </div>

      {/* Sub-page overlay */}
      {activeFilterSubPage && (
        <div className="absolute inset-0 z-[210] flex justify-end bg-black/50 animate-in fade-in duration-200" onClick={closeSubPage}>
          <div className="w-[85%] h-full bg-app-surface flex flex-col animate-in slide-in-from-right duration-300 relative" onClick={(e) => e.stopPropagation()}>
            {/* Sub-page header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between pt-10 flex-shrink-0">
              <button onClick={closeSubPage} aria-label={s.filter_back} className="mr-3">
                <IcNavBack size={24} className="text-black" />
              </button>
              <h3 className="text-xl font-bold text-black">{subPageTitle[activeFilterSubPage]}</h3>
              <div className="w-6" />
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ── Sort（筛选内：侧边子页，非底部弹窗）── */}
              {activeFilterSubPage === 'sort' && (
                <div className="px-0">
                  {SORT_OPTION_IDS.map(optionId => (
                    <div
                      key={optionId}
                      className="flex items-center px-4 py-4 border-b border-gray-100 cursor-pointer active:bg-gray-50"
                      onClick={() => {
                        setSortOption(optionId);
                        closeSubPage();
                      }}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${
                          sortOption === optionId ? 'border-blue-600' : 'border-black'
                        }`}
                      >
                        {sortOption === optionId && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
                      </div>
                      <span
                        className={`text-base ${sortOption === optionId ? 'font-bold' : 'font-normal'} text-black`}
                      >
                        {localizeEbaySortLabel(optionId, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Buying Format ── */}
              {activeFilterSubPage === 'buyingFormat' && (
                <div className="px-0">
                  {(['all', 'auction', 'buyItNow', 'offer'] as const).map((optId) => {
                    const isSelected = buyingFormat === optId;
                    const count = buyingFormatCounts[optId] ?? 0;
                    const desc = optId === 'auction'
                      ? s.filter_auction_desc
                      : optId === 'buyItNow'
                        ? s.filter_buy_it_now_desc
                        : optId === 'offer'
                          ? s.filter_offer_desc
                          : '';
                    return (
                      <div
                        key={optId}
                        className="flex items-start px-4 py-4 border-b border-gray-100 cursor-pointer"
                        onClick={() => { setBuyingFormat(optId); }}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center ${isSelected ? 'border-blue-600' : 'border-black'}`}>
                          {isSelected && <div className="w-3 h-3 bg-blue-600 rounded-full" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base text-black">{localizeEbayBuyingFormatLabel(optId, locale)}</span>
                            <span className="text-base text-black">({count.toLocaleString(numberLocale)})</span>
                          </div>
                          {desc ? <div className="text-app-text-muted text-sm mt-2 leading-snug">{desc}</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Condition (Bug C fixed: true multi-select) ── */}
              {activeFilterSubPage === 'condition' && (
                <div className="px-0">
                  {[
                    { value: '全新', label: '全新' },
                    { value: '二手', label: '二手' },
                    { value: '翻新', label: '翻新' },
                  ].map((opt) => {
                    const isSelected = selectedConditions.includes(opt.value);
                    const count = conditionCountsByValue[opt.value] ?? 0;
                    return (
                      <div
                        key={opt.value}
                        className="flex items-center px-4 py-4 border-b border-gray-100 cursor-pointer active:bg-gray-50"
                        onClick={() => {
                          setSelectedConditions(
                            isSelected
                              ? selectedConditions.filter(v => v !== opt.value)
                              : [...selectedConditions, opt.value],
                          );
                        }}
                      >
                        <div className={`w-6 h-6 rounded-sm border-2 mr-4 flex items-center justify-center ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-black'}`}>
                          {isSelected && <IcCheck size={14} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-base text-black">{localizeEbayConditionLabel(opt.label, locale)}</span>
                            <span className="text-base text-black">({count.toLocaleString(numberLocale)})</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Price ── */}
              {activeFilterSubPage === 'price' && (
                <div className="px-0">
                  <div className="px-4 pt-4">
                    <div className="text-base font-bold text-black">{s.filter_common_price_ranges}</div>
                    <div className="flex gap-3 mt-3 overflow-x-auto no-scrollbar">
                      <button
                        className={`px-4 py-2 rounded-full border text-sm flex-shrink-0 ${isPreset1 ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300 text-black bg-app-surface'}`}
                        onClick={() => setPriceRange({ min: '', max: priceLow.toFixed(2) })}
                      >
                        {s.filter_below} ￥{formatMoney(priceLow, numberLocale)}
                      </button>
                      <button
                        className={`px-4 py-2 rounded-full border text-sm flex-shrink-0 ${isPreset2 ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300 text-black bg-app-surface'}`}
                        onClick={() => setPriceRange({ min: priceLow.toFixed(2), max: priceHigh.toFixed(2) })}
                      >
                        ￥{formatMoney(priceLow, numberLocale)} {s.filter_between} ￥{formatMoney(priceHigh, numberLocale)}
                      </button>
                      <button
                        className={`px-4 py-2 rounded-full border text-sm flex-shrink-0 ${isPreset3 ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300 text-black bg-app-surface'}`}
                        onClick={() => setPriceRange({ min: priceHigh.toFixed(2), max: '' })}
                      >
                        {s.filter_above} ￥{formatMoney(priceHigh, numberLocale)}
                      </button>
                    </div>
                  </div>

                  <div className="px-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-base font-bold text-black">{s.filter_choose_price}</div>
                      <button className="text-base font-bold text-blue-600" onClick={() => setPriceRange({ min: '', max: '' })}>
                        {s.filter_reset}
                      </button>
                    </div>
                    <div className="mt-4 flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-center border-b border-gray-300 pb-1">
                          <span className="text-sm text-gray-500 mr-2 flex-shrink-0">RMB</span>
                          <input
                            value={priceRange.min}
                            onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                            inputMode="decimal"
                            className="w-full bg-transparent text-base text-black outline-none"
                          />
                        </div>
                        <div className="text-sm text-gray-400 mt-1">{s.filter_min}</div>
                      </div>
                      <div className="text-gray-500 text-lg mt-1 flex-shrink-0 px-1">-</div>
                      <div className="flex-1">
                        <div className="flex items-center border-b border-gray-300 pb-1">
                          <span className="text-sm text-gray-500 mr-2 flex-shrink-0">RMB</span>
                          <input
                            value={priceRange.max}
                            onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                            inputMode="decimal"
                            className="w-full bg-transparent text-base text-black outline-none"
                          />
                        </div>
                        <div className="text-sm text-gray-400 mt-1 text-right">{s.filter_max}</div>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 mt-6">
                    <div className="text-base font-bold text-black">{s.filter_inventory}</div>
                    <div className="mt-4">
                      <svg width="100%" height="130" viewBox="0 0 320 130" xmlns="http://www.w3.org/2000/svg">
                        {(() => {
                          const bw = 5, bg = 4, bx = 20, by = 115;
                          const heights = [3,4,3,5,8,12,18,15,10,8,6,7,9,8,6,5,7,6,5,8,10,14,20,35,55,75,85,60,30,10];
                          return heights.map((h, i) => (
                            <rect key={i} x={bx + i * (bw + bg)} y={by - 5 - h} width={bw} height={h} fill="#2563EB" rx="1" />
                          ));
                        })()}
                        <line x1="12" y1="115" x2="308" y2="115" stroke="#2563EB" strokeWidth="2.5" />
                        <line x1="12" y1="115" x2="100" y2="115" stroke="#2563EB" strokeWidth="2.5" strokeDasharray="4 4" />
                        <circle cx="12" cy="115" r="9" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2.5" />
                        <circle cx="308" cy="115" r="9" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Category ── */}
              {activeFilterSubPage === 'category' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto pb-20">
                    <div
                      className="flex items-center px-4 py-4 border-b border-gray-200 cursor-pointer"
                      onClick={() => setSelectedCategoryId(null)}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center flex-shrink-0 ${!selectedCategoryId ? 'border-blue-600' : 'border-gray-800'}`}>
                        {!selectedCategoryId && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                      </div>
                      <span className="text-base text-black">{s.filter_all_categories}</span>
                    </div>
                    {allCategories.map((cat) => {
                      const isSelected = selectedCategoryId === cat.id;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center px-4 py-4 border-b border-gray-200 cursor-pointer"
                          onClick={() => setSelectedCategoryId(cat.id)}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-blue-600' : 'border-gray-800'}`}>
                            {isSelected && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                          </div>
                          <span className="text-base text-black">{cat.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Brand (with real search input) ── */}
              {activeFilterSubPage === 'brand' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto px-4 pb-20">
                    <div className="mt-4">
                      <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2.5">
                        <IcSearch size={20} className="text-gray-400 mr-2 flex-shrink-0" />
                        <input
                          type="text"
                          placeholder={s.filter_search_brand}
                          value={brandSearchQuery}
                          onChange={(e) => setBrandSearchQuery(e.target.value)}
                          className="w-full bg-transparent text-base text-black outline-none placeholder-gray-400"
                        />
                      </div>
                    </div>

                    {!brandSearchQuery && (
                      <div className="mt-5">
                        <div className="text-lg font-bold text-black">{s.filter_hot}</div>
                        <div className="text-sm text-gray-400 mt-0.5">{s.filter_hot_brand_desc}</div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {hotBrands.map(([name]) => (
                            <button
                              key={name}
                              className={`px-4 py-2 rounded-full border text-sm ${
                                selectedBrands.has(name) ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-gray-300 text-black'
                              }`}
                              onClick={() => {
                                const next = new Set(selectedBrands);
                                if (next.has(name)) next.delete(name); else next.add(name);
                                setSelectedBrands(next);
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-5">
                      {sortedBrandGroups.map(([char, brands]) => (
                        <div key={char}>
                          <div className="text-base font-bold text-black pt-3 pb-1 border-b border-gray-200">{char}</div>
                          {brands.map(([name, count]) => (
                            <label
                              key={name}
                              className="flex items-center py-3 cursor-pointer"
                              onClick={() => {
                                const next = new Set(selectedBrands);
                                if (next.has(name)) next.delete(name); else next.add(name);
                                setSelectedBrands(next);
                              }}
                            >
                              <div className={`w-5 h-5 border-2 rounded mr-4 flex items-center justify-center flex-shrink-0 ${
                                selectedBrands.has(name) ? 'border-blue-600 bg-blue-600' : 'border-gray-400'
                              }`}>
                                {selectedBrands.has(name) && <IcCheck size={14} className="text-white" />}
                              </div>
                              <span className="text-base text-black">{name}</span>
                              <span className="text-base text-gray-400 ml-1">({count.toLocaleString(numberLocale)})</span>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  {resultsButton(closeSubPage)}
                </div>
              )}

              {/* ── Location (Bug A fixed: continent matching) ── */}
              {activeFilterSubPage === 'location' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto pb-20">
                    {locationOptions.map((opt) => {
                      const isSelected = selectedLocation === opt.id;
                      return (
                        <div
                          key={opt.label}
                          className="flex items-center px-4 py-4 border-b border-gray-200 cursor-pointer"
                          onClick={() => setSelectedLocation(opt.id)}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-blue-600' : 'border-gray-800'}`}>
                            {isSelected && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                          </div>
                          <span className="text-base text-black">{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Shipping ── */}
              {activeFilterSubPage === 'shipping' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto pb-20">
                    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                      <span className="text-base text-black">{s.filter_free_shipping}</span>
                      <button
                        className={`w-12 h-7 rounded-full relative transition-colors ${freeShippingOnly ? 'bg-blue-600' : 'bg-gray-800'}`}
                        onClick={() => setFreeShippingOnly(!freeShippingOnly)}
                      >
                        <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${freeShippingOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Custom ── */}
              {activeFilterSubPage === 'custom' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto pb-20">
                    <CustomToggleItem title={s.filter_custom_hide} desc={s.filter_custom_hide_desc} />
                    <CustomToggleItem title={s.filter_custom_expand} desc={s.filter_custom_expand_desc} />
                    <CustomToggleItem title={s.filter_custom_lock} desc={s.filter_custom_lock_desc} />
                  </div>
                </div>
              )}
            </div>
            {resultsButton(closeSubPage)}
          </div>
        </div>
      )}
    </>
  );
};

export default FilterDrawer;
