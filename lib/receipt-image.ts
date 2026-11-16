export const RECEIPT_LIMIT = 1024 * 1024;
export function fitImage(width:number,height:number,maxEdge=2200){
 const scale=Math.min(1,maxEdge/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export async function prepareReceipt(file:File):Promise<{blob:Blob;name:string;compressed:boolean}> {
 if(file.type==='application/pdf'){
  if(file.size>RECEIPT_LIMIT)throw Error('El PDF supera 1 MB. Adjunta una foto del comprobante o un PDF más pequeño.');
  return {blob:file,name:file.name,compressed:false};
 }
 if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)&&! /\.(heic|heif)$/i.test(file.name))throw Error('Adjunta una foto JPG, PNG, WebP o un PDF.');
 if(file.size>30*1024*1024)throw Error('La foto supera 30 MB. Elige una imagen más pequeña del comprobante.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.decoding='async';
  await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('No pudimos leer la foto. Si está en HEIC, expórtala como JPG o adjunta una captura de pantalla.'));img.src=url;});
  if(img.naturalWidth*img.naturalHeight>60_000_000)throw Error('La resolución de la foto es demasiado grande. Adjunta una captura del comprobante.');
  if(file.size<=RECEIPT_LIMIT&&['image/jpeg','image/png','image/webp'].includes(file.type))return {blob:file,name:file.name,compressed:false};
  const canvas=document.createElement('canvas');
  try{
   for(const edge of [2200,1800,1400,1100]){
    const size=fitImage(img.naturalWidth,img.naturalHeight,edge);canvas.width=size.width;canvas.height=size.height;
    const context=canvas.getContext('2d');if(!context)throw Error('Este navegador no puede procesar la imagen.');
    context.fillStyle='#fff';context.fillRect(0,0,size.width,size.height);context.drawImage(img,0,0,size.width,size.height);
    for(const quality of [.9,.8,.7,.6]){
     const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No pudimos optimizar la imagen. Intenta con otra foto.')),'image/jpeg',quality));
     if(blob.size<=900*1024)return {blob,name:file.name.replace(/\.[^.]+$/,'')+'.jpg',compressed:true};
    }
   }
   throw Error('No pudimos reducir la foto conservando la claridad. Prueba con una captura del comprobante.');
  }finally{canvas.width=0;canvas.height=0;}
 }finally{URL.revokeObjectURL(url);}
}
export function receiptDataURL(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{
 const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('No pudimos leer el comprobante.'));reader.readAsDataURL(blob);
});}
