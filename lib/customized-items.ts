import type {Product,CartItem} from './catalog';
import {cartKey} from './cart-key.ts';
export type UnitOptions={extras:string[];note:string};
export function customizedItems(product:Product,units:UnitOptions[],extras:{id:string;name:string;price:number}[]):CartItem[]{
 const lines=new Map<string,CartItem>();
 for(const unit of units){
  const note=unit.note.trim(),options=extras.filter(e=>unit.extras.includes(e.id));
  const selected=options.map(e=>e.id),key=cartKey(product.id,selected,note);
  const line=lines.get(key);
  if(line)line.quantity++;
  else lines.set(key,{key,product,quantity:1,extras:selected,note,extraDetails:options,unitPrice:product.price+options.reduce((sum,e)=>sum+e.price,0)});
 }
 return [...lines.values()];
}
