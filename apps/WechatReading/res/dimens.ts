// All app-level dimensions (matching AOSP dimens.xml)
// bench_env can replace this file to create different environments
export const dimens = {
  // [icon sizes]
  icStrokeWidth: 2,
  icSizeChevron: 16,
  icSizeTab: 24,
  icSizeNav: 20,
  icSizeAction: 18,
  icSizeService: 28,
  icSizeToolbar: 22,
  icSizeNavPagination: 14, // px — prev/next chapter pagination arrows
  icSizeInlineArrow: 10,   // px — tiny text-embedded "more" arrows in search
  icSizeFollowChevron: 20, // px — following/social list row trailing chevron
  icSizeReaderChevron: 12, // px — reader settings panel inline option chevrons
  icSizeTiny: 8,           // px — tiny check/indicator
  icSizeAvatarSm: 32,     // px — small avatar/icon in header
  icSizePlaceholder: 48,  // px — large placeholder icon

  // [status_bar]
  status_bar_top_padding: 40,        // px  — pt-10

  // [tab_bar]
  tab_bar_height: 56,                // px  — h-14
  tab_bar_icon_size: 24,             // px  — size={24}
  tab_bar_label_size: 10,            // px  — text-[10px]

  // [header / search bar]
  header_vertical_padding_top: 40,   // px  — pt-10
  header_vertical_padding_bottom: 8, // px  — pb-2
  header_search_bar_height: 40,      // px  — h-10
  header_search_icon_size: 18,       // px
  header_search_text_size: 15,       // px  — text-[15px]
  header_search_divider_width: 1,    // px  — w-[1px]
  header_search_divider_height: 16,  // px  — h-4

  // [bookshelf]
  bookshelf_search_bar_height: 36,   // px  — h-9
  bookshelf_sort_tab_padding_bottom: 12, // px — pb-3
  bookshelf_grid_columns: 3,         //     — grid-cols-3
  bookshelf_grid_gap_x: 16,          // px  — gap-x-4
  bookshelf_grid_gap_y: 32,          // px  — gap-y-8
  bookshelf_grid_padding: 16,        // px  — p-4
  bookshelf_selection_title_height: 48, // px — h-12
  bookshelf_title_size: 24,          // px  — text-2xl font-bold
  bookshelf_item_title_size: 13,     // px  — text-[13px]
  bookshelf_item_author_size: 9,     // px  — text-[9px]
  bookshelf_select_badge_size: 20,   // px  — w-5 h-5
  bookshelf_private_icon_size: 10,   // px  — size={10}
  bookshelf_footer_padding_bottom: 48, // px — pb-12
  bookshelf_footer_text_size: 12,    // px  — text-xs

  // [bookshelf_selection_toolbar]
  selection_toolbar_padding_top: 20, // px  — pt-5
  selection_toolbar_padding_bottom: 32, // px — pb-8
  selection_toolbar_padding_x: 24,   // px  — px-6
  selection_toolbar_icon_size: 24,   // px  — size={24}
  selection_toolbar_icon_text_size: 10, // px — text-[10px]
  selection_toolbar_row_gap: 28,     // px  — gap-y-7

  // [bookshelf_modal]
  modal_width_ratio: '80%',          //     — w-[80%]
  modal_max_width: 320,              // px  — max-w-[320px]
  modal_radius: 24,                  // px  — rounded-[24px]
  modal_padding: 32,                 // px  — p-8
  modal_title_size: 19,              // px  — text-[19px]
  modal_body_size: 15,               // px  — text-[15px]
  modal_action_row_height: 56,       // px  — h-14
  modal_action_text_size: 17,        // px  — text-[17px]
  modal_sheet_radius: 20,            // px  — rounded-t-[20px]
  modal_sheet_item_padding_x: 24,    // px  — px-6
  modal_sheet_item_padding_y: 16,    // px  — py-4
  modal_sheet_item_text_size: 15,    // px  — text-[15px]
  modal_sheet_icon_size: 20,         // px  — size={20}

  // [book_detail]
  book_detail_nav_padding_top: 48,   // px  — pt-12
  book_detail_nav_padding_x: 16,     // px  — px-4
  book_detail_nav_back_icon_size: 28, // px — size={28}
  book_detail_cover_width: 112,      // px  — w-28
  book_detail_cover_radius: 4,       // px  — rounded
  book_detail_title_size: 24,        // px  — text-2xl
  book_detail_author_size: 14,       // px  — text-sm
  book_detail_stat_divider_height: 32, // px — h-8
  book_detail_stat_label_size: 12,   // px  — text-xs
  book_detail_stat_value_size: 18,   // px  — text-lg
  book_detail_stat_sub_size: 10,     // px  — text-[10px]
  book_detail_card_padding: 20,      // px  — p-5
  book_detail_card_radius: 12,       // px  — rounded-xl
  book_detail_rating_bar_height: 6,  // px  — h-1.5
  book_detail_tag_padding_x: 12,     // px  — px-3
  book_detail_tag_padding_y: 6,      // px  — py-1.5
  book_detail_tag_radius: 8,         // px  — rounded-lg
  book_detail_tag_text_size: 12,     // px  — text-xs
  book_detail_action_bar_height: 64, // px  — h-16
  book_detail_action_icon_btn_size: 48, // px — w-12 h-10 (40px height)
  book_detail_action_btn_height: 40, // px  — h-10
  book_detail_action_btn_radius: 8,  // px  — rounded-lg
  book_detail_action_text_size: 14,  // px  — text-sm

  // [reader]
  reader_content_padding: 24,        // px  — p-6
  reader_content_padding_top: 40,    // px  — pt-10
  reader_doorleaf_padding: 32,       // px  — p-8
  reader_doorleaf_padding_top: 80,   // px  — pt-20
  reader_doorleaf_cover_width: 160,  // px  — w-40
  reader_doorleaf_cover_height: 224, // px  — h-56
  reader_doorleaf_title_size: 24,    // px  — text-2xl
  reader_doorleaf_author_size: 16,   // px  — text-base
  reader_content_text_size: 17,      // px  — text-[17px]
  reader_content_line_height: 32,    // px  — leading-8
  reader_page_header_size: 12,       // px  — text-xs
  reader_page_footer_size: 10,       // px  — text-[10px]

  // [reader_menu]
  reader_menu_top_bar_padding_top: 40, // px — pt-10
  reader_menu_top_bar_padding_x: 16, // px  — px-4
  reader_menu_back_icon_size: 26,    // px  — size={26}
  reader_menu_top_icon_size: 24,     // px  — size={24}
  reader_menu_bottom_padding_x: 24,  // px  — px-6
  reader_menu_bottom_padding_top: 12, // px — pt-3
  reader_menu_bottom_padding_bottom: 32, // px — pb-8
  reader_menu_bottom_icon_size: 24,  // px  — size={24}
  reader_tool_panel_height: 288,     // px  — h-[18rem] ≈ 288px
  reader_tool_panel_padding: 24,     // px  — p-6
  reader_tool_panel_radius: 16,      // px  — rounded-t-2xl
  reader_fab_size: 40,               // px  — w-10 h-10
  reader_fab_bottom_offset: 128,     // px  — bottom-32
  reader_fab_right_offset: 16,       // px  — right-4
  reader_progress_slider_height: 48, // px  — h-12
  reader_progress_thumb_size: 36,    // px  — w-9 h-9
  reader_fontsize_min: 15,           // px  — slider min
  reader_fontsize_max: 30,           // px  — slider max
  reader_fontsize_default: 19,       // px  — settings default

  // [audiobooks]
  audiobook_chart_thumb_size: 56,        // px  — w-14 h-14
  audiobook_chart_thumb_text_size: 9,    // px  — text-(--app-audiobook-chart-thumb-text-size)
  audiobook_chart_stat_text_size: 10,    // px  — text-(--app-audiobook-chart-stat-text-size)

  // [settings]
  settings_header_padding_top: 40,   // px  — pt-10
  settings_header_height: 52,        // px  — approx (pt-10 + pb-3)
  settings_header_back_size: 24,     // px  — size={24}
  settings_header_title_size: 17,    // px  — text-[17px]
  settings_group_padding_x: 16,      // px  — px-4
  settings_group_radius: 12,         // px  — rounded-xl
  settings_group_margin_bottom: 12,  // px  — mb-3
  settings_item_padding_y: 16,       // px  — py-4
  settings_item_text_size: 15,       // px  — text-[15px]
  settings_item_value_size: 13,      // px  — text-[13px]
  settings_toggle_width: 44,         // px  — w-11
  settings_toggle_height: 24,        // px  — h-6
  settings_toggle_thumb_size: 20,    // px  — w-5 h-5
  settings_chevron_size: 16,         // px  — size={16}
  settings_content_padding: 12,      // px  — p-3

  // ===== 任意值迁移（启发式命名）=====
  // 审核后请改为语义命名
  // --- width ---
  compHeaderWidth_1: 1,
  myReadingPageWidth_6: 6,
  myReadingPageWidth_24: 24,
  itemWidth_64: 64,
  titleWidth_80: 80,
  mePageWidth_100: 100,
  mePageWidth_120: 120,
  mePageWidth_150: 150,
  modalWidth_260: 260,
  cardWidth_320: 320,
  // --- height ---
  dividerHeight_2: 2,
  itemHeight_16: 16,
  bookshelfPageHeight_19: 19,
  itemHeight_80: 80,
  myProfilePageHeight_140: 140,
  // --- text_size ---
  itemTextSize_7: 7,
  itemTextSize_8: 8,
  titleTextSize_9: 9,
  titleTextSize_11: 11,
  titleTextSize_14: 14,
  titleTextSize_16: 16,
  titleTextSize_18: 18,
  titleTextSize_22: 22,
  titleTextSize_48: 48,
  // --- max_width ---
  myReadingPageMaxWidth_6: 6,
  myReadingPageMaxWidth_24: 24,
  itemMaxWidth_64: 64,
  mePageMaxWidth_100: 100,
  mePageMaxWidth_120: 120,
  mePageMaxWidth_150: 150,
  modalMaxWidth_260: 260,
  cardMaxWidth_320: 320,
  // --- min_height ---
  itemMinHeight_16: 16,
  itemMinHeight_80: 80,
  myProfilePageMinHeight_140: 140,
  // --- min_width ---
  titleMinWidth_80: 80,
  // --- gap ---
  itemGap_2: 2,
} as const;
