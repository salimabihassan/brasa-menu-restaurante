import { branch, products as demoProducts, extras as demoExtras, type Order, type Product } from './catalog';
import { customerSession, supabase } from './supabase';
import {newId} from "./id";
export type Settings = {paused:boolean;unavailable:string[]};
export async function cloudMenu():Promise<{products:Product[];extras:{id:string;name:string;price:number}[]}> {
 const client=supabase();
 const [menu,options]=await Promise.all([
  client.from('brasa_catalog').select('product').eq('branch_id',branch.id).order('id'),
  client.from('brasa_menu_extras').select('id,name,price').eq('branch_id',branch.id).eq('active',true).order('id')
 ]);
 fail(menu.error);fail(options.error);
 const position=(id:string,list:{id:string}[])=>{const index=list.findIndex(item=>item.id===id);return index<0?Number.MAX_SAFE_INTEGER:index;};
 return {products:(menu.data||[]).map(row=>row.product as Product).sort((a,b)=>position(a.id,demoProducts)-position(b.id,demoProducts)),extras:(options.data||[]).sort((a,b)=>position(a.id,demoExtras)-position(b.id,demoExtras))};
}
function fail(error: {message:string}|null) { if(error) throw new Error(error.message); }
export async function listCloudOrders(staff:boolean):Promise<Order[]> {
 if(!staff) await customerSession();
 const orders:Order[]=[];
 // Staff history must not silently lose older dates after the first 200 orders.
 const pageSize=200;
 for(let offset=0;;offset+=pageSize){
  const {data,error}=await supabase(staff?'staff':'customer').from('brasa_orders').select('payload,version').eq('branch_id',branch.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+pageSize-1);
  fail(error);orders.push(...(data||[]).map(row=>({...row.payload,version:row.version} as Order)));
  if(!staff||(data||[]).length<pageSize)break;
 }
 return orders;
}
export async function cloudSettings():Promise<Settings> {
 const {data,error}=await supabase().from('brasa_branches').select('paused,unavailable').eq('id',branch.id).single();
 fail(error); return data as Settings;
}
export async function saveSettings(settings:Settings) {
 const {error}=await supabase('staff').rpc('brasa_set_settings',{p_branch:branch.id,p_paused:settings.paused,p_unavailable:settings.unavailable});fail(error);
}
async function uploadReceipt(orderId:string,receipt:string) {
 const user=await customerSession();
 const blob=await (await fetch(receipt)).blob();
 const path=`${user.id}/${orderId}/${newId()}`;
 const {error}=await supabase().storage.from('brasa-receipts').upload(path,blob,{contentType:blob.type,upsert:false});
 fail(error); return path;
}
export async function createCloudOrder(order:Order):Promise<Order> {
 await customerSession();
 const {data:existing,error:lookupError}=await supabase().from('brasa_orders').select('payload,version').eq('id',order.id).maybeSingle();
 fail(lookupError);if(existing) return {...existing.payload,version:existing.version};
 const path=order.receipt?await uploadReceipt(order.id,order.receipt):null;
 const {data,error}=await supabase().rpc('brasa_place_order',{p_id:order.id,p_branch:order.branchId,p_name:order.name,p_phone:order.phone,p_note:order.note,p_method:order.method,p_items:order.items.map(i=>({productId:i.product.id,quantity:i.quantity,extras:i.extras,note:i.note||''})),p_receipt:path,p_receipt_name:order.receiptName||null,p_expected_total:order.total,p_fulfillment:order.fulfillment||'pickup',p_quote:order.deliveryQuoteId||null,p_delivery_note:order.delivery?.instructions||''});
 fail(error); return data as Order;
}
export async function mutateCloudOrder(order:Order,change:Partial<Order>):Promise<Order> {
 if(change.receipt){
  const path=await uploadReceipt(order.id,change.receipt);
  const {data,error}=await supabase().rpc('brasa_resubmit_receipt',{p_id:order.id,p_version:order.version,p_path:path,p_name:change.receiptName||'Comprobante'});
  fail(error);return data as Order;
 }
 const action=change.payment==='paid'?'approve':change.payment==='rejected'?'reject':change.status;
 const {data,error}=await supabase('staff').rpc('brasa_staff_action',{p_id:order.id,p_version:order.version,p_action:action,p_reason:change.reason||''});
 fail(error);return data as Order;
}
export async function receiptUrl(path:string,staff:boolean) {
 const {data,error}=await supabase(staff?'staff':'customer').storage.from('brasa-receipts').createSignedUrl(path,120);
 fail(error);return data!.signedUrl;
}
