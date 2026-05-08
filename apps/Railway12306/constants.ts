import { colors } from './res/colors';

export const SERVICE_PHONES = [
  { region: "哈尔滨铁路客户服务中心", areaCode: "0451", phone: "12306" },
  { region: "沈阳铁路客户服务中心", areaCode: "024", phone: "12306" },
  { region: "北京铁路客户服务中心", areaCode: "010", phone: "12306" },
  { region: "太原铁路客户服务中心", areaCode: "0351", phone: "12306" },
  { region: "呼和浩特铁路客户服务中心", areaCode: "0471", phone: "12306" },
  { region: "郑州铁路客户服务中心", areaCode: "0371", phone: "12306" },
  { region: "武汉铁路客户服务中心", areaCode: "027", phone: "12306" },
  { region: "西安铁路客户服务中心", areaCode: "029", phone: "12306" },
  { region: "济南铁路客户服务中心", areaCode: "0531", phone: "12306" },
  { region: "上海铁路客户服务中心", areaCode: "021", phone: "12306" },
  { region: "南昌铁路客户服务中心", areaCode: "0791", phone: "12306" },
  { region: "广州铁路客户服务中心", areaCode: "020", phone: "12306" },
  { region: "南宁铁路客户服务中心", areaCode: "0771", phone: "12306" },
  { region: "成都铁路客户服务中心", areaCode: "028", phone: "12306" },
  { region: "昆明铁路客户服务中心", areaCode: "0871", phone: "12306" },
  { region: "兰州铁路客户服务中心", areaCode: "0931", phone: "12306" },
  { region: "乌鲁木齐铁路客户服务中心", areaCode: "0991", phone: "12306" },
  { region: "青藏铁路客户服务中心", areaCode: "0971", phone: "12306" },
] as const;

