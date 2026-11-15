import {cleanTranscript} from './transcript.mjs';
export const listeningLanguages={en:'English',hi:'Hindi',mr:'Marathi',de:'German'};
// Inspect spoken words only. Expressive/event tags remain in the transcript.
export function usableTranscript(result){
 const text=cleanTranscript(result?.text),words=text.replace(/\[[^\]]{0,160}\]/g,'').trim();
 if(!words||!/[\p{L}\p{N}]/u.test(words))return {text:'',usable:true};
 const foreign=[...words.matchAll(/\p{L}/gu)].some(m=>!/[\p{Script=Latin}\p{Script=Devanagari}]/u.test(m[0]));
 return {text,usable:!foreign};
}
export async function transcribeVoice(audio,language,{key,signal,fetcher=fetch}={}){
 language=Object.hasOwn(listeningLanguages,language)?language:'en';
 for(const model of ['transcribe-1-pro','transcribe-1']){
  signal?.throwIfAborted();const form=new FormData();form.append('audio',audio,'speech.wav');form.append('ignore_timestamps','true');form.append('language',language);
  if(model==='transcribe-1-pro'){form.append('diarize','false');form.append('tag_audio_events','true')}
  const response=await fetcher('https://api.fish.audio/v1/asr',{method:'POST',headers:{Authorization:'Bearer '+key,model},body:form,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});
  if(!response.ok)throw Object.assign(new Error(response.status===402?'Fish Audio has no transcription credit available. Check your API balance.':'Cloud transcription is unavailable ('+response.status+'). Please try again.'),{status:502});
  const result=await response.json(),checked=usableTranscript(result);
  if(checked.usable)return {text:checked.text,language:result.language_code||language};
 }
 throw Object.assign(new Error('The recording was recognised in an unrelated language. I did not send it or run any commands. Please repeat clearly, or check Listening language and Microphone input in Settings.'),{status:422});
}
