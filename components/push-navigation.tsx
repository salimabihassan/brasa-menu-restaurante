'use client';
import {useEffect,useRef} from 'react';
export function PushNavigation({onOpen}:{onOpen:(id:string)=>void}){
 const open=useRef(onOpen);open.current=onOpen;
 useEffect(()=>{const id=new URL(window.location.href).searchParams.get('order');if(id&&/^[0-9a-f-]{36}$/i.test(id))open.current(id);
  if(!('serviceWorker' in navigator))return;
  const message=(event:MessageEvent)=>{const value=event.data;if(!value||typeof value.orderId!=='string'||!/^[0-9a-f-]{36}$/i.test(value.orderId))return;
   if(value.type==='BRASA_OPEN_ORDER')open.current(value.orderId);
   if(value.type==='BRASA_READY_PUSH'||value.type==='BRASA_OPEN_ORDER')window.dispatchEvent(new Event('brasa-refresh-orders'));
  };navigator.serviceWorker.addEventListener('message',message);return()=>navigator.serviceWorker.removeEventListener('message',message);
 },[]);
 return null;
}
