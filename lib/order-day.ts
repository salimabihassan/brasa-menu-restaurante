// Calendar dates follow the restaurant's timezone, regardless of the device.
export function orderDay(value:string|number|Date=new Date()):string {
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const part=(name:string)=>parts.find(item=>item.type===name)?.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
