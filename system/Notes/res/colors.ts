/**
 * Notes Tier-2 组件级颜色
 * 对应 AOSP res/values/colors.xml
 */
export const colors = {
  /** homepage_primary_color / page_bg */
  page_bg: '#f7f7f7',
  /** v12_theme_content_bg_color */
  /** theme_main_color */
  theme_main: '#ffbb0f',
  /** tab selected fillColor */
  tab_selected: '#ffbb0f',
  /** note_edit_extra_info_text_color (#66000000) */
  text_secondary: 'rgba(0,0,0,0.4)',
  /** note_dir_indicator_text_color_default (#cc000000) */
  text_secondary_strong: 'rgba(0,0,0,0.8)',
  /** note_dir_indicator_border_color_default (#0d000000) */
  hairline_border: 'rgba(0,0,0,0.05)',
  /** note_title_hint_color_default */
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
