import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../public/brasa-notifications-sw.js',import.meta.url),'utf8');
const id='20000000-0000-0000-0000-000000000001';
function runtime(paths=['/','/admin/']){
 const listeners={},notifications=[],opened=[],messages=[];
 const windows=paths.map(path=>({url:'https://brasa.example'+path,focus:async()=>{},postMessage:message=>messages.push({path,...message})}));
 const self={location:{origin:'https://brasa.example'},addEventListener:(type,fn)=>listeners[type]=fn,registration:{showNotification:async(title,options)=>notifications.push({title,...options})},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}};
 vm.runInNewContext(source,{self,URL});return {listeners,notifications,opened,messages};
}
test('staff push contains only a generic order alert and opens the staff panel, not a customer or editing tab',async()=>{
 const r=runtime();let pending;
 r.listeners.push({data:{json:()=>({type:'BRASA_STAFF_ORDER',orderId:id,event:'new_order',name:'Must not appear'})},waitUntil:promise=>pending=promise});await pending;
 assert.equal(r.notifications[0].title,'BRASA · Nuevo pedido');assert.equal(r.notifications[0].body.includes('Must not appear'),false);assert.equal(r.messages.length,0);
 r.listeners.notificationclick({notification:{data:r.notifications[0].data,close(){}},waitUntil:promise=>pending=promise});await pending;
 assert.equal(r.opened[0],`https://brasa.example/local/?order=${id}`);
});
test('receipt reupload refreshes only the staff panel; customer ready notices keep their original destination',async()=>{
 const r=runtime(['/','/local/']);let pending;
 r.listeners.push({data:{json:()=>({type:'BRASA_STAFF_ORDER',orderId:id,event:'receipt_resubmitted'})},waitUntil:promise=>pending=promise});await pending;
 assert.equal(r.notifications[0].title,'BRASA · Nuevo comprobante');assert.equal(r.messages[0].path,'/local/');assert.equal(r.messages[0].type,'BRASA_STAFF_PUSH');
 r.listeners.notificationclick({notification:{data:r.notifications[0].data,close(){}},waitUntil:promise=>pending=promise});await pending;
 assert.equal(r.messages.at(-1).type,'BRASA_STAFF_OPEN_ORDER');assert.equal(r.opened.length,0);
 r.listeners.push({data:{json:()=>({type:'BRASA_ORDER_READY',orderId:id})},waitUntil:promise=>pending=promise});await pending;
 assert.equal(r.notifications[1].title,'BRASA · Tu pedido está listo');assert.equal(r.messages.at(-1).path,'/');assert.equal(r.messages.at(-1).type,'BRASA_READY_PUSH');
});
