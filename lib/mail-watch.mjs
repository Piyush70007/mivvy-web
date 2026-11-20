import {createHash} from 'node:crypto';
import * as db from './db.mjs';
import {connectionStatus,searchGmail} from './connections.mjs';
import {completeAssistant} from './completion.mjs';

export const pollMilliseconds=30000;
const jobWords='application interview recruiter recruitment hiring "job offer" "job application" "assessment invitation" "application status" Vorstellungsgespräch Bewerbung Stellenangebot नौकरी इंटरव्यू';
const mailContext=/\b(?:(?:e-?)?mails?|gmail|inbox|mailbox|recruiter (?:messages?|replies)|job alerts?)\b|ईमेल|मेल|इनबॉक्स/i;
export function mailWatchIntent(text){
 text=String(text).trim();if(!mailContext.test(text)||/^\s*(?:translate|explain|say|what does|how (?:do|can|would))\b/i.test(text))return null;
 if(/\b(?:have|received|already)\b/i.test(text)&&!/\b(?:when|whenever|keep|monitor|watch|arrives?|comes?|from now)\b/i.test(text))return null;
 if(/\b(?:stop|pause|disable|cancel|turn off|don't|dont|do not|never|mat)\b|बंद|मत/i.test(text)&&/\b(?:watch|monitor|alert|notif|notify|inform|tell|batana|batao)|निगरानी|सूच/i.test(text))return 'pause';
 if(/\b(?:resume|re-enable|enable again|restart)\b|फिर.*शुरू/i.test(text)&&/\b(?:watch|monitor|alert|notif)/i.test(text))return 'resume';
 if(/\b(?:what|which|show|list|status)\b/i.test(text)&&/\b(?:watches|watching|monitoring|alerts|rules)\b/i.test(text))return 'list';
 if(/\b(?:watch(?:ing)?|monitor(?:ing)?|keep (?:an? )?eye|keep checking|let me know|notify|alert|inform|tell me when|tell me if|batana|bata dena|batao)\b|आए.*बता|आये.*बता|आने.*बता|सूचित|कळव/i.test(text))return 'create';
 return null;
}
export function validateMailWatch(input){
 const topic=String(input.topic||'').trim().slice(0,100),sender=String(input.sender||'').trim().toLowerCase();
 if(sender&&!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(sender))throw new Error('Use a complete sender email address.');
 let keywords=Array.isArray(input.keywords)?input.keywords:[];
 keywords=[...new Set(keywords.map(x=>String(x).trim()).filter(x=>x.length>=2&&x.length<=60&&/^[\p{L}\p{N}][\p{L}\p{N} '\-]*$/u.test(x)))].slice(0,12);
 const category=input.category==='jobs'?'jobs':input.category==='all'?'all':'topic';
 if(sender.length+keywords.join(' ').length>330)throw new Error('Use a shorter sender/topic criterion.');
 if(category==='topic'&&!keywords.length&&!sender)throw new Error('What kind of email should I watch for, or which sender?');
 if(!topic)throw new Error('Give this watch a short topic.');
 return {topic,category,keywords,sender,identity:['andrea','jarvis','ultron'].includes(input.identity)?input.identity:'andrea',slack:input.slack===true};
}
export function mailWatchKey(plan){return createHash('sha256').update(JSON.stringify([plan.category,plan.sender,[...plan.keywords].sort()])).digest('hex').slice(0,32)}
export function watchQuery(watch,cutoff){
 const plan=watch.data,from=Math.max(plan.startedAt,plan.since||plan.startedAt);
 const condition=plan.category==='jobs'?'{'+jobWords+'}':plan.keywords.length?'{'+plan.keywords.map(x=>'"'+x+'"').join(' ')+'}':'';
 return ['in:inbox','-in:spam','-in:trash','after:'+Math.floor(from/1000),'before:'+Math.ceil(cutoff/1000),plan.sender?'from:('+plan.sender+')':'',condition].filter(Boolean).join(' ');
}
export async function mailWatchAnswer(user,{text,identity='andrea',signal},{storage=db,status=connectionStatus,complete=completeAssistant,now=()=>Date.now()}={}){
 const intent=mailWatchIntent(text);if(!intent)return null;
 const existing=await storage.mailWatches(user.id);
 if(intent==='list')return {reply:existing.length?existing.map(w=>`${w.data.topic}: ${w.enabled?'enabled':'paused'}${w.data.lastError?' · '+w.data.lastError:''}`).join('\n'):'You have no saved email watches yet.',emotion:'focused',identity};
 if(intent==='pause'||intent==='resume'){
  const jobOnly=/\b(?:job|interview|recruit|application)/i.test(text),all=/\b(?:all|every)\b/i.test(text);
  const terms=text.toLowerCase();let targets=jobOnly?existing.filter(w=>w.data.category==='jobs'):all?existing:existing.filter(w=>(w.data.sender&&terms.includes(w.data.sender))||w.data.topic.toLowerCase().split(/\s+/).filter(x=>x.length>3&&!['email','emails','messages','inbox'].includes(x)).some(x=>terms.includes(x)));
  const sender=text.match(/\bfrom\s+([a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();if(sender)targets=targets.filter(w=>w.data.sender===sender);
  if(!targets.length&&!jobOnly&&!all&&existing.length===1)targets=existing;
  if(!targets.length&&existing.length>1&&!jobOnly&&!all)return {reply:'Which email watch should I '+intent+'? '+existing.map(w=>w.data.topic).join(', ')+'. Say all email watches to change all of them.',emotion:'curious',identity};
  if(!targets.length)return {reply:'There is no matching email watch to '+intent+'.',emotion:'focused',identity};
  if(intent==='resume'&&!(await status(user)).gmail?.connected)return {reply:'Reconnect Gmail in Settings before resuming email watches.',emotion:'focused',identity};
  for(const w of targets)await storage.changeMailWatch(user.id,w.id,intent,now());
  return {reply:(intent==='pause'?'Paused: ':'Resumed: ')+targets.map(w=>w.data.topic).join(', ')+'.',emotion:'focused',identity};
 }
 const connections=await status(user);
 if(!connections.gmail?.connected)return {reply:'Connect Gmail in Settings → Connected accounts first. No email watch was activated.',emotion:'focused',identity};
 if(!await storage.limit('mail-watch-edit:'+user.id,30,3600))return {reply:'Too many watch changes just now. Please try again later.',emotion:'focused',identity};
 const jobs=/\b(?:jobs?|application|interview|recruit|hiring)|नौकरी|नोकरी|इंटरव्यू/i.test(text),all=/\b(?:every|all|any new)\s+(?:(?:e-?)?mails?|messages?)\b/i.test(text);
 const sender=text.match(/\bfrom\s+([a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
 if((jobs||all)&&/\bfrom\s+(?!now\b|today\b|anyone\b|anybody\b)/i.test(text)&&!sender)return {reply:'Which complete sender email address should I watch? I haven’t activated a broader watch.',emotion:'curious',identity};
 let plan;
 if(jobs)plan={topic:'Job emails',category:'jobs',keywords:[],sender:sender||''};
 else if(all)plan={topic:'New inbox messages',category:'all',keywords:[],sender:sender||''};
 else{
  const result=await complete([{role:'system',content:'Extract ONLY the email watch criterion explicitly requested by the user. Return JSON {"reply":"brief clarification if needed","emotion":"focused","actions":[{"kind":"mail_watch","data":{"topic":"short display title","category":"topic","keywords":["exact topic words"],"sender":"complete email address if explicitly supplied, otherwise empty"}}]}. Do not broaden to all email. Do not invent addresses, subjects, recipients or permissions. Important emails with no definition needs clarification and empty actions. This extraction cannot send, click or perform any action.'},{role:'user',content:text}],{key:process.env.DEEPSEEK_API_KEY,model:process.env.DEEPSEEK_MODEL||'deepseek-flash',signal});
  plan=result.actions?.find(x=>x.kind==='mail_watch')?.data;
  if(!plan)return {reply:result.reply||'Which email topic or sender should I watch for?',emotion:'curious',identity};
  // Only the user's own explicit all-mail request may widen the watch to all mail.
  plan={...plan,category:'topic'};
 }
 signal?.throwIfAborted();plan=validateMailWatch({...plan,identity,slack:/\bslack\b/i.test(text)});
 if(plan.sender&&!text.toLowerCase().includes(plan.sender))return {reply:'Please give the complete sender email address. No watch was activated.',emotion:'curious',identity};
 if(plan.slack&&!connections.slack?.connected)return {reply:'Connect Slack in Settings first, or ask for email alerts in Mivvy. No watch was activated.',emotion:'focused',identity};
 const duplicate=existing.find(w=>w.key===mailWatchKey(plan));
 if(existing.length>=5&&!duplicate)return {reply:'You already have five email watches. Remove one in Keeping watch before adding another.',emotion:'focused',identity};
 const saved=await storage.saveMailWatch(user.id,mailWatchKey(plan),{...plan,startedAt:now(),since:now()});
 return {reply:`${saved.data.topic} is now a saved watch. I’ll alert you about new matching inbox messages${plan.slack?' in your Slack DM and Mivvy':' in Mivvy'}. Checks run about every 30 seconds while Mivvy or the desktop companion is online; the current daily cloud check is only a catch-up. You can pause this under Keeping watch.`,emotion:'happy',identity,watch:saved};
}

// No LLM is called in the polling loop. Email text is data, never instructions.
export async function checkMailWatches(userID=null,{storage=db,search=searchGmail,notify=async()=>{},now=()=>Date.now(),signal}={}){
 const started=now(),claimed=await storage.claimMailWatches(userID,started);let matched=0,failed=0;
 for(const watch of claimed){
  try{
   const cutoff=watch.data.scan?.cutoff||started,query=watchQuery(watch,cutoff);
   const page=await search({id:watch.user_id},query,{signal,maxResults:20,pageToken:watch.data.scan?.pageToken,withPage:true});
   signal?.throwIfAborted();
   for(const mail of page.messages||[]){
    // Reject late old mail and malformed/provider-independent input.
    if(!/^[a-zA-Z0-9_-]{1,200}$/.test(mail.id||'')||!Number.isFinite(mail.receivedAt)||mail.receivedAt<watch.data.startedAt||mail.receivedAt>cutoff)continue;
    const data={title:watch.data.topic,subject:String(mail.subject||'(No subject)').slice(0,300),from:String(mail.from||'').slice(0,300),snippet:String(mail.snippet||'').slice(0,500),url:mail.url,identity:watch.data.identity,receivedAt:mail.receivedAt};
    const event=await storage.createMailAlert(watch,mail.id,data);
    if(event){matched++;await notify(event,watch).catch(()=>{});}
   }
   await storage.finishMailWatch(watch,{lastChecked:new Date(started).toISOString(),lastError:'',...(page.nextPageToken?{scan:{cutoff,pageToken:page.nextPageToken}}:{scan:null,since:Math.max(watch.data.startedAt,cutoff-120000)})},started+pollMilliseconds);
  }catch(error){failed++;await storage.finishMailWatch(watch,{lastError:error.reconnectRequired?'Gmail access expired or was revoked. Reconnect Gmail in Settings; this watch will retry after linking.':`Email check failed${error.providerStatus?' (provider '+error.providerStatus+')':''}. Retrying in five minutes.`},started+300000);}
 }
 return {checked:claimed.length,matched,failed};
}
