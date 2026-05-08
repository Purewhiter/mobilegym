// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [layout]

  // [icon sizes]
  icSizeTab: 24,
  icSizeNav: 20,
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,
  icSizeNavLarge: 28,  // px — CategoryPage header nav back
  icStrokeWidth: 2,    // standard Ic* stroke width
  icSizeChevron: 20,   // list/settings trailing chevron (IcNavForward)
  icSizeBreadcrumb: 14, // px — breadcrumb path separator arrow (FolderPage)

  // [category grid]

  // [storage list item]

  // [selection circle]

  // [bottom action bar]
  selection_action_bar_height: 'calc(72px + env(safe-area-inset-bottom))',
  selection_action_bar_scroll_padding: 'calc(96px + env(safe-area-inset-bottom))',
  main_tab_bar_height: 80,

  // [file list thumbnail]

  // [category page list thumbnail]

  // [recent page media grid]

  // [clipboard bar]

  // [section header]
  section_title_sticky_top: 95, // px — top-[95px]
} as const;
