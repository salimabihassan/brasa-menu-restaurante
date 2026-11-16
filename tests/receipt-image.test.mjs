import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitImage,prepareReceipt} from '../lib/receipt-image.ts';
test('camera photos scale proportionally without enlargement',()=>{
 assert.deepEqual(fitImage(6000,4000),{width:2200,height:1467});
 assert.deepEqual(fitImage(3000,6000),{width:1100,height:2200});
 assert.deepEqual(fitImage(640,480),{width:640,height:480});
});
test('PDFs remain unchanged and oversized PDFs receive a specific message',async()=>{
 const pdf=new File(['pdf'],'receipt.pdf',{type:'application/pdf'});
 assert.equal((await prepareReceipt(pdf)).blob,pdf);
 await assert.rejects(prepareReceipt(new File([new Uint8Array(1048577)],'large.pdf',{type:'application/pdf'})),/PDF supera/);
 await assert.rejects(prepareReceipt(new File(['text'],'other.txt',{type:'text/plain'})),/Adjunta una foto/);
});
