import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CustomerChime} from '../lib/customer-chime.ts';
test('customer chime waits for interaction, plays once and cancels pending audio',async(t)=>{
 let notes=0,closed=0;
 const parameter={setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
 const original=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');
 t.after(()=>{if(original)Object.defineProperty(globalThis,'AudioContext',original);else delete globalThis.AudioContext;});
 globalThis.AudioContext=class{
  state='running';currentTime=0;destination={};
  resume=async()=>{};close=async()=>{closed++;};
  createOscillator(){notes++;return {frequency:parameter,connect(){},disconnect(){},start(){},stop(){}};}
  createGain(){return {gain:parameter,connect(){},disconnect(){}};}
 };
 const chime=new CustomerChime();chime.play();assert.equal(notes,0);
 await chime.unlock();assert.equal(notes,4);await chime.unlock();assert.equal(notes,4);
 chime.cancel();chime.dispose();assert.equal(closed,1);
 const pending=new CustomerChime();pending.play();pending.cancel();await pending.unlock();assert.equal(notes,4);pending.dispose();
});
