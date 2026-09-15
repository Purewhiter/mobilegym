import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Scroll Lab',
  list_subtitle: '100 fixed items · no search shortcut',
  item_title_prefix: 'Test Record',
  preview_short: 'Used to verify target localization after repeated scrolling.',
  preview_medium: 'This record has a longer summary so the deterministic list contains mixed row heights.',
  preview_long: 'The data order is fixed; after every reset, each target returns to the same list position.',
  target_mid_title: 'Aiden Scroll Target 024',
  target_deep_title: 'Aiden Scroll Target 083',
  target_badge: 'TARGET',
  detail_position_prefix: 'List position',
  detail_position_separator: 'of',
  detail_code_prefix: 'Record code',
  detail_selected: 'Selection recorded',
  detail_not_selected: 'Selection not recorded',
  item_not_found: 'Record not found',
};
