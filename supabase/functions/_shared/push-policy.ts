export function allowedPushEndpoint(value:string):boolean {
 try{const url=new URL(value);return value.length<=4096&&url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(
  ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));}catch{return false;}
}
export function readyPushPayload(orderId:string,delivery=false){return {type:delivery?'BRASA_ORDER_ON_THE_WAY':'BRASA_ORDER_READY',orderId};}
export function staffPushPayload(orderId:string,event:string){return {type:'BRASA_STAFF_ORDER',orderId,event:event==='receipt_resubmitted'?'receipt_resubmitted':'new_order'};}
export function pushErrorStatus(status:number){return status===404||status===410?'expired':status>=200&&status<300?'sent':'failed';}
