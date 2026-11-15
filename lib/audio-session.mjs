// Safari can retain its receiver route after getUserMedia stops. Declare
// playback again before creating/resuming the output context. Headphones and
// Bluetooth remain under the operating system's route selection.
export function configureAudioSession(capturing,nav=globalThis.navigator){
 try{if(!nav?.audioSession)return false;const type=capturing?'play-and-record':'playback';if(nav.audioSession.type!==type)nav.audioSession.type=type;return true}catch{return false}
}
