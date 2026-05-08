// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [chat_list]
  chat_list_item_bg: '#ffffff',
  chat_list_item_bg_sticky: '#f7f7f7',
  chat_list_item_bg_active: '#f3f3f3',
  chat_list_item_name: '#191919',
  chat_list_item_preview: '#999999',       // gray-400 approx
  chat_list_item_time: '#999999',          // gray-400 approx
  chat_list_item_divider: 'rgba(229,231,235,0.5)', // gray-100/50
  chat_list_alert_dot: '#ef4444',          // red-500

  // [chat_detail]
  chat_bubble_me_bg: '#95ec69',
  chat_bubble_other_bg: '#ffffff',
  chat_bubble_text: '#000000',
  chat_input_bar_bg: '#f7f7f7',
  chat_input_bar_border: '#e5e7eb',        // gray-200
  chat_plus_icon_color: '#5c5c5e',
  chat_time_label_text: '#9ca3af',         // gray-400
  chat_time_label_bg: 'rgba(0,0,0,0.05)',  // black/5
  chat_system_msg_text: '#b2b2b2',

  // [chat_search]
  search_bar_bg: '#f0f0f0',
  search_input_bg: '#ffffff',
  search_icon_color: '#8e8e93',
  search_cancel_text: '#6D80A0',
  search_filter_tab_text: '#6D6D6D',
  search_filter_tab_active_indicator: '#191919',
  search_category_link_text: '#6D80A0',
  search_result_divider: '#f5f5f5',
  search_empty_text: '#8e8e93',

  // [contacts]
  contacts_item_bg_active: '#f3f3f3',
  contacts_item_divider: '#f3f4f6',       // gray-100
  contacts_section_header_bg: '#ededed',   // app background
  contacts_section_header_text: '#6b7280', // gray-500
  contacts_new_friend_icon_bg: '#fa9d3b',
  contacts_tags_icon_bg: '#10aeff',
  contacts_count_text: '#9ca3af',          // gray-400

  // [me_page]
  me_username: '#000000',
  me_wxid_text: '#7f7f7f',
  me_chevron_color: '#cccccc',
  me_status_border: '#f3f4f6',             // gray-100
  me_avatar_bg: '#f2f2f2',

  // [me_menu_icons]
  me_icon_collection: '#fa9d3b',           // orange
  me_icon_moments: '#10aeff',              // blue
  me_icon_stickers: '#f6c444',             // yellow
  me_icon_settings: '#10aeff',             // blue

  // [settings]
  settings_item_text: '#191919',
  settings_item_extra_text: '#7f7f7f',
  settings_item_chevron: '#b2b2b2',
  settings_item_divider: '#f3f4f6',        // gray-100
  settings_group_title_text: '#6b7280',    // gray-500

  // [discover]
  discover_item_bg: '#ffffff',
  discover_item_divider: '#f3f4f6',        // gray-100

  // [address]
  address_link_text: '#576b95',
  address_field_divider: '#f3f4f6',        // gray-100
  address_chevron: '#d1d5db',              // gray-300

  // [common] - 通用颜色
  common_red: '#fa5151',                   // 微信系统红色（警告/删除/退出）
  common_green: '#40b983',                 // 微信绿色（在线/成功）
  common_link_blue: '#5a9aee',             // 链接蓝
  common_link_pink: '#ff5b7d',             // 强调链接粉
  common_text_primary: '#1a1a1a',          // 主要文字
  common_text_secondary: '#333333',        // 次要文字
  common_text_tertiary: '#555555',         // 三级文字
  common_text_hint: '#888888',             // 提示文字
  common_text_disabled: '#c8c8c8',         // 禁用文字

  // [overlay] - 深色遮罩/弹窗背景
  overlay_dark_bg: '#111111',
  overlay_dark_panel: '#191d21',
  overlay_dark_panel_alt: '#1c1f24',
  overlay_dark_item: '#2a2f35',
  overlay_dark_item_hover: '#4c4c4c',
  overlay_dark_item_alt: '#444444',
  overlay_deep_dark: '#0f0714',

  // [misc]
  misc_divider_light: '#eeeeee',
  misc_divider_gray: '#e5e5e7',
  misc_moments_cover_bg: '#c9c0a8',        // 朋友圈封面默认背景
  misc_border_light: '#f0f0f0',            // 浅灰分割线（用户资料页）

  // ===== Tailwind 原值迁移（视觉零差异）=====
  // 命名: 'tw-<type>-gray-<shade>'（连字符需要引号包裹）
  // 审核后请改为语义命名（如 'tw-text-gray-400' → hint_text）
  'tw-text-gray-400': '#9ca3af',
  'tw-bg-gray-50': '#f9fafb',
  'tw-border-gray-100': '#f3f4f6',
  'tw-active-bg-gray-50': '#f9fafb',
  'tw-text-gray-500': '#6b7280',
  'tw-bg-gray-100': '#f3f4f6',
  'tw-bg-gray-200': '#e5e7eb',
  'tw-active-bg-gray-100': '#f3f4f6',
  'tw-text-gray-300': '#d1d5db',
  'tw-border-gray-300': '#d1d5db',
  'tw-active-bg-gray-200': '#e5e7eb',
  'tw-bg-gray-400': '#9ca3af',
  'tw-text-gray-200': '#e5e7eb',
  'tw-border-gray-50': '#f9fafb',
  'tw-text-gray-700': '#374151',
  'tw-bg-gray-300': '#d1d5db',
  'tw-placeholder-gray-400': '#9ca3af',     // placeholder 文字颜色

  // ===== 任意值 hex 迁移（启发式命名）=====
  // 审核后请改为语义命名
  'wechat-app-border-bottom-4c4c': '#4c4c4c',        // 加号菜单三角箭头
  'discover-nearby-people-border-right-f0f0': '#f0f0f0', // 附近的人气泡箭头
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
