import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
export function localStatus(){
 let raw;
 try{raw=execFileSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000});}
 catch{throw new Error('Supabase local no está listo. Abre Docker Desktop y ejecuta npm run db:start.');}
 const status=JSON.parse(raw);
 const url=status.API_URL;
 if(!url||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Esta herramienta solo permite Supabase LOCAL.');
 const publicKey=status.PUBLISHABLE_KEY||status.ANON_KEY;
 const secret=status.SECRET_KEY||status.SERVICE_ROLE_KEY;
 if(!publicKey||!secret)throw Error('La CLI no devolvió las claves del entorno local.');
 return {url,publicKey,secret};
}
export function localClient(status,admin=false){return createClient(status.url,admin?status.secret:status.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
export function check(result){if(result.error)throw new Error(result.error.message);return result.data;}
