import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {localStatus,localClient,check} from '../scripts/local-runtime.mjs';

test('Supabase local: Auth, API, Storage, permisos y flujo completo', {timeout:120000},async()=>{
 const status=localStatus();
 if(process.env.BRASA_TEST_PROXY_URL){
  const proxy=new URL(process.env.BRASA_TEST_PROXY_URL);
  const ownAddresses=Object.values(networkInterfaces()).flat().filter(Boolean).map(entry=>entry.address);
  assert.ok(['127.0.0.1','localhost',...ownAddresses].includes(proxy.hostname),'La prueba solo permite direcciones de este computador');
  assert.equal(proxy.pathname,'/supabase');status.url=proxy.href.replace(/\/$/,'');
 }
 const admin=localClient(status,true);
 const staff=localClient(status),customer=localClient(status),other=localClient(status);
 const credentials={email:`security-${randomUUID()}@brasa.test`,password:'Test-'+randomUUID()};
 const ids=[],files=[],users=[];const passed=[];
 const branch='api-check-'+randomUUID();
 const action=(id,version,p_action,p_reason='')=>staff.rpc('brasa_staff_action',{p_id:id,p_version:version,p_action,p_reason});
 const make=(id,path,method='transfer',total=7690)=>({p_id:id,p_branch:branch,p_name:'Prueba API local',p_phone:'999999999',p_note:'Pedido automatizado de prueba',p_method:method,p_items:[{productId:'classic',quantity:1,extras:[]}],p_receipt:path,p_receipt_name:'prueba.png',p_expected_total:total});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jz1sAAAAASUVORK5CYII=','base64');
 try{
  check(await admin.from('brasa_branches').insert({id:branch,name:'Prueba aislada API'}));
  const staffUser=check(await admin.auth.admin.createUser({...credentials,email_confirm:true})).user;users.push(staffUser.id);
  check(await admin.from('brasa_memberships').insert({user_id:staffUser.id,branch_id:branch,role:'admin',active:true}));
  check(await admin.from('brasa_catalog').insert({branch_id:branch,id:'classic',product:{id:'classic',name:'Producto de prueba',category:'Prueba',price:7690,image:'',description:'',available:true,hidden:false,extraIds:[]}}));
  check(await staff.auth.signInWithPassword(credentials));
  const first=check(await customer.auth.signInAnonymously()).user;users.push(first.id);
  const second=check(await other.auth.signInAnonymously()).user;users.push(second.id);
  passed.push('Inicio de sesión del personal y dos clientes independientes');
  const id=randomUUID();ids.push(id);const path=`${first.id}/${id}/${randomUUID()}`;
  check(await customer.storage.from('brasa-receipts').upload(path,png,{contentType:'image/png'}));files.push(path);
  const invalid=await customer.storage.from('brasa-receipts').upload(`${first.id}/${id}/bad.txt`,Buffer.from('prueba'),{contentType:'text/plain'});
  assert.ok(invalid.error,'Debe rechazar formatos no permitidos');
  const oversized=await customer.storage.from('brasa-receipts').upload(`${first.id}/${id}/large.png`,Buffer.alloc(1048577),{contentType:'image/png'});
  assert.ok(oversized.error,'Debe rechazar archivos de más de 1 MB');
  passed.push('Carga privada, validación de formato y límite de tamaño');
  assert.ok((await customer.rpc('brasa_create_order',make(id,null))).error,'No aceptar transferencia sin comprobante');
  assert.ok((await customer.rpc('brasa_create_order',make(id,path,'transfer',1))).error,'No aceptar precio manipulado');
  let order=check(await customer.rpc('brasa_create_order',make(id,path)));
  assert.equal(order.payment,'review');assert.equal(order.total,7690);assert.equal(order.version,1);
  const again=check(await customer.rpc('brasa_create_order',make(id,path)));assert.equal(again.id,id);
  assert.equal(check(await staff.from('brasa_orders').select('id').eq('id',id)).length,1);
  passed.push('Pedido visible al enviar comprobante; total de servidor e idempotencia');
  assert.equal(check(await other.from('brasa_orders').select('id').eq('id',id)).length,0);
  assert.ok((await other.storage.from('brasa-receipts').createSignedUrl(path,120)).error);
  assert.ok((await customer.rpc('brasa_staff_action',{p_id:id,p_version:1,p_action:'approve',p_reason:''})).error);
  assert.ok((await customer.from('brasa_memberships').insert({user_id:first.id,branch_id:branch})).error);
  assert.ok((await customer.from('brasa_orders').update({payload:{}}).eq('id',id)).error);
  assert.ok((await action(id,1,'preparing')).error);
  passed.push('Cliente ajeno sin acceso; cliente no puede aprobar ni darse permisos; preparación bloqueada');
  const signed=check(await staff.storage.from('brasa-receipts').createSignedUrl(path,120));
  const download=await fetch(signed.signedUrl);assert.equal(download.status,200);
  const publicURL=customer.storage.from('brasa-receipts').getPublicUrl(path).data.publicUrl;
  assert.notEqual((await fetch(publicURL)).status,200);
  passed.push('Personal puede abrir enlace temporal; archivo inaccesible por URL pública');
  order=check(await action(id,1,'reject','La imagen no corresponde al pago'));assert.equal(order.payment,'rejected');
  assert.ok((await other.rpc('brasa_resubmit_receipt',{p_id:id,p_version:2,p_path:path,p_name:'otro.png'})).error);
  const path2=`${first.id}/${id}/${randomUUID()}`;check(await customer.storage.from('brasa-receipts').upload(path2,png,{contentType:'image/png'}));files.push(path2);
  order=check(await customer.rpc('brasa_resubmit_receipt',{p_id:id,p_version:2,p_path:path2,p_name:'nuevo.png'}));assert.equal(order.payment,'review');
  order=check(await action(id,3,'approve'));assert.equal(order.payment,'paid');
  assert.ok((await action(id,3,'preparing')).error,'Versión vieja no debe modificar el pedido');
  order=check(await action(id,4,'preparing'));assert.equal(order.status,'preparing');
  assert.ok((await action(id,5,'delivered')).error,'No saltar de preparación a entrega');
  check(await action(id,5,'ready'));order=check(await action(id,6,'delivered'));assert.equal(order.status,'delivered');
  assert.equal(check(await customer.from('brasa_orders').select('payload').eq('id',id).single()).payload.status,'delivered');
  passed.push('Rechazo, reenvío, aprobación, concurrencia, preparación, retiro y entrega entre sesiones');
  const cardId=randomUUID();ids.push(cardId);const card=check(await customer.rpc('brasa_create_order',make(cardId,null,'card')));assert.equal(card.payment,'paid');
  const cancelled=check(await action(cardId,1,'cancelled','Prueba de devolución'));assert.equal(cancelled.status,'cancelled');assert.match(cancelled.history.at(-1).text,/devolución manual/);
  passed.push('Tarjeta simulada y cancelación con devolución manual registrada');
  const settings=check(await admin.from('brasa_branches').select('paused,unavailable').eq('id',branch).single());
  try{
   check(await staff.rpc('brasa_set_settings',{p_branch:branch,p_paused:true,p_unavailable:[]}));
   assert.ok((await customer.rpc('brasa_create_order',make(randomUUID(),null,'card'))).error);
   check(await staff.rpc('brasa_set_settings',{p_branch:branch,p_paused:false,p_unavailable:['classic']}));
   assert.ok((await customer.rpc('brasa_create_order',make(randomUUID(),null,'card'))).error);
  }finally{check(await staff.rpc('brasa_set_settings',{p_branch:branch,p_paused:settings.paused,p_unavailable:settings.unavailable}));}
  passed.push('Pausa del local y productos agotados validados en servidor');
  await mkdir('.local',{recursive:true});await writeFile('.local/verification.json',JSON.stringify({at:new Date().toISOString(),environment:'Supabase local',passed},null,2)+'\n');
  for(const line of passed)console.log('OK · '+line);
 }finally{
  if(files.length)check(await admin.storage.from('brasa-receipts').remove(files));
  if(ids.length)check(await admin.from('brasa_orders').delete().in('id',ids));
  for(const id of users)check(await admin.auth.admin.deleteUser(id));
  await Promise.all([staff.auth.signOut(),customer.auth.signOut(),other.auth.signOut()]);
  check(await admin.from('brasa_catalog').delete().eq('branch_id',branch));
  check(await admin.from('brasa_branches').delete().eq('id',branch));
 }
});
