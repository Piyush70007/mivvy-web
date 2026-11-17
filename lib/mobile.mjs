import {canAccessLaptop} from './security.mjs';

export function laptopCommand(user,input,status,{requiresDevice=true}={}){
 if(!canAccessLaptop(user))throw Object.assign(new Error('Owner access required.'),{status:403});
 if(requiresDevice&&(!status||Date.now()-status.data.lastSeen>25000||status.data.commands!==true))throw Object.assign(new Error('Open the updated Windows desktop companion and enable its laptop connection first.'),{status:409});
 const request=String(input.request||'').trim();
 if(!request||request.length>4000)throw new Error('Use a laptop instruction between 1 and 4,000 characters.');
 if(/\b(?:sk-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,})/.test(request))throw new Error('Keep credentials outside commands.');
 return {request,identity:['andrea','jarvis','ultron'].includes(input.identity)?input.identity:'andrea',...(typeof input.conversation==='string'?{conversation:input.conversation.slice(0,80)}:{})};
}

export function mobileCapabilities(user,device){
 const online=Boolean(device&&Date.now()-device.data.lastSeen<25000);
 return {version:1,baseURL:'https://skulls-personal-ai.vercel.app',
  authentication:'session-cookie',identities:['andrea','jarvis','ultron'],
  chat:true,voiceTurns:true,reminders:true,localReminderNotifications:true,
  laptop:{owner:canAccessLaptop(user),online:canAccessLaptop(user)&&online,commands:canAccessLaptop(user)&&online&&device.data.commands===true,liveVideo:canAccessLaptop(user)&&online&&device.data.streams===true,platform:'windows'},
  incomingCalls:{ready:false,reason:'Native CallKit/PushKit app and live call transport are not connected.'},
  gmail:{read:true,send:false,reason:'Current OAuth grant is read-only.'}};
}
