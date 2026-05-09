import { describe, expect, it } from 'vitest';
import { getCashierExpectedPassword } from '../apps/Alipay/pages/CashierPage';

describe('Alipay cashier payment password', () => {
  it('uses the current Alipay account payment password instead of a standalone default', () => {
    expect(getCashierExpectedPassword({ paymentPassword: '123456' })).toBe('123456');
    expect(getCashierExpectedPassword({ paymentPassword: '654321' })).toBe('654321');
  });
});
