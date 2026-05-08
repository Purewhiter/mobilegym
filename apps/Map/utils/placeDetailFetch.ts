import { PLACE_ABOUT_FIELDS, placeRequestedLanguage } from './placeUtils';
import { pickFormattedPhoneNumber, pickPlaceWebsite, type GooglePlaceContactFields } from '../types';
import { extractPlaceAboutData } from './placeUtils';
import { getLocale } from '../locale';
import { cachePlaceDetail, getPlaceDetailOffline, getOfflinePlaceRowName, type OfflinePlaceRow } from './offlinePlaceStore';
import { buildPlaceDetailResultFromOfflineRow } from './placeDetailFromOffline';

/** 将 JS Place.fetchFields 结果序列化为与 REST GET / 快照 `details` 一致的缓存结构 */
function buildOfflinePlaceRowFromFetchedPlace(
  place: google.maps.places.Place & Record<string, unknown>,
): OfflinePlaceRow {
  const loc = place.location;
  if (!loc) {
    throw new Error('place.location missing');
  }
  const lat = loc.lat();
  const lng = loc.lng();
  const details: Record<string, unknown> = {
    displayName: place.displayName,
    formattedAddress: place.formattedAddress,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    businessStatus: place.businessStatus,
    types: place.types,
    primaryType: place.primaryType,
    primaryTypeDisplayName: place.primaryTypeDisplayName,
    internationalPhoneNumber: place.internationalPhoneNumber,
    nationalPhoneNumber: place.nationalPhoneNumber,
    websiteUri: place.websiteUri,
    regularOpeningHours: place.regularOpeningHours,
    currentOpeningHours: place.currentOpeningHours,
    editorialSummary: place.editorialSummary,
    plusCode: place.plusCode,
    accessibilityOptions: place.accessibilityOptions,
    paymentOptions: place.paymentOptions,
    parkingOptions: place.parkingOptions,
    hasDineIn: place.hasDineIn,
    hasTakeout: place.hasTakeout,
    hasDelivery: place.hasDelivery,
    isReservable: place.isReservable,
    servesBreakfast: place.servesBreakfast,
    servesLunch: place.servesLunch,
    servesDinner: place.servesDinner,
    servesBrunch: place.servesBrunch,
    servesBeer: place.servesBeer,
    servesWine: place.servesWine,
    servesCocktails: place.servesCocktails,
    servesCoffee: place.servesCoffee,
    servesDessert: place.servesDessert,
    servesVegetarianFood: place.servesVegetarianFood,
    hasRestroom: place.hasRestroom,
    allowsDogs: place.allowsDogs,
    hasOutdoorSeating: place.hasOutdoorSeating,
    hasLiveMusic: place.hasLiveMusic,
    isGoodForWatchingSports: place.isGoodForWatchingSports,
    isGoodForChildren: place.isGoodForChildren,
    isGoodForGroups: place.isGoodForGroups,
    hasMenuForChildren: place.hasMenuForChildren,
  };
  return {
    placeId: place.id as string,
    name: String(place.displayName ?? ''),
    lat,
    lng,
    rating: place.rating ?? undefined,
    userRatingCount: place.userRatingCount ?? undefined,
    types: (place.types as string[]) || [],
    primaryType: place.primaryType as string | undefined,
    formattedAddress: place.formattedAddress || '',
    internationalPhoneNumber: place.internationalPhoneNumber as string | undefined,
    details,
  };
}

function buildPlaceDetailResultFromFetchedPlace(
  place: google.maps.places.Place & Record<string, unknown>,
): Record<string, unknown> {
  return {
    place_id: place.id,
    name: place.displayName,
    formatted_address: place.formattedAddress,
    geometry: { location: place.location },
    rating: place.rating,
    user_ratings_total: place.userRatingCount,
    business_status: place.businessStatus,
    types: place.types,
    primaryType: place.primaryType,
    primaryTypeDisplayName: place.primaryTypeDisplayName,
    formatted_phone_number:
      (place as { nationalPhoneNumber?: string }).nationalPhoneNumber ||
      pickFormattedPhoneNumber(place as GooglePlaceContactFields),
    websiteURI: pickPlaceWebsite(place as GooglePlaceContactFields),
    regularOpeningHours:
      place.regularOpeningHours || (place as { currentOpeningHours?: unknown }).currentOpeningHours || null,
    editorialSummary: (place as { editorialSummary?: unknown }).editorialSummary,
    plusCode: (place as { plusCode?: { compoundCode?: string } }).plusCode?.compoundCode || null,
    _aboutData: extractPlaceAboutData(place),
  };
}

/**
 * 离线详情（places.json 含 details）优先，否则 Place.fetchFields。
 * 在线路径使用当前系统语言调用 API。
 */
export async function fetchPlaceDetailWithOfflineFirst(options: {
  placeId: string;
  google: typeof google;
}): Promise<Record<string, unknown>> {
  const { placeId, google } = options;
  const locale = getLocale();
  const offlineRow = await getPlaceDetailOffline(placeId);
  if (offlineRow?.details) {
    const fromOffline = buildPlaceDetailResultFromOfflineRow(offlineRow, google, locale);
    if (fromOffline) {
      if (import.meta.env.DEV) {
        console.log(`%c[离线详情] 命中 "${getOfflinePlaceRowName(offlineRow, locale)}" (${placeId.slice(0, 16)}…)`, 'color:#16a34a;font-weight:bold');
      }
      return fromOffline as Record<string, unknown>;
    }
  }

  if (import.meta.env.DEV) {
    console.log(`%c[在线详情] 请求 ${placeId.slice(0, 16)}…`, 'color:#d97706;font-weight:bold');
  }
  const { Place } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
  const place = new Place({ id: placeId, ...placeRequestedLanguage(locale) });
  await place.fetchFields({ fields: PLACE_ABOUT_FIELDS });
  const p = place as google.maps.places.Place & Record<string, unknown>;
  try {
    cachePlaceDetail(buildOfflinePlaceRowFromFetchedPlace(p));
  } catch {
    /* 缓存失败不影响主流程 */
  }
  return buildPlaceDetailResultFromFetchedPlace(p);
}

export { buildPlaceDetailResultFromFetchedPlace };

/** 从详情结果读取坐标（兼容 LatLng 与离线构造） */
export function getLatLngFromPlaceDetailResult(
  result: Record<string, unknown>,
): { lat: number; lng: number } | null {
  const g = result.geometry as { location?: google.maps.LatLng } | undefined;
  const loc = g?.location;
  if (!loc) return null;
  if (typeof loc.lat === 'function') {
    return { lat: loc.lat(), lng: loc.lng() };
  }
  return null;
}
