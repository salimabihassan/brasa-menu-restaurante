import {branch} from './catalog';
import {supabase} from './supabase';
import type {BankDetails} from './bank-details';
export async function getBankDetails(staff=false):Promise<BankDetails|null>{
 const {data,error}=await supabase(staff?'staff':'customer').from('brasa_bank_details').select('bank,account_type,account_number,holder,rut,email,enabled').eq('branch_id',branch.id).maybeSingle();
 if(error)throw Error('No se pudieron cargar los datos de transferencia.');return data;
}
export async function saveBankDetails(details:BankDetails){
 const {error}=await supabase('staff').rpc('brasa_save_bank_details',{p_branch:branch.id,p_details:details});if(error)throw Object.assign(Error(error.message),{field:error.details});
}
