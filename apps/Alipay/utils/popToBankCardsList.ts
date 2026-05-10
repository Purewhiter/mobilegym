import { memoryHistoryPopToFirstMatch } from '../../../os/utils/memoryHistoryPopTo';

/**
 * 支付宝"添加银行卡"流程的 Up 导航目标。
 *
 * 添加银行卡页（`/bank-cards/add`）有两个常规入口：
 * - "我的 → 银行卡" → `/bank-cards`
 * - "支付设置 → 银行卡" → `/settings/payment/bank-cards`
 *
 * 用户在 add 页点关闭按钮 + 在确认对话框点"退出"时，需要回到他原本来的列表页。
 * 顺序：先匹配更深层的 `/settings/payment/bank-cards`，再匹配 `/bank-cards`，
 * 避免被前者反向命中后者。
 *
 * 第三个入口"充值流程"（`/balance/recharge` 带 returnTo）不在此列表里——
 * 调用方在 popTo 失败时会 fallback 到单步 `back()`，刚好回到 recharge 页。
 */
const BANK_CARDS_PARENT_PATHS = ['/settings/payment/bank-cards', '/bank-cards'] as const;

export function popToAlipayBankCardsList(navigator: unknown): boolean {
  return memoryHistoryPopToFirstMatch(navigator, BANK_CARDS_PARENT_PATHS, { inclusive: false });
}
