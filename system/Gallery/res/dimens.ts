// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [layout]
  home_topbar_total_height: 88, // px — pt-10 (40) + topbar_height (48); used as paddingTop for scroll content

  // [icon sizes]
  icSizeTab: 22,
  icSizeNav: 26,       // overlay header nav back
  icSizeNavFullscreen: 30, // full-screen viewer nav back
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,
  icStrokeWidth: 2,    // standard Ic* stroke width
  icSizeChevron: 18,   // list/settings trailing chevron (IcNavForward)

  // [top bar]
  topbar_height: 48, // px — h-[48px]

  // [floating tab pill]
  tab_pill_bottom: 76, // px — bottom-[76px]

  // [photos page header]

  // [photo grid]
  grid_gap: 2, // px
  grid_padding: 2, // px

  // [video badge]

  // [favorite indicator]

  // [selection indicator]

  // [select mode action bar]
  select_bar_bottom: 132, // px — bottom-[132px]

  // [album grid]

  // [tool list row]

  // [customize button]

  // [photo viewer]

  // [album detail header]

  // [confirm dialog]
  dialog_width: 280, // px
} as const;
