// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [status bar]

  // [post card]
  post_image_max_height: 500, // px (max-h-[500px])

  // [vote bar]

  // [action buttons]
  medal_btn_size: 34, // px (h-[34px] w-[34px])
  medal_icon_size: 18, // px (w-[18px] h-[18px])

  // [join button]

  // [bottom sheet]

  // [profile]
  profile_avatar_size: 88, // px (w-[88px] h-[88px])
  profile_avatar_ring: 3, // px (p-[3px])
  profile_username_size: 26, // px (text-[26px])

  // [answers mark blobs]

  // [icon sizes]
  icSizeTab: 24,      // tab bar icons
  icSizeNav: 20,      // navigation / chrome icons
  icSizeAction: 18,   // inline action icons
  icSizeService: 28,  // service grid icons
  icSizeToolbar: 22,  // toolbar icons
} as const;
