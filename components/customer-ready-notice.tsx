'use client';
import {useEffect,useRef,useState} from 'react';
import {BellRing,CheckCircle2,MapPin} from 'lucide-react';
import {branch,type Order} from '@/lib/catalog';
import {readyEventKey,unseenReadyOrders} from '@/lib/ready-events';
import {CustomerChime} from '@/lib/customer-chime';
const storageKey=`brasa-ready-notices:${branch.id}`;
export function CustomerReadyNotice({orders,enabled,onOpenOrder}:{orders:Order[];enabled:boolean;onOpenOrder:(id:string)=>void}){
 const [queue,setQueue]=useState<Order[]>([]),[loaded,setLoaded]=useState(false);
 const seen=useRef(new Set<string>()),chime=useRef<CustomerChime|null>(null);
 useEffect(()=>{const sound=new CustomerChime();chime.current=sound;try{const saved=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(saved))seen.current=new Set(saved.filter((key:unknown)=>typeof key==='string'));}catch{}setLoaded(true);return()=>{sound.dispose();chime.current=null;};},[]);
 useEffect(()=>{if(!enabled){chime.current?.cancel();return;}const unlock=()=>void chime.current?.unlock();document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);};},[enabled]);
 useEffect(()=>{if(!loaded||!enabled)return;const fresh=unseenReadyOrders(orders,seen.current);if(fresh.length){fresh.forEach(order=>seen.current.add(readyEventKey(order)!));try{localStorage.setItem(storageKey,JSON.stringify([...seen.current].slice(-500)));}catch{}setQueue(current=>[...current,...fresh.filter(order=>!current.some(item=>item.id===order.id))]);chime.current?.play();}},[orders,enabled,loaded]);
 // Only prune after a successful customer refresh; transient loading/connection
 // errors must not dismiss an alert that the customer has not acknowledged.
 const current=queue.find(item=>!orders.some(order=>order.id===item.id&&!readyEventKey(order)));
 useEffect(()=>{if(!current)chime.current?.cancel();},[current]);
 if(!enabled||!current)return null;
 function dismiss(){chime.current?.cancel();setQueue(list=>list.filter(order=>order.id!==current!.id));}
 return <aside className="customer-ready-notice" role="alert" aria-live="assertive"><span className="ready-notice-icon"><BellRing size={26}/></span><div className="ready-notice-content"><span className="eyebrow">BRASA · PEDIDO #{current.id.slice(0,6).toUpperCase()}</span><h2>{current.fulfillment==='delivery'?'¡Tu pedido va en camino!':'¡Tu pedido está listo!'}</h2><p>{current.fulfillment==='delivery'?'El local despachó tu pedido a domicilio.':'Puedes pasar a retirarlo.'}</p><span className="ready-notice-location"><MapPin size={15}/> {current.fulfillment==='delivery'?'Entrega a domicilio':'Brasa '+branch.name}</span><div className="ready-notice-actions"><button className="primary" onClick={()=>{onOpenOrder(current.id);dismiss();}}>Ver mi pedido <CheckCircle2 size={16}/></button><button className="text-button" onClick={dismiss}>Entendido</button></div>{queue.length>1&&<small>También hay otros pedidos con novedades.</small>}</div></aside>;
}
