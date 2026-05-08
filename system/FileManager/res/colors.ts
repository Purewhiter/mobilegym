// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [category icons — file type chips in Browse home]

  // [file icon colors — per MIME type in fileUtils.ts]

  // [list item]

  // [selection indicator]

  // [breadcrumb]

  // [clipboard indicator]

  // [section header]

  // [video overlay badge]

  // [toolbar icons]

  // [empty state]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
