import {supabase} from './supabase';
import {branch} from './catalog';
import {pushConfigured,registerNotificationWorker} from './customer-push';
async function save(subscription:PushSubscription){
 const keys=subscription.toJSON().keys;
 const {error}=await supabase('staff').rpc('brasa_save_staff_push',{p_branch:branch.id,p_endpoint:subscription.endpoint,p_p256dh:keys?.p256dh,p_auth:keys?.auth});
 if(error)throw Error('No se pudieron activar los avisos. Comprueba que tu cuenta tenga acceso a pedidos.');
}
export async function enableStaffPush(){
 if(!pushConfigured)throw Error('Los avisos del teléfono se activarán al publicar la versión HTTPS.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error(permission==='denied'?'Las notificaciones están bloqueadas. Puedes habilitarlas en los ajustes del navegador.':'No se activaron los avisos del teléfono.');
 const registration=await registerNotificationWorker();
 const raw=atob(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY!.replace(/-/g,'+').replace(/_/g,'/'));
 const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,value=>value.charCodeAt(0))});
 await save(subscription);
}
export async function syncStaffPush(){
 if(!pushConfigured||Notification.permission!=='granted')return false;
 const registration=await registerNotificationWorker(),subscription=await registration.pushManager.getSubscription();if(!subscription)return false;
 // A customer subscription alone is never permission to notify restaurant staff.
 const {data,error}=await supabase('staff').from('brasa_staff_push_subscriptions').select('id').eq('branch_id',branch.id).eq('endpoint',subscription.endpoint).maybeSingle();
 if(error)throw Error('No se pudo comprobar el permiso del teléfono.');if(!data)return false;
 await save(subscription);return true;
}
export async function disableStaffPush(){
 if(!('serviceWorker' in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration('/'),subscription=await registration?.pushManager.getSubscription();if(!subscription)return;
 const {error}=await supabase('staff').from('brasa_staff_push_subscriptions').delete().eq('endpoint',subscription.endpoint);
 if(error)throw Error('No se pudo desactivar el aviso. Revisa la conexión e inténtalo otra vez.');
 // Keep the browser subscription: this device may also receive its own customer alerts.
}
export async function retryStaffPush(){
 if(!pushConfigured)return;
 const {data,error}=await supabase('staff').from('brasa_staff_push_jobs').select('id').eq('branch_id',branch.id).in('state',['pending','failed','processing']).lt('attempts',8).lte('available_at',new Date().toISOString()).order('created_at').limit(5);
 if(error)throw error;
 for(const job of data||[]){const {data:result,error}=await supabase('staff').functions.invoke('send-staff-notification',{body:{jobId:job.id}});if(error||result?.results?.some((item:{state:string})=>item.state==='failed'))throw Error('Algún aviso del teléfono sigue pendiente de envío.');}
}
