'use client';
import {useRef} from 'react';
import {Upload} from 'lucide-react';

export function ReceiptUpload({processing,name,onFile,replacement=false}:{processing:boolean;name:string;onFile:(file:File|undefined)=>void;replacement?:boolean}){
 const input=useRef<HTMLInputElement>(null);
 return <div className="upload-box receipt-upload"><button type="button" className="primary receipt-upload-button" disabled={processing} onClick={()=>input.current?.click()}><Upload size={24}/><span>{processing?'Optimizando foto…':replacement?'Adjuntar nuevo comprobante de transferencia':'Adjuntar comprobante de transferencia'}</span></button><small>Selecciona una foto o un PDF del comprobante de tu banco.</small><small>Fotos hasta 30 MB · Se comprimen automáticamente · PDF hasta 1 MB</small>{name&&<p className="receipt-upload-name" role="status">Archivo seleccionado: <strong>{name}</strong></p>}<input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={event=>{onFile(event.target.files?.[0]);event.target.value='';}}/></div>;
}
