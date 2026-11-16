'use client';
import {useEffect,useState} from 'react';
import {Bell,Check} from 'lucide-react';
import {pushConfigured,enableCustomerPush,disableCustomerPush,syncCustomerPush} from '@/lib/customer-push';
export function CustomerNotificationSettings(){
 const [available,setAvailable]=useState(false),[active,setActive]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[iosInstall,setIOSInstall]=useState(false);
 useEffect(()=>{const supported=window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;setAvailable(supported);
  const apple=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;
  setIOSInstall(apple&&!standalone);
  let live=true;if(supported&&pushConfigured)void syncCustomerPush().then(value=>{if(live)setActive(value);}).catch(()=>{if(live)setMessage('Vuelve a activar los avisos para vincular este teléfono.');});return()=>{live=false;};
 },[]);
 async function toggle(){setBusy(true);setMessage('');try{if(active){await disableCustomerPush();setActive(false);}else{await enableCustomerPush();setActive(true);}}catch(error){setMessage(error instanceof Error?error.message:'No se pudieron activar los avisos.');}finally{setBusy(false);}}
 return <section className="customer-notification-settings"><Bell size={20}/><div><strong>Te avisamos sobre tu pedido</strong><p>Con esta web abierta recibirás un aviso cuando esté listo para retirar o salga a reparto.</p>{active?<small><Check size={13}/> También recibirás avisos en este teléfono.</small>:iosInstall?<small>En iPhone, añade BRASA a la pantalla de inicio para activar los avisos con la web cerrada.</small>:!available||!pushConfigured?<small>Los avisos con la web cerrada se activarán al publicar la versión HTTPS.</small>:null}{message&&<p className="notification-message" role="status">{message}</p>}</div>{available&&pushConfigured&&!iosInstall&&<button className="secondary" onClick={()=>void toggle()} disabled={busy}>{busy?'Guardando…':active?'Desactivar avisos':'Avisarme en el teléfono'}</button>}</section>;
}
