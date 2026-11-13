'use client';
import {useState} from 'react';
import {cloudEnabled} from '@/lib/supabase';
import {receiptUrl} from '@/lib/cloud-orders';
export function ReceiptPreview({path,name}:{path:string;name?:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function open(){setBusy(true);setError('');try{setUrl(cloudEnabled?await receiptUrl(path,true):path);}catch{setError('No pudimos abrir el comprobante. Vuelve a iniciar sesión e inténtalo otra vez.');}finally{setBusy(false);}}
 return <details onToggle={e=>{if(e.currentTarget.open&&!url)void open();}}><summary>Ver comprobante · {name}</summary>{busy&&<p>Cargando comprobante privado…</p>}{error&&<p role="alert">{error}</p>}{url&&(path.startsWith('data:image/')||/\.(png|jpe?g|webp)$/i.test(name||'')?<img className="receipt" src={url} alt="Comprobante adjuntado por el cliente"/>:<a href={url} target="_blank" rel="noreferrer">Abrir comprobante</a>)}{cloudEnabled&&url&&<button className="text-button" onClick={()=>void open()}>Renovar enlace temporal</button>}<p className="fine">Comprueba que el archivo corresponde al pago antes de aprobar.</p></details>;
}
