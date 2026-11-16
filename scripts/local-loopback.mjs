// Docker Desktop can ignore a bridge's default binding. Recreate only this
// project's published containers with explicit loopback bindings, retaining mounts.
import http from 'node:http';
import {execFileSync} from 'node:child_process';
const context=JSON.parse(execFileSync('docker',['context','inspect'],{encoding:'utf8'}))[0];
const host=context.Endpoints.docker.Host;
if(!host.startsWith('npipe:')&&!host.startsWith('unix:'))throw Error('Solo se permite el motor Docker local.');
const socketPath=host.startsWith('npipe:')?'\\\\.\\pipe\\'+host.split('/').at(-1):host.replace('unix://','');
function request(method,path,body){return new Promise((resolve,reject)=>{
 const data=body?JSON.stringify(body):undefined;
 const req=http.request({socketPath,method,path,headers:data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}},res=>{
  let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>{if(res.statusCode>=400)return reject(Error(`Docker ${method} ${path}: ${res.statusCode}`));try{resolve(text?JSON.parse(text):null);}catch{reject(Error('Respuesta de Docker inválida.'));}});
 });req.on('error',reject);req.end(data);
});}
const list=await request('GET','/containers/json?all=1');
let databaseRecreated=false;
for(const item of list){
 const name=item.Names[0].replace(/^\//,'');
 if(!/^supabase_[a-z_]+_brasa-local$/.test(name))continue;
 const original=await request('GET',`/containers/${item.Id}/json`);
 const bindings=original.HostConfig.PortBindings||{};
 if(!Object.values(bindings).some(ports=>ports?.some(p=>p.HostIp!=='127.0.0.1')))continue;
 for(const ports of Object.values(bindings))for(const port of ports||[])port.HostIp='127.0.0.1';
 const backup=name+'-before-loopback';
 if(list.some(c=>c.Names.includes('/'+backup)))throw Error(`Revisa el respaldo de contenedor ${backup} antes de continuar.`);
 if(original.State.Running)await request('POST',`/containers/${item.Id}/stop?t=20`);
 // The CLI copies gateway certificates/configuration into the writable layer.
 // Retain that layer as well as the named volumes when changing port bindings.
 const snapshot=await request('POST',`/commit?container=${item.Id}&pause=false`);
 await request('POST',`/containers/${item.Id}/rename?name=${encodeURIComponent(backup)}`);
 let replacement;
 try{
  const endpoints=Object.fromEntries(Object.entries(original.NetworkSettings.Networks).map(([network,n])=>[network,{Aliases:n.Aliases,IPAMConfig:n.IPAMConfig,DriverOpts:n.DriverOpts}]));
  replacement=await request('POST',`/containers/create?name=${encodeURIComponent(name)}`,{...original.Config,Image:snapshot.Id,HostConfig:{...original.HostConfig,PortBindings:bindings},NetworkingConfig:{EndpointsConfig:endpoints}});
  await request('POST',`/containers/${replacement.Id}/start`);
 }catch(error){
  if(replacement)await request('DELETE',`/containers/${replacement.Id}?force=true`);
  await request('POST',`/containers/${item.Id}/rename?name=${encodeURIComponent(name)}`);
  if(original.State.Running)await request('POST',`/containers/${item.Id}/start`);
  throw error;
 }
 // v=false explicitly retains every mounted volume. The replacement uses the
 // same named volumes and bind mounts as the original.
 await request('DELETE',`/containers/${item.Id}?v=false`);
 if(name==='supabase_db_brasa-local')databaseRecreated=true;
 console.log(`${name}: puertos limitados a 127.0.0.1; volúmenes conservados.`);
}
if(databaseRecreated){
 for(const service of ['auth','rest','storage','pg_meta']){
  const name=`supabase_${service}_brasa-local`;
  if(list.some(c=>c.Names.includes('/'+name)&&c.State==='running'))await request('POST',`/containers/${name}/restart?t=20`);
 }
 console.log('Conexiones de Auth, API y Storage renovadas después de reiniciar PostgreSQL.');
}
