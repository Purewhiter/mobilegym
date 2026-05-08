import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Maps',

  // ─── Bottom Navigation Tabs ───
  tab_explore: 'Explore',
  tab_me: 'You',
  tab_contribute: 'Contribute',

  // ─── Search ───
  search_placeholder: 'Search here',
  search_no_results: 'No results found',
  search_recent: 'Recent',
  search_in_area: 'Search this area',
  search_results: 'Search results',
  search_view_similar: 'View similar places',
  search_voice: 'Voice search',
  search_loading_suggestions: 'Getting suggestions…',
  search_searching: 'Searching…',
  search_loading_results: 'Loading results…',

  // ─── Location & Position ───
  my_location: 'My location',
  your_location: 'Your location',
  your_current_location: 'Your location',
  dropped_pin: 'Dropped pin',
  selected_location: 'Selected location',

  // ─── Route & Navigation ───
  route: 'Directions',
  route_driving: 'Driving',
  route_transit: 'Transit',
  route_walking: 'Walking',
  route_cycling: 'Cycling',
  route_fastest: 'Fastest',
  route_fastest_route: 'Fastest route',
  route_detailed_steps: 'Detailed steps',
  route_arrive_destination: 'Arrive at destination',
  route_calculating: 'Calculating best route...',
  route_not_found: 'Can\'t find a route',
  route_not_found_detail: 'No route could be found',
  route_origin_dest_too_close: 'Origin and destination are too close',
  route_origin_dest_not_found: 'Can\'t find origin or destination',
  route_failed: 'Route planning failed',
  route_failed_prefix: 'Route planning failed: ',
  route_try_driving: 'Try driving directions',
  route_start: 'Start',
  route_add_stop: 'Add stop',
  route_share: 'Share',
  route_exit: 'Exit',
  route_continue_to: 'Continue to ',
  route_continue_straight: 'Continue straight',
  route_arrive_at: 'Arrive at',
  route_minute_unit: 'min',

  // ─── Route Options (Driving) ───
  route_depart_time: 'Depart at:',
  route_depart_now: 'Now',
  route_avoid_tolls: 'Avoid tolls',
  route_avoid_highways: 'Avoid highways',
  route_avoid_ferries: 'Avoid ferries',
  route_avoid_hills: 'Avoid hills',
  route_prefer_main_roads: 'Prefer main roads',

  // ─── Route Options (Transit) ───
  route_prefer_subway: 'Prefer subway',
  route_least_transfers: 'Fewest transfers',

  // ─── Location Selection / Pin Picker ───
  select_origin: 'Choose starting point',
  select_destination: 'Choose destination',
  select_on_map: 'Choose on map',
  pin_picker_hint: 'Pan and zoom the map around the pin',
  pin_picker_set: 'Set',
  confirm: 'OK',
  quick_set_location_title: 'Quickly set locations',
  quick_set_location_desc: 'Save home and work addresses for quicker directions',

  // ─── Place Categories ───
  category_restaurant: 'Restaurants',
  category_attraction: 'Attractions',
  category_hotel: 'Hotels',
  category_shopping: 'Shopping',
  category_cafe: 'Cafes',
  category_convenience_store: 'Convenience store',
  category_grocery: 'Grocery store',
  category_gas_station_short: 'Gas',
  category_gas_station: 'Gas station',
  category_clothing_store: 'Clothing store',
  category_shopping_mall: 'Shopping mall',
  category_store: 'Store',
  category_place: 'Place',

  // ─── Place Detail ───
  place_not_found: 'Place information not found',
  place_no_photo: 'No photos available',
  place_open: 'Open',
  place_open_now: 'Open now',
  place_closed_now: 'Closed',
  place_closes_at: 'Closes at ',
  place_opens_at: 'Opens at ',
  place_close_time: 'Closes',
  place_no_rating: 'No reviews',
  place_reviews_suffix: ' reviews',
  place_opening_hours: 'Opening hours',
  place_about_data: 'About data sources',
  place_demo_restaurant_address: 'Wai Tun East Street, Fengtai District, Beijing 100076',
  place_demo_landmark_address: 'No. 4 Jingshan Front Street, Dongcheng District, Beijing 100009',

  // ─── Place Types ───
  type_hotel_5star: '5-star hotel',
  type_hotel_3star: '3-star hotel',
  type_chinese_restaurant: 'Chinese restaurant',
  type_park: 'Park',
  type_hospital: 'Hospital',
  type_tourist_attraction: 'Tourist attraction',
  type_hotel_desc: 'Luxury hotel with indoor pool and spa',

  // ─── Action Buttons ───
  action_save: 'Save',
  action_share: 'Share',
  action_call: 'Call',
  action_phone: 'Phone',
  action_availability: 'Availability',
  action_tickets: 'Tickets',
  action_login: 'Sign in',

  // ─── Place Detail Tabs ───
  tab_overview: 'Overview',
  tab_price: 'Prices',
  tab_business: 'About',
  tab_about: 'About',
  tab_tickets: 'Tickets',

  // ─── Hotel Details ───
  hotel_checkin: 'Check-in',
  hotel_checkout: 'Check-out',
  hotel_demo_checkin_date: 'Sat, Jan 24',
  hotel_demo_checkout_date: 'Sun, Jan 25',
  hotel_demo_savings: 'Save CNY 401 by staying Jan 26-Jan 27',

  // ─── Explore Pulse Sheet ───
  explore_pulse: 'Local pulse',
  explore_accommodation: 'Places to stay',
  explore_view_all_hotels: 'View all hotels >',
  explore_nearby: 'Explore nearby',
  explore_nearby_placeholder: 'Explore nearby card placeholder',
  explore_hotel_price_dates: 'Prices for Jan 23-24',
  explore_no_reviews: 'No reviews',

  // ─── Shopping Sheet / Filters ───
  filter_relevance: 'Relevance',
  filter_distance: 'Distance',
  filter_open_now: 'Open now',
  filter_top_rated: 'Top rated',
  filter_conditions: '3+ conditions',
  filter_reviews_3_plus: '3+ reviews',
  filter_more: 'More filters',
  filter_title: 'Filters',
  filter_sort_by: 'Sort by',
  filter_rating: 'Rating',
  filter_no_limit: 'Any',
  filter_review_count: 'Number of reviews',
  filter_opening_hours: 'Hours',
  filter_custom: 'Custom',
  filter_clear: 'Clear',
  filter_apply: 'Apply',
  filter_cancel: 'Cancel',
  filter_save: 'Save',
  filter_loading: 'Loading',
  filter_load_more: 'Load more',
  filter_swipe_to_load_more: 'Swipe up to load more',

  // ─── Map Layers ───
  map_layers: 'Map layers',
  map_type: 'Map type',
  map_type_default: 'Default',
  map_type_satellite: 'Satellite',
  map_type_terrain: 'Terrain',
  map_details: 'Map details',
  map_detail_transit: 'Transit',
  map_detail_traffic: 'Traffic',
  map_detail_bicycling: 'Cycling',
  map_detail_street_view: 'Street View',
  map_detail_wildfire: 'Wildfires',
  map_detail_air_quality: 'Air quality',

  // ─── Distance & Units ───
  unit_km: 'km',
  unit_m: 'm',
  unit_miles: 'mi',

  // ─── Profile Menu ───
  profile_title: 'Your profile',
  profile_location_sharing: 'Location sharing',
  profile_offline_maps: 'Offline maps',
  profile_settings: 'Settings',
  profile_help_feedback: 'Help & feedback',
  profile_privacy_policy: 'Privacy Policy',
  profile_terms_of_service: 'Terms of Service',
  profile_more_actions: 'More from Maps',

  // ─── Settings ───
  settings_title: 'Settings',
  settings_app_display: 'App & display',
  settings_app_display_desc: 'Theme, map controls, accessibility',
  settings_navigation: 'Navigation',
  settings_navigation_desc: 'Driving, walking, public transit',
  settings_getting_around: 'Getting around',
  settings_getting_around_desc: 'Commute, public transit, cycling',
  settings_location_privacy: 'Location & privacy',
  settings_location_privacy_desc: 'Timeline, Maps history, profile',
  settings_offline_maps: 'Offline maps',
  settings_offline_maps_desc: 'Download options, updates',
  settings_notifications: 'Notifications',
  settings_notifications_desc: 'Reminders, suggestions',
  settings_about_terms: 'About & terms',

  // ─── App & Display Settings ───
  app_display_title: 'App & display',
  app_display_language: 'App language',
  app_display_theme: 'Theme',
  app_display_distance_unit: 'Distance units',
  app_display_scale_bar: 'Show scale on map',
  app_display_video_autoplay: 'Video autoplay',
  app_display_wlan_only: 'Download over Wi-Fi only',
  app_display_satellite: 'Start Maps in satellite view',
  app_display_accessibility: 'Accessible places',
  app_display_accessibility_desc: 'Show accessibility information. Accessibility info may not reflect actual conditions.',
  app_display_shake_feedback: 'Shake to send feedback',

  // ─── Theme Options ───
  theme_title: 'Theme',
  theme_light: 'Always light theme',
  theme_dark: 'Always dark theme',
  theme_device: 'Same as device theme',
  theme_nav_hint: 'You can also change map display settings in settings during navigation',
  theme_go_nav_settings: 'Go to navigation settings',

  // ─── Distance Unit Options ───
  distance_unit_title: 'Distance units',
  distance_unit_auto: 'Automatic',
  distance_unit_km: 'Kilometers',
  distance_unit_miles: 'Miles',

  // ─── Scale Bar Options ───
  scale_bar_title: 'Show scale on map',
  scale_bar_on_zoom: 'While zooming',
  scale_bar_always: 'Always',

  // ─── Video Autoplay Options ───
  video_settings_title: 'Video settings',
  video_autoplay_off: 'Autoplay is off',
  video_autoplay_always: 'Always autoplay',
  video_autoplay_wifi: 'Autoplay on Wi-Fi only',

  // ─── Language Page ───
  language_title: 'App language',
  language_suggested: 'Suggested languages',
  language_system_default: 'System default',
  language_chinese: 'Chinese (China)',
  language_english: 'English',
  language_all: 'All',

  // ─── Navigation Settings ───
  nav_title: 'Navigation',
  nav_sound_voice: 'Sound & voice',
  nav_mute_status: 'Mute state',
  nav_muted: 'Muted',
  nav_alerts_only: 'Alerts only',
  nav_unmuted: 'Unmuted',
  nav_voice_volume: 'Guidance volume',
  nav_volume_low: 'Softer',
  nav_volume_medium: 'Normal',
  nav_volume_high: 'Louder',
  nav_voice_selection: 'Voice selection',
  nav_voice_default: 'Default (Chinese)',
  nav_bluetooth_voice: 'Play voice over Bluetooth',
  nav_voice_during_calls: 'Play voice during phone calls',
  nav_play_audio_cues: 'Play audio cues',
  nav_play_test_sound: 'Play test sound',
  nav_show_media_controls: 'Show media playback controls',
  nav_default_media_app: 'Default media app',

  // ─── Navigation: Alerts ───
  nav_alert_options: 'Alerts',
  nav_alert_incident_desc: 'Get reported incidents that may affect driving and...',

  // ─── Navigation: Route Options ───
  nav_route_options: 'Route options',
  nav_prefer_fuel_efficient: 'Prefer fuel-efficient routes',
  nav_fuel_efficient_desc: 'When arrival time is similar, Maps will default to the most fuel-efficient route',
  nav_engine_type: 'Engine type',
  nav_engine_gasoline: 'Gasoline',

  // ─── Navigation: Map Display ───
  nav_map_display: 'Map display',
  nav_color_scheme: 'Color scheme',
  nav_color_auto: 'Automatic',
  nav_color_day: 'Day',
  nav_color_night: 'Night',
  nav_distance_units: 'Distance units',
  nav_keep_north_up: 'Keep map north up',

  // ─── Navigation: Route Preview ───
  nav_route_preview: 'Show route overview during navigation',
  nav_route_preview_desc: 'See your latest ETA and next turn directly on the route overview or lock screen. Navigation data will be collected to improve Google Maps for everyone.',
  nav_learn_more: 'Learn more',

  // ─── Navigation: Driving Options ───
  nav_driving_options: 'Driving options',
  nav_speedometer: 'Speedometer',
  nav_driving_notifications: 'Driving notifications',
  nav_driving_notifications_desc: 'Get ETA when connected to vehicle Bluetooth',
  nav_bluetooth_tunnel: 'Bluetooth tunnel beacon',
  nav_bluetooth_tunnel_desc: 'Scan Bluetooth tunnel beacons to improve location accuracy in tunnels',

  // ─── Getting Around Settings ───
  getting_around_title: 'Getting around',
  getting_around_commute: 'Commute',
  getting_around_commute_desc: 'Set up your commute',
  getting_around_walking: 'Walking options',
  getting_around_walking_desc: 'Preferences',
  getting_around_transit: 'Public transit',
  getting_around_transit_desc: 'Preferences',
  getting_around_rideshare: 'Ridesharing',
  getting_around_rideshare_desc: 'Price comparison and providers',
  getting_around_cycling: 'Cycling',
  getting_around_cycling_desc: 'Route options',

  // ─── Location & Privacy Settings ───
  location_privacy_title: 'Location & privacy',
  location_device_location: 'Device location',
  location_enabled: 'On',
  location_google_maps_location: 'Google Maps device location',
  location_permission_when_using: 'Allow while using the app',
  location_permission_desc: 'Helps show nearby search results, live traffic, and more',
  location_save_recent_searches: 'Save recent searches on this device',

  // ─── Offline Maps Settings ───
  offline_maps_title: 'Offline maps',
  offline_auto_update: 'Auto-update offline maps',
  offline_auto_update_desc: 'To save space and data, only recently used maps will be updated',
  offline_auto_download: 'Auto-download recommended maps',
  offline_download_prefs: 'Download preferences',
  offline_about: 'About offline maps',
  offline_about_desc: 'Learn more about using Google Maps offline',
  offline_download_prefs_title: 'Download preferences',
  offline_wlan_only: 'Over Wi-Fi only',
  offline_wlan_or_mobile: 'Over Wi-Fi or mobile network',

  // ─── Notification Settings ───
  notification_title: 'Notifications',
  notification_traffic: 'Traffic info',
  notification_recommendations: 'Personalized recommendations',
  notification_pref_all_types: 'Set preferences for all types',
  notification_setting: 'Notification preferences',
  notification_receive_settings: 'Notification delivery settings',
  notification_advanced_prefs: 'Advanced preferences',

  // ─── Traffic Notification Items ───
  traffic_title: 'Traffic info',
  traffic_offline_maps: 'Offline maps',
  traffic_nearby_incidents: 'Nearby traffic alerts',
  traffic_public_transit: 'Public transit info and maps',
  traffic_parking: 'Parking location',
  traffic_desktop_directions: 'Directions from computer',

  // ─── Traffic Notification Descriptions ───
  traffic_offline_maps_desc: 'Get updates about areas saved to your phone or tablet',
  traffic_nearby_incidents_desc: 'Get notifications about traffic, accidents, and construction near you',
  traffic_public_transit_desc: 'Get departure times, disruptions, and maps for nearby stations',
  traffic_parking_desc: 'Get updates about where you parked',
  traffic_desktop_directions_desc: 'Send trip directions to your phone',

  // ─── Recommendation Notification Items ───
  recommendation_title: 'Personalized recommendations',
  recommendation_nearby_places: 'Nearby places and events',
  recommendation_new_places: 'New and trending places',
  recommendation_nearby_desc: 'Get recommendations about nearby places and events',
  recommendation_new_desc: 'Get notifications about new and trending places based on your preferences',

  // ─── Common Setting Values ───
  setting_on: 'On',
  setting_off: 'Off',
  setting_app_only: 'App only',

  // ─── Contribute Page ───
  contribute_view_profile: 'View profile',
  contribute_level_suffix: ' Local Guide',
  contribute_points_to_next: '15 more points to reach Level 2',
  contribute_add_place: 'Add a place',
  contribute_update_place: 'Update a place',
  contribute_add_review: 'Add a review',
  contribute_add_photo: 'Add a photo',
  contribute_badge_title: 'Earn the "New contributor" badge',
  contribute_badge_desc: 'Get started with these simple updates',
  contribute_post_photos: 'Post 2 photos',
  contribute_write_reviews: 'Write 2 reviews',
  contribute_answer_questions: 'Answer 2 questions',
  contribute_info_note: 'Places shown here are based on your search terms, current location, and other info (?)',
  contribute_level_title: 'Local Guide',

  // ─── Me Page ───
  me_address_title: 'Confirm your home address',
  me_address_desc: 'Get convenient home delivery wherever you live',
  me_start: 'Get started',
  me_recent_interactions: 'Recent places',
  me_recent_desc: 'From Maps history and saved places',
  me_chip_area: 'Area',
  me_chip_category: 'Category',
  me_chip_saved: 'Saved',
  me_chip_history: 'Maps history',
  me_view_all: 'View all',
  me_your_lists: 'Your lists',
  me_new_list: 'New list',
  me_favorites: 'Favorites',
  me_want_to_go: 'Want to go',
  me_starred: 'Starred places',
  me_list_private: 'Private',
  me_list_places_count: ' places',

  // ─── Search Page ───
  search_typing_hint_title: 'Tired of typing?',
  search_typing_hint_desc: 'Sign in to get suggestions based on your search history and Google contacts.',
  search_login_save: 'Sign in to save searches',

  // ─── Language Page ───
  language_chinese_short: 'Chinese',

  // ─── Place Detail Extras ───
  place_reviews_paren_prefix: '(',
  place_reviews_paren_suffix: ')',
  place_open_until_example: '· Closes at 22:00',
  place_detail_title: 'Place details',
  place_loading_detail: 'Loading place details',
  place_no_description: 'No description available',

  // ─── Map Error Messages ───
  error_location_generic: 'Unable to get location',
  error_location_denied: 'Location access denied',
  error_location_unavailable: 'Location unavailable',
  error_location_timeout: 'Location request timed out',

  // ─── Route Setup ───
  route_setup_select_start: 'Choose starting point',
  route_setup_select_dest: 'Choose destination',

  // ─── About Section Headers ───
  about_service_options: 'Service options',
  about_accessibility: 'Accessibility',
  about_activities: 'Activities',
  about_amenities: 'Amenities',
  about_parking: 'Parking',
  about_payments: 'Payments',
  about_children: 'Children',
  about_pets: 'Pets',

  // ─── About Section Items — Service ───
  about_dine_in: 'Dine-in',
  about_takeout: 'Takeout',
  about_delivery: 'Delivery',
  about_reservable: 'Reservable',
  about_serves_breakfast: 'Serves breakfast',
  about_serves_lunch: 'Serves lunch',
  about_serves_dinner: 'Serves dinner',
  about_serves_brunch: 'Serves brunch',
  about_serves_coffee: 'Serves coffee',
  about_serves_dessert: 'Serves dessert',
  about_serves_beer: 'Serves beer',
  about_serves_wine: 'Serves wine',
  about_serves_cocktails: 'Serves cocktails',
  about_serves_vegetarian: 'Serves vegetarian food',

  // ─── About Section Items — Accessibility ───
  about_wheelchair_entrance: 'Wheelchair-accessible entrance',
  about_wheelchair_parking: 'Wheelchair-accessible parking',
  about_wheelchair_restroom: 'Wheelchair-accessible restroom',
  about_wheelchair_seating: 'Wheelchair-accessible seating',

  // ─── About Section Items — Activities ───
  about_outdoor_seating: 'Outdoor seating',
  about_live_music: 'Live music',
  about_good_for_sports: 'Good for watching sports',

  // ─── About Section Items — Amenities ───
  about_restroom: 'Restroom',
  about_good_for_groups: 'Good for groups',

  // ─── About Section Items — Parking ───
  about_free_parking: 'Free parking lot',
  about_paid_parking: 'Paid parking lot',
  about_street_parking: 'Street parking',
  about_garage_parking: 'Garage parking',
  about_valet_parking: 'Valet parking',

  // ─── About Section Items — Payments ───
  about_debit_cards: 'Debit cards',
  about_credit_cards: 'Credit cards',
  about_nfc_payments: 'NFC payments',
  about_cash_only: 'Cash only',

  // ─── About Section Items — Children ───
  about_good_for_children: 'Good for children',
  about_kids_menu: 'Kids menu',

  // ─── About Section Items — Pets ───
  about_dogs_allowed: 'Dogs allowed',
};
