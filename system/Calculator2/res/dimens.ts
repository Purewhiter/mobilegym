export const dimens = {
  // [icon sizes]
  icSizeTab: 24,
  icSizeNav: 20,
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,

  // Display area text
  formula_text_min: 36, // px (对应 AOSP sp)
  formula_text_max: 64,
  formula_text_step: 8,
  result_text: 36,

  // Button text sizes
  numeric_button_text: 32,
  operator_button_text: 23,
  operator_text_button: 15, // del / clr
  advanced_button_text: 20,
  equals_button_text: 23,

  // Layout proportions
  pad_numeric_weight: 264,
  pad_operator_weight: 96,

  // Display padding
  display_formula_padding_top: 48,
  display_formula_padding_bottom: 24,
  display_formula_padding_sides: 16,
  display_result_padding_top: 24,
  display_result_padding_bottom: 48,
  display_result_padding_sides: 16,

  // Pad padding
  pad_numeric_padding_top: 12,
  pad_numeric_padding_bottom: 20,
  pad_numeric_padding_sides: 12,
  pad_operator_padding_top: 8,
  pad_operator_padding_bottom: 24,
  pad_operator_padding_start: 4,
  pad_operator_padding_end: 28,
  pad_advanced_padding_top: 12,
  pad_advanced_padding_bottom: 20,
  pad_advanced_padding_sides: 20,
} as const;
