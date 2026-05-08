// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [status bar / layout]

  // [home page action grid]

  // [tab bar]

  // [header bar (subpages)]

  // [meeting list card]

  // [in-call (meeting room)]
  meeting_exit_button_height: 52,         // px (h-[52px]); action sheet row height

  // [me page]

  // [picker (scroll wheel)]
  picker_item_height: 44,           // px; each option row in PickerColumn
  picker_total_height: 220,         // px (h-[220px])
  timezone_item_height: 56,         // px; each row in timezone selector list

  // [toggle switch]

  // [cards / sections]

  // [general spacing]

  // [icon sizes]
  icSizeTab: 24,                    // px — tab bar icons
  icSizeNav: 20,                    // px — navigation / header icons
  icSizeAction: 18,                 // px — inline action icons
  icSizeService: 28,                // px — home action grid icons
  icSizeToolbar: 22,                // px — toolbar icons (me page header)
} as const;
