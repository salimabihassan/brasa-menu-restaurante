import {supabase,customerSession} from './supabase';
import {branch} from './catalog';
export const pushConfigured=process.env.NEXT_PUBLIC_WEB_PUSH_ENABLED==='true'&&!!process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
function publicKeyBytes(value:string){const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
export async function registerNotificationWorker(){
 if(!window.isSecureContext||!('serviceWorker' in navigator))throw Error('Los avisos del teléfono necesitan la versión HTTPS.');
 await navigator.serviceWorker.register('/brasa-notifications-sw.js',{scope:'/',updateViaCache:'none'});
 return Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('No se pudo preparar el servicio de notificaciones.')),12000))]);
}
async function saveSubscription(subscription:PushSubscription){
 await customerSession();const json=subscription.toJSON();
 const {error}=await supabase().rpc('brasa_save_push_subscription',{p_endpoint:subscription.endpoint,p_p256dh:json.keys?.p256dh,p_auth:json.keys?.auth});
 if(error)throw Error('No se pudo guardar el permiso de avisos. Inténtalo nuevamente.');
}
export async function enableCustomerPush(){
 if(!pushConfigured)throw Error('Los avisos con la web cerrada todavía no están activados.');
 // Request permission directly from the customer's button, never on page load.
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error(permission==='denied'?'El navegador bloqueó las notificaciones. Puedes habilitarlas en sus ajustes.':'No se activaron los avisos. Puedes seguir viendo el pedido en esta web.');
 const registration=await registerNotificationWorker();
 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKeyBytes(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!)});
 // The same browser subscription can also carry staff alerts. A failed customer
 // registration must not unsubscribe the restaurant's device.
 await saveSubscription(subscription);
}
export async function syncCustomerPush(){
 if(!pushConfigured||Notification.permission!=='granted')return false;
 const registration=await registerNotificationWorker();const subscription=await registration.pushManager.getSubscription();
 if(!subscription)return false;
 await customerSession();
 const {data,error}=await supabase().from('brasa_push_subscriptions').select('id').eq('endpoint',subscription.endpoint).limit(1);
 if(error)throw Error('No se pudo comprobar el permiso de avisos.');
 if(!data?.length)return false;
 await saveSubscription(subscription);return true;
}
export async function disableCustomerPush(){
 const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();
 if(!subscription)return;
 const {error}=await supabase().from('brasa_push_subscriptions').delete().eq('endpoint',subscription.endpoint);
 if(error)throw Error('No se pudo desactivar el aviso. Revisa la conexión e inténtalo otra vez.');
 // Remove this audience only; staff alerts may use the same browser endpoint.
}
export async function dispatchReadyPush(orderId:string){
 if(!pushConfigured)return;
 const {data,error}=await supabase('staff').functions.invoke('send-ready-notification',{body:{orderId}});
 if(error||data?.results?.some((job:{state:string})=>job.state==='failed'))throw Error('El pedido está listo. El aviso al teléfono quedó pendiente de reintento.');
}
export async function retryPendingReadyPush(){
 if(!pushConfigured)return;
 const {data,error}=await supabase('staff').from('brasa_ready_push_jobs').select('order_id').eq('branch_id',branch.id).in('state',['pending','failed','processing']).lt('attempts',8).lte('available_at',new Date().toISOString()).order('created_at').limit(5);
 if(error)throw error;await Promise.all((data||[]).map(row=>dispatchReadyPush(row.order_id)));
}
