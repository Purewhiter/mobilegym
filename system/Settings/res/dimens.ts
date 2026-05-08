// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [icon_sizes]
  icSizeTab: 24,       // px — tab bar icons
  icSizeNav: 24,       // px — navigation/back icons
  icSizeAction: 18,    // px — action icons in headers
  icSizeService: 28,   // px — service/category icons
  icSizeToolbar: 22,   // px — toolbar icons
  icSizeChevron: 16,   // px — list/settings row trailing chevrons
  icStrokeWidth: 2,    // — standard icon stroke width

  // [toolbar / header]

  // [preference item]
  preference_item_min_height: 52,    // min-h-[52px] PreferenceItem / SwitchPreference

  // [category]

  // [main page search bar]

  // [switch / toggle]
  switch_track_width: 44,            // w-[44px]
  switch_track_height: 26,           // h-[26px]
  switch_thumb_size: 22,             // w-[22px] h-[22px]
  switch_track_padding: 2,           // p-[2px]

  // [seek bar]

  // [account card (first section)]

  // [badge]

  // [dialog / bottom sheet]

  // [list bottom padding]
} as const;
