'use client';
import {useCallback,useEffect,useState} from 'react';
import type {Order} from './catalog';
import {branch} from './catalog';
import {alarmDue,pauseAttention,type AlarmPause} from './alarm-policy';
const key=`brasa-attention-pauses:${branch.id}`;
export function useAttentionPauses(orders:Order[],panelOpen:boolean){
 const [pauses,setPauses]=useState<Record<string,AlarmPause>>({}),[now,setNow]=useState(()=>Date.now());
 useEffect(()=>{try{const value=JSON.parse(sessionStorage.getItem(key)||'{}');const clean:Record<string,AlarmPause>={};for(const [id,p] of Object.entries(value)){const pause=p as AlarmPause;if(typeof pause.stage==='string'&&typeof pause.until==='number'&&pause.until>Date.now()&&pause.until<=Date.now()+60_000)clean[id]=pause;}setPauses(clean);}catch{}},[]);
 useEffect(()=>{if(!panelOpen)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[panelOpen]);
 const pause=useCallback((order:Order)=>{const time=Date.now();setNow(time);setPauses(current=>{const updated=Object.fromEntries(Object.entries(current).filter(([,p])=>p.until>time));updated[order.id]=pauseAttention(order,time);try{sessionStorage.setItem(key,JSON.stringify(updated));}catch{}return updated;});},[]);
 return {pause,shouldRing:orders.some(order=>alarmDue(order,pauses[order.id],now)),remaining:(order:Order)=>alarmDue(order,pauses[order.id],now)?0:Math.max(0,Math.ceil(((pauses[order.id]?.until||0)-now)/1000))};
}
