import {test} from 'node:test';
import assert from 'node:assert/strict';
import {customizedItems} from '../lib/customized-items.ts';
import {products,extras,itemTotal} from '../lib/catalog.ts';
const burger=products[0];
test('quantity two can have one original and one without sauces',()=>{
 const lines=customizedItems(burger,[{extras:[],note:''},{extras:[],note:'Solo pan, carne y papas hilo. Sin salsas.'}],extras);
 assert.equal(lines.length,2);assert.equal(lines[0].quantity,1);assert.equal(lines[0].note,'');assert.match(lines[1].note,/Sin salsas/);assert.equal(lines[1].quantity,1);
 assert.equal(lines.reduce((sum,line)=>sum+itemTotal(line),0),burger.price*2);
});
test('identical units group while different extras retain individual prices',()=>{
 const lines=customizedItems(burger,[{extras:['cheese'],note:''},{extras:[],note:''},{extras:['cheese'],note:''}],extras);
 assert.equal(lines.length,2);assert.equal(lines[0].quantity,2);assert.equal(itemTotal(lines[0]),(burger.price+700)*2);assert.equal(lines[1].quantity,1);
});
