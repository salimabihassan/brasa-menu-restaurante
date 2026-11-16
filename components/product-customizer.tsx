'use client';
import {useEffect,useRef,useState} from 'react';
import {Minus,Plus,X,Check} from 'lucide-react';
import {money,itemTotal,type Product,type CartItem} from '@/lib/catalog';
import {customizedItems,type UnitOptions} from '@/lib/customized-items';
import {menuImage} from '@/lib/menu-image';
export function ProductCustomizer({product,extras,disabled,onClose,onAdd}:{product:Product;extras:{id:string;name:string;price:number}[];disabled:boolean;onClose:()=>void;onAdd:(items:CartItem[])=>void}){
 const [units,setUnits]=useState<UnitOptions[]>([{extras:[],note:''}]),[index,setIndex]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=dialog.current;const viewport=window.visualViewport;const resize=()=>{el?.style.setProperty('--customizer-visible-height',(viewport?.height||window.innerHeight)+'px');el?.style.setProperty('--customizer-top',((viewport?.offsetTop||0)+12)+'px');};resize();el?.showModal();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize);return()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize);el?.close();};},[]);
 const options=product.extraIds?extras.filter(extra=>product.extraIds!.includes(extra.id)):['Hamburguesas','Combos'].includes(product.category)?extras:[];
 const selectedIndex=Math.min(index,units.length-1);
 const current=units[selectedIndex],lines=customizedItems(product,units,options),total=lines.reduce((sum,line)=>sum+itemTotal(line),0);
 function quantity(change:number){setUnits(previous=>{if(change>0){if(previous.length>=20)return previous;const last=previous.at(-1)!;return [...previous,{extras:[...last.extras],note:last.note}];}if(previous.length<=1)return previous;return previous.slice(0,-1);});if(change<0)setIndex(i=>Math.max(0,Math.min(i,units.length-2)));}
 function edit(change:Partial<UnitOptions>){setUnits(list=>list.map((unit,i)=>i===selectedIndex?{...unit,...change}:unit));}
 return <dialog ref={dialog} className="product-modal product-customizer" onCancel={e=>{e.preventDefault();onClose();}} aria-labelledby="customizer-title">
  <div className="customizer-heading"><img src={menuImage(product.image,140)} alt="" width={56} height={56}/><div><h2 id="customizer-title">{product.name}</h2><p>{product.description}</p></div><button className="close" onClick={onClose} aria-label="Cerrar producto" autoFocus><X size={20}/></button></div>
  <div className="customizer-quantity"><div><strong>Cantidad</strong><small>{units.length>1?'Puedes personalizar cada unidad':'Arma tu producto a tu gusto'}</small></div><div className="stepper"><button disabled={units.length<=1} onClick={()=>quantity(-1)} aria-label="Reducir cantidad"><Minus size={18}/></button><span aria-live="polite">{units.length}</span><button disabled={units.length>=20} onClick={()=>quantity(1)} aria-label="Aumentar cantidad"><Plus size={18}/></button></div></div>
  {units.length>1&&<div className="unit-tabs" role="tablist" aria-label="Personalizar cada unidad">{units.map((unit,i)=><button role="tab" aria-selected={selectedIndex===i} aria-controls="unit-options" id={`unit-tab-${i}`} key={i} onClick={()=>setIndex(i)}><strong>Unidad {i+1}</strong><small>{unit.note||unit.extras.length?'Personalizada':'Original'}</small>{selectedIndex===i&&<Check size={14}/>}</button>)}</div>}
  <div className="customizer-scroll" id="unit-options" role={units.length>1?'tabpanel':undefined} aria-labelledby={units.length>1?`unit-tab-${selectedIndex}`:undefined}>
   <div className="unit-heading"><strong>{units.length>1?`Configura la unidad ${selectedIndex+1}`:'Personaliza tu pedido'}</strong>{units.length>1&&<button className="text-button" onClick={()=>setUnits(list=>list.map(()=>({extras:[...current.extras],note:current.note})))}>Aplicar a todas</button>}</div>
   {options.length>0&&<div className="customizer-extras"><h3>Extras <small>Opcional</small></h3>{options.map(e=><label className="extra" key={e.id}><span><input type="checkbox" checked={current.extras.includes(e.id)} onChange={()=>edit({extras:current.extras.includes(e.id)?current.extras.filter(id=>id!==e.id):[...current.extras,e.id]})}/>{e.name}</span><strong>+ {money(e.price)}</strong></label>)}</div>}
   <label className="product-note">Indicaciones {units.length>1?`para la unidad ${selectedIndex+1}`:'para este producto'} <small>Opcional</small><textarea value={current.note} maxLength={300} onChange={e=>edit({note:e.target.value})} placeholder="Ej.: Solo pan, carne y papas hilo. Sin salsas."/><span>{units.length>1?'Solo se aplican a esta unidad. Cambia de pestaña para configurar las demás.':'Déjalo vacío para recibir la receta original.'}</span></label>
  </div>
  <div className="customizer-footer"><button className="primary wide" disabled={disabled} onClick={()=>onAdd(lines)}>Agregar {units.length} {units.length===1?'unidad':'unidades'} <strong>{money(total)}</strong><Plus size={18}/></button></div>
 </dialog>;
}
