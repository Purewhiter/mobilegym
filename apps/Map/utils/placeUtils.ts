import {
  pickFormattedPhoneNumber,
  pickPlaceWebsite,
  type GooglePlaceContactFields,
  type MapPoiSnapshot,
  type ShoppingItem,
} from '../types';
import type { Locale } from '@/os/locale';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { fromTimestamp } from '../../../os/TimeService';

export type MapStrings = Record<keyof typeof strings, string>;

export function getMapStrings(locale: Locale = 'zh-Hans'): MapStrings {
  return locale === 'en'
    ? ({ ...strings, ...stringsEn } as MapStrings)
    : (strings as MapStrings);
}

export const stripHtml = (html: string) =>
  String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const parseDistanceTextToMeters = (distance: string): number | null => {
  const value = String(distance || '').trim();
  if (!value) return null;
  const matched = value.match(/([\d.]+)\s*(公里|千米|km|米|m|mi|miles?)/i);
  if (!matched) return null;
  const amount = Number(matched[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = matched[2].toLowerCase();
  if (unit === '公里' || unit === '千米' || unit === 'km') return amount * 1000;
  if (unit === 'mi' || unit === 'mile' || unit === 'miles') return amount * 1609.344;
  return amount;
};

/** 列表/POI 等展示：≥1000m 为「x.x 公里」；1000m 以下为按 50m 粒度四舍五入；舍入到 1000m 时显示「1.0 公里」而非「1000.0 米」；结果不足 50m 时显示 50.0 米；无效/≤0 返回空串 */
export const MIN_DISPLAY_DISTANCE_METERS = 50;
export const MIN_ROUTE_DISTANCE_METERS = 10;

export function formatDistanceLabelMeters(
  meters: number | undefined | null,
  locale: Locale = 'zh-Hans',
): string {
  const t = getMapStrings(locale);
  if (meters === undefined || meters === null || !Number.isFinite(meters) || meters <= 0) {
    return '';
  }
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} ${t.unit_km}`;
  }
  const step = MIN_DISPLAY_DISTANCE_METERS;
  let rounded = Math.round(meters / step) * step;
  if (rounded < step) {
    rounded = step;
  }
  if (rounded >= 1000) {
    return `${(rounded / 1000).toFixed(1)} ${t.unit_km}`;
  }
  return `${rounded.toFixed(1)} ${t.unit_m}`;
}

/** 路线详情/导航距离：<1000m 显示按 10m 粒度取整的整数米数；否则显示 1 位小数公里 */
export function formatRouteDistanceMeters(
  meters: number | undefined | null,
  locale: Locale = 'zh-Hans',
): string {
  const t = getMapStrings(locale);
  if (meters === undefined || meters === null || !Number.isFinite(meters) || meters <= 0) {
    return '';
  }
  if (meters < 1000) {
    const rounded = Math.max(
      MIN_ROUTE_DISTANCE_METERS,
      Math.round(meters / MIN_ROUTE_DISTANCE_METERS) * MIN_ROUTE_DISTANCE_METERS,
    );
    if (rounded < 1000) {
      return `${rounded} ${t.unit_m}`;
    }
    return `${(rounded / 1000).toFixed(1)} ${t.unit_km}`;
  }
  return `${(meters / 1000).toFixed(1)} ${t.unit_km}`;
}

export const toSearchResultSnapshot = (item: ShoppingItem): Record<string, any> => ({
  id: item.id,
  place_id: item.id,
  name: item.name,
  rating: item.rating,
  user_ratings_total: item.ratingCount,
  distance: formatDistanceLabelMeters(item.distance),
  distance_meters: item.distance,
  address: item.address,
  formatted_address: item.address,
  category: item.category,
  types: item.types,
  primary_type: item.primaryType,
  status: item.status,
  lat: item.lat,
  lng: item.lng,
});

export const toPoiSnapshot = (
  place: (google.maps.places.PlaceResult & GooglePlaceContactFields) | null,
  distanceText: string,
): MapPoiSnapshot | null => {
  if (!place) return null;
  return {
    place_id: place.place_id,
    name: place.name || '',
    formatted_address: place.formatted_address || place.vicinity || '',
    address: place.formatted_address || place.vicinity || '',
    formatted_phone_number: pickFormattedPhoneNumber(place),
    website: pickPlaceWebsite(place),
    rating: place.rating,
    user_ratings_total: place.user_ratings_total,
    business_status: place.business_status,
    types: place.types || [],
    distance: distanceText || '',
    distance_meters: parseDistanceTextToMeters(distanceText),
  };
};

export const toJudgeTravelMode = (mode: 'driving' | 'transit' | 'walking' | 'cycling'): string => {
  if (mode === 'walking') return 'WALKING';
  if (mode === 'cycling') return 'BICYCLING';
  if (mode === 'transit') return 'TRANSIT';
  return 'DRIVING';
};

export const PLACE_ABOUT_FIELDS: string[] = [
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'businessStatus',
  'types',
  'primaryType',
  'primaryTypeDisplayName',
  'internationalPhoneNumber',
  'nationalPhoneNumber',
  'websiteURI',
  'regularOpeningHours',
  'currentOpeningHours',
  'editorialSummary',
  'plusCode',
  'accessibilityOptions',
  'paymentOptions',
  'parkingOptions',
  'hasDineIn',
  'hasTakeout',
  'hasDelivery',
  'isReservable',
  'servesBreakfast',
  'servesLunch',
  'servesDinner',
  'servesBrunch',
  'servesBeer',
  'servesWine',
  'servesCocktails',
  'servesCoffee',
  'servesDessert',
  'servesVegetarianFood',
  'hasRestroom',
  'allowsDogs',
  'hasOutdoorSeating',
  'hasLiveMusic',
  'isGoodForWatchingSports',
  'isGoodForChildren',
  'isGoodForGroups',
  'hasMenuForChildren',
];

export type AboutItem = { label: string; value: boolean };
export type AboutSection = { title: string; items: AboutItem[] };

export function extractPlaceAboutData(p: any): Record<string, any> {
  const acc = p.accessibilityOptions;
  const pay = p.paymentOptions;
  const park = p.parkingOptions;
  return {
    hasDineIn: p.hasDineIn ?? null,
    hasTakeout: p.hasTakeout ?? null,
    hasDelivery: p.hasDelivery ?? null,
    isReservable: p.isReservable ?? null,
    servesBreakfast: p.servesBreakfast ?? null,
    servesLunch: p.servesLunch ?? null,
    servesDinner: p.servesDinner ?? null,
    servesBeer: p.servesBeer ?? null,
    servesWine: p.servesWine ?? null,
    servesBrunch: p.servesBrunch ?? null,
    servesCocktails: p.servesCocktails ?? null,
    servesCoffee: p.servesCoffee ?? null,
    servesDessert: p.servesDessert ?? null,
    servesVegetarianFood: p.servesVegetarianFood ?? null,
    accessibility: acc
      ? {
          wheelchairEntrance: acc.hasWheelchairAccessibleEntrance ?? acc.wheelchairAccessibleEntrance ?? null,
          wheelchairParking: acc.hasWheelchairAccessibleParking ?? acc.wheelchairAccessibleParking ?? null,
          wheelchairRestroom: acc.hasWheelchairAccessibleRestroom ?? acc.wheelchairAccessibleRestroom ?? null,
          wheelchairSeating: acc.hasWheelchairAccessibleSeating ?? acc.wheelchairAccessibleSeating ?? null,
        }
      : undefined,
    payment: pay
      ? {
          creditCards: pay.acceptsCreditCards ?? null,
          debitCards: pay.acceptsDebitCards ?? null,
          cashOnly: pay.acceptsCashOnly ?? null,
          nfc: pay.acceptsNFC ?? pay.acceptsNfc ?? null,
        }
      : undefined,
    parking: park
      ? {
          freeParking: park.hasFreeParkingLot ?? park.freeParkingLot ?? null,
          paidParking: park.hasPaidParkingLot ?? park.paidParkingLot ?? null,
          streetParking: park.hasFreeStreetParking ?? park.freeStreetParking ?? park.hasPaidStreetParking ?? park.paidStreetParking ?? null,
          valetParking: park.hasValetParking ?? park.valetParking ?? null,
          garageParking: park.hasFreeGarageParking ?? park.freeGarageParking ?? park.hasPaidGarageParking ?? park.paidGarageParking ?? null,
        }
      : undefined,
    hasLiveMusic: p.hasLiveMusic ?? null,
    isGoodForWatchingSports: p.isGoodForWatchingSports ?? null,
    hasOutdoorSeating: p.hasOutdoorSeating ?? null,
    hasRestroom: p.hasRestroom ?? null,
    allowsDogs: p.allowsDogs ?? null,
    isGoodForChildren: p.isGoodForChildren ?? null,
    hasMenuForChildren: p.hasMenuForChildren ?? null,
    isGoodForGroups: p.isGoodForGroups ?? null,
  };
}

export function buildAboutSections(
  about: Record<string, any> | undefined,
  locale: Locale = 'zh-Hans',
): AboutSection[] {
  if (!about) return [];
  const t = getMapStrings(locale);
  const sections: AboutSection[] = [];

  const svc: AboutItem[] = [];
  if (about.hasDineIn === true) svc.push({ label: t.about_dine_in, value: true });
  if (about.hasTakeout === true) svc.push({ label: t.about_takeout, value: true });
  if (about.hasDelivery === true) svc.push({ label: t.about_delivery, value: true });
  if (about.isReservable === true) svc.push({ label: t.about_reservable, value: true });
  if (about.servesBreakfast === true) svc.push({ label: t.about_serves_breakfast, value: true });
  if (about.servesLunch === true) svc.push({ label: t.about_serves_lunch, value: true });
  if (about.servesDinner === true) svc.push({ label: t.about_serves_dinner, value: true });
  if (about.servesBrunch === true) svc.push({ label: t.about_serves_brunch, value: true });
  if (about.servesCoffee === true) svc.push({ label: t.about_serves_coffee, value: true });
  if (about.servesDessert === true) svc.push({ label: t.about_serves_dessert, value: true });
  if (about.servesBeer === true) svc.push({ label: t.about_serves_beer, value: true });
  if (about.servesWine === true) svc.push({ label: t.about_serves_wine, value: true });
  if (about.servesCocktails === true) svc.push({ label: t.about_serves_cocktails, value: true });
  if (about.servesVegetarianFood === true) svc.push({ label: t.about_serves_vegetarian, value: true });
  if (svc.length) sections.push({ title: t.about_service_options, items: svc });

  const acc = about.accessibility;
  if (acc) {
    const items: AboutItem[] = [];
    if (acc.wheelchairEntrance === true) items.push({ label: t.about_wheelchair_entrance, value: true });
    if (acc.wheelchairParking === true) items.push({ label: t.about_wheelchair_parking, value: true });
    if (acc.wheelchairRestroom === true) items.push({ label: t.about_wheelchair_restroom, value: true });
    if (acc.wheelchairSeating === true) items.push({ label: t.about_wheelchair_seating, value: true });
    if (items.length) sections.push({ title: t.about_accessibility, items });
  }

  const activities: AboutItem[] = [];
  if (about.hasOutdoorSeating === true) activities.push({ label: t.about_outdoor_seating, value: true });
  if (about.hasLiveMusic === true) activities.push({ label: t.about_live_music, value: true });
  if (about.isGoodForWatchingSports === true) activities.push({ label: t.about_good_for_sports, value: true });
  if (activities.length) sections.push({ title: t.about_activities, items: activities });

  const facilities: AboutItem[] = [];
  if (about.hasRestroom === true) facilities.push({ label: t.about_restroom, value: true });
  if (about.isGoodForGroups === true) facilities.push({ label: t.about_good_for_groups, value: true });
  if (facilities.length) sections.push({ title: t.about_amenities, items: facilities });

  const park = about.parking;
  if (park) {
    const items: AboutItem[] = [];
    if (park.freeParking === true) items.push({ label: t.about_free_parking, value: true });
    if (park.paidParking === true) items.push({ label: t.about_paid_parking, value: true });
    if (park.streetParking === true) items.push({ label: t.about_street_parking, value: true });
    if (park.garageParking === true) items.push({ label: t.about_garage_parking, value: true });
    if (park.valetParking === true) items.push({ label: t.about_valet_parking, value: true });
    if (items.length) sections.push({ title: t.about_parking, items });
  }

  const pay = about.payment;
  if (pay) {
    const items: AboutItem[] = [];
    if (pay.debitCards === true) items.push({ label: t.about_debit_cards, value: true });
    if (pay.creditCards === true) items.push({ label: t.about_credit_cards, value: true });
    if (pay.nfc === true) items.push({ label: t.about_nfc_payments, value: true });
    if (pay.cashOnly === true) items.push({ label: t.about_cash_only, value: true });
    if (items.length) sections.push({ title: t.about_payments, items });
  }

  const children: AboutItem[] = [];
  if (about.isGoodForChildren === true) children.push({ label: t.about_good_for_children, value: true });
  if (about.hasMenuForChildren === true) children.push({ label: t.about_kids_menu, value: true });
  if (children.length) sections.push({ title: t.about_children, items: children });

  const pets: AboutItem[] = [];
  if (about.allowsDogs === true) pets.push({ label: t.about_dogs_allowed, value: true });
  if (pets.length) sections.push({ title: t.about_pets, items: pets });

  return sections;
}

export const DAY_NAMES_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatCnAmpmTime(hour: number, minute: number): string {
  const period = hour >= 12 ? '下午' : '上午';
  const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${period}${h12}:${String(minute).padStart(2, '0')}`;
}

/** 24 小时制 HH:mm（与系统「24 小时制」展示一致） */
export function format24hTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function getNextOpeningDate(now: Date, open: { day: number; hour: number; minute: number }): Date {
  const target = fromTimestamp(now.getTime());
  const currentDay = now.getDay();
  const addDays = (open.day - currentDay + 7) % 7;
  target.setDate(now.getDate() + addDays);
  target.setHours(open.hour, open.minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 7);
  }
  return target;
}

