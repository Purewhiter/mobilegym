// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [top bar]

  // [photo grid]

  // [video badge overlay]

  // [favorite indicator]

  // [selection indicator]

  // [selection overlay]

  // [floating tab pill]

  // [album cover]

  // [album grid card]

  // [creations / tools list]

  // [favorites page header]

  // [photo viewer top/bottom overlay]

  // [photo viewer favorite active state]

  // [confirm dialog]

  // [select mode action bar]

  // [batch delete button]

  // [album date header sticky]

  // [customize button]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
