// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [status bar / top bar]
  top_bar_height: 70,          // px — sticky header total height (pt-10 + 30 content)

  // [home / booking card]
  station_row_height: 47,       // px — departure ↔ arrival row height
  query_btn_height: 44,         // px — 查询车票 button height

  // [trip reminder card]

  // [service grid]

  // [query result page]
  query_header_date_item_w: 46,    // px — each date pill width
  query_header_date_item_h: 46,    // px — each date pill height
  seat_detail_row_height: 54,      // px — expanded seat row height
  seat_detail_book_btn_w: 68,      // px — book button width
  seat_detail_book_btn_h: 34,      // px — book button height

  // [order confirm page]
  order_top_bar_height: 52,        // px — h-[52px] header
  order_seat_card_height: 102,     // px — seat selection card height
  order_passenger_row_height: 56,  // px — h-[56px] passenger select row
  order_submit_btn_height: 58,     // px — submit button height

  // [bottom toolbar (query result)]

  // [icon sizes]
  icSizeTab: 24,       // px — tab bar icons
  icSizeNav: 24,       // px — navigation / back button icons
  icSizeAction: 18,    // px — inline action icons
  icSizeService: 28,   // px — service grid icons
  icSizeToolbar: 22,   // px — toolbar / header icons
  icSizeChevron: 16,   // px — list/settings row trailing chevrons
  icSizeChevronLg: 18, // px — larger my-page section list chevrons
  icSizeNavLarge: 28,  // px — large nav back on dark-bg special pages
  icSizeInlineArrow: 14, // px — tiny inline text-embedded directional arrows
  icStrokeWidth: 2,    // — standard icon stroke width
} as const;
