import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OrderAlarm,ALARM_INTERVAL_MS,soundPreference} from '../lib/order-alarm.ts';
import {needsAttention} from '../lib/rules.ts';
test('alarm stays active after approving transfer and stops after accepting or rejecting',()=>{
 assert.equal(needsAttention({status:'pending',payment:'review'}),true);
 assert.equal(needsAttention({status:'pending',payment:'paid'}),true);
 for(const status of ['preparing','ready','delivered','cancelled'])assert.equal(needsAttention({status,payment:'paid'}),false);
 assert.equal(needsAttention({status:'pending',payment:'rejected'}),false);
 assert.equal(soundPreference(null),true);assert.equal(soundPreference('true'),true);assert.equal(soundPreference('false'),false);
});
test('audio repeats without duplicate timers and cancels queued tones immediately',async(t)=>{
 t.mock.timers.enable({apis:['setInterval']});
 let created=0,stopped=0,closed=0;
 const parameter={setValueAtTime(){},linearRampToValueAtTime(){}};
 const context={state:'running',currentTime:0,destination:{},resume:async()=>{},close:async()=>{closed++;},
  createOscillator(){created++;return {frequency:parameter,connect(){},disconnect(){},start(){},stop(){stopped++;},onended:null};},
  createGain(){return {gain:parameter,connect(){},disconnect(){}};}};
 const alarm=new OrderAlarm(()=>{},()=>context);
 alarm.setActive(true);assert.equal(created,0);
 await alarm.unlock();assert.equal(created,6);
 await alarm.unlock();assert.equal(created,6);
 t.mock.timers.tick(ALARM_INTERVAL_MS);assert.equal(created,12);
 alarm.setActive(false);assert.equal(stopped,24);
 t.mock.timers.tick(ALARM_INTERVAL_MS*3);assert.equal(created,12);
 alarm.setActive(true);assert.equal(created,18);
 alarm.dispose();t.mock.timers.tick(ALARM_INTERVAL_MS*2);assert.equal(created,18);assert.equal(closed,1);
});
