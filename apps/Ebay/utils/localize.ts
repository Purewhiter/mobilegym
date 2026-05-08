import type { Locale } from '@/os/locale';
import type { CategoryDef } from '../data/loader';
import type { ProductItem } from '../types';

const CATEGORY_LABEL_MAP: Record<string, string> = {
  'eBay 汽车': 'eBay Motors',
  '电子产品': 'Electronics',
  '收藏品和艺术品': 'Collectibles & Art',
  '收藏品': 'Collectibles',
  '家庭和花园': 'Home & Garden',
  '服装、鞋子和配饰': 'Clothing, Shoes & Accessories',
  '玩具和爱好': 'Toys & Hobbies',
  '运动用品': 'Sporting Goods',
  '书籍、电影和音乐': 'Books, Movies & Music',
  '健康与美容': 'Health & Beauty',
  '商业和工业': 'Business & Industrial',
  '珠宝和手表': 'Jewelry & Watches',
  '婴儿必需品': 'Baby Essentials',
  '宠物用品': 'Pet Supplies',
  '机票及旅游': 'Tickets & Travel',
  '礼品卡和优惠券': 'Gift Cards & Coupons',
  '其他一切': 'Everything Else',
  '房地产': 'Real Estate',
  '专业服务': 'Specialty Services',
  '集换卡': 'Trading Cards',
  '全新电子产品': 'Brand-new Electronics',
};

const TYPE_LABEL_MAP: Record<string, string> = {
  '电风扇': 'Fans',
  '电脑': 'Computers',
  '电视': 'TVs',
  '手表': 'Watches',
  '手机': 'Phones',
  '平板': 'Tablets',
  '相机': 'Cameras',
  '耳机': 'Headphones',
  '沙发': 'Sofas',
  '灯具': 'Lighting',
  '书桌': 'Desks',
  '椅子': 'Chairs',
  '吸尘器': 'Vacuums',
  '运动鞋': 'Sneakers',
  '连衣裙': 'Dresses',
  '太阳镜': 'Sunglasses',
  '时尚手表': 'Fashion Watches',
  '包袋': 'Handbags',
  '皮卡车': 'Pickup Trucks',
  '散热风扇': 'Radiator Fans',
  '轮胎': 'Tires',
  '发动机零件': 'Engine Parts',
  '哑铃': 'Dumbbells',
  '瑜伽垫': 'Yoga Mats',
  '自行车': 'Bicycles',
  '跑步机': 'Treadmills',
  '宠物床': 'Pet Beds',
  '狗粮': 'Dog Food',
  '猫砂': 'Cat Litter',
  '机票': 'Air Tickets',
  '行李箱': 'Luggage',
  '礼品卡': 'Gift Cards',
  '代金券': 'Vouchers',
  '腕表': 'Wristwatches',
  '戒指': 'Rings',
  '项链': 'Necklaces',
};

const LOCATION_LABEL_MAP: Record<string, string> = {
  '中国': 'China',
  '日本': 'Japan',
  '韩国': 'South Korea',
  '印度': 'India',
  '美国': 'United States',
  '加拿大': 'Canada',
  '墨西哥': 'Mexico',
  '英国': 'United Kingdom',
  '德国': 'Germany',
  '法国': 'France',
  '意大利': 'Italy',
  '西班牙': 'Spain',
  '澳大利亚': 'Australia',
  '新西兰': 'New Zealand',
  '巴西': 'Brazil',
  '亚洲': 'Asia',
  '北美洲': 'North America',
  '欧洲': 'Europe',
  '大洋洲': 'Oceania',
  '南美洲': 'South America',
};

const CONDITION_LABEL_MAP: Record<string, string> = {
  '全新': 'New',
  '二手': 'Pre-owned',
  '翻新': 'Refurbished',
  '未指明': 'Unspecified',
};

