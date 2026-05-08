// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [status bar]

  // [tab bar]

  // [icon sizes]
  icSizeTab: 24,      // tab bar icons
  icSizeNav: 20,      // navigation / chrome icons
  icSizeAction: 18,   // action button icons
  icSizeService: 28,  // service grid icons
  icSizeToolbar: 22,  // toolbar icons

  // [home nav bar]
  home_nav_height: 36, // px (h-[36px])

  // [note card]

  // [detail page]
  detail_header_min_height: 90, // px (min-h-[90px])
  detail_bottom_bar_height: 70, // px (h-[70px])
  detail_bottom_bar_input_height: 40, // px (h-[40px])
  detail_comment_avatar_size: 32, // px (w-[32px] h-[32px])

  // [follow story ring]
  follow_story_avatar_size: 52, // px (w-[52px] h-[52px])

  // [channel dropdown grid]
  channel_item_height: 36, // px (h-[36px])

  // [city dropdown sidebar]
  city_sidebar_width: 100, // px (w-[100px])
  city_sidebar_item_height: 44, // px (h-[44px])

  // [me page]
} as const;
