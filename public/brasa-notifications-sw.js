/* Push only: no caching of pages, API calls, orders, or private receipts. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 const id=/^[0-9a-f-]{36}$/i.test(payload.orderId||'')?payload.orderId:null;
 const staff=payload.type==='BRASA_STAFF_ORDER',receipt=staff&&payload.event==='receipt_resubmitted',delivery=payload.type==='BRASA_ORDER_ON_THE_WAY';
 const title=staff?(receipt?'BRASA · Nuevo comprobante':'BRASA · Nuevo pedido'):delivery?'BRASA · Tu pedido va en camino':'BRASA · Tu pedido está listo';
 const body=staff?(id?`Pedido #${id.slice(0,6).toUpperCase()}. Abre el panel del local para revisarlo.`:'Abre el panel del local para revisar los pendientes.'):(delivery?(id?`Pedido #${id.slice(0,6).toUpperCase()}. El local lo despachó a domicilio.`:'Tu pedido salió a reparto. Abre BRASA para ver el detalle.'):(id?`Pedido #${id.slice(0,6).toUpperCase()}. Puedes pasar a retirarlo.`:'Tu pedido está listo para retirar. Abre BRASA para ver el detalle.'));
 event.waitUntil(Promise.all([
  self.registration.showNotification(title,{body,icon:'/icons/brasa-192.png',badge:'/icons/brasa-192.png',tag:id?`brasa-${staff?'staff':'ready'}-${id}`:`brasa-${staff?'staff':'ready'}`,renotify:staff,data:{orderId:id,audience:staff?'staff':'customer'},vibrate:[200,100,200]}),
  self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>windows.filter(client=>{const path=new URL(client.url).pathname;return staff?/^\/local\/?$/.test(path):path==='/';}).forEach(client=>client.postMessage({type:staff?'BRASA_STAFF_PUSH':'BRASA_READY_PUSH',orderId:id})))
 ]));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const raw=event.notification.data?.orderId;
 const id=/^[0-9a-f-]{36}$/i.test(raw||'')?raw:null,staff=event.notification.data?.audience==='staff';
 const target=new URL(staff?'/local/':'/',self.location.origin);if(id)target.searchParams.set('order',id);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const client=windows.find(item=>{const url=new URL(item.url);return url.origin===self.location.origin&&(staff?/^\/local\/?$/.test(url.pathname):url.pathname==='/');});
  if(client){await client.focus();client.postMessage({type:staff?'BRASA_STAFF_OPEN_ORDER':'BRASA_OPEN_ORDER',orderId:id});return;}
  return self.clients.openWindow(target.href);
 }));
});
