'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
export function ThemeSwitch(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{
  setDark(document.documentElement.dataset.theme==='dark');
  const sync=(event:StorageEvent)=>{if(event.key!=='brasa-theme')return;const next=event.newValue==='dark';document.documentElement.dataset.theme=next?'dark':'light';setDark(next);};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 function toggle(){const next=!dark;setDark(next);document.documentElement.dataset.theme=next?'dark':'light';try{localStorage.setItem('brasa-theme',next?'dark':'light');}catch{}}
 return <button className="theme-switch" role="switch" aria-checked={dark} aria-label="Modo oscuro" title={dark?'Cambiar a modo claro':'Cambiar a modo oscuro'} onClick={toggle}>{dark?<Moon size={17}/>:<Sun size={17}/>}<span className="theme-switch-label">{dark?'Oscuro':'Claro'}</span><span className="theme-switch-track" aria-hidden="true"><span/></span></button>;
}
