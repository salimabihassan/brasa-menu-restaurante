import {Truck} from 'lucide-react';
import {money,type Order} from '@/lib/catalog';
export function OrderDelivery({order}:{order:Order}){
 if(order.fulfillment!=='delivery'||!order.delivery)return null;
 return <div className="order-delivery"><Truck size={22}/><div><strong>Entrega a domicilio</strong><p>{order.delivery.address}, {order.delivery.commune}</p>{order.delivery.instructions&&<p><strong>Indicaciones:</strong> {order.delivery.instructions}</p>}<small>{Number(order.delivery.distanceKm).toLocaleString('es-CL',{maximumFractionDigits:3})} km por calles · Delivery {money(order.deliveryFee??order.delivery.fee)}</small><span className="google-attribution" translate="no">Google Maps</span></div></div>;
}
