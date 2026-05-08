import { describe, expect, it } from 'vitest';
import {
  getBillAvatarFallback,
  getBillDisplayTitle,
  recordMatchesBillFilters,
  type BillTitleContext,
} from '../apps/Alipay/utils/bills';
import type { AlipayTransferRecord } from '../apps/Alipay/types';

const baseRecord: AlipayTransferRecord = {
  id: 'rp_1',
  counterpartyName: '小周(周小雨)',
  counterpartyAvatar: '',
  delta: 88.88,
  timestamp: 0,
  displayTitle: '小周(周小雨)',
  kind: 'redPacket',
  category: 'transferRedPacket',
  detailTimeLabel: '创建时间',
  paymentMethod: '余额',
  transferNote: '生日快乐',
  orderId: '202604250001',
};

function title(record: AlipayTransferRecord, context: BillTitleContext) {
  return getBillDisplayTitle(record, false, context);
}

describe('Alipay bill red packet titles', () => {
  it('账单列表按红包方向显示普通红包动作', () => {
    expect(title(baseRecord, 'list')).toBe('收到普通红包');
    expect(title({ ...baseRecord, delta: -66 }, 'list')).toBe('发普通红包');
  });

  it('账单详情按红包方向显示交易对象或支付宝红包', () => {
    expect(title(baseRecord, 'detail')).toBe('小周(周小雨)');
    expect(title({ ...baseRecord, delta: -66 }, 'detail')).toBe('支付宝红包');
  });

  it('转账筛选不包含红包，转账红包分类才包含红包', () => {
    expect(recordMatchesBillFilters(baseRecord, { quickFilter: 'transfer' })).toBe(false);
    expect(recordMatchesBillFilters(baseRecord, { category: 'transferRedPacket' })).toBe(true);
  });

  it('空头像账单使用灰色默认头像而不是分类图标', () => {
    expect(getBillAvatarFallback({ ...baseRecord, counterpartyAvatar: '' })).toBe('defaultAvatar');
  });

  it('转账显示名按收支方向处理真名', () => {
    expect(getBillDisplayTitle({
      ...baseRecord,
      kind: 'transfer',
      category: 'transferRedPacket',
      counterpartyName: '转账-小丽(李丽)',
      displayTitle: undefined,
      delta: 88.8,
    })).toBe('转账-小丽');
    expect(getBillDisplayTitle({
      ...baseRecord,
      kind: 'transfer',
      category: 'transferRedPacket',
      counterpartyName: '转账-小丽(李丽)',
      displayTitle: undefined,
      delta: -88.8,
    })).toBe('转账-小丽(李丽)');
  });
});
