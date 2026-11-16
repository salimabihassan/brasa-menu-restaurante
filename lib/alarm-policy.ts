import type {Order} from './catalog';
export const ATTENTION_GRACE_MS=60_000;
type Task=Pick<Order,'id'|'status'|'payment'|'receipt'|'version'|'history'>;
export type AlarmPause={stage:string;until:number};
export function alarmStage(order:Task):string {
 if(order.status!=='pending'||!['paid','review'].includes(order.payment))return '';
 return `${order.payment}:${order.receipt||''}:${order.version??order.history.length}`;
}
export function pauseAttention(order:Task,now:number):AlarmPause {
 return {stage:alarmStage(order),until:now+ATTENTION_GRACE_MS};
}
export function alarmDue(order:Task,pause:AlarmPause|undefined,now:number):boolean {
 const stage=alarmStage(order);
 return !!stage&&(!pause||pause.stage!==stage||pause.until<=now);
}
