export class CustomerChime {
 private context:AudioContext|null=null;
 private sources=new Set<OscillatorNode>();
 private pending=false;
 private disposed=false;
 async unlock(){
  if(this.disposed)return;
  try{this.context??=new AudioContext();if(this.context.state!=='running')await this.context.resume();if(this.pending&&!this.disposed&&this.context.state==='running'){this.pending=false;this.play();}}catch{}
 }
 play(){
  const c=this.context;if(!c||c.state!=='running'){this.pending=true;return;}
  for(const [i,frequency] of [523.25,659.25,783.99,1046.5].entries()){
   const source=c.createOscillator(),gain=c.createGain(),time=c.currentTime+i*.19;
   source.type='sine';source.frequency.setValueAtTime(frequency,time);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.22,time+.025);gain.gain.exponentialRampToValueAtTime(.001,time+.55);
   source.connect(gain);gain.connect(c.destination);this.sources.add(source);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};source.start(time);source.stop(time+.6);
  }
 }
 cancel(){this.pending=false;for(const source of this.sources)try{source.stop();}catch{}this.sources.clear();}
 dispose(){this.disposed=true;this.cancel();if(this.context){void this.context.close().catch(()=>{});this.context=null;}}
}
