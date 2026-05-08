// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [home feed]

  // [post card]

  // [vote]

  // [join button]

  // [bottom sheet]
  bottom_sheet_shadow: 'rgba(0,0,0,0.18)',

  // [bottom sheet icons]

  // [profile / user page]
  profile_avatar_ring: 'rgba(255,255,255,0.10)',

  // [answers page]

  // [divider]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
