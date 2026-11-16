import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = !!(url && key);
const clients: Partial<Record<'customer'|'staff',SupabaseClient>> = {};
export function supabase(role: 'customer'|'staff' = 'customer') {
 if (!cloudEnabled) throw new Error('Supabase aún no está configurado.');
 const endpoint = process.env.NEXT_PUBLIC_SUPABASE_LOCAL_PROXY === 'true' && typeof window !== 'undefined'
  ? `${window.location.origin}/supabase` : url!;
 return clients[role] ??= createClient(endpoint, key!, {auth: {storageKey:`brasa-${role}-auth`,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
}
let customerSessionRequest:Promise<User>|null=null;
export function customerSession():Promise<User> {
 if(customerSessionRequest)return customerSessionRequest;
 customerSessionRequest=(async()=>{
  const client=supabase();const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)return data.session.user;
  const result=await client.auth.signInAnonymously();if(result.error)throw new Error('No pudimos iniciar tu pedido. Verifica que el acceso anónimo esté habilitado en Supabase.');return result.data.user!;
 })().finally(()=>{customerSessionRequest=null;});
 return customerSessionRequest;
}