export function findNextOpeningLabel(
  periods: any[],
  now: Date,
  locale: Locale = 'zh-Hans',
): string | null {
  if (!periods?.length) return null;
  let best: Date | null = null;
  for (const pr of periods) {
    if (!pr?.open) continue;
    const next = getNextOpeningDate(now, pr.open);
    if (!best || next.getTime() < best.getTime()) best = next;
  }
  if (!best) return null;
  const dayName = locale === 'en' ? DAY_NAMES_EN[best.getDay()] : DAY_NAMES_ZH[best.getDay()];
  return `${dayName}${format24hTime(best.getHours(), best.getMinutes())}`;
}

/** 与 Google Maps 一致：营业中/已结束营业、结束时间、下次开始时间 */
export function computeOpeningStatusFromPeriods(
  hrs: { periods: any[] },
  now: Date,
  locale: Locale = 'zh-Hans',
): { isOpen: boolean; closesAt: string | null; opensNextLabel: string | null } {
  const periods = hrs?.periods;
  if (!periods?.length) {
    return { isOpen: false, closesAt: null, opensNextLabel: null };
  }
  const day = now.getDay();
  const hhmm = now.getHours() * 100 + now.getMinutes();
  let closesAt: string | null = null;
  let isOpen = false;
  for (const pr of periods) {
    if (pr.open?.day !== day) continue;
    const o = pr.open.hour * 100 + pr.open.minute;
    const c = pr.close ? pr.close.hour * 100 + pr.close.minute : 2400;
    if (hhmm >= o && hhmm < c) {
      isOpen = true;
      if (pr.close) {
        closesAt = format24hTime(pr.close.hour, pr.close.minute);
      }
      break;
    }
  }
  const opensNextLabel = isOpen ? null : findNextOpeningLabel(periods, now, locale);
  return { isOpen, closesAt, opensNextLabel };
}

