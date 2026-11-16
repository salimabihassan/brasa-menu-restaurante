export type BankDetails={bank:string;account_type:string;account_number:string;holder:string;rut:string;email:string;enabled:boolean};
export const emptyBankDetails:BankDetails={bank:'',account_type:'Cuenta corriente',account_number:'',holder:'',rut:'',email:'',enabled:false};
export function bankFields(details:BankDetails):[string,string][]{
 return [['Titular',details.holder],['RUT',details.rut],['Banco',details.bank],['Tipo de cuenta',details.account_type],['Número de cuenta',details.account_number],...(details.email?[['Correo',details.email] as [string,string]]:[])];
}
export function bankClipboardText(details:BankDetails){return bankFields(details).map(([label,value])=>`${label}: ${value}`).join('\n');}
