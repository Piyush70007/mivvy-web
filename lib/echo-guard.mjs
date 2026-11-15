// Browser WebRTC AEC cancels echo; reject strongly correlated residual
// playback before barge-in as well. No microphone recording is retained.
export class EchoGuard{
 constructor(){this.history=new Float32Array(16000);this.position=0;this.count=0}
 feed(microphone,reference){
  if(!reference)return false;
  for(const sample of reference){this.history[this.position]=sample;this.position=(this.position+1)%this.history.length;this.count=Math.min(this.count+1,this.history.length)}
  let input=0;for(let i=0;i<microphone.length;i+=4)input+=microphone[i]**2;if(input<1e-7)return false;
  for(let delay=0;delay<=4800;delay+=160){if(this.count<microphone.length+delay)break;let energy=0,dot=0;
   for(let i=0;i<microphone.length;i+=4){const index=(this.position-microphone.length-delay+i+this.history.length)%this.history.length,r=this.history[index];energy+=r*r;dot+=microphone[i]*r}
   if(energy>1e-6&&dot/Math.sqrt(input*energy)>.72)return true;
  }
  return false;
 }
}
