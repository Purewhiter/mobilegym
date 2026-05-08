// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [bookshelf]
  bookshelf_bg: '#ffffff',
  bookshelf_header_bg: '#ffffff',
  bookshelf_search_input_bg: 'rgba(243,244,246,0.8)', // gray-100/80
  bookshelf_search_divider: 'rgba(209,213,219,0.5)',   // gray-300/50
  bookshelf_sort_tab_active: '#2563eb',                // blue-600
  bookshelf_sort_tab_inactive: '#94a3b8',              // slate-400
  bookshelf_add_btn_bg: '#f8fafc',                     // slate-50
  bookshelf_add_btn_border: '#e2e8f0',                 // slate-200
  bookshelf_add_icon_color: '#cbd5e1',                 // slate-300
  bookshelf_item_title: '#1e293b',                     // slate-800
  bookshelf_item_title_selected: '#2563eb',            // blue-600
  bookshelf_select_check_bg: '#3b82f6',                // blue-500
  bookshelf_select_check_border: '#ffffff',
  bookshelf_private_indicator_bg: 'rgba(0,0,0,0.2)',
  bookshelf_footer_text: '#94a3b8',                    // slate-400
  bookshelf_footer_link: '#3b82f6',                    // blue-500

  // [bookshelf_selection_toolbar]
  selection_toolbar_bg: '#ffffff',
  selection_toolbar_border: '#f3f4f6',                 // gray-100
  selection_toolbar_icon_color: '#475569',             // slate-600
  selection_toolbar_icon_text: '#64748b',              // slate-500
  selection_toolbar_remove_color: '#ef4444',           // red-500
  selection_toolbar_shadow: 'rgba(0,0,0,0.05)',

  // [bookshelf_modal]
  modal_overlay_private: 'rgba(0,0,0,0.5)',
  modal_overlay_remove: 'rgba(0,0,0,0.4)',
  modal_bg: '#ffffff',
  modal_title_text: '#0f172a',                         // slate-900
  modal_body_text: '#64748b',                          // slate-500
  modal_divider: '#f3f4f6',                            // gray-100
  modal_action_text_primary: '#3b82f6',                // app-primary
  modal_action_remove_text: '#ef4444',                 // red-500
  modal_action_cancel_text: '#1e293b',                 // gray-800
  modal_sheet_bg: '#F7F7F7',
  modal_sheet_item_bg: '#ffffff',

  // [book_detail]
  book_detail_bg: '#FAFAFA',
  book_detail_nav_text: '#374151',                     // gray-700
  book_detail_author_link: '#3b82f6',                  // blue-500
  book_detail_ranking_badge_bg: 'rgba(219,234,254,0.5)', // blue-100/50
  book_detail_ranking_badge_border: 'rgba(59,130,246,0.5)', // blue-500 partial
  book_detail_badge_text: '#3b82f6',                   // blue-500
  book_detail_stat_divider: '#e5e7eb',                 // gray-200
  book_detail_masterpiece_color: '#D1A056',
  book_detail_card_bg: '#ffffff',
  book_detail_card_review_tag_bg: '#f3f4f6',           // gray-100
  book_detail_card_review_tag_text: '#4b5563',         // gray-600
  book_detail_action_bar_bg: '#ffffff',
  book_detail_action_bar_border: '#f3f4f6',            // gray-100
  book_detail_shelf_btn_added_text: '#9ca3af',         // gray-400
  book_detail_shelf_btn_bg: '#f3f4f6',                 // gray-100
  book_detail_review_name: '#374151',                  // gray-700

  // [reader]
  reader_bg_default: '#FAF9F4',
  reader_bg_yellow: '#F6F2E5',
  reader_bg_green: '#E8F5E9',
  reader_bg_dark: '#1A1A1A',
  reader_bg_variant1: '#FAF9F4',
  reader_bg_variant2: '#F5F5F0',
  reader_bg_variant3: '#EFEFEF',
  reader_bg_variant4: '#E0E0E0',
  reader_content_text: '#1f2937',                      // gray-800
  reader_header_text: '#9ca3af',                       // gray-400
  reader_footer_text: '#9ca3af',                       // gray-400

  // [reader_menu]
  reader_menu_bar_bg: 'rgba(255,255,255,0.95)',
  reader_menu_icon_color: '#4b5563',                   // gray-600
  reader_fab_bg: 'rgba(51,65,85,0.9)',                 // slate-700/90
  reader_fab_text: '#ffffff',
  reader_progress_slider_bg: '#f3f4f6',                // gray-100
  reader_progress_thumb_bg: '#ffffff',
  reader_typography_panel_bg: '#F2F2F2',
  reader_tool_active_color: '#3b82f6',                 // blue-500
  reader_tool_inactive_color: '#4b5563',               // gray-600

  // [tab_bar]
  tab_bar_bg: '#ffffff',
  tab_bar_border: '#f1f5f9',                           // slate-100
  tab_bar_icon_inactive: '#999999',

  // [header]
  header_bg: '#f1f5f9',                                // slate-100
  header_search_bg: '#f3f4f6',                         // gray-100
  header_search_divider: '#d1d5db',                    // gray-300
  header_search_placeholder: '#9ca3af',                // gray-400
  header_store_btn_text: '#475569',                    // slate-600

  // [settings]
  settings_bg: '#f1f5f9',                              // slate-100
  settings_group_bg: '#ffffff',
  settings_item_text: '#1e293b',                       // slate-800
  settings_item_value_text: '#94a3b8',                 // slate-400
  settings_item_divider: '#f1f5f9',                    // slate-100
  settings_toggle_on: '#3b82f6',                       // blue-500
  settings_toggle_off: '#cbd5e1',                      // slate-200
  settings_toggle_thumb: '#ffffff',
  settings_chevron: '#cbd5e1',                         // slate-300
  settings_logout_text: '#ef4444',                     // red-500

  // ===== Tailwind 原值迁移（视觉零差异）=====
  // 命名: 'tw-<type>-gray-<shade>'（连字符需要引号包裹）
  // 审核后请改为语义命名（如 'tw-text-gray-400' → hint_text）
  'tw-text-slate-800': '#1e293b',
  'tw-text-gray-400': '#9ca3af',
  'tw-text-slate-400': '#94a3b8',
  'tw-text-slate-500': '#64748b',
  'tw-bg-gray-100': '#f3f4f6',
  'tw-bg-gray-50': '#f9fafb',
  'tw-text-slate-300': '#cbd5e1',
  'tw-text-slate-900': '#0f172a',
  'tw-text-gray-600': '#4b5563',
  'tw-text-gray-500': '#6b7280',
  'tw-active-bg-gray-50': '#f9fafb',
  'tw-bg-slate-100': '#f1f5f9',
  'tw-border-gray-100': '#f3f4f6',
  'tw-text-gray-800': '#1f2937',
  'tw-text-blue-500': '#3b82f6',
  'tw-text-slate-600': '#475569',
  'tw-bg-gray-200': '#e5e7eb',
  'tw-border-slate-100': '#f1f5f9',
  'tw-border-gray-50': '#f9fafb',
  'tw-bg-slate-200': '#e2e8f0',
  'tw-bg-blue-500': '#3b82f6',
  'tw-bg-slate-50': '#f8fafc',
  'tw-border-slate-50': '#f8fafc',
  'tw-text-gray-700': '#374151',
  'tw-bg-gray-300': '#d1d5db',
  'tw-text-slate-700': '#334155',
  'tw-text-gray-900': '#111827',
  'tw-active-bg-slate-50': '#f8fafc',
  'tw-active-bg-slate-100': '#f1f5f9',
  'tw-placeholder-gray-400': '#9ca3af',
  'tw-active-bg-gray-100': '#f3f4f6',
  'tw-active-bg-gray-200': '#e5e7eb',
  'tw-text-slate-200': '#e2e8f0',
  'tw-bg-gray-500': '#6b7280',
  'tw-border-slate-200': '#e2e8f0',
  'tw-bg-slate-300': '#cbd5e1',
  'tw-hover-bg-gray-50': '#f9fafb',
  'tw-bg-gray-400': '#9ca3af',
  'tw-border-gray-500': '#6b7280',
  'tw-border-gray-400': '#9ca3af',
  'tw-border-gray-700': '#374151',
  'tw-border-gray-800': '#1f2937',

  // ===== 任意值 hex 迁移（启发式命名）=====
  // 审核后请改为语义命名
  'tab-bar-text-9999': '#999999',
  'audiobooks-page-text-d1a0': '#d1a056',
  'book-detail-page-text-d1a0': '#d1a056',
  'book-detail-page-bg-fafa': '#fafafa',
  'book-detail-page-bg-f7f7': '#f7f7f7',
  'book-detail-page-border-d1a0': '#d1a056',
  'following-page-bg-07c1': '#07c160',
  'my-reading-page-text-3333': '#333333',
  'my-reading-page-text-0288': '#0288d1',
  'my-reading-page-bg-a0cf': '#a0cfff',
  'my-reading-page-bg-f6f7': '#f6f7f9',
  'my-reading-page-bg-00aa': '#00aaff',
  'my-reading-page-bg-4fc3': '#4fc3f7',
  'my-reading-page-bg-f0f9': '#f0f9ff',
  'my-reading-page-gradient-from-4fc3': '#4fc3f7',
  'my-reading-page-gradient-to-039b': '#039be5',
  'reader-page-text-d1a0': '#d1a056',
  'reader-page-bg-faf9': '#faf9f4',
  'reader-page-bg-f6f2': '#f6f2e5',
  'reader-page-bg-e8f5': '#e8f5e9',
  'reader-page-bg-1a1a': '#1a1a1a',
  'reader-page-bg-f5f5': '#f5f5f0',
  'reader-page-bg-efef': '#efefef',
  'reader-page-bg-e0e0': '#e0e0e0',
  'reader-page-bg-f2f2': '#f2f2f2',
  'reader-page-bg-f7f7': '#f7f7f7',
  'reader-page-border-d1a0': '#d1a056',
  'transactions-page-bg-e1f1': '#e1f1ff',
  'user-profile-page-text-ff3b': '#ff3b30',
  'user-profile-page-bg-f7f7': '#f7f7f7',
  'settings-auto-download-page-text-8b57': '#8b572a',
  'settings-auto-download-page-bg-ecdc': '#ecdcc2',
} as const;

export const colorsDark: { [K in keyof typeof colors]?: string } = {
  reader_content_text: '#d1d5db',
  reader_header_text: '#6b7280',
  reader_bg_default: '#1A1A1A',
  reader_menu_bar_bg: 'rgba(30,30,30,0.95)',
} as const;
