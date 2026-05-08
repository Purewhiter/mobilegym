import type { strings } from '../res/strings';

type RailwayStrings = typeof strings;

const NAME_KEY_BY_ID: Record<string, keyof RailwayStrings> = {
  station_screen: 'service_station_screen',
  commuter_pass: 'service_commuter_pass',
  ecard: 'service_ecard',
  timetable: 'service_timetable',
  warm_service: 'service_warm_service',
  air_rail: 'service_air_rail',
  elder: 'service_elder',
  hotel: 'service_hotel',
  hotel_2: 'service_hotel',
  car_rental: 'service_car_rental',
  tourism: 'service_tourism',
  food: 'service_food',
  bus_ship: 'service_bus_ship',
  mall: 'service_mall',
  invoice: 'service_invoice',
  insurance: 'service_insurance',
  bus_ticket: 'service_bus_ticket',
  accident_insurance: 'service_accident_insurance',
  water_rail: 'service_water_rail',
  express: 'service_express',
  ski: 'service_ski',
  ship: 'service_ship',
  pet: 'service_pet_transport',
  pet_transport: 'service_pet_transport',
  light_travel: 'service_light_travel',
  unicom: 'service_unicom_gift',
  crt: 'service_crt',
  auto_transport: 'service_auto_transport',
  food_order: 'order_food',
  insurance_order: 'order_insurance',
  hotel_order: 'order_hotel',
  air_rail_order: 'order_air_rail',
  commuter_order: 'order_commuter',
  car_order: 'order_car_rental',
  business_order: 'order_business_class',
  mall_order: 'order_mall',
  bus_order: 'order_bus',
  tour_order: 'order_tour',
  water_order: 'order_water_rail',
  ship_order: 'order_ship',
  pet_order: 'order_pet',
  sale_time: 'guide_sale_time',
  delay_check: 'guide_delay_check',
  price_check: 'guide_price_check',
  transfer_time: 'guide_transfer_time',
  agency: 'guide_agency',
  more: 'guide_more',
  quick_refund: 'guide_quick_refund',
  contact: 'guide_contact',
  station_nav: 'guide_station_nav',
  train_status: 'guide_train_status',
  id_verify: 'func_id_verify',
  fingerprint: 'func_fingerprint',
  change_password: 'func_change_password',
  change_phone: 'func_change_phone',
  notifications: 'func_notifications',
  student_verify: 'func_student_verify',
  elder_mode: 'service_elder',
  temp_id: 'warm_temp_id',
  lost_found: 'warm_lost_found',
  suggestion: 'warm_suggestion',
  complaint: 'warm_complaint',
  special_passenger: 'warm_special_passenger',
  service_phone: 'warm_service_phone',
  foreign_service: 'warm_foreign_service',
  announcement: 'info_announcement',
  faq: 'info_faq',
  usage_notice: 'info_usage_notice',
  service_rules: 'info_service_rules',
  railway_insurance: 'info_railway_insurance',
  about: 'info_about',
  points: 'member_points_title',
  exchange: 'member_exchange_title',
  waitlist: 'member_waitlist_title',
  activity: 'member_activity_title',
};

const DESC_KEY_BY_ID: Record<string, keyof RailwayStrings> = {
  points: 'member_points_desc',
  exchange: 'member_exchange_desc',
  waitlist: 'member_waitlist_desc',
  activity: 'member_activity_desc',
};

const REGION_NAME_MAP: Record<string, string> = {
  '哈尔滨铁路客户服务中心': 'Harbin Railway Customer Service Center',
  '沈阳铁路客户服务中心': 'Shenyang Railway Customer Service Center',
  '北京铁路客户服务中心': 'Beijing Railway Customer Service Center',
  '太原铁路客户服务中心': 'Taiyuan Railway Customer Service Center',
  '呼和浩特铁路客户服务中心': 'Hohhot Railway Customer Service Center',
  '郑州铁路客户服务中心': 'Zhengzhou Railway Customer Service Center',
  '武汉铁路客户服务中心': 'Wuhan Railway Customer Service Center',
  '西安铁路客户服务中心': "Xi'an Railway Customer Service Center",
  '济南铁路客户服务中心': 'Jinan Railway Customer Service Center',
  '上海铁路客户服务中心': 'Shanghai Railway Customer Service Center',
  '南昌铁路客户服务中心': 'Nanchang Railway Customer Service Center',
  '广州铁路客户服务中心': 'Guangzhou Railway Customer Service Center',
  '南宁铁路客户服务中心': 'Nanning Railway Customer Service Center',
  '成都铁路客户服务中心': 'Chengdu Railway Customer Service Center',
  '昆明铁路客户服务中心': 'Kunming Railway Customer Service Center',
  '兰州铁路客户服务中心': 'Lanzhou Railway Customer Service Center',
  '乌鲁木齐铁路客户服务中心': 'Urumqi Railway Customer Service Center',
  '青藏铁路客户服务中心': 'Qinghai-Tibet Railway Customer Service Center',
};

const STATUS_MAP: Record<string, string> = {
  '正在候车': 'Boarding',
  '正点': 'On time',
  '早点': 'Early',
  '晚点': 'Delayed',
  '已开启': 'On',
};

const TEXT_MAP: Record<string, string> = {
  ...STATUS_MAP,
  '已通过': 'Verified',
  '已核验': 'Verified',
  '未通过核验': 'Not verified',
  '企业': 'Business',
  '个人/非企业': 'Personal / Non-business',
  '身份证': 'Resident ID Card',
  '中国居民身份证': 'Mainland China Resident ID Card',
  '港澳居民来往内地通行证': 'Mainland Travel Permit for HK/Macao Residents',
  '台湾居民来往大陆通行证': 'Mainland Travel Permit for Taiwan Residents',
  '护照': 'Passport',
  '学生': 'Student',
  '成人': 'Adult',
  '儿童': 'Child',
  '学生票': 'Student Fare',
  '成人票': 'Adult Fare',
  '残疾军人': 'Disabled veteran',
  '二等座': 'Second Class',
  '一等座': 'First Class',
  '商务座': 'Business Class',
  '无座': 'No Seat',
  '硬座': 'Hard Seat',
  '软座': 'Soft Seat',
  '硬卧': 'Hard Sleeper',
  '软卧': 'Soft Sleeper',
  '动卧': 'Sleeper',
  '高软': 'Premium Sleeper',
  '一等卧': 'First Sleeper',
  '二等卧': 'Second Sleeper',
  '非现金支付': 'Cashless',
  '线上购买': 'Online purchase',
  '已支付': 'Paid',
  '车上已检': 'Checked on board',
  '不对号入座': 'Unreserved seat',
};

export function localizeRailwayItemName(id: string, fallback: string, s: RailwayStrings): string {
  const key = NAME_KEY_BY_ID[id];
  return key ? s[key] : fallback;
}

export function localizeRailwayItemDescription(id: string, fallback: string, s: RailwayStrings): string {
  const key = DESC_KEY_BY_ID[id];
  return key ? s[key] : fallback;
}

export function localizeRailwayItemTag(tag: string | undefined, s: RailwayStrings): string | undefined {
  if (!tag) return undefined;
  if (tag === '限时优惠') return s.tag_limited_offer;
  return tag;
}

export function localizeRailwayPhoneRegion(region: string, isEnglish: boolean): string {
  if (!isEnglish) return region;
  return REGION_NAME_MAP[region] || region;
}

export function localizeRailwayStatus(status: string, isEnglish: boolean): string {
  if (!isEnglish) return status;
  return STATUS_MAP[status] || status;
}

export function localizeRailwayText(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return TEXT_MAP[value] || value;
}
