'use client';
import {useEffect,useState} from 'react';
import {BellRing,Check} from 'lucide-react';
import {pushConfigured} from '@/lib/customer-push';
import {enableStaffPush,disableStaffPush,syncStaffPush} from '@/lib/staff-push';
export function StaffNotificationSettings(){
 const [available,setAvailable]=useState(false),[iosInstall,setIOSInstall]=useState(false),[active,setActive]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let live=true;const supported=window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;setAvailable(supported);
  const apple=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone;setIOSInstall(apple&&!standalone);
  if(supported&&pushConfigured)void syncStaffPush().then(value=>{if(live)setActive(value);}).catch(()=>{if(live)setMessage('Vuelve a activar los avisos para vincular este teléfono.');});
  return()=>{live=false;};
 },[]);
 async function toggle(){setBusy(true);setMessage('');try{if(active){await disableStaffPush();setActive(false);}else{await enableStaffPush();setActive(true);}}catch(err){setMessage(err instanceof Error?err.message:'No se pudo cambiar el permiso.');}finally{setBusy(false);}}
 return <section className="customer-notification-settings staff-notification-settings"><BellRing size={23}/><div><strong>Nuevos pedidos en este teléfono</strong><p>Recibe un aviso cuando llegue un pedido o un nuevo comprobante, aunque no tengas el panel abierto.</p>{active?<small><Check size={14}/> Avisos activados para esta cuenta y este teléfono.</small>:iosInstall?<small>En iPhone, añade el panel a la pantalla de inicio para activar estos avisos.</small>:!available||!pushConfigured?<small>Se podrán activar al publicar la versión HTTPS. Por ahora sigue funcionando la alarma con el panel abierto.</small>:<small>Actívalos en cada teléfono del equipo que deba recibirlos.</small>}<small>El sonido depende de los ajustes del teléfono. «Silenciar alertas» controla la alarma del panel abierto.</small>{message&&<p role="status" className="notification-message">{message}</p>}</div>{available&&pushConfigured&&!iosInstall&&<button className="secondary" disabled={busy} onClick={()=>void toggle()}>{busy?'Guardando…':active?'Desactivar avisos del teléfono':'Activar avisos en este teléfono'}</button>}</section>;
}
