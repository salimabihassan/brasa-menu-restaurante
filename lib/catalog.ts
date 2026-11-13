export const branch = { id: 'santiago-centro', name: 'Providencia', address: 'Av. Providencia 1450, Santiago', hours: '12:00 – 23:00' };
export const money = (n: number) => '$' + new Intl.NumberFormat('es-CL').format(n);
export const extras = [{id:'cheese',name:'Queso cheddar',price:700},{id:'bacon',name:'Tocino crocante',price:1200},{id:'avocado',name:'Palta',price:1000}];
export const products = [
 {id:'classic',name:'La Clásica',category:'Hamburguesas',price:6990,description:'Carne a la parrilla, cheddar, lechuga, tomate y nuestra salsa de la casa.',image:'photo-1568901346375-23c9450c58cd',badge:'LA FAVORITA',available:true},
 {id:'double',name:'Doble Brasa',category:'Hamburguesas',price:8990,description:'Doble carne, doble cheddar, tocino crocante y cebolla caramelizada.',image:'photo-1553979459-d2229ba7433a',badge:'PARA EL HAMBRE',available:true},
 {id:'crispy',name:'Pollo Crispy',category:'Hamburguesas',price:7490,description:'Pollo crujiente, coleslaw fresco, pepinillos y mayo de la casa.',image:'photo-1606755962773-d324e0a13086',badge:'',available:true},
 {id:'veggie',name:'Verde que te quiero',category:'Hamburguesas',price:7490,description:'Hamburguesa vegetal, palta, rúcula y mayo de ajo asado.',image:'photo-1520072959219-c595dc870360',badge:'VEGGIE',available:false},
 {id:'fries',name:'Papas de la casa',category:'Acompañamientos',price:3490,description:'Doradas, crujientes y con nuestro toque de sal especiada.',image:'photo-1573080496219-bb080dd4f877',badge:'',available:true},
 {id:'loaded',name:'Papas Brasa',category:'Acompañamientos',price:5490,description:'Papas con cheddar fundido, tocino y ciboulette.',image:'photo-1639024471283-03518883512d',badge:'PARA COMPARTIR',available:true},
 {id:'cola',name:'Bebida helada',category:'Bebidas',price:1990,description:'Bebida cola de 350 ml. El acompañante de siempre.',image:'photo-1622483767028-3f66f32aef97',badge:'',available:true},
 {id:'combo',name:'Tu combo favorito',category:'Combos',price:10990,description:'La Clásica + papas de la casa + bebida de 350 ml.',image:'photo-1610614819513-58e34989848b',badge:'EL PLAN COMPLETO',available:true}
];
export type Product = typeof products[number];
export type CartItem = { key:string; product:Product; quantity:number; extras:string[]; unitPrice?:number; extraDetails?:{id:string;name:string;price:number}[] };
export type Order = { version?:number; id:string; branchId:string; createdAt:string; name:string; phone:string; note:string; items:CartItem[]; total:number; method:'transfer'|'card'; payment:'review'|'paid'|'rejected'; status:'pending'|'preparing'|'ready'|'delivered'|'cancelled'; receipt?:string; receiptName?:string; reason?:string; history:{at:string; text:string}[] };
export const itemTotal = (item: CartItem) => (item.unitPrice ?? (item.product.price + extras.filter(e=>item.extras.includes(e.id)).reduce((s,e)=>s+e.price,0)))*item.quantity;
export const statusNames = {pending:'Por aceptar',preparing:'En preparación',ready:'Listo para retirar',delivered:'Entregado',cancelled:'Cancelado'};


export const itemExtraNames = (item:CartItem) => (item.extraDetails ?? extras.filter(e=>item.extras.includes(e.id))).map(e=>e.name).join(', ');
