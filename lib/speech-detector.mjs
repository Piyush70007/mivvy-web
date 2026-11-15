import buildVAD,{VADMode,VADEvent} from '@ozymandiasthegreat/vad/lib/vad.js';
// Tiny WebRTC VAD WASM, served by Mivvy. No audio leaves the device here.
let constructor;
export async function createSpeechDetector(){
 constructor??=fetch('/audio/libfvad.wasm').then(r=>{if(!r.ok)throw new Error('Speech filter could not load. Reconnect the microphone.');return r.arrayBuffer()}).then(buildVAD).catch(e=>{constructor=null;throw e});
 const VAD=await constructor,detector=new VAD(VADMode.VERY_AGGRESSIVE,16000);
 return {isSpeech:samples=>{const result=detector.processFrame(VAD.floatTo16BitPCM(samples));if(result===VADEvent.ERROR)throw new Error('Speech filter rejected the microphone format.');return result===VADEvent.VOICE},destroy:()=>detector.destroy()};
}
