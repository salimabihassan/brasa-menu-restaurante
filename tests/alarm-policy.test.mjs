import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pauseAttention,alarmDue} from '../lib/alarm-policy.ts';
const review={id:'first',status:'pending',payment:'review',receipt:'receipt-a',version:1,history:[]};
test('opening a transfer grants exactly one minute; a different order still rings',()=>{
 const pause=pauseAttention(review,1000);
 assert.equal(alarmDue(review,pause,1000),false);
 assert.equal(alarmDue(review,pause,60999),false);
 assert.equal(alarmDue(review,pause,61000),true);
 assert.equal(alarmDue({...review,id:'new'},undefined,2000),true);
 assert.equal(alarmDue({...review,receipt:'receipt-b',version:3},pause,2000),true);
});
test('approval grants a fresh minute for preparation; rejection and preparation stop alarm',()=>{
 const approved={...review,payment:'paid',version:2};
 const pause=pauseAttention(approved,20000);
 assert.equal(alarmDue(approved,pause,79999),false);
 assert.equal(alarmDue(approved,pause,80000),true);
 assert.equal(alarmDue({...approved,status:'preparing'},pause,80000),false);
 assert.equal(alarmDue({...review,payment:'rejected',version:2},undefined,80000),false);
 assert.equal(alarmDue({...review,status:'cancelled'},undefined,80000),false);
});