export const RAILWAY12306_CONSTANTS = {
  "serviceGrid": [
    {
      "id": "station_screen",
      "name": "车站大屏",
      "icon": "IcMonitor",
      "color": colors.service_icon_blue
    },
    {
      "id": "commuter_pass",
      "name": "计次·定期票",
      "icon": "IcCard",
      "color": colors.service_icon_orange
    },
    {
      "id": "ecard",
      "name": "铁路e卡通",
      "icon": "IcWallet",
      "color": colors.service_icon_green
    },
    {
      "id": "timetable",
      "name": "时刻表",
      "icon": "IcClock",
      "color": colors.service_icon_blue
    },
    {
      "id": "warm_service",
      "name": "温馨服务",
      "icon": "IcHeart",
      "color": colors.service_icon_red
    },
    {
      "id": "air_rail",
      "name": "空铁联运",
      "icon": "IcFlight",
      "color": colors.service_icon_sky
    },
    {
      "id": "elder",
      "name": "敬老版",
      "icon": "IcHeartHandshake",
      "color": colors.service_icon_orange
    },
    {
      "id": "hotel",
      "name": "酒店住宿",
      "icon": "IcBuilding",
      "color": colors.service_icon_red
    },
    {
      "id": "car_rental",
      "name": "租车·约车",
      "icon": "IcCar",
      "color": colors.service_icon_green
    },
    {
      "id": "tourism",
      "name": "铁路旅游",
      "icon": "IcMountain",
      "color": colors.service_icon_teal
    },
    {
      "id": "food",
      "name": "餐饮·特产",
      "icon": "IcFood",
      "color": colors.service_icon_orange
    },
    {
      "id": "bus_ship",
      "name": "汽车·船票",
      "icon": "IcBus",
      "color": colors.service_icon_sky
    },
    {
      "id": "mall",
      "name": "铁路商城",
      "icon": "IcShopping",
      "color": colors.service_icon_red
    },
    {
      "id": "invoice",
      "name": "电子发票",
      "icon": "IcFile",
      "color": colors.service_icon_blue
    },
    {
      "id": "insurance",
      "name": "出行保险",
      "icon": "IcShield",
      "color": colors.service_icon_sky
    }
  ],
  "orderCategories": [
    {
      "id": "food_order",
      "name": "餐饮·特产订单",
      "icon": "IcFood",
      "color": colors.service_icon_amber
    },
    {
      "id": "insurance_order",
      "name": "保险订单",
      "icon": "IcShieldPlus",
      "color": colors.service_icon_red
    },
    {
      "id": "hotel_order",
      "name": "酒店订单",
      "icon": "IcBuilding",
      "color": colors.service_icon_green_hotel
    },
    {
      "id": "air_rail_order",
      "name": "空铁联运订单",
      "icon": "IcFlight",
      "color": colors.service_icon_blue
    },
    {
      "id": "commuter_order",
      "name": "计次·定期票订单",
      "icon": "IcCard",
      "color": colors.service_icon_amber
    },
    {
      "id": "car_order",
      "name": "租车·约车订单",
      "icon": "IcCar",
      "color": colors.service_icon_amber
    }
  ],
  "travelGuide": [
    {
      "id": "station_screen",
      "name": "车站大屏",
      "icon": "IcMonitor",
      "color": colors.service_icon_blue
    },
    {
      "id": "timetable",
      "name": "时刻表",
      "icon": "IcClock",
      "color": colors.service_icon_blue
    },
    {
      "id": "sale_time",
      "name": "起售时间",
      "icon": "IcCalendarClock",
      "color": colors.service_icon_green
    },
    {
      "id": "delay_check",
      "name": "正晚点查询",
      "icon": "IcTimer",
      "color": colors.service_icon_orange
    },
    {
      "id": "price_check",
      "name": "票价查询",
      "icon": "IcDollar",
      "color": colors.service_icon_red
    },
    {
      "id": "transfer_time",
      "name": "换乘时间",
      "icon": "IcSwap",
      "color": colors.service_icon_blue
    },
    {
      "id": "agency",
      "name": "代售点查询",
      "icon": "IcMapPin",
      "color": colors.service_icon_green
    },
    {
      "id": "more",
      "name": "更多",
      "icon": "IcMore",
      "color": colors.service_icon_muted
    }
  ],
  "commonFunctions": [
    {
      "id": "id_verify",
      "name": "人证核验",
      "icon": "IcUserCheck",
      "color": colors.service_icon_blue
    },
    {
      "id": "fingerprint",
      "name": "指纹登录",
      "icon": "IcFingerprint",
      "color": colors.service_icon_green
    },
    {
      "id": "change_password",
      "name": "修改密码",
      "icon": "IcLock",
      "color": colors.service_icon_orange
    },
    {
      "id": "change_phone",
      "name": "修改手机号",
      "icon": "IcPhoneDevice",
      "color": colors.service_icon_blue
    },
    {
      "id": "notifications",
      "name": "通知设置",
      "icon": "IcBell",
      "color": colors.service_icon_red
    },
    {
      "id": "elder_mode",
      "name": "敬老版",
      "icon": "IcHeartHandshake",
      "color": colors.service_icon_orange
    },
    {
      "id": "quick_refund",
      "name": "快捷退票",
      "icon": "IcTicketCancel",
      "color": colors.service_icon_red
    },
    {
      "id": "student_verify",
      "name": "学生资质核验",
      "icon": "IcGraduation",
      "color": colors.service_icon_blue
    }
  ],
  "travelQuickEntries": [
    {
      "id": "car_rental",
      "name": "租车·约车",
      "icon": "IcCar",
      "tag": "限时优惠",
      "color": colors.service_icon_green
    },
    {
      "id": "hotel",
      "name": "酒店住宿",
      "icon": "IcBuilding",
      "color": colors.service_icon_red
    },
    {
      "id": "mall",
      "name": "铁路商城",
      "icon": "IcShopping",
      "color": colors.service_icon_orange
    }
  ],
  "memberBenefits": [
    {
      "id": "points",
      "title": "积分权益",
      "desc": "购票领畅行积分",
      "color": colors.member_benefit_blue_bg
    },
    {
      "id": "exchange",
      "title": "兑换车票",
      "desc": "畅行积分兑换车票",
      "color": colors.member_benefit_yellow_bg
    },
    {
      "id": "waitlist",
      "title": "无票候补",
      "desc": "候补车票免核验",
      "color": colors.member_benefit_blue_bg
    },
    {
      "id": "activity",
      "title": "会员活动",
      "desc": "不定期会员活动",
      "color": colors.member_benefit_yellow_bg
    }
  ],
  "orderCategoriesFull": [
    {
      "id": "food_order",
      "name": "餐饮·特产订单",
      "icon": "IcFood",
      "color": colors.service_icon_amber
    },
    {
      "id": "insurance_order",
      "name": "保险订单",
      "icon": "IcShieldPlus",
      "color": colors.service_icon_red
    },
    {
      "id": "hotel_order",
      "name": "酒店订单",
      "icon": "IcBuilding",
      "color": colors.service_icon_green_hotel
    },
    {
      "id": "air_rail_order",
      "name": "空铁联运订单",
      "icon": "IcFlight",
      "color": colors.service_icon_blue
    },
    {
      "id": "commuter_order",
      "name": "计次·定期票订单",
      "icon": "IcCard",
      "color": colors.service_icon_amber
    },
    {
      "id": "car_order",
      "name": "租车·约车订单",
      "icon": "IcCar",
      "color": colors.service_icon_amber
    },
    {
      "id": "business_order",
      "name": "商务座服务订单",
      "icon": "IcShopping",
      "color": colors.service_icon_purple
    },
    {
      "id": "mall_order",
      "name": "铁路商城订单",
      "icon": "IcShopping",
      "color": colors.service_icon_blue
    },
    {
      "id": "bus_order",
      "name": "汽车票订单",
      "icon": "IcBus",
      "color": colors.service_icon_orange
    },
    {
      "id": "tour_order",
      "name": "门票·旅游订单",
      "icon": "IcMountain",
      "color": colors.service_icon_teal
    },
    {
      "id": "water_order",
      "name": "铁水联运订单",
      "icon": "IcShip",
      "color": colors.service_icon_amber
    },
    {
      "id": "ship_order",
      "name": "船票订单",
      "icon": "IcShip",
      "color": colors.service_icon_sky
    },
    {
      "id": "pet_order",
      "name": "宠物托运订单",
      "icon": "IcHeart",
      "color": colors.service_icon_red
    }
  ],
  "warmServices": [
    {
      "id": "temp_id",
      "name": "临时身份证明",
      "icon": "IcUserCheck"
    },
    {
      "id": "lost_found",
      "name": "遗失物品",
      "icon": "IcHelp"
    },
    {
      "id": "suggestion",
      "name": "建议",
      "icon": "IcMessage"
    },
    {
      "id": "complaint",
      "name": "投诉",
      "icon": "IcChat"
    },
    {
      "id": "special_passenger",
      "name": "重点旅客",
      "icon": "IcAccessibility"
    },
    {
      "id": "service_phone",
      "name": "客服电话",
      "icon": "IcPhoneCall"
    },
    {
      "id": "foreign_service",
      "name": "外国商务人…",
      "icon": "IcGlobe"
    }
  ],
  "infoServices": [
    {
      "id": "announcement",
      "name": "公告"
    },
    {
      "id": "faq",
      "name": "常见问题"
    },
    {
      "id": "usage_notice",
      "name": "使用须知"
    },
    {
      "id": "service_rules",
      "name": "服务规章"
    },
    {
      "id": "railway_insurance",
      "name": "铁路保险"
    },
    {
      "id": "about",
      "name": "关于"
    }
  ],
  "featuredApps": [
    {
      "id": "hotel",
      "name": "酒店住宿",
      "icon": "IcBuilding",
      "color": colors.service_icon_blue
    },
    {
      "id": "ecard",
      "name": "铁路e卡通",
      "icon": "IcCard",
      "color": colors.service_icon_sky
    },
    {
      "id": "mall",
      "name": "铁路商城",
      "icon": "IcShopping",
      "color": colors.service_icon_green
    },
    {
      "id": "insurance",
      "name": "出行保险",
      "icon": "IcShield",
      "color": colors.service_icon_blue
    },
    {
      "id": "invoice",
      "name": "电子发票",
      "icon": "IcFile",
      "color": colors.service_icon_sky
    },
    {
      "id": "commuter_pass",
      "name": "计次·定期票",
      "icon": "IcCard",
      "color": colors.service_icon_orange
    },
    {
      "id": "warm_service",
      "name": "温馨服务",
      "icon": "IcHeart",
      "color": colors.service_icon_red
    },
    {
      "id": "elder",
      "name": "敬老版",
      "icon": "IcHeartHandshake",
      "color": colors.service_icon_orange
    },
    {
      "id": "pet",
      "name": "宠物托运",
      "icon": "IcHeart",
      "color": colors.service_icon_green
    },
    {
      "id": "light_travel",
      "name": "轻装行",
      "icon": "IcShopping",
      "color": colors.service_icon_sky
    }
  ],
  "allTravelServices": [
    {
      "id": "food",
      "name": "餐饮·特产",
      "icon": "IcFood",
      "color": colors.service_icon_orange
    },
    {
      "id": "bus_ship",
      "name": "汽车票",
      "icon": "IcBus",
      "color": colors.service_icon_sky
    },
    {
      "id": "car_rental",
      "name": "租车·约车",
      "icon": "IcCar",
      "color": colors.service_icon_green
    },
    {
      "id": "tourism",
      "name": "铁路旅游",
      "icon": "IcMountain",
      "color": colors.service_icon_teal
    },
    {
      "id": "accident_insurance",
      "name": "乘意险",
      "icon": "IcShield",
      "color": colors.service_icon_red
    },
    {
      "id": "hotel_2",
      "name": "酒店住宿",
      "icon": "IcBuilding",
      "color": colors.service_icon_blue
    },
    {
      "id": "air_rail",
      "name": "空铁联运",
      "icon": "IcFlight",
      "color": colors.service_icon_sky
    },
    {
      "id": "water_rail",
      "name": "铁水联运",
      "icon": "IcShip",
      "color": colors.service_icon_green
    },
    {
      "id": "express",
      "name": "高铁急送",
      "icon": "IcTruck",
      "color": colors.service_icon_orange
    },
    {
      "id": "ski",
      "name": "雪具服务",
      "icon": "IcMountain",
      "color": colors.service_icon_sky
    },
    {
      "id": "ship",
      "name": "船票",
      "icon": "IcShip",
      "color": colors.service_icon_blue
    }
  ],
  "allTravelGuide": [
    {
      "id": "quick_refund",
      "name": "快捷退票",
      "icon": "IcTicketCancel",
      "color": colors.service_icon_blue
    },
    {
      "id": "contact",
      "name": "联系方式…",
      "icon": "IcPhoneCall",
      "color": colors.service_icon_sky
    },
    {
      "id": "station_screen",
      "name": "车站大屏",
      "icon": "IcMonitor",
      "color": colors.service_icon_green
    },
    {
      "id": "timetable",
      "name": "时刻表",
      "icon": "IcClock",
      "color": colors.service_icon_blue
    },
    {
      "id": "price_check",
      "name": "查票价",
      "icon": "IcDollar",
      "color": colors.service_icon_red
    },
    {
      "id": "agency",
      "name": "查代售点",
      "icon": "IcMapPin",
      "color": colors.service_icon_green
    },
    {
      "id": "sale_time",
      "name": "起售时间",
      "icon": "IcCalendarClock",
      "color": colors.service_icon_orange
    },
    {
      "id": "station_nav",
      "name": "站内导航",
      "icon": "IcNavigation",
      "color": colors.service_icon_green
    },
    {
      "id": "delay_check",
      "name": "正晚点",
      "icon": "IcTimer",
      "color": colors.service_icon_orange
    },
    {
      "id": "train_status",
      "name": "列车状态",
      "icon": "IcTrain",
      "color": colors.service_icon_blue
    }
  ],
  "thirdPartyServices": [
    {
      "id": "unicom",
      "name": "联通礼包",
      "icon": "IcGift",
      "color": colors.service_icon_red
    },
    {
      "id": "crt",
      "name": "中铁银通",
      "icon": "IcCard",
      "color": colors.service_icon_blue
    },
    {
      "id": "auto_transport",
      "name": "汽车托运",
      "icon": "IcTruck",
      "color": colors.service_icon_sky
    }
  ],
  "allWarmServices": [
    {
      "id": "temp_id",
      "name": "临时身份…",
      "icon": "IcUserCheck",
      "color": colors.service_icon_blue
    },
    {
      "id": "lost_found",
      "name": "遗失物品",
      "icon": "IcHelp",
      "color": colors.service_icon_orange
    },
    {
      "id": "suggestion",
      "name": "建议",
      "icon": "IcMessage",
      "color": colors.service_icon_green
    },
    {
      "id": "complaint",
      "name": "投诉",
      "icon": "IcChat",
      "color": colors.service_icon_orange
    },
    {
      "id": "special_passenger",
      "name": "重点旅客",
      "icon": "IcAccessibility",
      "color": colors.service_icon_red
    },
    {
      "id": "service_phone",
      "name": "客服电话",
      "icon": "IcPhoneCall",
      "color": colors.service_icon_blue
    },
    {
      "id": "foreign_service",
      "name": "外国商务…",
      "icon": "IcGlobe",
      "color": colors.service_icon_sky
    }
  ]
};
