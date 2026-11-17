import {randomUUID} from 'node:crypto';
import {canAccessLaptop} from './security.mjs';
import {laptopCommand} from './mobile.mjs';
import * as database from './db.mjs';

const names='(?:chat\\s*gpt|gpt|chrome|brave|edge|notepad|calculator|discord|spotify|whatsapp|slack|vs\\s*code|visual studio code|paint|file explorer|gmail|youtube|tradingview|क्रोम|ब्रेव|नोटपैड|डिस्कॉर्ड|यूट्यूब)';
export function displayNumber(text){
 const value=String(text).toLowerCase().replace(/[.!?।]+$/,'').trim();
 if(/\b(?:don't|dont|do not|never|mat|nahi|nahin)\b|मत|नहीं|["“”]/i.test(value))return null;
 const number=value.match(/\b(?:screen|display|monitor)\s*(?:number\s*)?(1|2|3|4|5|6|7|8|one|two)\b|स्क्रीन\s*(एक|दो|[1-8])/i);
 if(!number||!/^(?:(?:hey\s+)?(?:andrea|jarvis|ultron)[,\s]+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:switch|change|show|share|view|display|move|screen|monitor|स्क्रीन|display|mera|meri)/i.test(value))return null;
 if(/\b(?:and|then|send|delete|buy|type)\b|भेज|हटा/i.test(value))return null;
 const token=number[1]||number[2];return ({one:1,two:2,'एक':1,'दो':2})[token]||Number(token);
}
export function explicitLaptopCommand(text){
 let value=String(text).toLowerCase().replace(/’/g,"'").trim();
 if(/["“”\n]/.test(value)||/\b(?:don't|dont|do not|never|mat|nahi|nahin)\b|मत|नहीं/.test(value))return false;
 value=value.replace(/^(?:(?:hey|hi)\s+)?(?:andrea|jarvis|ultron)[,\s]+/,'').replace(/^(?:(?:can|could|would) you |please |kindly )+/,'');
 if(/^(?:why|how|what|explain|say|translate|imagine|tell me)\b/.test(value)||/\b(?:remind|reminder|budget|expense|habit|daily task)\b/.test(value))return false;
 if(displayNumber(value)!==null)return true;
 if(new RegExp('^(?:open|launch|start|close|quit|exit)\\s+(?:(?:the|my)\\s+)?'+names+'(?=$|[\\s,.!?])','i').test(value))return true;
 if(new RegExp('^'+names+'.{0,20}(?:kholo|khol do|band karo|खोलो|खोल दो|बंद करो)[.!?। ]*$','i').test(value))return true;
 if(/^(?:play|put on)\s+.+\b(?:song|songs|music|video|on (?:google )?chrome|on youtube)\b|^(?:pause|resume|rewind|skip|stop)\s+(?:the\s+)?(?:song|music|video)|^(?:lower|reduce|raise|increase|set|mute|unmute|turn)\s+(?:the\s+)?(?:volume|sound|audio)\b/.test(value))return true;
 return /^(?:open|close|play|search|find|read|inspect|check|click|type|switch|build|fix|edit)\b/.test(value)&&/\b(?:my laptop|my computer|my desktop|on (?:the |my )?(?:laptop|computer|pc))\b/.test(value);
}
export async function switchSharedDisplay(user,text,{db=database,signal}={}){
 const monitor=displayNumber(text);if(monitor===null)return null;
 if(!canAccessLaptop(user))throw Object.assign(new Error('Owner access required.'),{status:403});
 const stream=await db.getStream(user.id);
 if(!stream||!['pending','ready'].includes(stream.data.status))throw new Error('Open live screen sharing first, then choose screen '+monitor+'.');
 const device=(await db.documents(user.id)).find(d=>d.kind==='device');
 const count=Number(device?.data.displays||8);
 if(monitor>count)throw new Error('Your laptop reports '+count+' display'+(count===1?'':'s')+'. Choose an available display.');
 signal?.throwIfAborted();const row=await db.updateStream(user.id,stream.id,{kind:'screen',monitor},true);
 if(!row)throw new Error('The live screen session ended. Reopen it before switching displays.');
 return {reply:'Selected screen '+monitor+' for your live feed. The next frames will use that display.',emotion:'focused',identity:'andrea',monitor};
}
export async function ownerLaptopChat(user,{text,identity,conversation,signal},{db=database,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,timeout=42000}={}){
 if(!canAccessLaptop(user)||!explicitLaptopCommand(text))return null;
 signal?.throwIfAborted();
 const switched=await switchSharedDisplay(user,text,{db,signal});if(switched)return {...switched,identity};
 const device=(await db.documents(user.id)).find(d=>d.kind==='device');
 const payload=laptopCommand(user,{request:text,identity,conversation},device);
 if(!await db.limit('remote-command:'+user.id,6,60))throw new Error('Please wait before another laptop command.');
 signal?.throwIfAborted();const job=await db.newJob(user.id,'command',payload,randomUUID());
 let completed=false;
 try{
  const deadline=now()+timeout;
  while(now()<deadline){
   signal?.throwIfAborted();const current=await db.getJob(user.id,job.id);
   if(!current)throw new Error('The laptop request expired; it was not repeated.');
   if(current.status==='cancelled')throw new Error('The laptop request was stopped.');
   if(current.status==='done'){
    completed=true;
    if(current.result?.error)throw new Error(current.result.error);
    if(!current.result?.reply)throw new Error('The laptop returned no verified response.');
    return {reply:current.result.reply,emotion:'focused',identity,remoteJob:job.id,
     messages:[{id:'remote-user-'+job.id,role:'user',content:text,conversation,identity},{id:current.result.message_id||'remote-assistant-'+job.id,role:'assistant',content:current.result.reply,conversation,identity}]};
   }
   await sleep(600);
  }
  throw new Error('The laptop request took too long and was stopped. Its outcome is uncertain; it was not repeated.');
 }finally{if(!completed)await db.cancelJob(user.id,job.id)}
}
