// Small local energy gate. Speech recognition runs in the cloud, not locally.
export class VoiceGate{
 constructor({onStart=()=>{},onTurn=()=>{},onDiscard=()=>{},rate=16000,threshold=.008,silenceMs=650,maxMs=40000}={}){Object.assign(this,{onStart,onTurn,onDiscard,rate,threshold,silenceMs,maxMs});this.reset();this.noise=.001}
 reset(){this.active=false;this.frames=[];this.pre=[];this.onset=0;this.voiced=0;this.quiet=0;this.duration=0}
 feed(samples,{playback=false,speech=true}={}){let energy=0;for(const s of samples)energy+=s*s;const level=Math.sqrt(energy/Math.max(1,samples.length));const ms=samples.length/this.rate*1000;const threshold=Math.max(this.threshold,Math.min(this.threshold*1.6,this.noise*3))*(playback?2:1);const voiced=speech&&level>=threshold;
  if(!this.active){this.pre.push(samples.slice());if(this.pre.length>22)this.pre.shift();if(!voiced&&!speech)this.noise=this.noise*.98+Math.min(level,.03)*.02;this.onset=voiced?this.onset+ms:0;if(this.onset>=(playback?320:180)){this.active=true;this.frames=this.pre.slice();this.duration=this.frames.reduce((n,f)=>n+f.length,0)/this.rate*1000;this.voiced=this.onset;this.onStart()}}
  else{this.frames.push(samples.slice());this.duration+=ms;if(voiced){this.voiced+=ms;this.quiet=0}else this.quiet+=ms;if(this.quiet>=this.silenceMs||this.duration>=this.maxMs)this.flush()}
  return level;
 }
 flush(){if(!this.active)return;const frames=this.frames,voiced=this.voiced;this.reset();if(voiced>=240){const count=frames.reduce((n,f)=>n+f.length,0),data=new Float32Array(count);let offset=0;for(const frame of frames){data.set(frame,offset);offset+=frame.length}this.onTurn(data)}else this.onDiscard()}
}
export function wavBlob(samples,rate=16000){const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i))};text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),true);return new Blob([bytes],{type:'audio/wav'})}
