import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatRut,isValidRut,validateBankDetails} from '../lib/bank-validation.ts';
const details={bank:'Banco de prueba',account_type:'Cuenta vista',account_number:'001234',holder:'Titular prueba',rut:'12.345.678-5',email:'test@example.invalid',enabled:true};
test('RUT formatting handles typing, pasted punctuation and lowercase K without changing the check digit',()=>{
 assert.equal(formatRut('123456785'),'12345678-5');assert.equal(formatRut('12.345.678-5'),'12345678-5');assert.equal(formatRut('6k'),'6-K');
 assert.equal(formatRut('123456786'),'12345678-6');assert.equal(formatRut('ABC'),'ABC');
});
test('RUT modulo 11 covers numeric, K and zero check digits and rejects bad input',()=>{
 for(const rut of ['12345678-5','6-K','14-0','11111111-1'])assert.equal(isValidRut(rut),true,rut);
 for(const rut of ['12345678-6','0-0','00000000-0','123K-5','123456789-2','ABC',''])assert.equal(isValidRut(rut),false,rut);
});
test('bank errors identify each invalid field; disabled drafts remain possible',()=>{
 assert.deepEqual(validateBankDetails(details),{});
 const errors=validateBankDetails({...details,bank:'',account_type:'Otra',account_number:'ABC',holder:'',rut:'12345678-6',email:'incorrecto'});
 assert.deepEqual(Object.keys(errors).sort(),['account_number','account_type','bank','email','holder','rut']);
 assert.deepEqual(validateBankDetails({...details,enabled:false,rut:'',bank:'',holder:'',account_number:''}),{});
});
