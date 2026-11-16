'use client';
import {useEffect,useRef,useState} from 'react';
import type {Order} from '@/lib/catalog';
export function StaffPushNavigation({orders,onOpen}:{orders:Order[];onOpen:(order:Order)=>void}){
 const [target,setTarget]=useState(''),[sequence,setSequence]=useState(0),handled=useRef(-1),open=useRef(onOpen);open.current=onOpen;
 useEffect(()=>{
  const select=(id:unknown)=>{if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))return;setTarget(id);setSequence(value=>value+1);window.dispatchEvent(new Event('brasa-refresh-orders'));};
  select(new URL(window.location.href).searchParams.get('order'));
  if(!('serviceWorker' in navigator))return;
  const message=(event:MessageEvent)=>{if(event.data?.type==='BRASA_STAFF_OPEN_ORDER')select(event.data.orderId);else if(event.data?.type==='BRASA_STAFF_PUSH')window.dispatchEvent(new Event('brasa-refresh-orders'));};
  navigator.serviceWorker.addEventListener('message',message);return()=>navigator.serviceWorker.removeEventListener('message',message);
 },[]);
 useEffect(()=>{if(!target||handled.current===sequence)return;const order=orders.find(order=>order.id===target);if(!order)return;handled.current=sequence;open.current(order);},[orders,target,sequence]);
 return null;
}
