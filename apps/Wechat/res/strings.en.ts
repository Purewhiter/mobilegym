/**
 * Wechat English string resources
 * Corresponds to strings.ts (Chinese source)
 */
import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  // ============================================================================
  // [common] - 通用高频字符串
  // ============================================================================
  common_wechat: 'WeChat',
  common_cancel: 'Cancel',
  common_confirm: 'OK',
  common_done: 'Done',
  common_save: 'Save',
  common_delete: 'Delete',
  common_search: 'Search',
  search_section_contacts: 'Contacts',
  search_section_features: 'Features',
  common_loading: 'Loading...',
  common_unknown: 'Unknown',
  common_today: 'Today',
  common_male: 'Male',
  common_female: 'Female',

  // ============================================================================
  // [tabs] - 底部导航标签
  // ============================================================================
  tab_wechat: 'WeChat',
  tab_contacts: 'Contacts',
  tab_discover: 'Discover',
  tab_me: 'Me',

  // ============================================================================
  // [discover] - 发现页功能
  // ============================================================================
  discover_moments: 'Moments',
  discover_channels: 'Channels',
  discover_live: 'Live',
  discover_scan: 'Scan',
  discover_shake: 'Shake',
  discover_listen: 'Listen',
  discover_watch: 'Top Stories',
  discover_search: 'Search',
  discover_nearby: 'People Nearby',
  discover_mini_programs: 'Mini Programs',
  discover_games: 'Games',

  // ============================================================================
  // [discover_management] - 发现页管理
  // ============================================================================
  discover_management: 'Manage Discover',
  discover_friend_permission: 'Friend Permissions',

  // ============================================================================
  // [contacts] - 通讯录相关
  // ============================================================================
  contacts_new_friend: 'New Friends',
  contacts_add_friend: 'Add Contacts',
  contacts_group_chat: 'Group Chats',
  contacts_start_group: 'New Group',
  contacts_start_group_pick_existing: 'Choose an existing group',
  contacts_start_group_create_new: 'Create new group',
  contacts_start_group_face_to_face: 'Face-to-Face Group',
  contacts_start_group_pick_from_group: 'Choose from group members',
  contacts_tags: 'Tags',
  contacts_friend_info: 'Friend Info',
  contacts_phone: 'Phone Number',

  // ============================================================================
  // [settings] - 设置相关
  // ============================================================================
  settings_title: 'Settings',
  settings_profile: 'Profile',
  settings_account_security: 'Account Security',
  settings_minor_mode: 'Minor Mode',
  settings_care_mode: 'Care Mode',
  settings_notifications: 'Notifications',
  settings_chat: 'Chats',
  settings_general: 'General',
  settings_subscriptions: 'Subscriptions',
  settings_privacy: 'Privacy',
  settings_dark_mode: 'Dark Mode',
  settings_follow_system: 'Follow System',
  settings_accessibility: 'Accessibility',
  settings_wechat_sports: 'WeRun',
  settings_wechat_beans: 'WeChat Beans',
  settings_personal_info: 'Personal Info & Permissions',
  settings_personal_info_list: 'Personal Info Collection List',
  settings_third_party_list: 'Third-Party Sharing List',
  settings_plugins: 'Plugins',
  settings_about: 'About WeChat',
  settings_switch_account: 'Switch Account',
  settings_logout: 'Log Out',

  // ============================================================================
  // [chat] - 聊天相关
  // ============================================================================
  chat_title: 'Chat',
  chat_only: 'Chats Only',
  chat_complaint: 'Report',
  chat_contact_not_found: 'Contact not found',
  chat_plus_coupon: 'Cards & Offers',

  // ============================================================================
  // [me] - 个人页面
  // ============================================================================
  me_wxid_label: 'WeChat ID: ',
  me_status: 'Status',
  me_services: 'Services',
  me_favorites: 'Favorites',
  me_stickers: 'Stickers',
  me_album: 'Album',
  me_location: 'Location',
  me_pay: 'Pay',
  
  // ============================================================================
  // [profile] - 个人资料页面
  // ============================================================================
  profile_avatar: 'Avatar',
  profile_name: 'Name',
  profile_gender: 'Gender',
  profile_region: 'Region',
  profile_wxid: 'WeChat ID',
  profile_qrcode: 'My QR Code',
  profile_pat: 'Poke',
  profile_signature: 'What\'s Up',
  profile_pat_hint: 'Shown when friends tap you.',
  profile_signature_placeholder: 'Write a status',
  profile_ringtone: 'Ringtone',
  profile_address: 'My Addresses',
  profile_invoice: 'My Invoices',
  profile_not_set: 'Not set',
  
  // ============================================================================
  // [topbar] - 顶部导航栏标题
  // ============================================================================
  topbar_post_text: 'Post Text',
  topbar_edit_name: 'Edit Name',
  topbar_set_gender: 'Set Gender',
  topbar_select_region: 'Select Region',
  topbar_signature: 'What\'s Up',
  topbar_add_address: 'Add Address',
  topbar_add_invoice: 'Add Invoice',
  topbar_banner_display: 'Banner Display',
  topbar_notification_sound: 'Notification Sound',
  topbar_media_files: 'Photos, Videos, Files & Calls',
  topbar_add_me_methods: 'Ways to Add Me',
  topbar_moments_permission: 'Moments Permissions',
  topbar_top_stories_permission: 'Top Stories Permissions',
  topbar_blacklist: 'Blocked List',
  topbar_leaderboard: 'Leaderboard',
  topbar_my_profile: 'My Profile',
  topbar_privacy_settings: 'Privacy & Notification Settings',
  topbar_sports_profile: 'Sports Profile',

  // ============================================================================
  // [accessibility] - 辅助功能
  // ============================================================================
  accessibility_tencent_news: 'Tencent News',
  accessibility_broadcast: 'Broadcast',
  accessibility_qq_mail: 'QQ Email',
  accessibility_wechat_pay: 'WeChat Pay',
  accessibility_wechat_games: 'WeChat Games',
  accessibility_desc_tencent_news: 'Find the latest and most comprehensive news here.',
  accessibility_desc_broadcast: 'Send the same message to multiple friends.',
  accessibility_desc_qq_mail: 'Receive QQ email notifications in WeChat.',
  accessibility_desc_wechat_sports: 'See how your friends are doing with their workouts.',
  accessibility_desc_wechat_pay: 'Safe, fast, and efficient payment experience.',
  accessibility_desc_wechat_games: 'Discover fun mobile games.',
  accessibility_enabled: 'Enabled',
  accessibility_disabled: 'Not Enabled',
  accessibility_intro: 'Introduction',
  accessibility_clear_history: 'Clear Message History',
  accessibility_enable: 'Enable This Feature',
  accessibility_disable: 'Disable',
  accessibility_enter: 'Enter',
  accessibility_enter_my_profile: 'My Profile',
  accessibility_invite_friend: 'Invite Friends',
  accessibility_faq: 'FAQ',
  accessibility_data_source: 'Data Source',
  accessibility_sticky: 'Pin This Feature',
  accessibility_dnd: 'Do Not Disturb',
  accessibility_first_page: 'First Page',
  accessibility_second_page: 'Second Page',

  // ============================================================================
  // [sound] - 通知声音选项
  // ============================================================================
  sound_follow_system: 'Follow System',
  sound_blocks: 'Blocks',
  sound_cute: 'Cute',
  sound_ethereal: 'Ethereal',
  sound_playful: 'Playful',
  sound_crisp: 'Crisp',
  sound_lively: 'Lively',
  sound_elegant: 'Elegant',

  // ============================================================================
  // [wechat_sports] - 微信运动
  // ============================================================================
  sports_share_joy: 'Share the joy of sports with you',
  sports_welcome: 'Hey, new friend, come in!',
  sports_leaderboard: 'Step Leaderboard',
  sports_no_data: 'No data',
  sports_set_background: 'Tap to set background',
  sports_today: 'Today\'s Activity',
  sports_steps: 'Steps',
  sports_following: 'Following',
  sports_donate: 'Donate Steps',
  sports_likes_title: 'Update steps to get ranking',
  sports_hint: 'Activity data updates daily at 7:00 AM',
  sports_join_leaderboard: 'Join Leaderboard',
  sports_recv_leaderboard_msg: 'Receive Leaderboard Messages',
  sports_recv_like_msg: 'Receive Like Messages',
  sports_exclude_ranking: 'Exclude from Ranking',
  sports_cover_occupied: 'has the cover',

  // ============================================================================
  // [friend_info] - 朋友资料
  // ============================================================================
  friend_not_found: 'Profile not found',
  chat_info_not_found: 'Chat info not found',
  chat_info_search_history: 'Search Chat History',
  chat_info_mute_notifications: 'Mute Notifications',
  chat_info_pin_chat: 'Pin Chat',
  chat_info_alerts: 'Alerts',
  chat_info_set_background: 'Set Current Chat Background',
  chat_info_clear_history: 'Clear Chat History',
  friend_permission_chat_all: 'Chat, Moments, WeChat Sports, etc.',
  friend_remark: 'Remarks',
  friend_remark_name: 'Alias',
  friend_phone: 'Phone',
  friend_memo: 'Notes',
  friend_photos: 'Photos',
  friend_permission: 'Permissions',
  friend_more_info: 'More Info',
  friend_common_groups: 'Common Groups',
  friend_signature: 'Status',
  friend_source: 'Source',
  friend_added_time: 'Added On',
  friend_default_signature: 'Learning makes me happy',
  friend_default_source: 'Added via QR Code',
  friend_groups_count: '',

  // ============================================================================
  // [general] - 通用设置
  // ============================================================================
  general_on: 'On',
  general_off: 'Off',
  general_interface_display: 'Interface & Display',
  general_landscape_mode: 'Enable Landscape Mode',
  general_nfc: 'Enable NFC',
  general_auto_download: 'Auto-download WeChat Update',
  general_wifi_only: 'Wi-Fi Only',
  general_language: 'Language',
  general_translation: 'Translation',
  general_other: 'Other',
  general_storage: 'Storage',
  general_font_size: 'Font Size',

  // ============================================================================
  // [chat_settings] - 聊天设置
  // ============================================================================
  chat_settings_history: 'Chat History',
  chat_settings_auto_download_voice: 'Auto-download Voice Messages',
  chat_settings_emoji: 'Chat Stickers',
  chat_settings_video_auto: 'Auto-mute & PiP for Videos',
  chat_settings_use_speaker: 'Use Earpiece for Voice',
  chat_settings_mic_mode: 'Enable Mic Recording Popup',
  chat_settings_enable_speaker: 'On',
  chat_settings_disable_speaker: 'Off',
  chat_settings_ringtone: 'Ringtone',
  chat_settings_manage: 'Manage Chat History',
  chat_settings_backup: 'Backup & Migrate',
  chat_settings_clear_cache: 'Clear Chat Cache',
  chat_settings_speaker_mode: 'Use Earpiece for Voice Messages',
  chat_settings_send_button: 'Use Separate Send Button',
  chat_settings_send_button_hint: 'When enabled, the keyboard send button is replaced with newline',
  chat_settings_background: 'Chat Background',
  chat_settings_sticker_manage: 'Sticker Management',
  chat_settings_clear_history: 'Clear Chat History',

  // ============================================================================
  // [notifications] - 通知设置
  // ============================================================================
  notification_message: 'Message Notifications',
  notification_voice_video: 'Voice & Video Call Notifications',
  notification_display_content: 'Notification Display',
  notification_sound_vibration: 'Sound & Vibration',
  notification_system_settings: 'Go to System Settings',
  notification_ringtone_title: 'Sounds & Ringtones',
  notification_change: 'Change',
  notification_custom_friend_ringtone: 'Set Custom Ringtones for Friends',
  notification_display_count: 'Show "You received 1 message" only',
  notification_display_name: 'Show friend and group names',
  notification_display_full: 'Show friend/group names and message content',

  // ============================================================================
  // [chat_search] - 聊天搜索筛选
  // ============================================================================
  search_date: 'Date',
  search_photo_video: 'Photos & Videos',
  search_file: 'Files',
  search_link: 'Links',
  search_music_audio: 'Music & Audio',
  search_transaction: 'Transactions',
  search_mini_program: 'Mini Programs',
  search_channels: 'Channels',
  search_contact_card: 'Contact Cards',
  search_location: 'Location',
  search_note: 'Notes',
  search_product: 'Products',
  search_gift: 'Gifts',
  search_all: 'All',
  search_photo: 'Photos',
  search_clear: 'Clear',
  search_no_results: 'No matching results found',
  search_image_placeholder: '[Image]',
  search_specific_content: 'Search Specific Content',

  // ============================================================================
  // [time] - 时间格式
  // ============================================================================
  time_sunday: 'Sun',
  time_monday: 'Mon',
  time_tuesday: 'Tue',
  time_wednesday: 'Wed',
  time_thursday: 'Thu',
  time_friday: 'Fri',
  time_saturday: 'Sat',
  time_month_day: '',
  
  // ============================================================================
  // [common_time] - 时间相关
  // ============================================================================
  time_yesterday: 'Yesterday',
  time_just_now: 'Just now',
  time_minutes_ago: 'min ago',
  
  // ============================================================================
  // [chat_plus_menu] - 聊天加号菜单
  // ============================================================================
  chat_album: 'Album',
  chat_camera: 'Camera',
  chat_video_call: 'Video Call',
  chat_location: 'Location',
  chat_voice_input: 'Voice Input',
  chat_red_packet: 'Red Packet',
  chat_transfer: 'Transfer',
  chat_gift: 'Gift',
  chat_file: 'File',
  chat_card: 'Contact',
  chat_music: 'Music',
  chat_send: 'Send',
  chat_original_image: 'Original',
  chat_image_placeholder: '[Image]',
  chat_file_placeholder: '[File]',

  // ============================================================================
  // [chat_select_file] - Send file picker
  // ============================================================================
  selectFile_title: 'Select File',
  selectFile_cancel: 'Cancel',
  selectFile_send: 'Send',
  selectFile_tab_chat: 'Chats',
  selectFile_tab_favorites: 'Favorites',
  selectFile_tab_album: 'Album',
  selectFile_tab_file: 'Files',
  selectFile_favorites_empty: 'No files',
  selectFile_album_today: 'Today',
  selectFile_album_yesterday: 'Yesterday',
  selectFile_album_recent_7d: 'Past 7 days',
  selectFile_chat_recent_30d: 'Past 30 days',
  selectFile_file_empty_hint: 'Pick a file from your phone',
  selectFile_file_pick: 'Pick',
  selectFile_chat_empty: 'No files',
  selectFile_album_empty: 'No photos',
  selectFile_browser_title: 'Select File',
  selectFile_chat_from: 'From',
  selectFile_selected_count: '{n} selected',
  selectFile_selected_remove: 'Remove',

  // ============================================================================
  // [share/forward] - Receive external share → pick chat / create chat / confirm
  // ============================================================================
  share_title: 'Select Chat',
  share_recent_forwards: 'Recent Forwards',
  share_recent_chats: 'Recent Chats',
  share_create_chat_link: 'Create Chat',
  share_create_chat_title: 'Create Chat',
  share_create_pick_existing_group: 'Pick existing group',
  share_create_new_group: 'New group chat',
  share_create_pick_from_group: 'Pick from group members',
  share_done: 'Done',
  share_send_image_to: 'Send to:',
  share_send_button: 'Send',
  share_cancel: 'Cancel',
  share_caption_placeholder: 'Message',
  share_toast_sent: 'Sent',
  share_no_target: 'No contact selected',

  // ============================================================================
  // [moments_camera] - 发朋友圈相机菜单
  // ============================================================================
  moments_shoot: 'Shoot',
  moments_photo_video: 'Photo or Video',
  moments_from_album: 'Choose from Album',

  // ============================================================================
  // Service group titles
  // ============================================================================
  service_group_finance: 'Finance',
  service_group_daily_life: 'Daily Services',
  service_group_transport: 'Transportation',
  service_group_shopping: 'Shopping',

  // ============================================================================
  // Service item labels
  // ============================================================================
  service_credit_card_repay: 'Credit Card Repayment',
  service_wealth_management: 'Wealth Management',
  service_insurance: 'Insurance Services',
  service_phone_topup: 'Mobile Top-Up',
  service_utility_payment: 'Utility Payment',
  service_qcoin_topup: 'Q-Coin Top-Up',
  service_city_service: 'City Services',
  service_tencent_charity: 'Tencent Charity',
  service_healthcare: 'Healthcare',
  service_travel: 'Travel Services',
  service_train_air_ticket: 'Train & Flight Tickets',
  service_didi: 'DiDi Ride-Hailing',
  service_hotel: 'Hotels & B&B',
  service_brand_discovery: 'Brand Discovery',
  service_jd_shopping: 'JD.com Shopping',
  service_meituan_delivery: 'Meituan Delivery',
  service_entertainment: 'Movies, Shows & Fun',
  service_meituan_group_buy: 'Meituan Group Buy',
  service_pinduoduo: 'Pinduoduo',
  service_vip_sale: 'Vipshop Sale',
  service_zhuanzhuan: 'Zhuanzhuan Used Goods',
  service_wallet: 'Wallet',

  // ============================================================================
  // [contacts_page]
  // ============================================================================
  contacts_official_accounts: 'Official Accounts',
  contacts_count_suffix: ' contacts',

  // ============================================================================
  // [chat_list]
  // ============================================================================
  chat_list_date_format_month_day: '{{m}}/{{d}}',

  // ============================================================================
  // [payment]
  // ============================================================================
  pay_unknown_app: 'Unknown App',
  pay_default_type: 'Service',
  pay_default_user: 'User',
  pay_bilibili_site: 'Bilibili',
  pay_bilibili_membership: 'Bilibili Premium Membership',
  pay_bilibili_monthly: 'Bilibili Monthly Membership',
  pay_title_prefix: 'Buy ',
  pay_account: 'Account',
  pay_service_name: 'Service',
  pay_description: 'Description',
  pay_payment_method: 'Payment Method',
  pay_bilibili_description:
    'Bilibili Premium auto-renewal. One more month will be charged within 24 hours before expiry unless canceled.',
  pay_auto_renew_description: 'Auto-renewal service',
  pay_payment_method_description:
    'Balance will be charged first. If it fails, another payment method will be used.',
  pay_agreement_prefix: 'By continuing, you agree to the ',
  pay_agreement: 'Auto-Deduction Authorization',
  pay_paying: 'Processing...',
  pay_and_open: 'Pay & Activate',
  pay_give_up_payment: 'Give up this payment?',
  pay_continue_pay: 'Continue',
  pay_abandon: 'Give Up',
  pay_enter_password: 'Enter payment password',
  pay_period_year: 'Year',
  pay_period_quarter: 'Quarter',
  pay_period_month: 'Month',
  pay_source_bilibili: 'Bilibili',

  profile_phone_bound: 'Bound phone number: ',
  profile_phone_show: 'Show',
  profile_phone_hide: 'Hide',
  profile_phone_hint: 'This phone number is bound to your account. Tap the button below to see which friends in your contacts list have registered an account.',
  profile_phone_view_contacts: 'View Contacts',
  profile_phone_change: 'Change Phone Number',
  profile_region_current_location: 'Current location',
  profile_region_all_regions: 'All regions',
  profile_region_mainland_china: 'Mainland China',
  profile_region_selected: 'Selected',
  profile_region_mainland_beijing: 'Mainland China Beijing',
  subscription_intro: 'You have enabled the following services. Merchants will renew them automatically based on the agreed rules.',
  subscription_empty: 'No auto-renew services',
  subscription_service_center: 'Support Center',
  subscription_activated_on: 'Activated on',
  subscription_membership_line_separator: ' ',
  subscription_yearly_auto_renew: 'auto-renews yearly',
  subscription_detail_not_found: 'Subscription not found',
  subscription_detail_current_status: 'Current status',
  subscription_detail_status_active: 'Active',
  subscription_detail_status_disabled: 'Disabled',
  subscription_detail_activated_at: 'Activated at',
  subscription_detail_account: 'Account',
  subscription_detail_service_intro: 'Service description',
  subscription_service_description_template:
    'This membership renews automatically every year. The renewal fee is {{price}} yuan per {{cycle}}. On the expiration day, WeChat Pay will automatically charge and extend your service period. No further charges will be made after cancellation.',
  subscription_detail_payment_method: 'Payment method',
  subscription_detail_balance: 'Balance',
  subscription_detail_billing_history: 'Billing history',
  subscription_detail_stop_billing: 'Turn off billing service',
  subscription_cancel_confirm_title: 'Turn it off?',
  subscription_cancel_confirm_body:
    'After turning it off, the service will no longer renew automatically when it expires. You can enable it again at any time.',
  subscription_cancel_think_again: 'Cancel',
  subscription_cancel_still_close: 'Turn off anyway',
  translation_title: 'Translate',
  translation_target_label: 'Translate text to',
  translation_description: 'Text in chats, Moments, webpages, and images will be translated into the selected language.',
  translation_auto_label: 'Auto-translate incoming chat messages',
  translation_auto_description: 'When enabled, all incoming chat messages will be translated automatically.',
  translation_simplified_chinese: 'Simplified Chinese',
  camera_hint: 'Tap to take a photo, hold to record video',
  discover_live_broadcast: 'CCTV News Channel is on air',
  discover_game_bonus: '10th anniversary comeback rewards',
  discover_moments_cover_hint: 'Tap to change cover',
  moment_media_album_all: 'Photos and videos',
  moment_media_no_content: 'No content',
  moment_media_select: 'Select',
  moment_media_edit: 'Edit',
  moment_media_make_video: 'Create video',
  moment_media_preview: 'Preview',
  moment_media_done: 'Done',
  post_moment_placeholder: 'What is on your mind right now...',
  post_moment_location_placeholder: 'Location',
  post_moment_remind_who: 'Remind who to see',
  post_moment_who_can_see: 'Who can see this',
  post_moment_public: 'Public',
  post_moment_keep_edit: 'Keep this edit?',
  post_moment_keep: 'Keep',
  post_moment_dont_keep: 'Do not keep',
  profile_name_hint: 'A good name helps your friends remember you more easily.',
  profile_qrcode_instruction: 'Scan the QR code above to add me as a friend.',
  profile_qrcode_change_style: 'Change style',
  profile_qrcode_save_image: 'Save image',
  tags_hint: 'Use tags to find and manage contacts more easily.',
  tags_create: 'New Tag',
  invoice_empty: 'No invoice title yet',
  invoice_type_label: 'Title type',
  invoice_type_personal: 'Personal',
  invoice_type_company: 'Company',
  invoice_name_label: 'Name',
  invoice_name_placeholder: 'Name (required)',
  invoice_tax_label: 'Tax ID',
  invoice_tax_placeholder: 'Taxpayer identification number',
  top_stories_hide_likes: 'Don\'t view their likes',
  top_stories_hide_my_likes: 'Hide my likes from them',
  login_expired_message: 'Your WeChat login environment is abnormal. For account security, this login has expired.',
  login_expired_cancel: 'Cancel',
  login_expired_confirm: 'OK',

  // ============================================================================
  // [privacy_flow] - Privacy & account security (PrivacyFlow)
  // ============================================================================
  security_wechat_password: 'Weixin Password',
  security_voiceprint: 'Voiceprint',
  security_emergency_contacts: 'Emergency Contacts',
  security_login_devices: 'Login Devices',
  security_more_settings: 'More Security Settings',
  security_more_qq: 'QQ ID',
  security_more_email: 'Email Address',
  security_more_email_unbound: 'Not Linked',
  security_more_phone_protection: 'Phone Security',
  security_wechat_center: 'Weixin Security Center',
  security_center_hint:
    'For account security issues such as leakage of account information, forgotten password, and fraud, go to Weixin Security Center.',
  privacy_require_friend_request: 'Require Friend Request',
  privacy_add_me_methods_label: 'Methods for Friending Me',
  privacy_recommend_contacts: 'Recommend Contacts',
  privacy_recommend_contacts_hint:
    'Enabling will recommend you mobile contacts who also use the app in "Contacts" > "New Friends".',
  privacy_blacklist_contacts: 'Blocked List of Contacts',
  privacy_system_permission_mgmt: 'System Permission Management',
  privacy_authorization_mgmt: 'Authorization Management',
  privacy_personalized_ads: 'Personalized Ads Management',
  privacy_personal_info_export: 'View and Export Personal Information',
  privacy_guide_summary: 'Privacy Protection Summary',
  privacy_guide_full: 'Privacy Protection Guidelines',

  // ============================================================================
  // [moments_permissions] - Moments privacy
  // ============================================================================
  privacy_moments_hide_mine_from_them: 'Hide my Moments and Status from them',
  privacy_moments_do_not_view_theirs: 'Do not view their Moments and Status',
  privacy_moments_stranger_ten: 'Allow strangers to view 10 Moments posts',
  privacy_moments_friend_range: 'Allow friends to view Moments within',
  privacy_moments_range_half_year: 'Last 6 Months',
  privacy_moments_range_month: 'Last Month',
  privacy_moments_range_three_days: 'Last 3 Days',
  privacy_moments_range_all: 'All',
  auth_permission_list_separator: ', ',

  // ============================================================================
  // [add_me_methods]
  // ============================================================================
  add_me_search_header: 'People can find me by',
  add_me_add_header: 'People can add me as a friend by',
  add_me_wechat_id: 'WeChat ID',
  add_me_qr_code: 'QR Code',
  add_me_other: 'Other',
  add_me_other_hint: 'Deleted contacts, Nearby, Radar, and other retained paths',

  // ============================================================================
  // [authorization]
  // ============================================================================
  auth_mgmt_title: 'Authorization Management',
  auth_mgmt_footer: 'Only apps with valid authorizations are shown',
  auth_app_type_mobile: 'Mobile App',
  auth_app_type_mini_program: 'Mini Program',
  auth_detail_title: 'Can access the following info or permissions',
  auth_permission_nickname_avatar: 'Nickname and Avatar',
  auth_permission_friends: 'Friends List',
  auth_deauthorize: 'Remove Authorization',
  auth_deauthorize_confirm:
    'After authorization is removed, "{{name}}" will no longer be able to access your related info or permissions.',

  // ============================================================================
  // [friend_perm_settings]
  // ============================================================================
  friend_perm_section_title: "Friends' Permissions",
  friend_perm_chat_only_hint:
    'They will not be able to see your Moments, Status, WeChat Sports, and more.',
  friend_perm_moments_status: 'Moments and Status',
  friend_perm_hide_my_moments: 'Hide My Moments',
  friend_perm_hide_their_moments: 'Hide Their Moments',
  friend_settings_not_found: 'Friend not found',
  friend_settings_edit_info: 'Edit Friend Info',
  friend_settings_recommend: 'Recommend to Friends',
  friend_settings_add_home: 'Add to Home Screen',
  friend_settings_star: 'Star Friend',
  friend_settings_blacklist: 'Add to Blacklist',
  friend_settings_blacklist_title: 'Add to Blacklist',
  friend_settings_blacklist_desc:
    "After adding this person to the blacklist, you will no longer receive their messages, and both of you will stop seeing each other's Moments updates.",

  // ============================================================================
  // [care_minor_mode]
  // ============================================================================
  care_mode_intro: 'After turning on Care Mode, you can use the following features:',
  care_mode_feature_1: 'Larger text, stronger colors, and bigger buttons.',
  care_mode_feature_2: 'Listen to text messages in chats.',
  care_mode_feature_3: 'Quiet mode to avoid loudspeaker interruptions.',
  common_turn_on: 'Turn On',
  common_turn_off: 'Turn Off',
  minor_mode_description:
    'To better protect minors, WeChat provides Minor Mode. Some features are restricted in this mode and should be configured by a guardian.',
  minor_mode_agreement: 'I have read and agree to the Terms for WeChat Minor Mode',

  // ============================================================================
  // [security_center]
  // ============================================================================
  security_help_center: 'Help Center',
  account_delete_title: 'Delete Account',
  security_recover_password: 'Recover Password',
  security_recover_password_desc: 'Appeal to recover your Weixin account password',
  security_unblock_account: 'Unblock Account',
  security_unblock_account_desc:
    'Request to unblock an account restricted for violations or other reasons',
  security_freeze_account: 'Freeze Account',
  security_freeze_account_desc:
    "Freeze WeChat if your or your friend's account is stolen or the phone is lost",
  security_unfreeze_account: 'Unfreeze Account',
  security_unfreeze_account_desc:
    'You can unfreeze the account after security risks are removed',
  security_report_rights: 'Report & Rights Protection',
  security_report_rights_desc: 'Learn how to report violations or infringement',
  security_delete_account_desc: 'Submit a request to permanently delete all data',
  account_delete_apply_title: 'Request to Delete WeChat Account',
  account_delete_verify_intro:
    'Before your deletion request takes effect, WeChat will complete the following checks to protect your account and funds:',
  account_delete_condition_1_title: 'Account is secure',
  account_delete_condition_1_desc: 'The account has no theft, suspension, or similar risks.',
  account_delete_condition_2_title: 'WeChat Pay settled',
  account_delete_condition_2_desc:
    'WeChat Pay has been closed, or was never enabled, and there are no outstanding funds to settle.',
  account_delete_condition_3_title: 'Cards and coupons cleared',
  account_delete_condition_3_desc: 'Cards and coupons under this account have been cleared.',
  account_delete_condition_4_title: 'Permissions released',
  account_delete_condition_4_desc:
    'Official accounts, Enterprise WeChat creator roles, and similar bindings must be released or transferred.',
  account_delete_condition_5_title: 'WeBeans settled',
  account_delete_condition_5_desc:
    'The WeBeans balance is cleared and creator income has been withdrawn.',
  account_delete_condition_6_title: 'Channels deleted or reassigned',
  account_delete_condition_6_desc:
    'Any linked Channels account must be deleted or transferred to another WeChat user.',
  account_delete_agree_read: 'I have read and agree to ',
  account_delete_agree_important: 'Important Reminder',
  account_delete_request_submit: 'Request Deletion',
  account_delete_warning_intro:
    'Deletion verification has passed. After you confirm deleting your Weixin account, the following data will be permanently removed.',
  account_delete_data_warning_1:
    'Contacts will be permanently deleted and cannot be recovered',
  account_delete_data_warning_2:
    'Group chat relationships will be permanently deleted and cannot be recovered',
  account_delete_data_warning_3:
    'Personal albums and favorites will be permanently deleted and cannot be recovered',
  account_delete_data_warning_4:
    'All records linked to Tencent or third-party services will be cleared and cannot be recovered',
  common_next: 'Next',
  account_delete_important_title: 'Important Reminder',
  account_delete_important_intro:
    'Deleting a Weixin account cannot be undone. Back up your account information and data in advance, and make sure all services tied to the account have been handled properly. You are responsible for the consequences of deleting the account.',
  account_delete_important_note:
    'Please note: after deleting this Weixin account, you will no longer be able to use it or recover any content, data, or bindings created with it, even if you register again with the same phone number. This includes but is not limited to:',
  account_delete_important_p1:
    '(1) You will not be able to sign in to or use this Weixin account, and your friends will not be able to contact you through it.',
  account_delete_important_p2:
    '(2) Your profile and historical information, including nickname, avatar, QR code card, message history, Moments content, photos, and favorites, cannot be recovered.',
  account_delete_important_p3:
    '(3) Before deleting your Weixin account, you must close your WeChat Pay accounts and settle all related funds.',
  account_delete_important_p4:
    '(4) Services from Tencent or third parties that you use, authorize, or bind with this Weixin account, such as games, wealth management, WeChat Pay, third-party sites, city services, bill payment, and tickets, will be terminated and cannot be recovered. Back up or handle relevant data before deletion.',
  account_delete_confirm_agree: 'Agree and Delete',
};
