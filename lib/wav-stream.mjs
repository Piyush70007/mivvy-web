export class WavStream{
 constructor(){this.pending=new Uint8Array();this.riff=false;this.format=false;this.data=false;this.rate=24000}
 feed(chunk){const merged=new Uint8Array(this.pending.length+chunk.length);merged.set(this.pending);merged.set(chunk,this.pending.length);this.pending=merged;
  const name=(at,n=4)=>String.fromCharCode(...this.pending.slice(at,at+n));
  if(!this.riff){if(this.pending.length<12)return new Float32Array();if(name(0)!=='RIFF'||name(8)!=='WAVE')throw new Error('The voice service returned an invalid WAV stream.');this.pending=this.pending.slice(12);this.riff=true}
  while(!this.data){if(this.pending.length<8)return new Float32Array();const view=new DataView(this.pending.buffer,this.pending.byteOffset,this.pending.byteLength),kind=name(0),length=view.getUint32(4,true);if(kind==='data'){if(!this.format)throw new Error('Voice stream format is missing.');this.pending=this.pending.slice(8);this.data=true;break}if(length>65536)throw new Error('Unsupported voice stream header.');if(this.pending.length<8+length+(length%2))return new Float32Array();if(kind==='fmt '){if(length<16||view.getUint16(8,true)!==1||view.getUint16(10,true)!==1||view.getUint16(22,true)!==16)throw new Error('Unsupported voice audio format.');this.rate=view.getUint32(12,true);if(this.rate<8000||this.rate>48000)throw new Error('Invalid voice sample rate.');this.format=true}this.pending=this.pending.slice(8+length+(length%2))}
  const count=Math.floor(this.pending.length/2),output=new Float32Array(count),view=new DataView(this.pending.buffer,this.pending.byteOffset,this.pending.byteLength);for(let i=0;i<count;i++)output[i]=view.getInt16(i*2,true)/32768;this.pending=this.pending.slice(count*2);return output;
 }
}
