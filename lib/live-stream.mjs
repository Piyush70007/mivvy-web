import {canAccessLaptop} from './security.mjs';
export const leaseSeconds=35;
export function streamMode(input,displayCount=8){
 if(!['screen','camera'].includes(input.kind))throw new Error('Choose screen or camera.');
 const monitor=Number(input.monitor??1);
 if(!Number.isInteger(monitor)||monitor<1||monitor>8)throw new Error('Choose a valid display.');
 if(input.kind==='screen'&&monitor>displayCount)throw new Error('That display is unavailable. Your laptop reports '+displayCount+' display'+(displayCount===1?'':'s')+'.');
 return {kind:input.kind,monitor};
}
export function requireOwner(user){if(!canAccessLaptop(user))throw Object.assign(new Error('Owner access required.'),{status:403})}
export function streamOffer(input){
 if(!['screen','camera'].includes(input.kind))throw new Error('Choose screen or camera video.');
 const offer=input.offer;
 if(offer?.type!=='offer'||typeof offer.sdp!=='string'||offer.sdp.length>100000||!offer.sdp.startsWith('v=0')||!offer.sdp.includes('m=video'))throw new Error('A valid WebRTC video offer is required.');
 // The receiver must not publish phone audio/video back to the laptop.
 const media=offer.sdp.split(/(?=^m=)/m).filter(s=>s.startsWith('m='));
 if(media.some(s=>/^m=audio/m.test(s)||(/^m=video/m.test(s)&&!/^a=recvonly\r?$/m.test(s))))throw new Error('Use a receive-only video connection without phone audio.');
 const monitor=Number(input.monitor??1);if(!Number.isInteger(monitor)||monitor<1||monitor>8)throw new Error('Choose a valid laptop display.');
 return {kind:input.kind,monitor,revision:1,offer:{type:'offer',sdp:offer.sdp},status:'pending',answer:null};
}
export function iceConfiguration(){
 let iceServers=[{urls:['stun:stun.l.google.com:19302']}];
 if(process.env.MIVVY_ICE_SERVERS_JSON){
  const parsed=JSON.parse(process.env.MIVVY_ICE_SERVERS_JSON);
  if(!Array.isArray(parsed)||parsed.length>8)throw new Error('The stream relay configuration is invalid.');
  iceServers=parsed.map(server=>{
   const urls=Array.isArray(server.urls)?server.urls:[server.urls];
   if(!urls.length||urls.some(url=>typeof url!=='string'||!/^stuns?:|^turns?:/.test(url)))throw new Error('The stream relay URL is invalid.');
   return {urls,...(server.username?{username:String(server.username)}:{}),...(server.credential?{credential:String(server.credential)}:{})};
  });
 }
 return {iceServers,relayConfigured:iceServers.some(server=>server.urls.some(url=>/^turns?:/.test(url))),leaseSeconds};
}
export function streamAnswer(input){
 if(input.error)return {status:'failed',error:String(input.error).slice(0,250),offer:null,answer:null};
 if(input.answer?.type!=='answer'||typeof input.answer.sdp!=='string'||input.answer.sdp.length>100000||!input.answer.sdp.startsWith('v=0'))throw new Error('A valid stream answer is required.');
 return {status:'ready',answer:{type:'answer',sdp:input.answer.sdp}};
}
export function streamIntent(text){
 if(/\b(stop|close|end)\b.{0,25}\b(sharing|share|stream|camera|video)\b/i.test(text))return 'stop';
 if(/\b(screen|camera|webcam|display)\b/i.test(text)&&/\b(show|see|view|share|stream|watch|open)\b/i.test(text))return /camera|webcam/i.test(text)?'camera':'screen';
 return null;
}
