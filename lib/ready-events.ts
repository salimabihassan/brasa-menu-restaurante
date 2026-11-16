import type {Order} from './catalog';
export function readyEventKey(order:Pick<Order,'id'|'status'|'createdAt'|'history'|'fulfillment'>):string|null {
 const delivery=order.fulfillment==='delivery';
 if(delivery?order.status!=='out_for_delivery':order.status!=='ready')return null;
 const event=[...order.history].reverse().find(item=>item.text===(delivery?'En reparto':'Listo para retirar'));
 return `${order.id}:${delivery?'out_for_delivery':'ready'}:${event?.at||order.createdAt}`;
}
export function unseenReadyOrders(orders:Order[],seen:ReadonlySet<string>):Order[]{
 return orders.filter(order=>{const key=readyEventKey(order);return key!==null&&!seen.has(key);});
}
