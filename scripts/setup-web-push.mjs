import webPush from 'web-push';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const args=process.argv.slice(2);
const option=name=>args[args.indexOf(name)+1];
const origin=option('--origin'),subject=option('--subject');
if(!args.includes('--origin')||!args.includes('--subject')||!origin||!subject)throw Error('Uso: node scripts/setup-web-push.mjs --origin https://tu-demo.example --subject mailto:tu-correo@example.com');
const url=new URL(origin);
if(url.origin!==origin||!(url.protocol==='https:'||(['localhost','127.0.0.1'].includes(url.hostname)&&url.protocol==='http:')))throw Error('Usa un origen HTTPS, sin ruta ni barra final. Localhost HTTP se permite solo para pruebas.');
if(!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(subject))throw Error('Se necesita un contacto VAPID válido (mailto: o HTTPS).');
await mkdir('.local',{recursive:true});let keys;
try{keys=JSON.parse(await readFile('.local/web-push-keys.json','utf8'));}catch{keys={...webPush.generateVAPIDKeys(),workerToken:randomBytes(32).toString('hex')};await writeFile('.local/web-push-keys.json',JSON.stringify(keys,null,2)+'\n',{mode:0o600});}
await writeFile('.local/push.env',`BRASA_APP_ORIGIN=${origin}\nWEB_PUSH_PUBLIC_KEY=${keys.publicKey}\nWEB_PUSH_PRIVATE_KEY=${keys.privateKey}\nWEB_PUSH_SUBJECT=${subject}\nBRASA_PUSH_WORKER_TOKEN=${keys.workerToken}\n`,{mode:0o600});
await writeFile('.local/push-public.env',`NEXT_PUBLIC_WEB_PUSH_ENABLED=true\nNEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=${keys.publicKey}\n`);
console.log('Claves VAPID y configuración guardadas en .local, fuera de Git. No se activó ni publicó el servicio.');
