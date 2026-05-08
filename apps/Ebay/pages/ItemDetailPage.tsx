import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  IcNavBack,
  IcSearch,
  IcCart,
  IcShare,
  IcMore,
  IcHeart,
  IcInfo,
  IcStar,
  IcTruck,
  IcShield,
  IcExpand,
  IcFastPay,
  IcNavForward,
} from '../res/icons';
import { useEbayGestures } from '../navigation';
import { useEbayStrings } from '../hooks/useEbayStrings';
import { useLocale } from '../../../os/locale';
import { loadProducts, getProductsSync } from '../data/loader';
import type { ProductItem } from '../types';
import {
  localizeEbayProductTitle,
  localizeEbayConditionLabel,
  localizeEbayLocationLabel,
} from '../utils/localize';
import * as TimeService from '../../../os/TimeService';
import TabBar from '../components/TabBar';

// ── Currency helpers ────────────────────────────────────────

/** 发货地 → 货币信息 (数据中价格为人民币，需转换到发货地货币) */
const LOCATION_CURRENCY: Record<string, { symbol: string; code: string; rate: number }> = {
  '中国':   { symbol: '¥',   code: 'CNY', rate: 1 },
  '美国':   { symbol: 'US $', code: 'USD', rate: 1 / 7.25 },
  '英国':   { symbol: '£',   code: 'GBP', rate: 1 / 9.15 },
  '德国':   { symbol: '€',   code: 'EUR', rate: 1 / 7.85 },
  '法国':   { symbol: '€',   code: 'EUR', rate: 1 / 7.85 },
  '意大利': { symbol: '€',   code: 'EUR', rate: 1 / 7.85 },
  '西班牙': { symbol: '€',   code: 'EUR', rate: 1 / 7.85 },
  '日本':   { symbol: '¥',   code: 'JPY', rate: 21.0 },
  '澳大利亚': { symbol: 'A$', code: 'AUD', rate: 1 / 4.75 },
  '加拿大': { symbol: 'C$',  code: 'CAD', rate: 1 / 5.25 },
  '韩国':   { symbol: '₩',   code: 'KRW', rate: 190 },
  '巴西':   { symbol: 'R$',  code: 'BRL', rate: 1 / 1.42 },
  '新西兰': { symbol: 'NZ$', code: 'NZD', rate: 1 / 4.35 },
};
const DEFAULT_CURRENCY = { symbol: 'US $', code: 'USD', rate: 1 / 7.25 };

function getCurrency(location: string) {
  return LOCATION_CURRENCY[location] ?? DEFAULT_CURRENCY;
}

