import {createClient} from 'npm:@supabase/supabase-js@2';
import {deliveryAddress,googleRouteRequest,readGoogleRoute} from '../_shared/delivery-policy.ts';
Deno.serve(async request=>{
 const origins=(Deno.env.get('BRASA_ALLOWED_ORIGINS')||Deno.env.get('BRASA_APP_ORIGIN')||'').split(',').map(origin=>origin.trim()).filter(Boolean),origin=request.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.includes(origin)?origin:'','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.includes(origin))return respond({error:'Origen no permitido.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return respond({error:'Método no permitido.'},405);
 const auth=request.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return respond({error:'Inicia una sesión para calcular el delivery.'},401);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return respond({error:'El servicio de delivery no está configurado.'},503);
 const caller=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}});
 const {data:session,error:sessionError}=await caller.auth.getUser(auth.slice(7));if(sessionError||!session.user)return respond({error:'La sesión no es válida.'},401);
 let body;try{const raw=await request.text();if(raw.length>3000)return respond({error:'Solicitud demasiado grande.'},413);body=JSON.parse(raw);}catch{return respond({error:'Solicitud inválida.'},400);}
 if(!body||typeof body!=='object'||typeof body.branchId!=='string')return respond({error:'Solicitud inválida.'},400);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}}),key=Deno.env.get('GOOGLE_MAPS_SERVER_API_KEY');
 if(body.action==='status'){
  const {data:allowed,error}=await caller.rpc('brasa_has_role',{p_branch:body.branchId,p_roles:['admin']});
  if(error||!allowed)return respond({error:'Solo el administrador puede comprobar la conexión.'},403);
  return respond({configured:!!key});
 }
 let address,commune;try{address=deliveryAddress(body.address,5,200);commune=deliveryAddress(body.commune,2,80);}catch(error){return respond({error:(error as Error).message},400);}
 const {data:settings,error:settingsError}=await admin.from('brasa_delivery_settings').select('*').eq('branch_id',body.branchId).maybeSingle();
 if(settingsError)return respond({error:'No se pudo consultar la tarifa de delivery.'},503);
 if(!settings?.enabled)return respond({error:'El local no tiene delivery habilitado.'},409);
 if(!key)return respond({error:'El cálculo por calles todavía no está habilitado. Puedes elegir retiro en local.'},503);
 const {error:rateError}=await admin.rpc('brasa_reserve_delivery_request',{p_user:session.user.id,p_branch:body.branchId});if(rateError)return respond({error:rateError.message},429);
 let route;
 try{
  const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration'},body:JSON.stringify(googleRouteRequest(settings.origin_address,address,commune)),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return respond({error:'No se pudo consultar la ruta. Inténtalo de nuevo o elige retiro en local.'},503);
  route=readGoogleRoute(await response.json());
 }catch{return respond({error:'No se pudo calcular la ruta. Revisa la dirección o inténtalo nuevamente.'},503);}
 const {data:quote,error:quoteError}=await admin.rpc('brasa_store_delivery_quote',{p_user:session.user.id,p_branch:body.branchId,p_version:settings.version,p_address:address,p_commune:commune,p_meters:route.meters,p_seconds:route.seconds});
 if(quoteError)return respond({error:quoteError.message},409);
 const {id,address:street,commune:area,distance_meters,duration_seconds,fee,price_per_km,expires_at}=quote;
 return respond({quote:{id,address:street,commune:area,distance_meters,duration_seconds,fee,price_per_km,expires_at}});
});
