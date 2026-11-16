import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderDay} from '../lib/order-day.ts';
test('restaurant calendar uses Santiago midnight in summer and winter',()=>{
 assert.equal(orderDay('2026-11-14T02:59:59Z'),'2026-11-13');
 assert.equal(orderDay('2026-11-14T03:00:00Z'),'2026-11-14');
 assert.equal(orderDay('2026-07-14T03:59:59Z'),'2026-07-13');
 assert.equal(orderDay('2026-07-14T04:00:00Z'),'2026-07-14');
 assert.equal(orderDay('invalid'),'');
});
