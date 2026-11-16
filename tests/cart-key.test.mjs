import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cartKey} from '../lib/cart-key.ts';
test('same burger with different kitchen instructions stays on separate lines',()=>{
 assert.notEqual(cartKey('burger',[],'Sin salsas'),cartKey('burger',[],''));
 assert.notEqual(cartKey('burger',[],'Sin salsas'),cartKey('burger',[],'Solo pan y carne'));
 assert.equal(cartKey('burger',['bacon','cheese'],' Sin salsas '),cartKey('burger',['cheese','bacon'],'Sin salsas'));
});
