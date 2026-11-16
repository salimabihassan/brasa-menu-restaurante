import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMenuPrice} from '../lib/menu-price.ts';
test('menu accepts Chilean peso notation and rejects ambiguous or fractional amounts',()=>{
 for(const [input,result] of [['6.990',6990],['6990',6990],['6.990,00',6990],['0',0],['1.000.000',1000000]])assert.equal(parseMenuPrice(input),result);
 for(const input of ['6,990','6.99','-100','1.000.001','hola','6.990,50',''])assert.throws(()=>parseMenuPrice(input));
});
