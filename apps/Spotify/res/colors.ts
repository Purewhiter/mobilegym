// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [player]
  player_progress_track: 'rgba(255,255,255,0.2)', // progress bar background

  // [bottom_player]
  bottom_player_progress_track: 'rgba(255,255,255,0.1)', // mini progress bar background

  // [queue_sheet]
  queue_current_track_bg: 'rgba(255,255,255,0.05)', // current track highlight in queue

  // [track_menu]

  // [library]

  // [home]

  // [artist_page]

  // [playlist_page]

  // [search]

  // [liked_songs]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