/** 系统 locale → Google Maps API languageCode */
export function googleLangCode(locale: 'zh-Hans' | 'en' = 'zh-Hans'): string {
  return locale === 'en' ? 'en' : 'zh-CN';
}

/** Place 构造器用 requestedLanguage 参数 */
export function placeRequestedLanguage(locale: 'zh-Hans' | 'en' = 'zh-Hans'): { requestedLanguage: string } {
  return { requestedLanguage: googleLangCode(locale) };
}

/** weekdayDescriptions 为 API 本地化字符串；仅按首处冒号分列排版 */
export function splitWeekdayDescriptionLine(desc: string): { left: string; right: string | null } {
  const m = String(desc).match(/^([^:：]+)[:：]\s*(.+)$/);
  if (m) return { left: m[1].trim(), right: m[2].trim() };
  return { left: desc, right: null };
}

/**
 * formattedAddress 有时会把短 Plus Code 嵌进正文（如 …圆明园275X+67P 邮政编码…）。
 * compoundCode 单独展示在展开区；主行应去掉嵌入片段，避免重复。
 */
export function stripEmbeddedPlusCodeFromAddress(address: string, compoundCode: string | null | undefined): string {
  if (!address) return '';
  let out = address.trim();
  if (compoundCode) {
    const localPart = compoundCode.split(/\s+/)[0]?.trim();
    if (localPart && localPart.includes('+')) {
      const escaped = localPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(escaped, 'gi'), '');
    }
  }
  // 兜底：Open Location Code 短码（约 4+2/3 位），与 compoundCode 首段可能不一致时仍剥离
  const olcShort = /\s*[23456789CFGHJKLMNPQRSTVWXY]{4,8}\+[23456789CFGHJKLMNPQRSTVWXY]{2,3}\s*/gi;
  out = out.replace(olcShort, ' ');
  return out.replace(/\s{2,}/g, ' ').trim();
}

/**
 * 将完整格式化地址裁成更接近 Google 地图卡片风格的短地址。
 * 优先保留道路 / 门牌 / POI 附近信息，去掉国家、省市区等行政前缀。
 */
export function formatShortDisplayAddress(address: string | null | undefined): string {
  const original = String(address || '').trim();
  if (!original) return '';

  let out = stripEmbeddedPlusCodeFromAddress(original, null)
    .replace(/^中国/, '')
    .replace(/[，,]\s*中国$/, '')
    .replace(/\s*邮政编码[:：]?\s*\d{6}\s*$/u, '')
    .trim();

  const administrativePrefixes = [
    /^(北京市|上海市|天津市|重庆市|香港特别行政区|澳门特别行政区)/u,
    /^[^省]+省/u,
    /^[^自治区]+自治区/u,
    /^[^特别行政区]+特别行政区/u,
    /^[^市]+市/u,
    /^[^区县旗]+区/u,
    /^[^区县旗]+县/u,
    /^[^旗]+旗/u,
  ];

  for (const pattern of administrativePrefixes) {
    const shortened = out.replace(pattern, '').trim();
    if (shortened && shortened.length >= 4) {
      out = shortened;
    }
  }

  return out || original;
}
