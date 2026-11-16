import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localStatus,localClient,check} from '../scripts/local-runtime.mjs';
test('local delivery settings, server quotes, totals, ownership, expiry and dispatch states',async()=>{
 const status=localStatus(),root=localClient(status,true),admin=localClient(status),menu=localClient(status),customer=localClient(status),other=localClient(status);
 const branch='delivery-check-'+randomUUID(),users=[],paths=[],clients=[admin,menu,customer,other];
 async function staff(client,role){const email=`delivery-${randomUUID()}@brasa.test`,password='Test-'+randomUUID();const user=check(await root.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user.id);check(await root.from('brasa_memberships').insert({user_id:user.id,branch_id:branch,role,display_name:'Prueba delivery'}));check(await client.auth.signInWithPassword({email,password}));}
 try{
  check(await root.from('brasa_branches').insert({id:branch,name:'Prueba aislada delivery'}));
  await staff(admin,'admin');await staff(menu,'menu');
  const user=check(await customer.auth.signInAnonymously()).user;users.push(user.id);users.push(check(await other.auth.signInAnonymously()).user.id);
  const config={enabled:true,origin_address:'Dirección pública de prueba, Santiago, Chile',price_per_km:700,maximum_km:5};
  const save=(client,settings=config)=>client.rpc('brasa_save_delivery_settings',{p_branch:branch,p_settings:settings});
  assert.ok((await save(menu)).error);assert.ok((await save(customer)).error);check(await save(admin));
  check(await root.from('brasa_catalog').insert({branch_id:branch,id:'test',product:{id:'test',name:'Producto prueba',category:'Prueba',price:1000,image:'',description:'',badge:'',available:true,hidden:false,extraIds:[]}}));
  const settings=check(await customer.from('brasa_delivery_settings').select('version').eq('branch_id',branch).single());
  const quote=(meters=2501,version=settings.version)=>root.rpc('brasa_store_delivery_quote',{p_user:user.id,p_branch:branch,p_version:version,p_address:'Calle prueba 123',p_commune:'Providencia',p_meters:meters,p_seconds:600});
  assert.ok((await customer.rpc('brasa_store_delivery_quote',{p_user:user.id,p_branch:branch,p_version:1,p_address:'Calle prueba 123',p_commune:'Providencia',p_meters:1,p_seconds:1})).error);
  assert.ok((await quote(5001)).error);const q=check(await quote());assert.equal(q.fee,1751);
  assert.equal(check(await other.from('brasa_delivery_quotes').select('id').eq('id',q.id)).length,0);
  const place=(client,id,quoteId,total=2751,method='delivery')=>client.rpc('brasa_place_order',{p_id:id,p_branch:branch,p_name:'Cliente prueba',p_phone:'999999999',p_note:'',p_method:'card',p_items:[{productId:'test',quantity:1,extras:[]}],p_receipt:null,p_receipt_name:null,p_expected_total:total,p_fulfillment:method,p_quote:quoteId,p_delivery_note:'Departamento de prueba'});
  const id=randomUUID();assert.ok((await place(other,id,q.id)).error);assert.ok((await place(customer,id,q.id,1000)).error);assert.ok((await place(customer,id,null)).error);
  const order=check(await place(customer,id,q.id));assert.equal(order.total,2751);assert.equal(order.subtotal,1000);assert.equal(order.deliveryFee,1751);assert.equal(order.delivery.distanceMeters,2501);assert.equal(order.delivery.instructions,'Departamento de prueba');
  assert.equal(check(await place(customer,id,q.id)).id,id);assert.ok((await place(customer,randomUUID(),q.id)).error);
  assert.equal(check(await root.from('brasa_staff_push_jobs').select('id').eq('order_id',id)).length,1);
  const pickup=check(await place(customer,randomUUID(),null,1000,'pickup'));
  const pickupAction=(version,state)=>admin.rpc('brasa_staff_action',{p_id:pickup.id,p_version:version,p_action:state,p_reason:''});
  check(await pickupAction(1,'preparing'));check(await pickupAction(2,'ready'));assert.ok((await pickupAction(3,'out_for_delivery')).error);check(await pickupAction(3,'delivered'));
  const expired=check(await quote());check(await root.from('brasa_delivery_quotes').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',expired.id));assert.ok((await place(customer,randomUUID(),expired.id)).error);
  const stale=check(await quote());check(await save(admin,{...config,price_per_km:900}));assert.ok((await place(customer,randomUUID(),stale.id)).error);
  const stored=check(await customer.from('brasa_orders').select('payload').eq('id',id).single()).payload;assert.equal(stored.total,2751);assert.equal(stored.delivery.pricePerKm,700);
  const action=(version,state)=>admin.rpc('brasa_staff_action',{p_id:id,p_version:version,p_action:state,p_reason:''});
  check(await action(1,'preparing'));check(await action(2,'ready'));
  assert.equal(check(await root.from('brasa_ready_push_jobs').select('order_id').eq('order_id',id)).length,0,'ready for delivery must not tell the customer to pick it up');
  assert.ok((await action(3,'delivered')).error);check(await action(3,'out_for_delivery'));
  assert.equal(check(await root.from('brasa_ready_push_jobs').select('order_id').eq('order_id',id)).length,1);check(await action(4,'delivered'));
  const current=check(await customer.from('brasa_delivery_settings').select('version').eq('branch_id',branch).single());const transferQuote=check(await quote(2501,current.version));
  const transferId=randomUUID(),receipt=`${user.id}/${transferId}/${randomUUID()}`;paths.push(receipt);
  check(await customer.storage.from('brasa-receipts').upload(receipt,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=','base64'),{contentType:'image/png'}));
  const transfer=check(await customer.rpc('brasa_place_order',{p_id:transferId,p_branch:branch,p_name:'Cliente prueba',p_phone:'999999999',p_note:'',p_method:'transfer',p_items:[{productId:'test',quantity:1,extras:[]}],p_receipt:receipt,p_receipt_name:'prueba.png',p_expected_total:3251,p_fulfillment:'delivery',p_quote:transferQuote.id,p_delivery_note:''}));
  assert.equal(transfer.total,3251);assert.equal(transfer.payment,'review');assert.equal(transfer.deliveryFee,2251);
  const auth=check(await customer.auth.getSession()).session.access_token,adminToken=check(await admin.auth.getSession()).session.access_token;
  const health=await fetch(`${status.url}/functions/v1/quote-delivery`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000',Authorization:`Bearer ${adminToken}`},body:JSON.stringify({branchId:branch,action:'status'})});
  const configured=(await health.json()).configured;
  const response=await fetch(`${status.url}/functions/v1/quote-delivery`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000',Authorization:`Bearer ${auth}`},body:JSON.stringify({branchId:branch,address:configured?'':'Calle prueba 456',commune:'Providencia'})});
  assert.equal(response.status,configured?400:503);
  for(let index=0;index<6;index++)check(await root.rpc('brasa_reserve_delivery_request',{p_user:user.id,p_branch:branch}));assert.ok((await root.rpc('brasa_reserve_delivery_request',{p_user:user.id,p_branch:branch})).error);
  console.log('OK · Tarifas, cobertura, total validado, cotización privada y estados de entrega; sin llamadas a Google.');
 }finally{
  if(paths.length)check(await root.storage.from('brasa-receipts').remove(paths));
  for(const table of ['brasa_orders','brasa_delivery_quotes','brasa_delivery_quote_requests','brasa_delivery_settings','brasa_memberships','brasa_catalog'])check(await root.from(table).delete().eq('branch_id',branch));
  check(await root.from('brasa_branches').delete().eq('id',branch));for(const user of users)check(await root.auth.admin.deleteUser(user));await Promise.all(clients.map(client=>client.auth.signOut()));
 }
});
