// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [icon sizes]
  icSizeTab: 32,
  icSizeNav: 24,
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,
  icSizeChevron: 20,    // px — IcNavForward as list row trailing chevron
  icStrokeWidth: 2,    // standard stroke width for Ic* icons

  // [player]
  player_album_art_max_height: 360, // px — max-h-[360px]

  // [bottom_player]
  bottom_player_progress_height: 2, // px — h-[2px]
  bottom_player_bottom: 100, // px — mini player bottom offset above tab bar

  // [queue_sheet]

  // [track_menu]

  // [library]

  // [home / search]

  // [playlist_page]

  // [artist_page]

  // [tab bar area]
  tab_bar_height: 85, // px — bottom tab bar height and create sheet anchor

  // [search]
} as const;
