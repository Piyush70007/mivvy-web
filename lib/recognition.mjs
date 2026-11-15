const norm=text=>text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
export function isPlaybackEcho(text,reply){const value=norm(text),spoken=norm(reply);if(!value||!spoken)return false;if(/^(stop|stop talking|pause|wait|listen|andrea stop|jarvis stop|ultron stop)$/.test(value))return false;return value.length>=4&&spoken.includes(value)}
export class ContinuousRecognition{
 constructor({create,language,onState,onFinal,onPartial,onSpeech,onError,schedule=setTimeout,unschedule=clearTimeout}){Object.assign(this,{create,language,onState,onFinal,onPartial,onSpeech,onError,schedule,unschedule});this.wanted=false;this.rec=null;this.timer=null;this.failures=0;this.lastText='';this.lastTime=0;}
 start(){if(this.wanted)return;this.wanted=true;this.launch()}
 launch(){if(!this.wanted)return;const rec=this.create();this.rec=rec;rec.lang=this.language;rec.continuous=true;rec.interimResults=true;let processed=0;
  rec.onstart=()=>{if(this.rec===rec&&this.wanted)this.onState(true)};
  rec.onspeechstart=()=>{if(this.rec===rec&&this.wanted)this.onSpeech()};
  rec.onresult=e=>{if(this.rec!==rec||!this.wanted)return;this.failures=0;const final=[];let partial='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)final.push(e.results[i][0].transcript);else partial+=e.results[i][0].transcript}if(partial)this.onPartial(partial);const text=final.join(' ').trim();if(text){const normalized=norm(text),now=Date.now();if(normalized!==this.lastText||now-this.lastTime>1800){this.lastText=normalized;this.lastTime=now;this.onFinal(text)}}};
  rec.onerror=e=>{if(this.rec!==rec||!this.wanted)return;if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){this.stop();this.onError(e.error==='audio-capture'?'The microphone is unavailable. Check your selected input device.':'Microphone permission is needed to listen.');return}if(!['no-speech','aborted'].includes(e.error))this.failures++;if(this.failures>=4){this.stop();this.onError('The browser’s speech service disconnected. Tap the microphone to reconnect.')}};
  rec.onend=()=>{if(this.rec!==rec)return;this.rec=null;this.onState(false);this.restart()};
  try{rec.start()}catch{this.rec=null;this.failures++;if(this.failures>=4){this.stop();this.onError('Could not restart listening. Tap the microphone to reconnect.')}else this.restart()}
 }
 restart(){if(!this.wanted)return;this.unschedule(this.timer);this.timer=this.schedule(()=>this.launch(),Math.min(2000,250*(this.failures+1)))}
 setLanguage(language){if(language===this.language)return;const wanted=this.wanted;this.stop();this.language=language;if(wanted)this.start()}
 stop(){this.wanted=false;this.unschedule(this.timer);this.timer=null;const rec=this.rec;this.rec=null;if(rec){rec.onend=rec.onresult=rec.onerror=rec.onspeechstart=rec.onstart=null;try{rec.abort()}catch{}}this.onState(false)}
}
