// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [service icon — blue family]
  service_icon_blue: '#3B99FC',        // station screen, timetable, invoice, id verify, transfer
  service_icon_sky: '#54A0FF',         // air-rail, bus-ship, insurance, foreign service
  service_icon_teal: '#1DD1A1',        // railway tourism, tour orders

  // [service icon — green family]
  service_icon_green: '#2ED573',       // ecard, car rental, sale-time, agency, fingerprint

  // [service icon — orange/red family]
  service_icon_orange: '#FF9F43',      // commuter pass, elder, food, delay check, change password
  service_icon_amber: '#FF8C00',       // food order, commuter order, car order, water order (= theme accent)
  service_icon_red: '#FF6B6B',         // warm service, hotel, mall, price check, notifications, insurance order

  // [service icon — special]
  service_icon_green_hotel: '#4CAF50', // hotel order (AOSP green)
  service_icon_purple: '#9B59B6',      // business-seat service order
  service_icon_muted: '#9CA3AF',       // "more" placeholder icon

  // [member benefit card backgrounds]
  member_benefit_blue_bg: '#EBF3FF',   // points, waitlist card background
  member_benefit_yellow_bg: '#FFF8E1', // exchange, activity card background

  // [home / booking card]
  home_warm_service_bg_start: 'from-blue-50',  // retained as note; see dimens for pixel values

  // [query result page]

  // [order confirm page]

  // [station type badge]
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
