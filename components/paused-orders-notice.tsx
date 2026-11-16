'use client';
import {useEffect,useRef} from 'react';
import {Clock} from 'lucide-react';

export function PausedOrdersNotice({paused,visible}:{paused:boolean;visible:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  if(paused&&visible){if(!element.open)element.showModal();}else element.close();
  return()=>element.close();
 },[paused,visible]);
 return <>{paused&&visible&&<aside className="paused-orders-banner" role="status"><Clock size={23}/><div><strong>Estamos con muchos pedidos. ¡Pronto volvemos!</strong><p>Por el momento no aceptamos nuevos pedidos. Si ya hiciste el tuyo, puedes seguir consultando su estado en «Mis pedidos».</p></div></aside>}<dialog ref={dialog} className="paused-orders-dialog" aria-labelledby="paused-orders-title" aria-describedby="paused-orders-description"><span className="paused-orders-icon"><Clock size={32}/></span><h2 id="paused-orders-title">¡Pronto volvemos!</h2><p id="paused-orders-description">Estamos recibiendo muchos pedidos y necesitamos una pequeña pausa para prepararlos con el cariño de siempre.</p><p><strong>En este momento no podemos aceptar nuevos pedidos.</strong></p><small>Si ya realizaste tu pedido, puedes seguir consultando su estado en «Mis pedidos».</small><button className="primary wide" onClick={()=>dialog.current?.close()}>Entendido</button></dialog></>;
}
