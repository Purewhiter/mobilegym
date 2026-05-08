// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [logo — eBay brand letters]

  // [home page]

  // [search bar]

  // [quick filter chips]

  // [action links / interactive text]

  // [sort modal / filter drawer radio]

  // [info callout on Me page]

  // [product card]
  product_card_wishlist_btn_bg: 'rgba(255,255,255,0.8)', // semi-transparent white heart overlay

  // [category page]

  // [filter drawer — apply button]

  // [cart / me page icon background]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
