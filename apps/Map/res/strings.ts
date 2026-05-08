/**
 * Map 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '地图',

  // ─── Bottom Navigation Tabs ───
  tab_explore: '探索',
  tab_me: '我',
  tab_contribute: '贡献',

  // ─── Search ───
  search_placeholder: '在此处搜索',
  search_no_results: '未找到结果',
  search_recent: '最近',
  search_in_area: '在此区域搜索',
  search_results: '搜索结果',
  search_view_similar: '查看相似地点',
  search_voice: '语音搜索',
  search_loading_suggestions: '正在获取建议…',
  search_searching: '正在搜索…',
  search_loading_results: '正在加载结果…',

  // ─── Location & Position ───
  my_location: '我的位置',
  your_location: '您的位置',
  your_current_location: '您所在的位置',
  dropped_pin: '已放置的图钉',
  selected_location: '已选位置',

  // ─── Route & Navigation ───
  route: '路线',
  route_driving: '驾车',
  route_transit: '公交',
  route_walking: '步行',
  route_cycling: '骑行',
  route_fastest: '最快',
  route_fastest_route: '最快路线',
  route_recommended_route: '推荐路线',
  route_alternative_route: '备选路线',
  route_fuel_efficient_route: '省油路线',
  route_shorter_distance_route: '更短距离路线',
  route_detailed_steps: '具体路线',
  route_arrive_destination: '到达目的地',
  route_calculating: '正在计算最佳路线...',
  route_not_found: '无法找到路线',
  route_not_found_detail: '无法找到该路线',
  route_origin_dest_too_close: '起点和终点距离太近',
  route_origin_dest_not_found: '无法找到起终点位置',
  route_failed: '路线规划失败',
  route_failed_prefix: '路线规划失败: ',
  route_try_driving: '尝试驾车路线',
  route_start: '开始',
  route_add_stop: '添加经停点',
  route_share: '分享',
  route_exit: '退出',
  route_continue_to: '继续前往',
  route_continue_straight: '直行',
  route_arrive_at: '到达',
  route_minute_unit: '分钟',

  // ─── Route Options (Driving) ───
  route_depart_time: '出发时间:',
  route_depart_now: '现在',
  route_avoid_tolls: '避开收费站',
  route_avoid_highways: '避开高速公路',
  route_avoid_ferries: '避开轮渡',
  route_avoid_hills: '避开坡路',
  route_prefer_main_roads: '大路优先',

  // ─── Route Options (Transit) ───
  route_prefer_subway: '偏好地铁',
  route_least_transfers: '最少换乘',

  // ─── Location Selection / Pin Picker ───
  select_origin: '选择出发地',
  select_destination: '选择目的地',
  select_on_map: '在地图上选择',
  pin_picker_hint: '平移和缩放图钉周围的地图',
  /** 地图选点页主按钮（确认所选坐标） */
  pin_picker_set: '设置',
  confirm: '确定',
  quick_set_location_title: '快捷地设置地点',
  quick_set_location_desc: '保存住址和工作地址，查询路线更便捷',

  // ─── Place Categories ───
  category_set_home: '设置住址',
  category_restaurant: '餐馆',
  category_attraction: '景点',
  category_hotel: '酒店',
  category_cafe: '咖啡馆',
  category_gas_station_short: '加油站',
  category_shopping: '购物',
  category_grocery: '杂货店',
  category_convenience_store: '便利店',
  category_gas_station: '加油站',
  category_clothing_store: '服饰店',
  category_shopping_mall: '购物中心',
  category_store: '商店',
  category_place: '地点',

  // ─── Place Detail ───
  place_not_found: '未找到地点信息',
  place_no_photo: '暂无图片',
  place_open: '营业中',
  place_open_now: '正在营业',
  place_closed_now: '已结束营业',
  place_closes_at: '结束营业时间：',
  place_opens_at: '开始营业时间：',
  place_close_time: '关闭',
  place_no_rating: '无评价',
  place_reviews_suffix: '条评论',
  place_opening_hours: '营业时间',
  place_about_data: '关于数据来源',
  place_demo_restaurant_address: '北京市丰台区五爱屯东街 邮政编码: 100076',
  place_demo_landmark_address: '北京市东城区景山前街4号 邮政编码: 100009',

  // ─── Place Types ───
  type_hotel_5star: '5 星级酒店',
  type_hotel_3star: '3 星级酒店',
  type_chinese_restaurant: '中餐馆',
  type_park: '公园',
  type_hospital: '医院',
  type_tourist_attraction: '旅游胜地',
  type_hotel_desc: '带有室内泳池和水疗会所的豪华酒店',

  // ─── Action Buttons ───
  action_save: '保存',
  action_share: '分享',
  action_call: '致电',
  action_phone: '电话',
  action_availability: '空房情况',
  action_tickets: '门票',
  action_login: '登录',

  // ─── Place Detail Tabs ───
  tab_overview: '概览',
  tab_price: '价格',
  tab_business: '商家一览',
  tab_about: '简介',
  tab_tickets: '门票',

  // ─── Hotel Details ───
  hotel_checkin: '入住日期',
  hotel_checkout: '退房日期',
  hotel_demo_checkin_date: '1月24日周六',
  hotel_demo_checkout_date: '1月25日周日',
  hotel_demo_savings: '如果在1月26日周一 - 1月27日周二期间入住，可节省 ¥401',

  // ─── Explore Pulse Sheet ───
  explore_pulse: '本地生活脉搏',
  explore_accommodation: '住宿地点',
  explore_view_all_hotels: '查看所有酒店 ＞',
  explore_nearby: '探索周边',
  explore_nearby_placeholder: '探索周边卡片占位',
  explore_hotel_price_dates: '1月23日至24日的价格',
  explore_no_reviews: '无评价',

  // ─── Shopping Sheet / Filters ───
  filter_relevance: '相关性',
  filter_distance: '距离',
  filter_open_now: '营业中',
  filter_top_rated: '评分最高',
  filter_conditions: '3+ 条件',
  filter_reviews_3_plus: '3+ 条评价',
  filter_more: '更多过滤条件',
  filter_title: '过滤条件',
  filter_sort_by: '排序依据',
  filter_rating: '评分',
  filter_no_limit: '不限',
  filter_review_count: '评价数量',
  filter_opening_hours: '营业时间',
  filter_custom: '自定义',
  filter_clear: '清除',
  filter_apply: '应用',
  filter_cancel: '取消',
  filter_save: '保存',
  filter_loading: '加载中',
  filter_load_more: '加载更多',
  filter_swipe_to_load_more: '上滑加载更多',

  // ─── Map Layers ───
  map_layers: '地图图层',
  map_type: '地图类型',
  map_type_default: '默认',
  map_type_satellite: '卫星图像',
  map_type_terrain: '地形',
  map_details: '地图详情',
  map_detail_transit: '公共交通',
  map_detail_traffic: '实时路况',
  map_detail_bicycling: '骑车线路',
  map_detail_street_view: '街景',
  map_detail_wildfire: '野火',
  map_detail_air_quality: '空气质量',

  // ─── Distance & Units ───
  unit_km: '公里',
  unit_m: '米',
  unit_miles: '英里',

  // ─── Profile Menu ───
  profile_title: '您的个人资料',
  profile_location_sharing: '位置信息分享',
  profile_offline_maps: '离线地图',
  profile_settings: '设置',
  profile_help_feedback: '帮助与反馈',
  profile_privacy_policy: '隐私权政策',
  profile_terms_of_service: '服务条款',
  profile_more_actions: '"地图"所支持的更多操作',

  // ─── Settings ───
  settings_title: '设置',
  settings_app_display: '应用和显示',
  settings_app_display_desc: '主题、地图控件、无障碍功能',
  settings_navigation: '导航',
  settings_navigation_desc: '驾车、步行、公共交通',
  settings_getting_around: '出行',
  settings_getting_around_desc: '通勤、公共交通、骑行',
  settings_location_privacy: '位置信息和隐私',
  settings_location_privacy_desc: '时间轴、地图历史记录、个人资料',
  settings_offline_maps: '离线地图',
  settings_offline_maps_desc: '下载选项、更新',
  settings_notifications: '通知',
  settings_notifications_desc: '提醒、建议',
  settings_about_terms: '简介和条款',

  // ─── App & Display Settings ───
  app_display_title: '应用和显示',
  app_display_language: '应用语言',
  app_display_theme: '主题',
  app_display_distance_unit: '距离单位',
  app_display_scale_bar: '在地图上显示比例尺',
  app_display_video_autoplay: '视频自动播放',
  app_display_wlan_only: '仅通过 WLAN 下载',
  app_display_satellite: '以卫星视图启动地图',
  app_display_accessibility: '无障碍设施',
  app_display_accessibility_desc: '显示无障碍设施的信息。无障碍设施的信息可能与实际情况不符。',
  app_display_shake_feedback: '摇动发送反馈',

  // ─── Theme Options ───
  theme_title: '主题背景',
  theme_light: '始终采用浅色主题',
  theme_dark: '始终采用深色主题',
  theme_device: '与设备主题背景一致',
  theme_nav_hint: '导航期间，您还可以在设置中更改地图显示设置',
  theme_go_nav_settings: '转至导航设置',

  // ─── Distance Unit Options ───
  distance_unit_title: '距离单位',
  distance_unit_auto: '自动',
  distance_unit_km: '公里',
  distance_unit_miles: '英里',

  // ─── Scale Bar Options ───
  scale_bar_title: '在地图上显示比例尺',
  scale_bar_on_zoom: '缩放时',
  scale_bar_always: '始终',

  // ─── Video Autoplay Options ───
  video_settings_title: '视频设置',
  video_autoplay_off: '自动播放功能已关闭',
  video_autoplay_always: '始终开启自动播放功能',
  video_autoplay_wifi: '仅在连接到 Wi-Fi 时自动播放',

  // ─── Language Page ───
  language_title: '应用语言',
  language_suggested: '建议的语言',
  language_system_default: '系统默认',
  language_chinese: '中文 (中国)',
  language_english: 'English',
  language_all: '全部',

  // ─── Navigation Settings ───
  nav_title: '导航',
  nav_sound_voice: '声音和语音',
  nav_mute_status: '静音状态',
  nav_muted: '已静音',
  nav_alerts_only: '仅播放提醒',
  nav_unmuted: '已取消静音',
  nav_voice_volume: '语音提示音量',
  nav_volume_low: '小',
  nav_volume_medium: '中',
  nav_volume_high: '大',
  nav_voice_selection: '语音选择',
  nav_voice_default: '默认 (中文)',
  nav_bluetooth_voice: '通过蓝牙播放语音',
  nav_voice_during_calls: '在通话期间播放语音',
  nav_play_audio_cues: '播放音频提示',
  nav_play_test_sound: '播放测试声音',
  nav_show_media_controls: '显示媒体播放控件',
  nav_default_media_app: '默认媒体应用',

  // ─── Navigation: Alerts ───
  nav_alert_options: '提醒选项',
  nav_alert_incident_desc: '接收报告的可能影响驾驶的事故和...',

  // ─── Navigation: Route Options ───
  nav_route_options: '路线选项',
  nav_prefer_fuel_efficient: '首选省油的路线',
  nav_fuel_efficient_desc: '如果到达时间相近，默认情况下地图将推荐省油的路线',
  nav_engine_type: '发动机类型',
  nav_engine_gasoline: '汽油',

  // ─── Navigation: Map Display ───
  nav_map_display: '地图显示',
  nav_color_scheme: '配色方案',
  nav_color_auto: '自动',
  nav_color_day: '日间',
  nav_color_night: '夜间',
  nav_distance_units: '距离单位',
  nav_keep_north_up: '地图始终保持上北下南',

  // ─── Navigation: Route Preview ───
  nav_route_preview: '在导航时显示路线速览',
  nav_route_preview_desc: '直接在路线概览或锁屏界面上查看最新的预计到达时间和下一个转弯等。系统将收集导航数据，用于优化 Google 地图、惠及每位用户。',
  nav_learn_more: '了解详情',

  // ─── Navigation: Driving Options ───
  nav_driving_options: '行车选项',
  nav_speedometer: '车速表',
  nav_driving_notifications: '行车通知',
  nav_driving_notifications_desc: '在连接车辆蓝牙时获知预计到达时间',
  nav_bluetooth_tunnel: '蓝牙隧道信标',
  nav_bluetooth_tunnel_desc: '扫描蓝牙隧道信标，提高隧道内的定位精确度',

  // ─── Getting Around Settings ───
  getting_around_title: '出行',
  getting_around_commute: '通勤',
  getting_around_commute_desc: '设置您的通勤路线',
  getting_around_walking: '步行选项',
  getting_around_walking_desc: '偏好设置',
  getting_around_transit: '公共交通',
  getting_around_transit_desc: '偏好设置',
  getting_around_rideshare: '叫车服务',
  getting_around_rideshare_desc: '价格比较和提供商',
  getting_around_cycling: '骑行',
  getting_around_cycling_desc: '路线选项',

  // ─── Location & Privacy Settings ───
  location_privacy_title: '位置信息和隐私',
  location_device_location: '设备位置信息',
  location_enabled: '开启',
  location_google_maps_location: 'Google 地图的设备位置信息',
  location_permission_when_using: '使用此应用时允许',
  location_permission_desc: '有助于显示附近搜索结果、实时路况等信息',
  location_save_recent_searches: '在此设备上保存近期搜索',

  // ─── Offline Maps Settings ───
  offline_maps_title: '离线地图',
  offline_auto_update: '自动更新离线地图',
  offline_auto_update_desc: '为了节省空间和数据流量，系统将仅更新最近使用的地图',
  offline_auto_download: '自动下载推荐的地图',
  offline_download_prefs: '下载偏好设置',
  offline_about: '关于离线地图',
  offline_about_desc: '详细了解如何离线使用 Google 地图',
  offline_download_prefs_title: '下载偏好设置',
  offline_wlan_only: '仅通过 WLAN 网络',
  offline_wlan_or_mobile: '通过 WLAN 或移动网络',

  // ─── Notification Settings ───
  notification_title: '通知',
  notification_traffic: '交通信息',
  notification_recommendations: '个性化推荐',
  notification_pref_all_types: '为所有类型进行偏好设置',
  notification_setting: '通知接收设置',
  notification_receive_settings: '通知接收设置',
  notification_advanced_prefs: '高级偏好设置',

  // ─── Traffic Notification Items ───
  traffic_title: '交通信息',
  traffic_offline_maps: '离线地图',
  traffic_nearby_incidents: '附近活动路况通知',
  traffic_public_transit: '公共交通路线信息和地图',
  traffic_parking: '停车位置',
  traffic_desktop_directions: '来自计算机的路线指示',

  // ─── Traffic Notification Descriptions ───
  traffic_offline_maps_desc: '获取有关保存到您的手机或平板电脑的区域的最新信息',
  traffic_nearby_incidents_desc: '获取有关您所在位置附近的路况、事故和施工信息的通知',
  traffic_public_transit_desc: '获取附近车站的发车时刻、交通中断信息和地图',
  traffic_parking_desc: '获取有关您的停车地点的最新信息',
  traffic_desktop_directions_desc: '将行程路线发送到您的手机',

  // ─── Recommendation Notification Items ───
  recommendation_title: '个性化推荐',
  recommendation_nearby_places: '附近的地点和活动',
  recommendation_new_places: '新地点和热门地点',
  recommendation_nearby_desc: '获取关于附近地点和活动的推荐内容',
  recommendation_new_desc: '根据您的偏好设置接收关于新地点和热门地点的通知',

  // ─── Common Setting Values ───
  setting_on: '开启',
  setting_off: '关闭',
  setting_app_only: '仅限应用',

  // ─── Contribute Page ───
  contribute_view_profile: '查看个人资料',
  contribute_level_suffix: '级本地向导',
  contribute_points_to_next: '还差 15 个积分就能升至 2 级',
  contribute_add_place: '添加地点',
  contribute_update_place: '更新地点',
  contribute_add_review: '添加评价',
  contribute_add_photo: '添加照片',
  contribute_badge_title: '为自己赢得"新贡献者"徽章',
  contribute_badge_desc: '从这些简单的更新入手',
  contribute_post_photos: '发布 2 张照片',
  contribute_write_reviews: '撰写 2 条评价',
  contribute_answer_questions: '回答 2 个问题',
  contribute_info_note: '此处显示的地点基于您搜索过的字词、当前位置及其他信息 (?)',
  contribute_level_title: '本地向导',

  // ─── Me Page ───
  me_address_title: '提供准确的家庭住址',
  me_address_desc: '无论您住在哪里，都能获享便捷的送货上门服务',
  me_start: '开始',
  me_recent_interactions: '最近互动过的地点',
  me_recent_desc: '来自地图历史记录和保存的地点',
  me_chip_area: '区域',
  me_chip_category: '类别',
  me_chip_saved: '已保存',
  me_chip_history: '地图历史记录',
  me_view_all: '查看全部',
  me_your_lists: '您的列表',
  me_new_list: '新建列表',
  me_favorites: '收藏',
  me_want_to_go: '想去的地点',
  me_starred: '已加星标的地点',
  me_list_private: '不公开',
  me_list_places_count: '个地点',

  // ─── Search Page ───
  search_typing_hint_title: '嫌打字太麻烦？',
  search_typing_hint_desc: '登录账号，即可获得我们根据您的搜索记录和Google通讯录提供的建议。',
  search_login_save: '登录即可保存搜索记录',

  // ─── Language Page ───
  language_chinese_short: '中文',

  // ─── Place Detail Extras ───
  place_reviews_paren_prefix: '(',
  place_reviews_paren_suffix: ')',
  place_open_until_example: '· 结束营业时间：22:00',
  place_detail_title: '地点详情',
  place_loading_detail: '正在加载地点详情',
  place_no_description: '暂无简介信息',

  // ─── Map Error Messages ───
  error_location_generic: '无法获取位置信息',
  error_location_denied: '位置访问被拒绝',
  error_location_unavailable: '位置信息不可用',
  error_location_timeout: '获取位置信息超时',

  // ─── Route Setup ───
  route_setup_select_start: '选择出发地',
  route_setup_select_dest: '选择目的地',

  // ─── About Section Headers ───
  about_service_options: '服务选项',
  about_accessibility: '无障碍服务',
  about_activities: '活动',
  about_amenities: '设施',
  about_parking: '停车',
  about_payments: '付款',
  about_children: '儿童',
  about_pets: '宠物',

  // ─── About Section Items — Service ───
  about_dine_in: '门店服务',
  about_takeout: '外带',
  about_delivery: '外送',
  about_reservable: '可预订',
  about_serves_breakfast: '供应早餐',
  about_serves_lunch: '供应午餐',
  about_serves_dinner: '供应晚餐',
  about_serves_brunch: '供应早午餐',
  about_serves_coffee: '供应咖啡',
  about_serves_dessert: '供应甜点',
  about_serves_beer: '供应啤酒',
  about_serves_wine: '供应葡萄酒',
  about_serves_cocktails: '供应鸡尾酒',
  about_serves_vegetarian: '供应素食',

  // ─── About Section Items — Accessibility ───
  about_wheelchair_entrance: '无障碍入口',
  about_wheelchair_parking: '无障碍停车场',
  about_wheelchair_restroom: '无障碍洗手间',
  about_wheelchair_seating: '无障碍座位',

  // ─── About Section Items — Activities ───
  about_outdoor_seating: '户外座位',
  about_live_music: '现场音乐',
  about_good_for_sports: '适合看体育比赛',

  // ─── About Section Items — Amenities ───
  about_restroom: '公用洗手间',
  about_good_for_groups: '适合团体',

  // ─── About Section Items — Parking ───
  about_free_parking: '免费停车场',
  about_paid_parking: '付费停车场',
  about_street_parking: '路边停车',
  about_garage_parking: '车库停车',
  about_valet_parking: '代客泊车',

  // ─── About Section Items — Payments ───
  about_debit_cards: '借记卡',
  about_credit_cards: '信用卡',
  about_nfc_payments: 'NFC 支付',
  about_cash_only: '仅接受现金',

  // ─── About Section Items — Children ───
  about_good_for_children: '适合儿童',
  about_kids_menu: '儿童菜单',

  // ─── About Section Items — Pets ───
  about_dogs_allowed: '允许携带宠物',
} as const;

export type StringKey = keyof typeof strings;
