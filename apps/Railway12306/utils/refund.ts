import type { TransitionId } from '../navigation.declaration';
import type { OrderRecord } from '../types';

type RequestRailwayRefundOptions = {
  order: OrderRecord;
  updateOrder: (id: string, patch: Partial<OrderRecord>) => void;
  go: (
    id: TransitionId,
    params?: Record<string, string | number>,
    options?: { mode?: 'push' | 'replace'; state?: unknown },
  ) => void;
  successTransitionId: Extract<TransitionId, 'refundConfirm.refundSuccess'>;
};

export function requestRailwayRefund({
  order,
  updateOrder,
  go,
  successTransitionId,
}: RequestRailwayRefundOptions): void {
  const refundedOrder: OrderRecord = { ...order, status: 'cancelled' };
  updateOrder(order.id, { status: 'cancelled' });
  go(successTransitionId, {}, { mode: 'replace', state: { order: refundedOrder } });
}
