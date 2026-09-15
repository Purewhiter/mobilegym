export const strings = {
  app_name: '列表实验室',
  list_subtitle: '固定 100 项 · 无搜索入口',
  item_title_prefix: '测试记录',
  preview_short: '用于验证连续滚动后的目标定位。',
  preview_medium: '该记录包含两段摘要信息，用于形成稳定但不完全等高的列表项。',
  preview_long: '滚动测试数据保持固定顺序；每次重置后，目标项都会回到相同的位置。',
  target_mid_title: 'Aiden 滚动目标 024',
  target_deep_title: 'Aiden 滚动目标 083',
  target_badge: '目标',
  detail_position_prefix: '列表位置',
  detail_position_separator: '/',
  detail_code_prefix: '记录编号',
  detail_selected: '已记录本次选择',
  detail_not_selected: '尚未记录本次选择',
  item_not_found: '未找到该记录',
} as const;

export type StringKey = keyof typeof strings;
