export function cartKey(productId:string,extras:string[],note:string){
 return JSON.stringify([productId,[...extras].sort(),note.trim()]);
}
