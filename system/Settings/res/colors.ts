// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [page / global background]
  // [card / surface]
  // [text]
  // [icon]
  // [divider]
  // [switch / toggle]
  // [search bar]
  search_bar_background: 'rgba(255,255,255,0.80)', // bg-white/80
  // [badge]
  // [account avatar]
  // [dialog / bottom sheet]
  dialog_overlay: 'rgba(0,0,0,0.40)',
  // [seek bar]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
