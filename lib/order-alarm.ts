export const ALARM_INTERVAL_MS=2400;
export const soundPreference=(stored:string|null)=>stored!=='false';
export class OrderAlarm {
 private context:AudioContext|null=null;
 private timer:ReturnType<typeof setInterval>|null=null;
 private sources=new Set<OscillatorNode>();
 private active=false;
 private disposed=false;
 private changed:(ready:boolean)=>void;
 private createContext:()=>AudioContext;
 constructor(changed:(ready:boolean)=>void=()=>{},createContext:()=>AudioContext=()=>new AudioContext()){
  this.changed=changed;this.createContext=createContext;
 }
 async unlock(){
  if(this.disposed)return;
  try{
   if(!this.context){this.context=this.createContext();this.context.onstatechange=()=>{this.changed(this.context?.state==='running');if(this.context?.state==='running'&&this.active)this.start();};}
   if(this.context.state!=='running')await this.context.resume();
   if(this.disposed)return;
   this.changed(this.context.state==='running');if(this.active)this.start();
  }catch{this.changed(false);}
 }
 setActive(active:boolean){this.active=active;if(active)this.start();else this.stop();}
 private ring(){
  const context=this.context;if(!this.active||!context||context.state!=='running')return;
  // Three alternating chimes, repeated until every pending task is handled.
  for(let pulse=0;pulse<3;pulse++)for(let note=0;note<2;note++){
   const oscillator=context.createOscillator(),gain=context.createGain();
   const time=context.currentTime+pulse*.55+note*.21;
   oscillator.type='triangle';oscillator.frequency.setValueAtTime(note?1040:780,time);
   gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.48,time+.018);gain.gain.setValueAtTime(.48,time+.12);gain.gain.linearRampToValueAtTime(0,time+.2);
   oscillator.connect(gain);gain.connect(context.destination);
   this.sources.add(oscillator);oscillator.onended=()=>{this.sources.delete(oscillator);oscillator.disconnect();gain.disconnect();};
   oscillator.start(time);oscillator.stop(time+.21);
  }
 }
 private start(){if(this.timer||!this.context||this.context.state!=='running'||!this.active)return;this.ring();this.timer=setInterval(()=>this.ring(),ALARM_INTERVAL_MS);}
 private stop(){if(this.timer!==null){clearInterval(this.timer);this.timer=null;}for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();}
 dispose(){this.disposed=true;this.active=false;this.stop();const context=this.context;this.context=null;if(context){context.onstatechange=null;void context.close().catch(()=>{});}}
}
