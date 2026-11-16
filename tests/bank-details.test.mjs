import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bankClipboardText,bankFields} from '../lib/bank-details.ts';
test('copy all preserves account digits and optional bank email in readable lines',()=>{
 const details={bank:'Banco de prueba',account_type:'Cuenta vista',account_number:'0012345678',holder:'Titular prueba',rut:'99999999-9',email:'transferencias@example.invalid',enabled:true};
 assert.equal(bankClipboardText(details),'Titular: Titular prueba\nRUT: 99999999-9\nBanco: Banco de prueba\nTipo de cuenta: Cuenta vista\nNúmero de cuenta: 0012345678\nCorreo: transferencias@example.invalid');
 assert.equal(bankFields({...details,email:''}).length,5);
});
