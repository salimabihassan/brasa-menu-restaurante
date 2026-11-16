import {spawnSync} from 'node:child_process';
import {localStatus} from './local-runtime.mjs';
const network='brasa-local';
const found=spawnSync('docker',['network','inspect',network],{stdio:'ignore'});
if(found.status!==0){const made=spawnSync('docker',['network','create','--driver','bridge','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network],{stdio:'inherit'});if(made.status!==0)process.exit(1);}
console.log('Iniciando Supabase de BRASA. La primera ejecución descarga las imágenes necesarias…');
const result=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','start','--network-id',network,'--exclude','realtime,imgproxy,edge-runtime,logflare,vector,supavisor'],{encoding:'utf8',maxBuffer:16*1024*1024});
if(result.status!==0){console.error((result.stderr||result.error?.message||'No se pudo iniciar Supabase local.').replace(/(?:sb_secret_|eyJ)[A-Za-z0-9_.-]+/g,'[clave local omitida]').slice(-6000));process.exit(result.status??1);}
console.log('Servicios locales iniciados. Comprobando puertos…');
const bound=spawnSync(process.execPath,['scripts/local-loopback.mjs'],{stdio:'inherit'});
if(bound.status!==0)process.exit(bound.status??1);
const local=localStatus();let ready=false;
for(let attempt=0;attempt<30;attempt++){
 try{const response=await fetch(local.url+'/rest/v1/brasa_branches?select=id&limit=1',{headers:{apikey:local.publicKey},signal:AbortSignal.timeout(3000)});if(response.ok){ready=true;break;}}catch{}
 await new Promise(resolve=>setTimeout(resolve,1000));
}
if(!ready)throw Error('Los servicios iniciaron pero la API aún no responde. Revisa Docker antes de probar pedidos.');
console.log('BRASA local lista: API http://127.0.0.1:54321 · Studio http://127.0.0.1:54323');

const functions=spawnSync(process.execPath,['scripts/local-functions.mjs'],{stdio:'inherit'});
if(functions.status!==0)process.exit(functions.status??1);
