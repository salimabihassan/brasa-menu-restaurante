import {test} from 'node:test';
import assert from 'node:assert/strict';
import {visibleToKitchen,canPrepare,needsReview} from '../lib/rules.ts';
test('unpaid checkout without receipt stays out of kitchen',()=>{
 assert.equal(visibleToKitchen({payment:'review'}),false);
 assert.equal(visibleToKitchen({payment:'review',receipt:'data:image/png;base64,test'}),true);
 assert.equal(visibleToKitchen({payment:'paid'}),true);
});
test('receipt upload never authorizes preparation',()=>{
 assert.equal(canPrepare({payment:'review',status:'pending'}),false);
 assert.equal(canPrepare({payment:'rejected',status:'pending'}),false);
 assert.equal(canPrepare({payment:'paid',status:'pending'}),true);
 assert.equal(canPrepare({payment:'paid',status:'cancelled'}),false);
});
test('transfer review has no time expiry and ends on review or cancellation',()=>{
 assert.equal(needsReview({payment:'review',status:'pending',createdAt:'2020-01-01'}),true);
 assert.equal(needsReview({payment:'review',status:'cancelled'}),false);
 assert.equal(needsReview({payment:'paid',status:'pending'}),false);
 assert.equal(needsReview({payment:'rejected',status:'pending'}),false);
});
