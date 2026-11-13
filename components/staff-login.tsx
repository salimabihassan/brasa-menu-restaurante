'use client';
import {useState} from 'react';
import {LockKeyhole,ArrowUpRight} from 'lucide-react';
import {branch} from '@/lib/catalog';
import {supabase} from '@/lib/supabase';
export function StaffLogin({onLogin}:{onLogin:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function login(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const values=new FormData(e.currentTarget);setBusy(true);setError('');
  try{
   const client=supabase('staff');
   const {error:authError}=await client.auth.signInWithPassword({email:String(values.get('email')).trim(),password:String(values.get('password'))});
   if(authError)throw new Error('No pudimos iniciar sesión. Revisa el correo y la contraseña.');
   const {data,error:membershipError}=await client.from('brasa_memberships').select('branch_id').eq('branch_id',branch.id);
   if(membershipError||!data?.length){await client.auth.signOut();throw new Error('Tu cuenta no tiene acceso a esta sucursal.');}
   onLogin();
  }catch(err){setError(err instanceof Error?err.message:'No pudimos conectar con el local.');}finally{setBusy(false);}
 }
 return <main className="workspace"><section className="surface staff-login"><span className="login-icon"><LockKeyhole size={27}/></span><span className="eyebrow muted">BRASA · EQUIPO DEL LOCAL</span><h1 className="page-title">Bienvenido a cocina.</h1><p>Ingresa con tu cuenta para revisar pagos y gestionar pedidos.</p><form onSubmit={login} className="checkout-form"><label>Correo del personal<input autoComplete="username" type="email" name="email" required placeholder="equipo@tulocal.cl"/></label><label>Contraseña<input autoComplete="current-password" type="password" name="password" required minLength={6}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button disabled={busy} className="primary wide">{busy?'Ingresando…':'Entrar al local'}<ArrowUpRight size={18}/></button></form><p className="fine">Acceso exclusivo para personal autorizado de {branch.name}.</p></section></main>;
}
