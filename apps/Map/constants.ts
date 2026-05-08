import type { LucideIcon } from 'lucide-react';
import type { Locale } from '@/os/locale';
import type { StringKey } from './res/strings';
import { IcHome, IcFood, IcMountain, IcHotel, IcCoffee, IcFuel, IcShop, IcGrocery } from './res/icons';

export interface CategoryItem {
  icon: LucideIcon;
  labelKey: StringKey;
  searchType: string;
}

export const EXPLORE_CATEGORIES: CategoryItem[] = [
  { icon: IcFood,     labelKey: 'category_restaurant',         searchType: 'restaurant' },
  { icon: IcMountain, labelKey: 'category_attraction',         searchType: 'tourist_attraction' },
  { icon: IcHotel,    labelKey: 'category_hotel',              searchType: 'lodging' },
  { icon: IcCoffee,   labelKey: 'category_cafe',               searchType: 'cafe' },
  { icon: IcFuel,     labelKey: 'category_gas_station_short',  searchType: 'gas_station' },
  { icon: IcShop,     labelKey: 'category_shopping',           searchType: 'shopping_mall' },
  { icon: IcGrocery,  labelKey: 'category_grocery',            searchType: 'grocery_store' },
];

// Places API type → 中文映射（含 Table A 新类型 + legacy Table 1）
const PLACE_TYPE_LABELS: Record<string, string> = {
  // 餐饮细分（New API primaryType）
  chinese_restaurant: '中国风味',
  japanese_restaurant: '日本料理',
  korean_restaurant: '韩国料理',
  indian_restaurant: '印度菜',
  italian_restaurant: '意大利菜',
  thai_restaurant: '泰国菜',
  vietnamese_restaurant: '越南菜',
  american_restaurant: '美式餐厅',
  french_restaurant: '法国菜',
  mexican_restaurant: '墨西哥菜',
  mediterranean_restaurant: '地中海菜',
  seafood_restaurant: '海鲜',
  barbecue_restaurant: '烧烤',
  fast_food_restaurant: '快餐',
  hamburger_restaurant: '汉堡',
  pizza_restaurant: '披萨',
  ramen_restaurant: '拉面',
  sushi_restaurant: '寿司',
  steak_house: '牛排',
  vegetarian_restaurant: '素食',
  brunch_restaurant: '早午餐',
  ice_cream_shop: '冰淇淋',
  sandwich_shop: '三明治',
  coffee_shop: '咖啡店',
  tea_house: '茶馆',
  // Legacy Table 1
  restaurant: '餐馆',
  cafe: '咖啡馆',
  bar: '酒吧',
  bakery: '面包店',
  meal_delivery: '外卖',
  meal_takeaway: '外带',
  lodging: '酒店',
  tourist_attraction: '景点',
  gas_station: '加油站',
  shopping_mall: '购物中心',
  store: '商店',
  convenience_store: '便利店',
  grocery_store: '杂货店',
  supermarket: '超市',
  clothing_store: '服饰店',
  department_store: '百货商店',
  electronics_store: '电子产品',
  furniture_store: '家具店',
  book_store: '书店',
  pet_store: '宠物店',
  shoe_store: '鞋店',
  jewelry_store: '珠宝店',
  florist: '花店',
  pharmacy: '药店',
  drugstore: '药房',
  hospital: '医院',
  doctor: '诊所',
  dentist: '牙科',
  bank: '银行',
  atm: 'ATM',
  parking: '停车场',
  school: '学校',
  primary_school: '小学',
  secondary_school: '中学',
  university: '大学',
  library: '图书馆',
  museum: '博物馆',
  park: '公园',
  gym: '健身房',
  spa: '水疗',
  beauty_salon: '美容院',
  hair_care: '美发',
  movie_theater: '电影院',
  night_club: '夜店',
  laundry: '洗衣店',
  car_repair: '汽修',
  car_wash: '洗车',
  car_dealer: '汽车经销商',
  car_rental: '租车',
  subway_station: '地铁站',
  bus_station: '公交站',
  train_station: '火车站',
  transit_station: '公交枢纽',
  light_rail_station: '轻轨站',
  airport: '机场',
  taxi_stand: '出租车站',
  post_office: '邮局',
  police: '警察局',
  fire_station: '消防站',
  church: '教堂',
  mosque: '清真寺',
  hindu_temple: '印度教寺庙',
  synagogue: '犹太教堂',
  travel_agency: '旅行社',
  real_estate_agency: '房产中介',
  insurance_agency: '保险',
  accounting: '会计',
  lawyer: '律师',
  locksmith: '开锁',
  veterinary_care: '宠物医院',
  zoo: '动物园',
  aquarium: '水族馆',
  amusement_park: '游乐园',
  campground: '露营地',
  bowling_alley: '保龄球馆',
  stadium: '体育场',
  casino: '赌场',
  liquor_store: '酒类专卖',
  home_goods_store: '家居用品',
  hardware_store: '五金店',
};

const GENERIC_TYPES = new Set([
  'establishment', 'point_of_interest', 'premise', 'political',
  'geocode', 'street_address', 'route', 'locality',
  'sublocality', 'sublocality_level_1', 'sublocality_level_2',
  'sublocality_level_3', 'sublocality_level_4', 'sublocality_level_5',
  'neighborhood', 'colloquial_area',
  'administrative_area_level_1', 'administrative_area_level_2',
  'country', 'postal_code', 'postal_code_prefix', 'postal_code_suffix',
  'postal_town', 'plus_code', 'floor', 'room', 'subpremise',
  'street_number', 'town_square', 'natural_feature',
  'food', 'health', 'finance', 'general_contractor', 'place_of_worship',
]);

/**
 * 从 Place 类型信息推导展示标签。
 * 中文优先使用自有映射；英文优先使用 API displayName，缺失时再把 snake_case 转为标题文本。
 */
export function getPlaceTypeLabel(
  types: string[] | undefined,
  primaryType?: string | null,
  primaryTypeDisplayName?: string | null,
  locale: Locale = 'zh-Hans',
): string {
  const humanizeType = (value: string) => value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  if (locale === 'en') {
    if (primaryTypeDisplayName) return primaryTypeDisplayName;
    if (primaryType) return humanizeType(primaryType);
    if (!types?.length) return 'Place';
    for (const t of types) {
      if (GENERIC_TYPES.has(t)) continue;
      return humanizeType(t);
    }
    return 'Place';
  }

  if (primaryType && PLACE_TYPE_LABELS[primaryType]) return PLACE_TYPE_LABELS[primaryType];
  if (primaryTypeDisplayName) return primaryTypeDisplayName;
  if (!types?.length) return '地点';
  for (const t of types) {
    if (GENERIC_TYPES.has(t)) continue;
    if (PLACE_TYPE_LABELS[t]) return PLACE_TYPE_LABELS[t];
  }
  return '地点';
}

/**
 * 矢量地图 Map ID，启用 AdvancedMarkerElement 所必需。
 * 在 Google Cloud Console 创建 Map（JavaScript 类型）后，可通过 VITE_GOOGLE_MAP_ID 覆盖；
 * 未配置时使用官方文档中的 DEMO_MAP_ID 便于本地调试。
 */
export const GOOGLE_MAP_VECTOR_MAP_ID =
  (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined) || 'DEMO_MAP_ID';
