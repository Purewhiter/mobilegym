// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [display area]

  // [function keys (AC, +/-, %)]

  // [digit keys (0–9, decimal)]

  // [operator keys (÷, ×, -, +, =)]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
