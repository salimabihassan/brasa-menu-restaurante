import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readyEventKey,unseenReadyOrders} from '../lib/ready-events.ts';
const order={id:'a',status:'preparing',createdAt:'2026-11-14T10:00:00Z',history:[]};
test('only ready orders notify; polling or reloading does not duplicate an acknowledged event',()=>{
 assert.equal(readyEventKey(order),null);
 const ready={...order,status:'ready',history:[{at:'2026-11-14T10:15:00Z',text:'Listo para retirar'}]};
 assert.equal(unseenReadyOrders([ready],new Set()).length,1);
 const seen=new Set([readyEventKey(ready)]);
 assert.equal(unseenReadyOrders([{...ready}],seen).length,0);
 assert.equal(unseenReadyOrders([{...ready,status:'delivered'}],new Set()).length,0);
 assert.equal(unseenReadyOrders([{...ready,id:'b'}],seen).length,1);
 assert.equal(unseenReadyOrders([{...ready,history:[...ready.history,{at:'2026-11-14T10:20:00Z',text:'Listo para retirar'}]}],seen).length,1);
});
