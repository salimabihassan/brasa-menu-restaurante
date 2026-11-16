import {createClient} from 'npm:@supabase/supabase-js@2';
import webPush from 'npm:web-push@3.6.7';
import {allowedPushEndpoint,staffPushPayload,pushErrorStatus} from '../_shared/push-policy.ts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function secretMatches(actual:string,expected:string){
 if(!expected||expected.length<32)return false;
 const hash=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [a,b]=await Promise.all([hash(actual),hash(expected)]);let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;
}
Deno.serve(async request=>{
 const appOrigin=Deno.env.get('BRASA_APP_ORIGIN')||'';
 const origin=request.headers.get('origin');
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':appOrigin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
 if(origin&&origin!==appOrigin)return respond({error:'Origen no permitido'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return respond({error:'Método no permitido'},405);
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))return respond({error:'Acceso no autorizado'},401);
 const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
 const publicKey=Deno.env.get('WEB_PUSH_PUBLIC_KEY'),privateKey=Deno.env.get('WEB_PUSH_PRIVATE_KEY'),subject=Deno.env.get('WEB_PUSH_SUBJECT');
 if(!url||!secret||!anon||!appOrigin||!publicKey||!privateKey||!subject)return respond({error:'El envío push no está configurado'},503);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
 let body:{jobId?:string};try{const text=await request.text();if(text.length>2000)return respond({error:'Solicitud demasiado grande'},413);body=JSON.parse(text);}catch{return respond({error:'Solicitud inválida'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||(body.jobId!==undefined&&typeof body.jobId!=='string'))return respond({error:'Solicitud inválida'},400);
 const worker=await secretMatches(auth.slice(7),Deno.env.get('BRASA_PUSH_WORKER_TOKEN')||'');
 if(!worker){
  const {data:user,error}=await caller.auth.getUser(auth.slice(7));
  if(error||!user.user)return respond({error:'Sesión inválida'},401);
  if(!body.jobId||!uuid.test(body.jobId))return respond({error:'Pedido inválido'},400);
  const {data:order,error:orderError}=await caller.from('brasa_staff_push_jobs').select('branch_id').eq('id',body.jobId).maybeSingle();
  if(orderError||!order)return respond({error:'Sin acceso al pedido'},403);
  const {data:member,error:memberError}=await caller.from('brasa_memberships').select('branch_id').eq('branch_id',order.branch_id).eq('active',true).in('role',['admin','local']);
  if(memberError||!member?.length)return respond({error:'Solo el personal puede enviar avisos'},403);
 }
 let ids:string[];
 if(body.jobId){if(!uuid.test(body.jobId))return respond({error:'Pedido inválido'},400);ids=[body.jobId];}
 else{
  if(!worker)return respond({error:'Acceso no autorizado'},401);
  const {data,error}=await admin.from('brasa_staff_push_jobs').select('id').in('state',['pending','failed','processing']).lt('attempts',8).lte('available_at',new Date().toISOString()).order('created_at').limit(5);
  if(error)return respond({error:'No se pudo leer la cola'},503);ids=(data||[]).map(job=>job.id);
 }
 const results=[];
 for(const id of ids){
  const {data:claims,error:claimError}=await admin.rpc('brasa_claim_staff_push',{p_id:id});
  if(claimError){results.push({jobId:id,state:'failed'});continue;}
  const job=claims?.[0];if(!job){results.push({jobId:id,state:'already_processed_or_leased'});continue;}
  const finish=async(state:string,error:string|null=null)=>{
   const {error:finishError}=await admin.from('brasa_staff_push_jobs').update({state,last_error:error,lease_until:null,available_at:new Date(Date.now()+60000).toISOString(),completed_at:['sent','skipped'].includes(state)?new Date().toISOString():null}).eq('id',id).eq('lease_id',job.lease_id);
   if(finishError)throw Error('No se pudo actualizar la cola');
  };
  try{
   const {data:order,error:orderError}=await admin.from('brasa_orders').select('payload').eq('id',job.order_id).single();
   if(orderError)throw Error('No se pudo consultar el pedido');
   const latest=await admin.from('brasa_staff_push_jobs').select('id').eq('order_id',job.order_id).order('order_version',{ascending:false}).limit(1).single();
   if(latest.error)throw Error('No se pudo consultar el último evento');
   if(order.payload.status!=='pending'||!['review','paid'].includes(order.payload.payment)||latest.data.id!==id){await finish('skipped');results.push({jobId:id,state:'skipped'});continue;}
   const {data:subscriptions,error:subscriptionError}=await admin.rpc('brasa_staff_push_recipients',{p_branch:job.branch_id});
   if(subscriptionError)throw Error('No se pudieron consultar los dispositivos');
   if(!subscriptions?.length){await finish('skipped');results.push({jobId:id,state:'no_subscriptions'});continue;}
   const {data:sent,error:sentError}=await admin.from('brasa_staff_push_deliveries').select('subscription_id').eq('job_id',id).eq('state','sent');
   if(sentError)throw Error('No se pudo consultar el estado del envío');
   const completed=new Set((sent||[]).map(row=>row.subscription_id));
   const outcomes=await Promise.all(subscriptions.map(async subscription=>{
    if(completed.has(subscription.id))return true;
    if(!allowedPushEndpoint(subscription.endpoint))throw Error('Destino de notificación no permitido');
    let code=0;
    try{
     const details=webPush.generateRequestDetails({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_key}},JSON.stringify(staffPushPayload(job.order_id,job.event)),{TTL:300,urgency:'high',topic:'s'+job.order_id.replaceAll('-','').slice(0,31),vapidDetails:{subject,publicKey,privateKey}});
     const response=await fetch(subscription.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(8000)});code=response.status;await response.body?.cancel();
    }catch{code=0;}
    const state=pushErrorStatus(code);
    if(state==='expired'){
     const {error}=await admin.from('brasa_staff_push_subscriptions').delete().eq('id',subscription.id);if(error)throw Error('No se pudo retirar un destino vencido');return true;
    }
    const {error}=await admin.from('brasa_staff_push_deliveries').upsert({job_id:id,subscription_id:subscription.id,state,status_code:code,updated_at:new Date().toISOString()});
    if(error)throw Error('No se pudo guardar el estado del envío');return state==='sent';
   }));
   const success=outcomes.every(Boolean);await finish(success?'sent':'failed',success?null:'Algún dispositivo no aceptó el aviso');results.push({jobId:id,state:success?'sent':'failed'});
  }catch{await finish('failed','No se pudo completar el envío').catch(()=>{});results.push({jobId:id,state:'failed'});}
 }
 return respond({results});
});
