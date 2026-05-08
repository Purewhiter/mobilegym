// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [home page]

  // [search / URL bar]

  // [browser view URL strip]

  // [loading spinner]

  // [bottom navigation bar]

  // [tab counter badge]

  // [tabs overlay]

  // [quick links grid]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
