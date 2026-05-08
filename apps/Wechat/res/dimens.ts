// All app-level dimensions (matching AOSP dimens.xml)
// bench_env can replace this file to create different environments
export const dimens = {
  // [icon_sizes]
  icSizeTab: 24,       // px — tab bar icons, also TopBar main icons (message, more)
  icSizeNav: 28,       // px — navigation/back icons
  icSizeAction: 18,    // px — action icons in headers, search icon
  icSizeService: 28,   // px — service grid icons
  icSizeToolbar: 22,   // px — toolbar / me menu / list item icons
  icSizeChevron: 18,   // px — settings/list row trailing chevron (IcNavForward)
  icSizeChevronSm: 16, // px — smaller form/compact row chevron (address, region, sports)
  icSizeChevronLg: 20, // px — prominent profile section chevron (Me page wxid row)
  icSizePlusMenu: 20,  // px — plus menu action icons (start group, add friend, scan, qrcode)
  icSizeCheck: 20,     // px — checkmark/selection icons
  icSizePlaceholder: 48, // px — large placeholder icons (camera, empty state)
  icSizeHeartLg: 26,   // px — large heart icon (sports page likes)
  icSizeHeartSm: 20,   // px — small heart icon (step ranking likes)
  icSizeTiny: 14,      // px — tiny status icons (ear icon, etc.)
  icSizeXs: 12,        // px — extra small icons (lightbulb hint)
  icSizeAddLarge: 36,  // px — large add button icon (post moment)
  icSizeServiceGrid: 32, // px — service grid icons (Services page)
  icSizeClose: 26,     // px — close/dismiss button icon
  icSizeCloseLg: 28,   // px — large close button icon (camera view)
  icSizeListIcon: 24,  // px — list item icons (add friend options)
  icSizeWxidAdd: 13,   // px — tiny add icon next to wxid
  icStrokeWidth: 2,    // standard stroke width for line icons

  // [tab_bar]
  tab_bar_height: 56,             // px  — pb-16 bottom padding in content area (64px total safe)
  tab_bar_bottom_padding: 64,     // px  — pb-16 applied to scrollable content

  // [status_bar]
  status_bar_top_padding: 40,     // px  — pt-10

  // [app_bar / action_bar]
  action_bar_height: 56,          // px  — h-[56px] settings & me menu items

  // [chat_list]
  chat_list_item_avatar_size: 48, // px  — w-[48px] h-[48px]
  chat_list_item_avatar_radius: 6, // px  — rounded-[6px]
  chat_list_item_padding_x: 16,   // px  — px-4
  chat_list_item_padding_y: 12,   // px  — py-3
  chat_list_item_name_size: 17,   // px  — text-[17px]
  chat_list_item_preview_size: 14, // px  — text-[14px]
  chat_list_item_time_size: 11,   // px  — text-[11px]
  chat_list_alert_dot_size: 8,    // px  — w-2 h-2

  // [chat_detail]
  chat_bubble_padding_x: 12,      // px  — px-3
  chat_bubble_padding_y: 10,      // px  — py-2.5
  chat_bubble_radius: 6,          // px  — rounded-[6px]
  chat_bubble_text_size: 16,      // px  — text-[16px]
  chat_avatar_size: 40,           // px  — w-10 h-10
  chat_avatar_radius: 4,          // px  — rounded-[4px]
  chat_input_bar_height: 56,      // px
  chat_input_bar_padding_x: 12,   // px  — px-3
  chat_input_bar_padding_y: 8,    // px  — py-2
  chat_plus_icon_size: 28,        // px  — size={28}
  chat_time_label_text_size: 12,  // px  — text-[12px]
  chat_system_msg_text_size: 13,  // px  — text-[13px]

  // [chat_search]
  search_bar_input_height: 36,    // px  — h-[36px]
  search_bar_input_radius: 8,     // px  — rounded-[8px]
  search_icon_size: 18,           // px
  search_filter_tab_min_width: 80, // px  — min-w-[5rem]
  search_filter_text_size: 15,    // px  — text-[15px]
  search_result_avatar_size: 40,  // px  — w-10 h-10
  search_result_avatar_radius: 4, // px  — rounded-[4px]
  search_result_text_size: 15,    // px  — text-[15px]
  search_result_time_size: 12,    // px  — text-[12px]
  search_category_item_height: 52, // px  — min-h-[52px]

  // [contacts]
  contacts_item_avatar_size: 40,  // px  — w-10 h-10
  contacts_item_avatar_radius: 4, // px  — rounded-[4px]
  contacts_item_padding_x: 16,    // px  — px-4
  contacts_item_padding_y: 10,    // px  — py-2.5
  contacts_item_name_size: 17,    // px  — text-[17px]
  contacts_section_header_text_size: 12, // px  — text-xs

  // [me_page]
  me_avatar_size: 56,             // px  — w-[56px] h-[56px]
  me_avatar_radius: 8,            // px  — rounded-[8px]
  me_header_padding_top: 80,      // px  — pt-20
  me_header_padding_x: 24,        // px  — px-6
  me_header_padding_bottom: 32,   // px  — pb-8
  me_username_size: 20,           // px  — text-[20px]
  me_wxid_size: 14,               // px  — text-[14px]
  me_menu_item_height: 56,        // px  — h-[56px]
  me_menu_item_text_size: 17,     // px  — text-[17px]
  me_menu_icon_size: 22,          // px  — size={22}
  me_section_gap: 8,              // px  — h-2

  // [settings]
  settings_item_height: 56,       // px  — h-[56px]
  settings_item_text_size: 17,    // px  — text-[17px]
  settings_item_extra_text_size: 17, // px
  settings_item_padding_x: 20,    // px  — px-5
  settings_group_title_size: 14,  // px  — text-[14px]
  settings_group_title_padding_y: 8, // px  — py-2
  settings_group_margin_bottom: 8, // px  — mb-2

  // [address]
  address_field_padding_y: 16,    // px  — py-4
  address_field_text_size: 16,    // px  — text-[16px]
  address_link_text_size: 14,     // px  — text-sm

  // ===== 任意值迁移（启发式命名）=====
  // 审核后请改为语义命名
  // --- width ---
  discoverSearchWidth_1: 1,
  itemWidth_24: 24,
  itemWidth_34: 34,
  itemWidth_36: 36,
  settingsBlacklistWidth_40: 40,
  avatarWidth_44: 44,
  contactsUserProfileWidth_50: 50,
  avatarWidth_52: 52,
  itemWidth_56: 56,
  cardWidth_60: 60,
  avatarWidth_64: 64,
  meMomentsAlbumWidth_70: 70,
  cardWidth_78: 78,
  itemWidth_80: 80,
  itemWidth_84: 84,
  meMomentsAlbumWidth_85: 85,
  itemWidth_100: 100,
  discoverNearbyPeopleWidth_120: 120,
  discoverMomentsFeedWidth_150: 150,
  modalWidth_160: 160,
  contactsAddFriendWidth_175: 175,
  cardWidth_180: 180,
  itemWidth_184: 184,
  itemWidth_220: 220,
  itemWidth_240: 240,
  modalWidth_280: 280,
  cardWidth_320: 320,
  // --- text_size ---
  titleTextSize_6: 6,
  hintTextSize_10: 10,
  hintTextSize_12: 12,
  wechatAppTextSize_16: 16,
  titleTextSize_17: 17,
  titleTextSize_18: 18,
  itemTextSize_22: 22,
  titleTextSize_24: 24,
  titleTextSize_26: 26,
  titleTextSize_28: 28,
  titleTextSize_34: 34,
  titleTextSize_48: 48,
  // --- height ---
  dividerHeight_1: 1,
  dividerHeight_2: 2,
  chatChatInfoHeight_18: 18,
  itemHeight_24: 24,
  itemHeight_28: 28,
  itemHeight_34: 34,
  itemHeight_36: 36,
  cardHeight_40: 40,
  avatarHeight_44: 44,
  settingsIncomingRingtoneHeight_50: 50,
  itemHeight_52: 52,
  itemHeight_60: 60,
  avatarHeight_64: 64,
  itemHeight_65: 65,
  itemHeight_72: 72,
  cardHeight_78: 78,
  itemHeight_80: 80,
  itemHeight_84: 84,
  meMomentsAlbumHeight_85: 85,
  itemHeight_88: 88,
  itemHeight_100: 100,
  cardHeight_120: 120,
  modalHeight_160: 160,
  contactsAddFriendHeight_175: 175,
  itemHeight_180: 180,
  itemHeight_280: 280,
  cardHeight_300: 300,
  itemHeight_320: 320,
  itemHeight_400: 400,
  // --- padding_y ---
  itemPaddingY_3: 3,
  // --- min_height ---
  cardMinHeight_40: 40,
  itemMinHeight_52: 52,
  itemMinHeight_72: 72,
  itemMinHeight_400: 400,
  // --- max_height ---
  cardMaxHeight_120: 120,
  cardMaxHeight_300: 300,
  // --- max_width ---
  discoverNearbyPeopleMaxWidth_120: 120,
  discoverMomentsFeedMaxWidth_150: 150,
  cardMaxWidth_180: 180,
  itemMaxWidth_220: 220,
  itemMaxWidth_240: 240,
  contactsUserProfileMaxWidth_280: 280,
  cardMaxWidth_320: 320,
  // --- gap ---
  discoverMomentMediaPickerGap_2: 2,
  itemGap_3: 3,
  // --- padding ---
  cardPadding_1: 1,
  discoverMomentMediaPickerPadding_2: 2,
  cardPadding_3: 3,
} as const;
