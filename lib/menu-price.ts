export function parseMenuPrice(value:string):number {
 const clean=value.trim();
 if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,0{1,2})?$/.test(clean))throw Error('Escribe un precio en pesos enteros, por ejemplo 6.990.');
 const price=Number(clean.replace(/\./g,'').replace(/,0{1,2}$/, ''));
 if(!Number.isSafeInteger(price)||price<0||price>1000000)throw Error('El precio debe estar entre $0 y $1.000.000.');
 return price;
}
