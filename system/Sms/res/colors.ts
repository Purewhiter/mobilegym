// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [page / global background]
  page_background: '#f5f5f5',
  // [card / surface]
  // [text]
  // [conversation list item]
  // [unread indicator]
  // [avatar]
  // [message bubbles (conversation detail)]
  // [input bar]
  // [attachment panel]
  // [FAB]
  // [toolbar icons]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
