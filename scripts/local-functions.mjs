import {spawn,spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
await mkdir('.local',{recursive:true});
let environment='';try{environment=await readFile('.local/push.env','utf8');}catch{}
try{environment+='\n'+await readFile('.local/delivery.env','utf8');}catch{}
let config='';try{config=await readFile('.env.development.local','utf8');}catch{}
const hosts=(config.match(/^BRASA_LAN_HOSTS=(.*)$/m)?.[1]||'').split(',').map(host=>host.trim()).filter(host=>/^[a-zA-Z0-9.-]+$/.test(host));
const origins=['http://localhost:3000','http://127.0.0.1:3000',...hosts.map(host=>`http://${host}:3000`)];
environment=environment.split(/\r?\n/).filter(line=>!line.startsWith('BRASA_ALLOWED_ORIGINS=')).join('\n');
await writeFile('.local/functions.env',environment+`\nBRASA_ALLOWED_ORIGINS=${origins.join(',')}\n`,{mode:0o600});
async function ready(){try{const response=await fetch('http://127.0.0.1:54321/functions/v1/manage-staff',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(2000)});return response.status===401;}catch{return false;}}
if(process.argv.includes('--restart'))spawnSync('docker',['stop','supabase_edge_runtime_brasa-local'],{stdio:'ignore',windowsHide:true});
if(await ready()){console.log('Servicios locales listos.');process.exit(0);}
const log=await open('.local/functions.log','a');
const child=spawn(process.execPath,['node_modules/supabase/dist/supabase.js','functions','serve','manage-staff','--network-id','brasa-local','--env-file','.local/functions.env'],{stdio:['ignore',log.fd,log.fd],windowsHide:true,detached:true});
child.unref();await log.close();
for(let attempt=0;attempt<45;attempt++){if(await ready()){console.log('Servicio local de usuarios listo; solo accesible por la API de BRASA.');process.exit(0);}await new Promise(resolve=>setTimeout(resolve,1000));}
throw Error('El servicio de usuarios no respondió. Revisa .local/functions.log.');
