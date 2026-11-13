import { branch, type Order } from './catalog';
import { customerSession, supabase } from './supabase';
export type Settings = {paused:boolean;unavailable:string[]};
function fail(error: {message:string}|null) { if(error) throw new Error(error.message); }
export async function listCloudOrders(staff:boolean):Promise<Order[]> {
 if(!staff) await customerSession();
 const {data,error}=await supabase(staff?'staff':'customer').from('brasa_orders').select('payload,version').eq('branch_id',branch.id).order('created_at',{ascending:false}).limit(200);
 fail(error);return (data||[]).map(row=>({...row.payload,version:row.version} as Order));
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
 const path=`${user.id}/${orderId}/${crypto.randomUUID()}`;
 const {error}=await supabase().storage.from('brasa-receipts').upload(path,blob,{contentType:blob.type,upsert:false});
 fail(error); return path;
}
export async function createCloudOrder(order:Order):Promise<Order> {
 await customerSession();
 const {data:existing,error:lookupError}=await supabase().from('brasa_orders').select('payload,version').eq('id',order.id).maybeSingle();
 fail(lookupError);if(existing) return {...existing.payload,version:existing.version};
 const path=order.receipt?await uploadReceipt(order.id,order.receipt):null;
 const {data,error}=await supabase().rpc('brasa_create_order',{p_id:order.id,p_branch:order.branchId,p_name:order.name,p_phone:order.phone,p_note:order.note,p_method:order.method,p_items:order.items.map(i=>({productId:i.product.id,quantity:i.quantity,extras:i.extras})),p_receipt:path,p_receipt_name:order.receiptName||null,p_expected_total:order.total});
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
