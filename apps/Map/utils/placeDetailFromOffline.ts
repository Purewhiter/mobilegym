import { extractPlaceAboutData } from './placeUtils';
import type { GooglePlaceContactFields } from '../types';
import { pickFormattedPhoneNumber, pickPlaceWebsite } from '../types';
import type { OfflinePlaceRow } from './offlinePlaceStore';
import type { Locale } from '../../../os/locale';

/** 内部双语文本对 */
type BiText = { zh: string; en: string };

function pickText(field: string | BiText | undefined | null, locale: Locale): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return locale === 'en' ? (field.en || field.zh || '') : (field.zh || field.en || '');
}

function pickTextArr(field: string[] | { zh: string[]; en: string[] } | undefined | null, locale: Locale): string[] {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  return locale === 'en' ? (field.en?.length ? field.en : field.zh || []) : (field.zh?.length ? field.zh : field.en || []);
}

function localizedText(v: unknown, locale: Locale): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'zh' in v && 'en' in v) {
    return pickText(v as BiText, locale);
  }
  if (typeof v === 'object' && v !== null && 'text' in v) {
    return String((v as { text?: string }).text ?? '');
  }
  return undefined;
}

/**
 * 将 REST Places details 与离线行合并为可供 UI 使用的 PlaceResult 形状。
 * locale 参数控制 displayName / formattedAddress / editorialSummary 等字段的语言。
 */
export function buildPlaceDetailResultFromOfflineRow(
  row: OfflinePlaceRow,
  googleNs: typeof google,
  locale: Locale,
): (google.maps.places.PlaceResult & Record<string, unknown>) | null {
  if (!row.details) return null;
  const d = row.details;

  const displayName =
    localizedText(d.displayName, locale) ||
    pickText(row.name as string | BiText, locale);
  const formattedAddress = localizedText(d.formattedAddress, locale) || pickText(row.formattedAddress as string | BiText, locale);
  const loc = new googleNs.maps.LatLng(row.lat, row.lng);

  const editorialRaw = d.editorialSummary;
  let editorialSummary: string | undefined;
  if (editorialRaw) {
    editorialSummary = localizedText(editorialRaw, locale);
  }

  const plusRaw = d.plusCode as { compoundCode?: string } | undefined;
  const plusCode = plusRaw?.compoundCode ?? null;

  const weekdayDescs = d.regularOpeningHours && typeof d.regularOpeningHours === 'object'
    ? (d.regularOpeningHours as Record<string, unknown>).weekdayDescriptions
    : undefined;
  const resolvedWeekdayDescriptions = weekdayDescs
    ? pickTextArr(weekdayDescs as string[] | { zh: string[]; en: string[] }, locale)
    : undefined;

  const openingHoursRaw = d.regularOpeningHours || d.currentOpeningHours || null;
  let regularOpeningHours: unknown = openingHoursRaw;
  if (resolvedWeekdayDescriptions && openingHoursRaw && typeof openingHoursRaw === 'object') {
    regularOpeningHours = { ...openingHoursRaw as object, weekdayDescriptions: resolvedWeekdayDescriptions };
  }

  const raw = d as Record<string, unknown>;
  const aboutSource = {
    ...d,
    displayName,
    websiteURI: raw.websiteURI ?? raw.websiteUri,
    hasDineIn: raw.hasDineIn ?? raw.dineIn,
    hasTakeout: raw.hasTakeout ?? raw.takeout,
    hasDelivery: raw.hasDelivery ?? raw.delivery,
    isReservable: raw.isReservable ?? raw.reservable,
    hasRestroom: raw.hasRestroom ?? raw.restroom,
    hasOutdoorSeating: raw.hasOutdoorSeating ?? raw.outdoorSeating,
    hasLiveMusic: raw.hasLiveMusic ?? raw.liveMusic,
    hasMenuForChildren: raw.hasMenuForChildren ?? raw.menuForChildren,
    isGoodForChildren: raw.isGoodForChildren ?? raw.goodForChildren,
    isGoodForGroups: raw.isGoodForGroups ?? raw.goodForGroups,
    isGoodForWatchingSports: raw.isGoodForWatchingSports ?? raw.goodForWatchingSports,
    accessibilityOptions: d.accessibilityOptions,
    paymentOptions: d.paymentOptions,
    parkingOptions: d.parkingOptions,
  };

  return {
    place_id: row.placeId,
    name: displayName,
    formatted_address: formattedAddress,
    geometry: { location: loc },
    rating: (d.rating as number | undefined) ?? row.rating,
    user_ratings_total: (d.userRatingCount as number | undefined) ?? row.userRatingCount,
    business_status: d.businessStatus as google.maps.places.BusinessStatus | undefined,
    types: (d.types as string[] | undefined) || row.types,
    primaryType: (d.primaryType as string | undefined) || row.primaryType,
    primaryTypeDisplayName: localizedText(d.primaryTypeDisplayName, locale),
    formatted_phone_number:
      (d.nationalPhoneNumber as string | undefined) ||
      pickFormattedPhoneNumber({ ...d, ...row } as GooglePlaceContactFields),
    websiteURI: pickPlaceWebsite({ ...d, ...row } as GooglePlaceContactFields),
    regularOpeningHours: regularOpeningHours as unknown as
      | google.maps.places.PlaceOpeningHours
      | null,
    editorialSummary,
    plusCode,
    _aboutData: extractPlaceAboutData(aboutSource),
  };
}
