import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {localStatus,localClient,check} from './local-runtime.mjs';
const status=localStatus(),admin=localClient(status,true);
await mkdir('.local',{recursive:true});
let credentials;
try{credentials=JSON.parse(await readFile('.local/staff.json','utf8'));}catch{credentials={email:'cocina@brasa.test',password:randomBytes(18).toString('base64url')};}
const users=check(await admin.auth.admin.listUsers()).users;
let user=users.find(u=>u.email===credentials.email);
if(!user)user=check(await admin.auth.admin.createUser({...credentials,email_confirm:true})).user;
// Only this explicitly local fixture account is managed by this setup script.
else check(await admin.auth.admin.updateUserById(user.id,{password:credentials.password,email_confirm:true}));
check(await admin.from('brasa_memberships').upsert({user_id:user.id,branch_id:'santiago-centro',role:'admin',active:true,display_name:'Administrador BRASA'}));
await writeFile('.local/staff.json',JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
let previous='';try{previous=await readFile('.env.development.local','utf8');}catch{}
const existingURL=previous.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
if(existingURL&&!['127.0.0.1','localhost'].includes(new URL(existingURL).hostname))throw Error('Hay una configuración remota en .env.development.local. No se modificó.');
const retained=previous.split(/\r?\n/).filter(line=>!/^NEXT_PUBLIC_SUPABASE_(URL|PUBLISHABLE_KEY)=/.test(line));
await writeFile('.env.development.local',[...retained,`NEXT_PUBLIC_SUPABASE_URL=${status.url}`,`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.publicKey}`,''].join('\n'));
console.log('Supabase LOCAL conectado. Personal: cocina@brasa.test. Contraseña de prueba guardada en .local/staff.json (fuera de Git).');
console.log('Ejecuta npm run dev. Panel de base de datos: http://127.0.0.1:54323');
