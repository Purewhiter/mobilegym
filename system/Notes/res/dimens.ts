/**
 * Notes 尺寸常量
 * 对应 AOSP res/values/dimens.xml
 */
export const dimens = {
  /** floating_action_button_size */
  fab_size: 58,
  /** floating_action_bar_margin_end/bottom */
  fab_margin: 35,
  /** v12_grid_item_shape_radius */
  /** note_editor_padding */
  note_editor_padding: 12,
  /** note_edit_title_font_size */
  note_editor_title_size: 24,

  // [icon sizes]
  icSizeTab: 24,
  icSizeNav: 24,
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,
  icStrokeWidth: 2,    // standard Ic* stroke width
  icSizeChevron: 18,   // list/settings trailing chevron (IcNavForward)
} as const;
