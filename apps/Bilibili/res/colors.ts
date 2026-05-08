// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [player]
  player_overlay_bg: 'rgba(0,0,0,0.50)',
  player_back_btn_bg: 'rgba(0,0,0,0.50)',

  // [action bar]

  // [comment]

  // [follow button]

  // [suggestion card]

  // [video card]
  video_overlay_gradient_start: 'rgba(0,0,0,0.00)',
  video_overlay_gradient_end: 'rgba(0,0,0,0.60)',

  // [tab indicator]

  // [danmaku]

  // [ad banner]

  // [no-reprint badge]

  // [vip badge]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
