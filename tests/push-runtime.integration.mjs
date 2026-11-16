import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {localStatus,localClient,check} from '../scripts/local-runtime.mjs';
test('local Edge Function authorizes staff, rejects invalid input and skips absent subscriptions',async()=>{
 const status=localStatus(),admin=localClient(status,true),customer=localClient(status),staff=localClient(status);
 const keys=JSON.parse(await readFile('.local/web-push-keys.json','utf8'));
 const credentials=JSON.parse(await readFile('.local/staff.json','utf8'));
 const branch='push-check-'+randomUUID(),id=randomUUID();let user;
 const call=async(token,body,origin='http://localhost:3000')=>{
  const response=await fetch(`${status.url}/functions/v1/send-ready-notification`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  return {status:response.status,body:await response.json()};
 };
 try{
  check(await admin.from('brasa_branches').insert({id:branch,name:'Prueba aislada push'}));
  const product=check(await admin.from('brasa_catalog').select('product').eq('branch_id','santiago-centro').eq('id','classic').single()).product;
  check(await admin.from('brasa_catalog').insert({branch_id:branch,id:product.id,product:{...product,available:true}}));
  const session=check(await customer.auth.signInAnonymously());user=session.user;
  check(await customer.rpc('brasa_create_order',{p_id:id,p_branch:branch,p_name:'Prueba aislada push',p_phone:'999999999',p_note:'',p_method:'card',p_receipt:null,p_receipt_name:null,p_expected_total:product.price,p_items:[{productId:product.id,quantity:1,extras:[]}]}));
  check(await staff.auth.signInWithPassword(credentials));
  assert.equal((await call(null,{})).status,401);
  assert.equal((await call(keys.workerToken,null)).status,400);
  assert.equal((await call(keys.workerToken,{},'https://other.invalid')).status,403);
  assert.equal((await call(session.session.access_token,{orderId:id})).status,403);
  // Add this test membership only, then use the same production transition RPCs.
  const staffUser=check(await staff.auth.getUser()).user;
  check(await admin.from('brasa_memberships').insert({user_id:staffUser.id,branch_id:branch}));
  let order=check(await admin.from('brasa_orders').select('version').eq('id',id).single());
  for(const action of ['preparing','ready'])order=check(await staff.rpc('brasa_staff_action',{p_id:id,p_version:order.version,p_action:action,p_reason:''}));
  const token=check(await staff.auth.getSession()).session.access_token;
  const result=await call(token,{orderId:id});assert.equal(result.status,200);assert.equal(result.body.results[0].state,'no_subscriptions');
  const duplicate=await call(keys.workerToken,{orderId:id});assert.equal(duplicate.body.results[0].state,'already_processed_or_leased');
  assert.equal(check(await admin.from('brasa_ready_push_jobs').select('state').eq('order_id',id).single()).state,'skipped');
 }finally{
  check(await admin.from('brasa_orders').delete().eq('branch_id',branch));
  check(await admin.from('brasa_memberships').delete().eq('branch_id',branch));
  check(await admin.from('brasa_catalog').delete().eq('branch_id',branch));
  check(await admin.from('brasa_branches').delete().eq('id',branch));
  if(user)check(await admin.auth.admin.deleteUser(user.id));
  await Promise.all([customer.auth.signOut(),staff.auth.signOut()]);
 }
});
