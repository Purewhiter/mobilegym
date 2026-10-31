import type { OrderRecord } from '../types';

type RequestRailwayRefundOptions = {
  order: OrderRecord;
  updateOrder: (id: string, patch: Partial<OrderRecord>) => void;
  /** Called with the cancelled order once the refund is recorded (the page opens the success screen). */
  onRefunded: (refundedOrder: OrderRecord) => void;
};

export function requestRailwayRefund({
  order,
  updateOrder,
  onRefunded,
}: RequestRailwayRefundOptions): void {
  const refundedOrder: OrderRecord = { ...order, status: 'cancelled' };
  updateOrder(order.id, { status: 'cancelled' });
  onRefunded(refundedOrder);
}
