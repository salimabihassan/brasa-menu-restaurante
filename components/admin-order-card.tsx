'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';

export function AdminOrderCard({initiallyOpen,openRequest=0,children}:{initiallyOpen:boolean;openRequest?:number;children:ReactNode}){
 // Initialize once per order: polling must respect a manual collapse.
 const [open,setOpen]=useState(initiallyOpen);
 const element=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(openRequest>0){setOpen(true);element.current?.scrollIntoView({behavior:'smooth',block:'start'});}},[openRequest]);
 return <details ref={element} className="surface order-card admin-order-card" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>{children}</details>;
}
