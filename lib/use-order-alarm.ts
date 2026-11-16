'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {OrderAlarm,soundPreference} from './order-alarm';
import {branch} from './catalog';
const key=`brasa-alert-sound:${branch.id}`;
export function useOrderAlarm(panelOpen:boolean,attentionRequired:boolean){
 const [enabled,setEnabled]=useState(true),[ready,setReady]=useState(false),[loaded,setLoaded]=useState(false);
 const engine=useRef<OrderAlarm|null>(null);
 useEffect(()=>{const alarm=new OrderAlarm(setReady);engine.current=alarm;try{setEnabled(soundPreference(localStorage.getItem(key)));}catch{}setLoaded(true);
  const sync=(e:StorageEvent)=>{if(e.key===key)setEnabled(soundPreference(e.newValue));};window.addEventListener('storage',sync);
  return()=>{window.removeEventListener('storage',sync);alarm.dispose();engine.current=null;};
 },[]);
 useEffect(()=>{if(loaded)try{localStorage.setItem(key,String(enabled));}catch{}},[loaded,enabled]);
 const unlock=useCallback(()=>{void engine.current?.unlock();},[]);
 useEffect(()=>{engine.current?.setActive(loaded&&enabled&&panelOpen&&attentionRequired);return()=>engine.current?.setActive(false);},[loaded,enabled,panelOpen,attentionRequired]);
 useEffect(()=>{if(!panelOpen||!enabled||!loaded)return;
  unlock();const attempt=()=>unlock();document.addEventListener('pointerdown',attempt);document.addEventListener('keydown',attempt);
  const resume=()=>{if(document.visibilityState==='visible')unlock();};document.addEventListener('visibilitychange',resume);
  return()=>{document.removeEventListener('pointerdown',attempt);document.removeEventListener('keydown',attempt);document.removeEventListener('visibilitychange',resume);};
 },[panelOpen,enabled,loaded,unlock]);
 function toggle(){if(!enabled)unlock();else engine.current?.setActive(false);setEnabled(value=>!value);}
 return {enabled,ready,toggle,unlock};
}
