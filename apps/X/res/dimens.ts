// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [icon_sizes]
  icSizeTab: 24,       // px — tab bar icons
  icSizeNav: 20,       // px — navigation/back icons
  icSizeAction: 18,    // px — action icons in post action bar
  icSizeService: 28,   // px — service/drawer icons
  icSizeToolbar: 22,   // px — compose toolbar icons
  icStrokeWidth: 2,    // standard stroke width for Ic* icons

  // [feed]
  feed_image_max_height: 500, // px — max-h-[500px]

  // [action_bar]
  action_icon_hit_area_offset: -8, // px — -ml-2 left offset

  // [tab_indicator]

  // [header]

  // [profile]
  profile_avatar_offset_top: -40, // px — -top-10

  // [search]

  // [compose]
  compose_toolbar_icon_size: 24, // px — Image/Camera/MapPin etc.

  // [notifications]

  // [connections]

  // [fab]

  // [general]
} as const;
