import {branch,type Product,type MenuExtra} from './catalog';
import {supabase} from './supabase';
import {newId} from './id';
import {prepareReceipt} from './receipt-image';
export {parseMenuPrice} from './menu-price';
export async function setProductAvailable(id:string,available:boolean){
 const {error}=await supabase('staff').rpc('brasa_set_product_available',{p_branch:branch.id,p_product:id,p_available:available});
 if(error)throw Error(error.message);
}
export async function menuAdministration(){
 const client=supabase('staff');
 const [categories,extras]=await Promise.all([client.from('brasa_categories').select('name').eq('branch_id',branch.id).order('name'),client.from('brasa_menu_extras').select('id,name,price,active').eq('branch_id',branch.id).order('name')]);
 if(categories.error||extras.error)throw Error('No se pudo cargar la administración del menú.');
 return {categories:(categories.data||[]).map(row=>row.name as string),extras:(extras.data||[]) as MenuExtra[]};
}
export async function saveMenu(kind:'product'|'category'|'extra',doc:Product|MenuExtra|{name:string;oldName?:string;action?:string}){
 const {error}=await supabase('staff').rpc('brasa_manage_menu',{p_branch:branch.id,p_kind:kind,p_doc:doc});
 if(error)throw Error(error.message);
}
export async function uploadMenuPhoto(file:File){
 if(!file.type.startsWith('image/'))throw Error('Selecciona una foto JPG, PNG, WebP o HEIC.');
 const prepared=await prepareReceipt(file);
 const extension=prepared.blob.type==='image/png'?'png':prepared.blob.type==='image/webp'?'webp':'jpg';
 const path=`${branch.id}/${newId()}.${extension}`;
 const {error}=await supabase('staff').storage.from('brasa-menu').upload(path,prepared.blob,{contentType:prepared.blob.type,upsert:false,cacheControl:'3600'});
 if(error)throw Error('No se pudo subir la foto. Revisa la conexión e inténtalo nuevamente.');
 return `menu:${path}`;
}