const BUYING_FORMAT_LABEL_MAP: Record<string, { zh: string; en: string }> = {
  all: { zh: '全部物品', en: 'All Listings' },
  auction: { zh: '拍卖', en: 'Auction' },
  buyItNow: { zh: '立即购买', en: 'Buy It Now' },
  offer: { zh: '议价', en: 'Best Offer' },
};

const SORT_LABEL_MAP: Record<string, { zh: string; en: string }> = {
  bestMatch: { zh: '最佳匹配', en: 'Best Match' },
  priceLow: { zh: '最低价 + 运费优先', en: 'Lowest Price + Shipping' },
  priceHigh: { zh: '最高价 + 运费优先', en: 'Highest Price + Shipping' },
  endingSoon: { zh: '最快结束优先', en: 'Ending Soonest' },
  newlyListed: { zh: '新刊登优先', en: 'Newly Listed' },
  distance: { zh: '距离：最近优先', en: 'Distance: Nearest First' },
};

const TITLE_REPLACEMENTS = [
  ...Object.entries(CATEGORY_LABEL_MAP),
  ...Object.entries(TYPE_LABEL_MAP),
].sort((a, b) => b[0].length - a[0].length);

export function isEnglish(locale: Locale): boolean {
  return locale === 'en';
}

export function localizeEbayCategoryLabel(label: string, locale: Locale): string {
  if (!isEnglish(locale)) return label;
  return CATEGORY_LABEL_MAP[label] ?? label;
}

export function localizeEbayTypeLabel(label: string, locale: Locale): string {
  if (!isEnglish(locale)) return label;
  return TYPE_LABEL_MAP[label] ?? label;
}

export function localizeEbayLocationLabel(label: string | null, locale: Locale): string {
  if (label == null) return isEnglish(locale) ? 'Preset' : '预设值';
  if (!isEnglish(locale)) return label;
  return LOCATION_LABEL_MAP[label] ?? label;
}

export function localizeEbayConditionLabel(label: string, locale: Locale): string {
  if (!isEnglish(locale)) return label;
  return CONDITION_LABEL_MAP[label] ?? label;
}

export function localizeEbayBuyingFormatLabel(label: string, locale: Locale): string {
  const entry = BUYING_FORMAT_LABEL_MAP[label];
  if (!entry) return label;
  return isEnglish(locale) ? entry.en : entry.zh;
}

export function localizeEbaySortLabel(label: string, locale: Locale): string {
  const entry = SORT_LABEL_MAP[label];
  if (!entry) return label;
  return isEnglish(locale) ? entry.en : entry.zh;
}

export function localizeEbayProductTitle(title: string, locale: Locale): string {
  if (!isEnglish(locale)) return title;
  let localized = title;
  for (const [source, target] of TITLE_REPLACEMENTS) {
    localized = localized.replaceAll(source, target);
  }
  return localized;
}

export function localizeEbayCategories(categories: CategoryDef[], locale: Locale): CategoryDef[] {
  if (!isEnglish(locale)) return categories;
  return categories.map((category) => ({
    ...category,
    label: localizeEbayCategoryLabel(category.label, locale),
    types: category.types.map((type) => ({
      ...type,
      label: localizeEbayTypeLabel(type.label, locale),
    })),
  }));
}

export function buildEbaySearchHaystack(product: ProductItem): string {
  const englishTitle = localizeEbayProductTitle(product.title, 'en');
  const englishCategory = localizeEbayCategoryLabel(product.categoryLabel, 'en');
  const englishType = localizeEbayTypeLabel(product.typeLabel, 'en');
  const englishCondition = localizeEbayConditionLabel(product.condition, 'en');
  const englishLocation = localizeEbayLocationLabel(product.location, 'en');
  return [
    product.title,
    englishTitle,
    product.brand,
    product.categoryLabel,
    englishCategory,
    product.typeLabel,
    englishType,
    product.condition,
    englishCondition,
    product.location,
    englishLocation,
  ].join(' ');
}
