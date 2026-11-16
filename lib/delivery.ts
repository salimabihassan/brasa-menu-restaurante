import {branch} from './catalog';
import {customerSession,supabase} from './supabase';
export type DeliverySettings={enabled:boolean;origin_address:string;price_per_km:number;maximum_km:number;version?:number};
export type DeliveryQuote={id:string;address:string;commune:string;distance_meters:number;duration_seconds:number;fee:number;price_per_km:number;expires_at:string};
export const defaultDeliverySettings:DeliverySettings={enabled:false,origin_address:'',price_per_km:0,maximum_km:5};
export async function getDeliverySettings(staff=false):Promise<DeliverySettings|null>{const {data,error}=await supabase(staff?'staff':'customer').from('brasa_delivery_settings').select('enabled,origin_address,price_per_km,maximum_km,version').eq('branch_id',branch.id).maybeSingle();if(error)throw Error('No se pudo cargar la configuración de delivery.');return data?{...data,maximum_km:Number(data.maximum_km)}:null;}
export async function saveDeliverySettings(settings:DeliverySettings){const {error}=await supabase('staff').rpc('brasa_save_delivery_settings',{p_branch:branch.id,p_settings:settings});if(error)throw Error(error.message);}
async function functionError(error:{context?:Response}){try{return (await error.context?.json())?.error;}catch{return null;}}
export async function quoteDelivery(address:string,commune:string):Promise<DeliveryQuote>{await customerSession();const {data,error}=await supabase().functions.invoke('quote-delivery',{body:{branchId:branch.id,address,commune}});if(error)throw Error(await functionError(error)||'No se pudo calcular el delivery. Revisa la conexión e inténtalo de nuevo.');return data.quote;}
export async function deliveryProviderStatus(){const {data,error}=await supabase('staff').functions.invoke('quote-delivery',{body:{branchId:branch.id,action:'status'}});if(error)throw Error('No se pudo comprobar la conexión del cálculo de rutas.');return !!data.configured;}
