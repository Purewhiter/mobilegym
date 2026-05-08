// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [meeting room (in-call screen)]

  // [meeting controls / mic]

  // [home page]

  // [meeting cards]

  // [me page]

  // [schedule meeting page]

  // [toggle switch]

  // [pro / upgrade badge]

  // [home action buttons]

  // [user avatar (profile)]

  // [overlay / backdrop]
  overlay_bg_light: 'rgba(0,0,0,0.30)',    // date picker and modal overlays
  overlay_bg_heavy: 'rgba(0,0,0,0.50)',    // exit meeting confirmation overlay
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
