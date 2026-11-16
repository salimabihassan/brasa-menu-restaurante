import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localStatus,localClient,check} from '../scripts/local-runtime.mjs';
test('local API stores different kitchen instructions on separate lines',async()=>{
 const status=localStatus(),admin=localClient(status,true),customer=localClient(status);
 const branch='notes-check-'+randomUUID(),id=randomUUID();let user;
 try{
  check(await admin.from('brasa_branches').insert({id:branch,name:'Prueba aislada de indicaciones'}));
  const product=check(await admin.from('brasa_catalog').select('product').eq('branch_id','santiago-centro').eq('id','classic').single()).product;
  check(await admin.from('brasa_catalog').insert({branch_id:branch,id:product.id,product:{...product,available:true}}));
  user=check(await customer.auth.signInAnonymously()).user;
  const args={p_id:id,p_branch:branch,p_name:'Prueba indicaciones',p_phone:'999999999',p_note:'',p_method:'card',p_receipt:null,p_receipt_name:null,p_expected_total:product.price*2,
   p_items:[{productId:product.id,quantity:1,extras:[],note:'Solo pan, carne y papas hilo. Sin salsas.'},{productId:product.id,quantity:1,extras:[],note:'Receta normal, sin cebolla.'}]};
  const bad=await customer.rpc('brasa_create_order',{...args,p_items:[{...args.p_items[0],note:'x'.repeat(301)}]});
  assert.ok(bad.error);assert.match(bad.error.message,/indicaciones/);
  const order=check(await customer.rpc('brasa_create_order',args));
  assert.equal(order.items.length,2);assert.equal(order.items[0].note,args.p_items[0].note);assert.equal(order.items[1].note,args.p_items[1].note);
  assert.notEqual(order.items[0].key,order.items[1].key);
  const stored=check(await customer.from('brasa_orders').select('payload').eq('id',id).single());
  assert.equal(stored.payload.items[0].note,args.p_items[0].note);
  console.log('OK · Dos productos iguales conservan sus indicaciones por separado en PostgreSQL.');
 }finally{
  check(await admin.from('brasa_orders').delete().eq('branch_id',branch));
  check(await admin.from('brasa_catalog').delete().eq('branch_id',branch));
  check(await admin.from('brasa_branches').delete().eq('id',branch));
  if(user)check(await admin.auth.admin.deleteUser(user.id));
  await customer.auth.signOut();
 }
});
