export interface ShoppingItem {
  id: string;
  name: string;
  rating?: number;
  ratingCount?: number; // 0 means "无评价"
  category: string;
  types?: string[];
  primaryType?: string;
  distance: number; // meters
  address: string;
  status: 'Open' | 'Closed';
  /** 基于 regularOpeningHours 判定的"此刻是否在营业时间内"，undefined 表示无数据 */
  openNow?: boolean;
  /** 当日结束营业时间（如 "下午10:00"），仅 openNow===true 时有值 */
  closesAt?: string;
  /** 下次开始营业标签（如 "周一09:00"），仅 openNow===false 时有值 */
  opensNextLabel?: string;
  lat: number;
  lng: number;
}

/** Google Places（旧 PlaceResult / 新 Place.fetchFields）里可能出现的联系信息字段 */
export type GooglePlaceContactFields = {
  formatted_phone_number?: string;
  internationalPhoneNumber?: string;
  international_phone_number?: string;
  formattedPhoneNumber?: string;
  /** JS Places SDK */
  websiteURI?: string;
  /** Places API REST JSON */
  websiteUri?: string;
  website_uri?: string;
  website?: string;
};

/** bench / active_poi 侧使用的 POI 快照（字段名与任务约定对齐） */
export type MapPoiSnapshot = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  distance?: string;
  distance_meters?: number | null;
};

export function pickFormattedPhoneNumber(place: GooglePlaceContactFields): string | undefined {
  return (
    place.formatted_phone_number ||
    place.formattedPhoneNumber ||
    place.internationalPhoneNumber ||
    place.international_phone_number ||
    undefined
  );
}

export function pickPlaceWebsite(place: GooglePlaceContactFields): string | undefined {
  return place.websiteURI || place.websiteUri || place.website_uri || place.website || undefined;
}

