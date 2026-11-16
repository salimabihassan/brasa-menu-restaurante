import {createClient} from 'npm:@supabase/supabase-js@2';
const roles=['admin','menu','local'];
Deno.serve(async request=>{
 const origins=(Deno.env.get('BRASA_ALLOWED_ORIGINS')||Deno.env.get('BRASA_APP_ORIGIN')||'').split(',').map(value=>value.trim()).filter(Boolean);
 const origin=request.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':origins.includes(origin)?origin:'','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.includes(origin))return respond({error:'Origen no permitido.'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return respond({error:'Método no permitido.'},405);
 const token=request.headers.get('authorization')||'';
 if(!token.startsWith('Bearer '))return respond({error:'Inicia sesión como administrador.'},401);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return respond({error:'El servicio de usuarios no está configurado.'},503);
 const caller=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:token}}});
 const {data:session,error:sessionError}=await caller.auth.getUser(token.slice(7));
 if(sessionError||!session.user)return respond({error:'Sesión inválida.'},401);
 let body;
 try{const raw=await request.text();if(raw.length>5000)return respond({error:'Solicitud demasiado grande.'},413);body=JSON.parse(raw);}catch{return respond({error:'Solicitud inválida.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.branchId!=='string')return respond({error:'Solicitud inválida.'},400);
 const {data:allowed,error:permissionError}=await caller.rpc('brasa_has_role',{p_branch:body.branchId,p_roles:['admin']});
 if(permissionError||!allowed)return respond({error:'Solo el administrador puede crear usuarios.'},403);
 const {name,email,password,role}=body;
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>80||typeof email!=='string'||email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof password!=='string'||password.length<12||password.length>128||!/[a-zA-Z]/.test(password)||!/[0-9]/.test(password)||!roles.includes(role))return respond({error:'Revisa nombre, correo, nivel y contraseña (12 caracteres, letras y números).'},400);
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 // The administrator creates a confirmed staff account; no invitation email is sent.
 const {data:created,error:createError}=await admin.auth.admin.createUser({email:email.trim().toLowerCase(),password,email_confirm:true});
 if(createError||!created.user)return respond({error:'No se pudo crear la cuenta. El correo puede estar registrado o la contraseña no cumple los requisitos.'},400);
 const {error:membershipError}=await admin.rpc('brasa_add_staff',{p_requester:session.user.id,p_branch:body.branchId,p_user:created.user.id,p_role:role,p_name:name.trim()});
 if(membershipError){
  const {error:cleanupError}=await admin.auth.admin.deleteUser(created.user.id);
  return respond({error:cleanupError?'No se asignó acceso. La cuenta creada requiere revisión del administrador.':'No se pudo asignar el acceso. Comprueba tu permiso y el límite de usuarios.'},409);
 }
 return respond({userId:created.user.id,message:'Usuario creado.'},201);
});
