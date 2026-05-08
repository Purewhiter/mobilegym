// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [page / global background]
  // [text]
  // [card / surface]
  card_active_background: 'rgba(0,0,0,0.05)', // active:bg-black/5 tap feedback
  // [divider]
  divider: 'rgba(0,0,0,0.05)',         // bg-black/5 h-px separator
  // [contact row]
  // [section header in list]
  // [avatar placeholder]
  avatar_search_placeholder: 'rgba(0,0,0,0.10)', // bg-black/10
  // [favorites / starred icon]
  // [call log]
  call_type_icon_background: 'rgba(0,0,0,0.05)', // bg-black/5 circle
  // [dialpad overlay]
  // [call button in dialpad / detail]
  call_button_background: '#1dcd3a',   // accentGreen (from PHONE_CONFIG.theme)
  sms_button_background: 'rgba(0,0,0,0.05)',
  // [delete button in contact detail]
  // [search history]
  search_history_border: 'rgba(0,0,0,0.05)',
  // [alphabet index]
  // [FAB]
  fab_background: '#1dcd3a',           // accentGreen
  fab_shadow: 'rgba(0,0,0,0.16)',
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
