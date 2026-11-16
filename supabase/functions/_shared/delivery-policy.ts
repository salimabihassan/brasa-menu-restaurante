export function deliveryAddress(value:unknown,min:number,max:number){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max||/[\x00-\x1f]/.test(value))throw Error('Revisa la dirección y la comuna de entrega.');return value.trim();}
export function googleRouteRequest(origin:string,address:string,commune:string){return {origin:{address:origin},destination:{address:`${address}, ${commune}, Chile`},travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',computeAlternativeRoutes:false,languageCode:'es',regionCode:'CL',units:'METRIC'};}
export function readGoogleRoute(body:{routes?:{distanceMeters?:number;duration?:string}[]}){
 const route=body?.routes?.[0];if(!route)throw Error('No encontramos una ruta para esa dirección. Revisa calle, número y comuna.');
 const meters=route.distanceMeters;const duration=route.duration;
 if(typeof meters!=='number'||!Number.isInteger(meters)||meters<0||typeof duration!=='string'||!/^\d+(?:\.\d+)?s$/.test(duration))throw Error('No se pudo validar la distancia de entrega.');
 const seconds=Math.round(Number(duration.slice(0,-1)));if(!Number.isSafeInteger(seconds)||seconds<0)throw Error('No se pudo validar la ruta.');
 return {meters,seconds};
}
export function deliveryCost(meters:number,pricePerKm:number,maximumKm:number){
 if(!Number.isFinite(meters)||meters<0||!Number.isFinite(pricePerKm)||pricePerKm<0||!Number.isFinite(maximumKm)||maximumKm<=0)throw Error('Configuración de delivery inválida.');
 if(meters>maximumKm*1000)throw Error('La dirección está fuera de la zona de delivery del local.');
 return Math.round(meters/1000*pricePerKm);
}
