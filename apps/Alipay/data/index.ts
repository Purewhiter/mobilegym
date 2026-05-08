import defaults from './defaults.json';
import { resolveDataTimestamp } from '../../../os/TimeService';
import {
  ALIPAY_CONSTANTS,
  QUICK_ACTIONS,
  MAIN_SERVICES,
  COMMON_SERVICES,
  FINANCE_SERVICES,
  MY_SERVICES_LIST,
  MY_SERVICES_GRID,
  MY_CIVIC_SERVICES,
  BANK_OPTIONS,
} from '../constants';
import type { AlipayTransferRecord } from '../types';
import { enrichTransferRecord } from '../utils/bills';

export { BANK_OPTIONS } from '../constants';

/** 按 ID 列表从服务目录中查找并排序，保持用户配置的顺序 */
function resolveById<T extends { id: string }>(ids: string[], catalog: T[]): T[] {
  const map = new Map(catalog.map(item => [item.id, item]));
  return ids.flatMap(id => {
    const item = map.get(id);
    return item ? [item] : [];
  });
}

const ts = (v: unknown) => resolveDataTimestamp(v as string | number);

function resolveAllTimestamps(data: typeof defaults) {
  const bankCards = data.bankCards.map(card => ({ ...card }));
  return {
    ...data,
    conversations: data.conversations.map(c => ({
      ...c,
      lastTimestamp: ts(c.lastTimestamp),
      ...('lastReadAt' in c ? { lastReadAt: ts((c as any).lastReadAt) } : {}),
    })),
    chatHistory: Object.fromEntries(
      Object.entries(data.chatHistory).map(([k, msgs]) => [
        k, msgs.map(m => ({ ...m, timestamp: ts(m.timestamp) })),
      ]),
    ),
    bankCards,
    transferRecords: data.transferRecords.map(r => {
      const record: AlipayTransferRecord = {
        ...(r as unknown as AlipayTransferRecord),
        ...(r.detailTimeLabel === '创建时间' || r.detailTimeLabel === '支付时间'
          ? { detailTimeLabel: r.detailTimeLabel }
          : {}),
        timestamp: ts(r.timestamp),
      };
      return enrichTransferRecord(record, bankCards);
    }),
    notifications: data.notifications.map(n => ({
      ...n, timestamp: ts(n.timestamp),
    })),
  };
}

const resolved = resolveAllTimestamps(defaults);

export const ALIPAY_CONFIG = {
  ...ALIPAY_CONSTANTS,
  ...resolved,
  quickActions: resolveById(resolved.quickActionIds, QUICK_ACTIONS),
  mainServices: resolveById(resolved.mainServiceIds, MAIN_SERVICES),
  commonServices: resolveById(resolved.commonServiceIds, COMMON_SERVICES),
  financeServices: resolveById(resolved.financeServiceIds, FINANCE_SERVICES),
  myServicesList: resolveById(resolved.myServicesListIds, MY_SERVICES_LIST),
  myServicesGrid: resolveById(resolved.myServicesGridIds, MY_SERVICES_GRID),
  myCivicServices: resolveById(resolved.myCivicServiceIds, MY_CIVIC_SERVICES),
  bankOptions: BANK_OPTIONS,
};
