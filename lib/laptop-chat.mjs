import {randomUUID} from 'node:crypto';
import {canAccessLaptop} from './security.mjs';
import {laptopCommand} from './mobile.mjs';
import * as database from './db.mjs';

const names='(?:chat\\s*gpt|gpt|chrome|brave|edge|notepad|calculator|discord|spotify|whatsapp|telegram|slack|zoom|microsoft teams|teams|word|excel|powerpoint|outlook|onenote|settings|task manager|camera|photos|clock|microsoft store|snipping tool|figma|obsidian|vs\\s*code|visual studio code|paint|file explorer|downloads|documents|gmail|github|linkedin|google drive|google docs|google calendar|google maps|google photos|overleaf|vercel|wikipedia|reddit|instagram|netflix|amazon|claude|gemini|hugging face|youtube|tradingview|क्रोम|ब्रेव|नोटपैड|डिस्कॉर्ड|यूट्यूब)';
export function displaySelection(text){
 const value=String(text).toLowerCase().replace(/’/g,"'").replace(/[.!?।]+$/,'').trim();
 const head=/^(?:(?:hey\s+)?(?:andrea|jarvis|ultron)[,\s]+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?(?:switch|change|show|share|view|display|move|screen|monitor|स्क्रीन|mera|meri|dusra|doosra|दूसर|agli|अगली)/i;
 if(!head.test(value)||/\b(?:don't|dont|do not|never|mat|nahi|nahin)\b|मत|नहीं|["“”]/i.test(value))return null;
 const refs=[...value.matchAll(/\b(?:screen|display|monitor)\s*(?:number\s*|to\s*)?(\d+|one|two)\b|स्क्रीन\s*(एक|दो|\d+)/gi)];
 if(!refs.length){
  if(/\b(?:send|delete|buy|type|and|then|or)\b|भेज|हटा/i.test(value))return null;
  if(/\b(?:other|next|another|second)\s+(?:screen|display|monitor)\b|\b(?:dusra|doosra|agli)\s+(?:screen|display|monitor)\b|(?:दूसरी|दूसरा|अगली)\s*स्क्रीन/i.test(value))return /\bsecond\b/.test(value)?{monitor:2}:{relative:1};
  if(/\b(?:previous|prior)\s+(?:screen|display|monitor)\b/i.test(value))return {relative:-1};
  if(/\bfirst\s+(?:screen|display|monitor)\b/i.test(value))return {monitor:1};
  return null;
 }
 const values=refs.map(match=>{const token=match[1]||match[2];return ({one:1,two:2,'एक':1,'दो':2})[token]||Number(token)});
 if(new Set(values).size>1)return {error:'Choose one display: screen 1 or screen 2.'};
 if(/\b(?:and|or)(?:\s+also)?\s+(?:[1-8]|one|two)\b|\s&\s*[1-8]\b/i.test(value))return {error:'Live view shows one screen at a time. Choose screen 1 or screen 2.'};
 if(!Number.isInteger(values[0])||values[0]<1||values[0]>8)return {error:'Choose a valid display number between 1 and 8.'};
 if(/\b(?:and|then|or|send|delete|buy|type)\b|भेज|हटा/i.test(value))return null;
 return {monitor:values[0]};
}
export function displayNumber(text){
 return displaySelection(text)?.monitor??null;
}
export function explicitLaptopCommand(text){
 let value=String(text).toLowerCase().replace(/’/g,"'").trim();
 if(/["“”\n]/.test(value)||/\b(?:don't|dont|do not|never|mat|nahi|nahin)\b|मत|नहीं/.test(value))return false;
 value=value.replace(/^(?:(?:hey|hi)\s+)?(?:andrea|jarvis|ultron)[,\s]+/,'').replace(/^(?:(?:can|could|would) you |please |kindly )+/,'');
 if(/\b(?:password|passcode|otp|api key|secret key)\b/.test(value))return false;
 if(/^(?:mute|unmute)\s+(?:the\s+)?(?:mic|microphone)\b|^(?:mic|microphone)\s+(?:on|off)$|^(?:stop listening|stop talking|stop speaking)$/.test(value))return false;
 const level=value.match(/^(?:(?:set|change)\s+)?(?:the\s+)?volume\s+(?:to\s+)?(-?\d+)(?:\s*(?:percent|%))?[.!? ]*$/);
 if(level&&(Number(level[1])<0||Number(level[1])>100))return false;
 if(/\b(?:time|date|battery|cpu|ram|disk space|laptop memory)\b/.test(value)&&/\b(?:my laptop|the laptop|my computer)\b/.test(value)&&!/^(?:say|translate|explain|imagine)\b/.test(value))return true;
 if(/^what are the latest\b/.test(value))return true;
 if(/^(?:why|how|what|explain|say|translate|imagine|tell me)\b/.test(value)||/\b(?:remind|reminder|timer|budget|expense|habit|daily task)\b/.test(value))return false;
 if(displaySelection(value))return true;
 if(new RegExp('^(?:open|launch|start|close|quit|exit|go to|visit)\\s+(?:(?:the|my)\\s+)?'+names+'(?=$|[\\s,.!?])','i').test(value))return true;
 if(new RegExp('^'+names+'.{0,20}(?:kholo|khol do|band karo|खोलो|खोल दो|बंद करो)[.!?। ]*$','i').test(value))return true;
 if(new RegExp('^'+names+'\\s+(?:kholo|khol do|खोलो|खोल दो)\\s+(?:aur|and|और)\\s+','i').test(value))return true;
 if(/^(?:play|put on|i (?:want|would like) to (?:listen to|hear)|youtube (?:pe|par)|koi (?:bhi )?(?:gana|gaana))\s+/.test(value)&&!/^play\s+(?:a game|games?|chess|football|guitar|piano|the role|along|with me)\b/.test(value))return true;
 if(/^(?:pause|resume|unpause|skip|next track|next song|previous song|rewind|fast forward|go back)\b|(?:^|\s)(?:rok do|रोक दो|chalao|laga do|लगाओ|चलाओ)[.!?। ]*$/.test(value))return true;
 if(/^(?:volume|my volume|thodi awaaz|thoda volume|awaaz|awaz|आवाज़|आवाज)\b|^(?:make it (?:quieter|louder)|turn it (?:up|down)|unmute|mute)\b/.test(value)||/^(?:आवाज़|आवाज)/.test(value))return true;
 if(/^(?:google|look up|search (?:the web|google|youtube)|search .+ and play)\b/.test(value))return true;
 if(/^(?:team(?:\b|[, ]))|^stop the team\b/.test(value))return true;
 if(/^(?:review|fix|edit|build)\b.*\b(?:project|code|backend|frontend|app)\b|^(?:show|check)\b.*\bcoding job\b|^recall\b.*\b(?:team|project|research)\b/.test(value))return true;
 if(/^(?:list|show)\b.*\bapplication packs\b.*\bmy laptop\b/.test(value))return true;
 if(/^(?:inspect|see|look at|read)\b.*\b(?:my screen|laptop screen|my laptop screen)\b|^(?:list|show)\b.*\b(?:open windows|installed apps)\b/.test(value))return true;
 if(/^(?:create|write|save)\b.*\b(?:local (?:text )?note|text file)\b.*\b(?:my laptop|my computer)\b/.test(value))return true;
 if(/\b(?:time|date|battery|cpu|ram|disk space|laptop memory)\b/.test(value)&&/\b(?:my laptop|the laptop|my computer)\b/.test(value))return true;
 if(/^(?:research|find current|check the newest)\b|^what are the latest\b/.test(value))return true;
 if(/^(?:join|disconnect|switch|go)\b.*\b(?:discord|voice channel)\b/.test(value))return true;
 if(/\btrading\s*view\b/.test(value)&&/\b(?:read|check|show|add|open)\b/.test(value)&&/\b(?:price|quote|value|indicator|rsi|macd|chart)\b/.test(value))return true;
 if(/^(?:read|summarize)\b.*https?:\/\//.test(value))return true;
 if(/^(?:play|put on)\s+.+\b(?:song|songs|music|video|on (?:google )?chrome|on youtube)\b|^(?:pause|resume|rewind|skip|stop)\s+(?:the\s+)?(?:song|music|video)|^(?:lower|reduce|raise|increase|set|mute|unmute|turn)\s+(?:the\s+)?(?:volume|sound|audio)\b/.test(value))return true;
 return /^(?:open|close|play|search|find|read|inspect|check|click|type|switch|build|fix|edit)\b/.test(value)&&/\b(?:my laptop|my computer|my desktop|on (?:the |my )?(?:laptop|computer|pc))\b/.test(value);
}
export async function switchSharedDisplay(user,text,{db=database,signal}={}){
 const selection=displaySelection(text);if(!selection)return null;
 if(!canAccessLaptop(user))throw Object.assign(new Error('Owner access required.'),{status:403});
 if(selection.error)throw new Error(selection.error);
 const stream=await db.getStream(user.id);
 if(!stream||!['pending','ready'].includes(stream.data.status))throw new Error('Open live screen sharing first, then choose a display.');
 const device=(await db.documents(user.id)).find(d=>d.kind==='device');
 const count=Number(device?.data.displays||8);
 if(selection.relative&&count<2)throw new Error('Your laptop reports only one display. There is no other screen to show.');
 const current=Math.max(1,Math.min(count,Number(stream.data.monitor)||1));
 const monitor=selection.monitor??((current-1+selection.relative+count)%count+1);
 if(monitor>count)throw new Error('Your laptop reports '+count+' display'+(count===1?'':'s')+'. Choose an available display.');
 signal?.throwIfAborted();const row=await db.updateStream(user.id,stream.id,{kind:'screen',monitor},true);
 if(!row)throw new Error('The live screen session ended. Reopen it before switching displays.');
 return {reply:'Selected screen '+monitor+' for your live feed. The next frames will use that display.',emotion:'focused',identity:'andrea',monitor};
}
function followupPhrase(text){
 const value=String(text).toLowerCase().replace(/’/g,"'").trim().replace(/[.!?।]+$/,'');
 if(/["“”\n]|\b(?:password|send|delete|buy|submit|type|never|don't|do not|mat)\b|मत/.test(value))return false;
 const follows=/^(?:close(?: it| this)?|band karo|बंद करो|pause|resume|next song|next track|play it|yes|yeah|haan|हाँ|हां)$/.test(value)
  || /^(?:no|sorry|actually|i meant|i mean)[, ]+(?:chrome|brave|edge|notepad|calculator|discord|spotify)$/.test(value)
  || /^(?:chrome|brave|edge)\s+(?:nahi|nahin|नहीं)[, ]+(?:chrome|brave|edge)$/.test(value)
  || /^search youtube for .{1,120}$/.test(value);
 return follows;
}
export function contextualLaptopFollowup(text,history,conversation,now=Date.now()){
 if(!followupPhrase(text))return false;
 const last=(history||[]).at(-1);
 if(!last||last.role!=='assistant'||!last.id?.startsWith('remote-assistant-')||last.conversation!==conversation)return false;
 const age=now-new Date(last.created_at).getTime();if(!Number.isFinite(age)||age<0||age>600000)return false;
 const userID=last.id.replace('remote-assistant-','remote-user-');
 return history.some(m=>m.id===userID&&m.role==='user'&&m.conversation===conversation);
}
export async function ownerLaptopChat(user,{text,identity,conversation,signal,request_id},{db=database,sleep=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now,timeout=42000}={}){
 if(!canAccessLaptop(user))return null;
 const selection=displaySelection(text);
 if(selection?.error)throw new Error(selection.error);
 if(!explicitLaptopCommand(text)){
  if(!followupPhrase(text)||typeof db.messages!=='function'||!contextualLaptopFollowup(text,await db.messages(user.id,conversation),conversation,now()))return null;
 }
 if(request_id!==undefined&&!/^[a-f0-9-]{36}$/.test(request_id))throw new Error('Invalid request ID.');
 signal?.throwIfAborted();
 const switched=await switchSharedDisplay(user,text,{db,signal});if(switched)return {...switched,identity};
 const device=(await db.documents(user.id)).find(d=>d.kind==='device');
 const payload=laptopCommand(user,{request:text,identity,conversation},device);
 if(!await db.limit('remote-command:'+user.id,6,60))throw new Error('Please wait before another laptop command.');
 signal?.throwIfAborted();const job=await db.newJob(user.id,'command',payload,request_id||randomUUID());
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