function fmt(value: number, numberLocale: string, decimals = 2): string {
  return value.toLocaleString(numberLocale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** 人民币价格 → 发货地货币价格 */
function convertPrice(cnyPrice: number, rate: number): number {
  return cnyPrice * rate;
}

// ── Stable pseudo-random helpers ────────────────────────────

function stableHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateSellerInfo(productId: string) {
  const h = stableHash(productId);
  const names = [
    'tech_store_88', 'best.deals.shop', 'global_express', 'premium_outlet',
    'smart_buyer_01', 'eworld_digital', 'sunshine_mall', 'top_value_store',
  ];
  const name = names[h % names.length];
  const rating = 950 + (h % 9050);
  const positivePct = 95.0 + ((h % 50) / 10);
  return { name, rating, positivePct: Math.min(positivePct, 99.9) };
}

function generateWatcherCount(productId: string): number {
  return 5 + (stableHash(productId) % 45);
}

function generateSoldCount(productId: string): number {
  return 1 + (stableHash(productId + 'sold') % 12);
}

function generateStockCount(productId: string): number {
  return 1 + (stableHash(productId + 'stock') % 5);
}

// ── Component ───────────────────────────────────────────────

const ItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { bindBack } = useEbayGestures();
  const s = useEbayStrings();
  const locale = useLocale();
  const isEn = locale === 'en';
  const numberLocale = isEn ? 'en-US' : 'zh-CN';

  const [allProducts, setAllProducts] = useState<ProductItem[]>(getProductsSync() ?? []);
  useEffect(() => {
    if (!allProducts.length) loadProducts().then(setAllProducts);
  }, []);

  const product = useMemo(
    () => allProducts.find(p => p.id === id) ?? null,
    [allProducts, id],
  );

  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);

  if (!product) {
    return (
      <div className="h-full bg-app-surface flex flex-col">
        <div className="pt-10 px-4 py-3 flex items-center">
          <div {...bindBack()} className="cursor-pointer">
            <IcNavBack size={24} className="text-black" />
          </div>
          <span className="ml-3 text-lg font-medium text-black">{s.item_title}</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-app-text-muted text-base">...</span>
        </div>
      </div>
    );
  }

  const title = localizeEbayProductTitle(product.title, locale);
  const condition = localizeEbayConditionLabel(product.condition, locale);
  const locationLabel = localizeEbayLocationLabel(product.location, locale);
  const seller = generateSellerInfo(product.id);
  const watcherCount = generateWatcherCount(product.id);
  const soldCount = generateSoldCount(product.id);
  const stockCount = generateStockCount(product.id);
  const isOffer = product.buyingFormat === 'offer';
  const isAuction = product.buyingFormat === 'auction';

  // 货币
  const cur = getCurrency(product.location);
  const displayPrice = convertPrice(product.price, cur.rate);
  const displayShipping = convertPrice(product.shipping, cur.rate);
  const displayOriginal = product.originalPrice ? convertPrice(product.originalPrice, cur.rate) : null;
  // JPY 不需要小数
  const dec = cur.code === 'JPY' || cur.code === 'KRW' ? 0 : 2;

  const priceStr = `${cur.symbol}${fmt(displayPrice, numberLocale, dec)}`;
  const shippingStr = `${cur.symbol}${fmt(displayShipping, numberLocale, dec)}`;

  // 缩略图（模拟多张）
  const thumbnails = [product.image, product.image];

  // 预计送达日期
  const now = TimeService.now();
  const deliveryStart = TimeService.fromTimestamp(now + 14 * 86400000);
  const deliveryEnd = TimeService.fromTimestamp(now + 28 * 86400000);
  const dateFormatter = new Intl.DateTimeFormat(isEn ? 'en-US' : 'zh-CN', {
    month: isEn ? 'short' : 'long',
    day: 'numeric',
    weekday: isEn ? 'short' : 'long',
  });
  const deliveryRange = `${dateFormatter.format(deliveryStart)} - ${dateFormatter.format(deliveryEnd)}`;

  // 条件描述（模拟）
  const conditionDescriptions: Record<string, string> = {
    '二手': '"EXPECT SOME MARKS AND SIGNS OF WEAR N..."',
    '全新': '"Brand new, sealed in original packaging"',
    '翻新': '"Professionally restored to working order"',
  };
  const conditionDesc = conditionDescriptions[product.condition] ?? '';

  // 物品编号
  const itemNumber = String(277790000000 + stableHash(product.id) % 1000000);

  return (
    <div className="h-full bg-app-surface flex flex-col" data-status-bar-foreground="dark">
      {/* ── Header ── */}
      <div className="flex-shrink-0 pt-10 px-3 py-2 flex items-center justify-between bg-app-surface border-b border-gray-100 z-10">
        <div className="flex items-center space-x-3">
          <div {...bindBack()} className="cursor-pointer p-1">
            <IcNavBack size={22} className="text-black" />
          </div>
          <span className="text-base font-medium text-black">{s.item_title}</span>
        </div>
        <div className="flex items-center space-x-4">
          <IcSearch size={22} className="text-black" />
          <IcCart size={22} className="text-black" />
          <IcShare size={22} className="text-black" />
          <IcMore size={22} className="text-black" />
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar pb-16"
        data-scroll-container="item_detail"
        data-scroll-direction="vertical"
      >
        {/* ── Product Image ── */}
        <div className="relative bg-gray-50">
          <img
            src={thumbnails[selectedThumbIndex]}
            className="w-full aspect-[4/3] object-cover"
            alt={title}
          />
          <div className="absolute bottom-3 right-3 bg-white/90 rounded-full px-3 py-1.5 flex items-center space-x-1 shadow-sm">
            <span className="text-sm font-medium text-black">{watcherCount}</span>
            <IcHeart size={18} className="text-black" />
          </div>
        </div>

        {/* ── Thumbnail strip ── */}
        <div className="flex px-4 py-2 space-x-2 bg-app-surface">
          {thumbnails.map((thumb, i) => (
            <div
              key={i}
              className={`w-16 h-16 rounded-md overflow-hidden border-2 cursor-pointer flex-shrink-0 ${
                i === selectedThumbIndex ? 'border-black' : 'border-transparent'
              }`}
              onClick={() => setSelectedThumbIndex(i)}
            >
              <img src={thumb} className="w-full h-full object-cover" alt="" />
            </div>
          ))}
        </div>

        {/* ── Title ── */}
        <div className="px-4 pt-2 pb-3 bg-app-surface">
          <h1 className="text-xl font-medium text-black leading-snug">{title}</h1>
        </div>

        {/* ── Seller info ── */}
        <div className="px-4 py-3 bg-app-surface flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              <span className="text-gray-600 text-base font-bold">
                {seller.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-1">
                <span className="text-blue-600 text-sm font-medium underline">{seller.name}</span>
                <span className="text-sm text-black">({seller.rating.toLocaleString(numberLocale)})</span>
              </div>
              <span className="text-xs text-app-text-muted">
                {s.item_positive_feedback.replace('{pct}', seller.positivePct.toFixed(1))}
              </span>
            </div>
          </div>
          <button className="border border-gray-300 rounded-full px-4 py-1.5">
            <span className="text-sm font-medium text-black">{s.item_message_seller}</span>
          </button>
        </div>

        {/* ── Price ── */}
        <div className="px-4 py-3 bg-app-surface border-t border-gray-100">
          <div className="text-2xl font-bold text-black">{priceStr}</div>
          {/* 非人民币货币时显示人民币近似值 */}
          {cur.code !== 'CNY' && (
            <div className="text-sm text-app-text-muted mt-0.5">
              {s.item_price_approx.replace('{cny}', fmt(product.price, numberLocale))}
            </div>
          )}
          {isOffer && (
            <div className="text-sm text-app-text-muted mt-0.5">{s.item_or_best_offer}</div>
          )}
          {displayOriginal && (
            <div className="text-sm text-app-text-muted line-through mt-0.5">
              {cur.symbol}{fmt(displayOriginal, numberLocale, dec)}
            </div>
          )}
        </div>

        {/* ── Shipping ── */}
        <div className="px-4 py-3 bg-app-surface">
          {product.freeShipping ? (
            <span className="text-sm font-medium text-green-700">{s.item_free_shipping}</span>
          ) : (
            <span className="text-sm text-black">
              {s.item_shipping_cost
                .replace('{price}', shippingStr)
                .replace('{cny}', cur.code !== 'CNY' ? fmt(product.shipping, numberLocale) : '')}
            </span>
          )}
          <div className="flex items-center mt-1">
            <span className="text-sm text-black flex-1">
              {s.item_est_delivery.replace('{date}', deliveryRange)}
            </span>
            <IcNavForward size={16} className="text-app-text-muted flex-shrink-0" />
          </div>
        </div>

        {/* ── Condition ── */}
        <div className="px-4 py-3 bg-app-surface border-t border-gray-100 flex items-center">
          <span className="text-sm text-app-text-muted mr-8">{s.item_condition}</span>
          <span className="text-sm font-medium text-black">{condition}</span>
          <IcInfo size={14} className="text-app-text-muted ml-1" />
        </div>

        {/* ── Quantity ── */}
        <div className="px-4 py-3 bg-app-surface border-t border-gray-100">
          <div className="border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-black">{s.item_quantity}: 1</span>
            <IcExpand size={16} className="text-app-text-muted" />
          </div>
        </div>

        {/* ── Action Buttons (scrollable, not fixed) ── */}
        <div className="px-4 py-4 bg-app-surface space-y-2.5">
          {!isAuction && (
            <button className="w-full h-12 bg-blue-600 text-white font-bold text-base rounded-full">
              {s.item_buy_now}
            </button>
          )}
          <button className="w-full h-12 border-2 border-blue-600 text-blue-600 font-bold text-base rounded-full">
            {s.item_add_to_cart}
          </button>
          {isOffer && (
            <button className="w-full h-12 border-2 border-blue-600 text-blue-600 font-bold text-base rounded-full">
              {s.item_make_offer}
            </button>
          )}
          <button className="w-full h-12 border-2 border-gray-300 text-black font-medium text-base rounded-full flex items-center justify-center space-x-2">
            <IcHeart size={18} className="text-black" />
            <span>{s.item_add_to_watchlist}</span>
          </button>
        </div>

        {/* ── Watcher notice ── */}
        <div className="px-4 py-4 bg-app-surface border-t border-gray-100">
          <div className="flex items-start space-x-3 bg-gray-50 rounded-xl px-4 py-3">
            <IcFastPay size={24} className="text-gray-600 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-black leading-relaxed">
              {s.item_watcher_notice.replace('{count}', String(watcherCount))}
            </span>
          </div>
        </div>

        {/* ── 关于物品 ── */}
        <div className="px-4 py-4 bg-app-surface border-t border-gray-100">
          <h2 className="text-xl font-bold text-black mb-4">{s.item_about}</h2>
          <div className="space-y-0">
            <AboutRow label={s.item_condition} value={condition} />
            {conditionDesc && (
              <AboutRow label={s.item_condition_desc} value={conditionDesc} />
            )}
            <div className="flex border-b border-gray-100 py-3">
              <span className="text-sm text-app-text-muted w-28 flex-shrink-0">{s.item_quantity}</span>
              <div className="flex-1 flex items-center justify-between">
                <div>
                  <span className="text-sm text-red-500 font-medium">
                    {s.item_sold_count.replace('{count}', String(soldCount))}
                  </span>
                  <div className="text-sm text-black">
                    {s.item_stock_count.replace('{count}', String(stockCount))}
                  </div>
                </div>
                <IcNavForward size={16} className="text-app-text-muted" />
              </div>
            </div>
            <AboutRow label={s.item_item_number} value={itemNumber} />
            <AboutRow label={s.item_brand} value={product.brand} />
          </div>
        </div>

        {/* ── 卖家提供的物品描述 ── */}
        <div className="px-4 py-4 bg-app-surface border-t border-gray-100">
          <h2 className="text-xl font-bold text-black mb-3">{s.item_seller_desc}</h2>
          <div className="flex items-start">
            <p className="text-sm text-black leading-relaxed flex-1 line-clamp-6">
              {title.toUpperCase()} — {product.brand} {product.typeLabel} {condition}. {locationLabel}.
            </p>
            <IcNavForward size={16} className="text-app-text-muted flex-shrink-0 mt-1 ml-2" />
          </div>
          <button className="text-sm text-blue-600 font-medium mt-2">
            {s.item_view_full_desc}
          </button>
        </div>

        {/* ── Returns & Payments ── */}
        <div className="px-4 py-4 bg-app-surface border-t border-gray-100">
          <div className="flex items-center space-x-2 mb-2">
            <IcShield size={16} className="text-green-600" />
            <span className="text-sm text-black">{s.item_returns_accepted}</span>
          </div>
          <div className="flex items-center space-x-2">
            <IcShield size={16} className="text-blue-600" />
            <span className="text-sm text-black">{s.item_secure_payment}</span>
          </div>
        </div>

        <div className="h-4" />
      </div>

      <TabBar />
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────

const AboutRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex border-b border-gray-100 py-3">
    <span className="text-sm text-app-text-muted w-28 flex-shrink-0">{label}</span>
    <span className="text-sm text-black font-medium flex-1">{value}</span>
  </div>
);

export default ItemDetailPage;
