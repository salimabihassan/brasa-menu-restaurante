import type { Order } from './catalog';
export function visibleToKitchen(order: Pick<Order,'payment'|'receipt'>) {
 return order.payment === 'paid' || !!order.receipt;
}
export function canPrepare(order: Pick<Order,'payment'|'status'>) {
 return order.payment === 'paid' && order.status === 'pending';
}
export function needsReview(order: Pick<Order,'payment'|'status'>) {
 return order.payment === 'review' && order.status !== 'cancelled';
}
export function needsAttention(order:Pick<Order,'payment'|'status'>){
 return order.status==='pending'&&(order.payment==='review'||order.payment==='paid');
}
