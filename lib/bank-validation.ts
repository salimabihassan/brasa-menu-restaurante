import type {BankDetails} from './bank-details';
export type BankField=keyof BankDetails;
export type BankErrors=Partial<Record<BankField,string>>;
export const accountTypes=['Cuenta corriente','Cuenta vista','Cuenta de ahorro','Cuenta RUT'];
export function formatRut(value:string){
 const compact=value.toUpperCase().replace(/[.\s-]/g,'');
 if(!/^[0-9K]*$/.test(compact))return value.toUpperCase();
 return compact.length>1?`${compact.slice(0,-1)}-${compact.slice(-1)}`:compact;
}
export function isValidRut(value:string){
 const rut=formatRut(value);
 if(!/^[0-9]{1,8}-[0-9K]$/.test(rut))return false;
 const [body,digit]=rut.split('-');if(Number(body)===0)return false;
 let sum=0,factor=2;
 for(let index=body.length-1;index>=0;index--){sum+=Number(body[index])*factor;factor=factor===7?2:factor+1;}
 const result=11-sum%11,expected=result===11?'0':result===10?'K':String(result);
 return digit===expected;
}
export function validateBankDetails(details:BankDetails):BankErrors {
 const errors:BankErrors={};
 if(details.bank.trim().length>80)errors.bank='El nombre del banco admite hasta 80 caracteres.';
 else if(details.enabled&&details.bank.trim().length<2)errors.bank='Escribe el nombre del banco.';
 if(details.account_type.length>40||details.enabled&&!accountTypes.includes(details.account_type))errors.account_type='Selecciona un tipo de cuenta válido.';
 if(details.account_number.length>30||details.enabled&&!/^[0-9]{1,30}$/.test(details.account_number.trim()))errors.account_number='Escribe el número de cuenta usando solo dígitos, sin puntos ni espacios.';
 if(details.holder.trim().length>120)errors.holder='El nombre del titular admite hasta 120 caracteres.';
 else if(details.enabled&&details.holder.trim().length<2)errors.holder='Escribe el nombre del titular.';
 const rut=formatRut(details.rut);
 if(rut.length>20||details.enabled&&!/^[0-9]{1,8}-[0-9K]$/.test(rut))errors.rut='Escribe el RUT completo, incluido su dígito verificador.';
 else if(details.enabled&&!isValidRut(rut))errors.rut='El dígito verificador del RUT no corresponde. Revisa el RUT del titular.';
 if(details.email.length>254||details.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim()))errors.email='Escribe un correo de confirmación válido o deja este campo vacío.';
 return errors;
}
