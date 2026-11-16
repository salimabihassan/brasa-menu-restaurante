'use client';
import {useEffect,useRef,useState} from 'react';
import {Copy,Check,ChevronDown} from 'lucide-react';
import {bankFields,bankClipboardText,type BankDetails} from '@/lib/bank-details';
import {getBankDetails} from '@/lib/bank-api';
import {money} from '@/lib/catalog';
export function BankTransferDetails({total,demo=true}:{total:number;demo?:boolean}){
 const [details,setDetails]=useState<BankDetails|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[copied,setCopied]=useState(''),[manual,setManual]=useState('');
 const manualInput=useRef<HTMLTextAreaElement>(null),copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{let live=true;const load=async()=>{try{const details=await getBankDetails();if(live){setDetails(details);setError('');}}catch(err){if(live){setDetails(null);setError(err instanceof Error?err.message:'No se pudieron cargar los datos.');}}finally{if(live)setLoading(false);}};void load();const timer=setInterval(()=>void load(),8000);window.addEventListener('focus',load);return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',load);};},[]);
 useEffect(()=>()=>{if(copyTimer.current)clearTimeout(copyTimer.current);},[]);
 useEffect(()=>{if(manual)manualInput.current?.select();},[manual]);
 async function copy(text:string,label:string){
  let success=false;
  try{if(window.isSecureContext&&navigator.clipboard){await navigator.clipboard.writeText(text);success=true;}}catch{}
  if(!success){const previous=document.activeElement as HTMLElement|null;const textarea=document.createElement('textarea');textarea.value=text;textarea.readOnly=true;textarea.style.cssText='position:fixed;left:-9999px;top:0;font-size:16px';document.body.append(textarea);textarea.select();try{success=document.execCommand('copy');}catch{}textarea.remove();previous?.focus({preventScroll:true});}
  if(success){setManual('');setCopied(label);if(copyTimer.current)clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(''),2500);}else{setCopied('');setManual(text);}
 }
 if(loading)return <div className="bank-info" role="status">Cargando datos de transferencia…</div>;
 return <section className="bank-info bank-transfer-details" aria-label="Datos de transferencia">
  <div className="bank-compact-heading"><h3>Datos de transferencia</h3><strong>{money(total)}</strong></div>
  {demo&&<p className="bank-demo-note">Prueba · No transfieras dinero real.</p>}
  {error?<p role="alert">{error} Vuelve a intentarlo antes de transferir.</p>:details?.enabled?<>
   <button type="button" className="secondary bank-copy-all" onClick={()=>void copy(bankClipboardText(details),'Todos los datos')}><Copy size={17}/> Copiar todos los datos</button>
   <details className="bank-disclosure"><summary><span>Ver datos bancarios</span><ChevronDown size={17}/></summary>
    <div className="bank-transfer-amount"><span>Monto del pedido</span><strong>{money(total)}</strong><button type="button" className="bank-copy-field" onClick={()=>void copy(String(total),'Monto')} aria-label="Copiar monto"><Copy size={16}/></button></div>
    <dl className="bank-fields">{bankFields(details).map(([label,value])=><div key={label}><dt>{label}</dt><dd><span>{value}</span><button type="button" className="bank-copy-field" onClick={()=>void copy(value,label)} aria-label={`Copiar ${label.toLowerCase()}`}><Copy size={16}/></button></dd></div>)}</dl>
    <small>Puedes pegarlos en tu banco. El llenado automático depende de la aplicación bancaria.</small>
   </details>
  </>:<p>{demo?'El administrador todavía no ha configurado una cuenta. Puedes continuar la prueba adjuntando una imagen o un PDF de muestra.':'El local todavía no ha habilitado los datos de transferencia. No transfieras sin confirmar la cuenta.'}</p>}
  {copied&&<p className="bank-copy-status" role="status"><Check size={15}/> {copied}: copiado.</p>}
  {manual&&<label className="bank-copy-manual">Tu navegador no permitió copiar. Mantén pulsado el texto y elige «Copiar».<textarea ref={manualInput} readOnly value={manual} rows={7}/></label>}
 </section>;
}
