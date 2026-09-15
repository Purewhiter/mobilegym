export const strings = {
  app_name: '列表实验室',
  list_subtitle: '固定 100 项 · 无搜索入口',
  detail_position_prefix: '列表位置',
  detail_position_separator: '/',
  detail_code_prefix: '记录编号',
  detail_selected: '已记录本次选择',
  detail_not_selected: '尚未记录本次选择',
  item_not_found: '未找到该记录',
} as const;

export type StringKey = keyof typeof strings;
