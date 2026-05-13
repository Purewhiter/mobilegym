// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [note card]
  note_card_shadow: 'rgba(0,0,0,0.04)',

  // [home]

  // [detail page]
  detail_image_indicator_inactive: 'rgba(255,255,255,0.50)',

  // [follow button]

  // [comment]

  // [me page]
  me_page_bg: '#1A1A1A',
  me_nav_frosted_bg: 'rgba(255,255,255,0.20)',
  me_nav_frosted_border: 'rgba(255,255,255,0.20)',

  // [follow story ring]

  // [city dropdown]
  city_distance_active_bg: 'rgba(255,36,66,0.05)',

  // [channel dropdown]

  // [note item border]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
