// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [top bar]
  top_bar_divider: 'rgba(0,0,0,0.05)',    // border-black/5

  // [segment tabs (主题 / 字体 / 息屏)]
  tab_container_bg: 'rgba(0,0,0,0.05)',    // bg-black/5 pill container

  // [theme / font / aod grid cards]
  card_border: 'rgba(0,0,0,0.05)',         // border-black/5
  card_preview_placeholder_bg: 'rgba(0,0,0,0.05)', // bg-black/5 image placeholder

  // [pill badges on cards]

  // [detail page — apply buttons]

  // [loading / empty states]

  // [preview image grid]
  preview_image_placeholder_bg: 'rgba(0,0,0,0.05)', // bg-black/5
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
