// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [feed]
  feed_post_hover_bg: 'rgba(0,0,0,0.03)',

  // [actions — post action icons]
  action_reply_hover_bg: 'rgba(29,155,240,0.1)',
  action_retweet_hover_bg: 'rgba(0,186,124,0.1)',
  action_like_hover_bg: 'rgba(249,24,128,0.1)',
  action_bookmark_hover_bg: 'rgba(29,155,240,0.1)',
  action_share_hover_bg: 'rgba(29,155,240,0.1)',

  // [search]
  search_sports_card_bg: 'rgba(0,0,0,0.04)',
  search_promo_image_opacity: 0.6,

  // [compose]
  compose_post_btn_disabled_bg: 'rgba(29,155,240,0.5)',
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
