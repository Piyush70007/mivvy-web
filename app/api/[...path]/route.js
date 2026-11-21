import {savedPerformance,speechDelivery} from '../../../lib/performance.mjs';
import {cookies} from 'next/headers';
import {after} from 'next/server';
import * as db from '../../../lib/db.mjs';
import {digest,verifyPassword,passwordHash,newToken,cleanEmail,ownerEmail,canAccessLaptop,safeEqual,validateEntry} from '../../../lib/security.mjs';
import {answer,identities} from '../../../lib/assistant.mjs';
import {transcribeVoice} from '../../../lib/transcription.mjs';
import {connectionStatus,beginConnection,finishConnection,providers,appOrigin,setSlackReminders,sendSlackToMe} from '../../../lib/connections.mjs';
import {connectedAnswer,connectionIntent} from '../../../lib/connected-assistant.mjs';
import {laptopCommand,mobileCapabilities} from '../../../lib/mobile.mjs';
import {requireOwner,streamOffer,streamAnswer,streamCapture,iceConfiguration,streamMode} from '../../../lib/live-stream.mjs';
import {ownerLaptopChat,switchSharedDisplay} from '../../../lib/laptop-chat.mjs';
import {personalToolRequest} from '../../../lib/personal-tools.mjs';
import {needsLiveResearch} from '../../../lib/live-research.mjs';
import {resolveAssistantTurn} from '../../../lib/chat-routing.mjs';
import {actionShaped,routeUnfamiliarOwnerRequest} from '../../../lib/agent-routing.mjs';
import {mailWatchIntent,mailWatchAnswer} from '../../../lib/mail-watch.mjs';
import {attentionTick,attentionState} from '../../../lib/attention.mjs';
import {mailDelivery,saveMailDelivery,proactiveDeliverable} from '../../../lib/mail-delivery.mjs';
export const runtime='nodejs';
export const maxDuration=60;
export const dynamic='force-dynamic';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function current(){const value=(await cookies()).get('andrea_session')?.value;return value?db.sessionUser(digest(value)):null}
function deviceAuth(req){return process.env.DEVICE_TOKEN_HASH&&safeEqual(digest(req.headers.get('authorization')?.replace(/^Bearer /,'')||''),process.env.DEVICE_TOKEN_HASH)}
function csrf(req){const origin=req.headers.get('origin');let accepted=false;try{const parsed=new URL(origin);accepted=['http:','https:'].includes(parsed.protocol)&&parsed.host===req.headers.get('host')}catch{}if(!accepted)throw Object.assign(new Error('Request origin was not accepted.'),{status:403})}
async function body(req){const raw=await req.text();if(raw.length>3_000_000)throw new Error('Request is too large.');try{return JSON.parse(raw||'{}')}catch{throw new Error('Invalid request.') }}
async function reminderTick(){
 const due=await db.dueReminders();let sent=0,slackSent=0;let push;
 if(process.env.VAPID_PRIVATE_KEY){push=(await import('web-push')).default;push.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY)}
 for(const item of due){
  if(push){const subscriptions=(await db.documents(item.user_id)).filter(d=>d.kind==='subscription');for(const sub of subscriptions)try{await push.sendNotification(sub.data,JSON.stringify({title:'Mivvy · Reminder',body:item.data.title,id:item.id}));sent++}catch(e){if([404,410].includes(e.statusCode))await db.deleteDoc(item.user_id,sub.id)}}
  const slack=await db.connection(item.user_id,'slack');if(slack?.profile.reminders)try{await sendSlackToMe({id:item.user_id},'Mivvy reminder: '+item.data.title);slackSent++}catch{console.warn('Slack reminder delivery was not confirmed; no automatic resend.')}
 }
 return {due:due.length,sent,slackSent};
}
async function route(req,ctx){
 try{
 const path=(await ctx.params).path.join('/'),url=new URL(req.url);
 if(path==='health')return json({ok:true,accounts:Boolean(process.env.DATABASE_URL)||db.localDevelopment,ai:Boolean(process.env.DEEPSEEK_API_KEY),voice:Boolean(process.env.FISH_AUDIO_API_KEY),development:db.localDevelopment});
 if(path==='cron'){if(!process.env.CRON_SECRET||!safeEqual(req.headers.get('authorization'),'Bearer '+process.env.CRON_SECRET))return json({error:'Unauthorized'},401);return json({reminders:await reminderTick(),attention:await attentionTick(null,{signal:req.signal})})}
 if(path==='device'){
  if(!deviceAuth(req))return json({error:'Unauthorized'},401);await db.init();const owner=await db.userByEmail(ownerEmail());if(!owner?.owner)return json({error:'Owner must sign in first.'},409);
  if(req.method==='GET'){
   const displays=Number(url.searchParams.get('displays'));
   await db.putDoc(owner.id,'device',{lastSeen:Date.now(),name:'Piyush’s laptop',commands:url.searchParams.get('commands')==='1',streams:url.searchParams.get('streams')==='1',...(Number.isInteger(displays)&&displays>=1&&displays<=8?{displays}:{})},'laptop-status');
   const stream=await db.getStream(owner.id),running=url.searchParams.get('running'),active=running?await db.getJob(owner.id,running):null;
   return json({job:await db.claimJob(url.searchParams.get('accept_commands')!=='0',owner.id),stream:stream?{...stream,iceServers:iceConfiguration().iceServers}:null,cancelCommand:active?.status==='cancelled'?running:null});
  }
  const input=await body(req);
  if(input.action==='stream_capture'){
   const id=String(input.id||''),row=await db.getStream(owner.id,id);
   if(!row)return json({error:'Stream expired or replaced.'},409);
   const updated=await db.updateStream(owner.id,id,streamCapture(input,row.data));
   return updated?json({ok:true}):json({error:'Stream expired or replaced.'},409);
  }
  if(input.action==='stream_answer'){
   const updated=await db.updateStream(owner.id,String(input.id||''),streamAnswer(input));
   return updated?json({ok:true}):json({error:'Stream expired or replaced.'},409);
  }
  if(input.action==='result'){
   if(typeof input.id!=='string')throw new Error('Job ID missing.');
   const result=input.error?{error:String(input.error).slice(0,250)}:typeof input.reply==='string'?{reply:input.reply.slice(0,12000)}:{image:String(input.image||'')};
   if(result.image&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.image))throw new Error('Invalid snapshot.');if(result.image?.length>2_800_000)throw new Error('Snapshot too large.');
   const job=await db.getJob(owner.id,input.id);
   if(job?.kind==='command'&&job.status==='working'&&result.reply){
    const conversation=String(job.payload?.conversation||'laptop').slice(0,80),identity=identities.includes(job.payload?.identity)?job.payload.identity:'andrea';
    await db.addMessage(owner.id,conversation,'user',String(job.payload?.request||'').slice(0,4000),identity,'remote-user-'+job.id);
    const message=await db.addMessage(owner.id,conversation,'assistant',result.reply,identity,'remote-assistant-'+job.id);result.message_id=message.id;
   }
   await db.finishJob(input.id,result);return json({ok:true});
  }
  if(input.action==='sync'){for(const m of (input.messages||[]).slice(-30)){if(!['user','assistant'].includes(m.role)||typeof m.content!=='string'||!/^desktop-[a-f0-9]{32,64}$/.test(m.id||''))continue;await db.addMessage(owner.id,'laptop',m.role,m.content.slice(0,5000),String(m.identity||'andrea').slice(0,20),m.id)}return json({ok:true})}
  if(input.action==='connected_tool'){
   const text=String(input.request||'').trim();if(!text||text.length>4000||/\b(?:sk-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,})/.test(text))throw new Error('Use a connected-account request without credentials.');
   if(!await db.limit('connected:'+owner.id,200,86400))return json({error:'Connected service allowance reached.'},429);
   const context=Array.isArray(input.context)?input.context.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string').slice(-8).map(m=>({role:m.role,content:m.content.slice(0,5000)})):[];
   const request={text,identity:identities.includes(input.identity)?input.identity:'andrea',history:context.length?context:(await db.messages(owner.id,'laptop')).slice(-8),signal:req.signal};
   return json(mailWatchIntent(text)?await mailWatchAnswer(owner,request):await connectedAnswer(owner,request));
  }
  if(input.action==='personal_tool'||input.action==='switch_display'){
   const text=String(input.request||'').trim();if(!text||text.length>4000||/\b(?:sk-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,})/.test(text))throw new Error('Use a tool request without credentials.');
   const history=Array.isArray(input.context)?input.context.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string').slice(-8).map(m=>({role:m.role,content:m.content.slice(0,5000)})):[];
   const identity=identities.includes(input.identity)?input.identity:'andrea';
   if(input.action==='switch_display'){const result=await switchSharedDisplay(owner,text,{signal:req.signal});if(!result)throw new Error('Name the live screen display to select.');return json({...result,identity})}
   if(!personalToolRequest(text,history))throw new Error('Use an explicit reminder, task, money, note, habit or preference request.');
   if(!await db.limit('desktop-tools:'+owner.id,200,86400))return json({error:'Personal tool allowance reached.'},429);
   const conversation='desktop-tools-'+identity;
   const result=await answer(owner,{text,identity,conversation,history,signal:req.signal});
   await db.addMessage(owner.id,conversation,'user',text,identity);await db.addMessage(owner.id,conversation,'assistant',result.reply,identity);return json(result);
  }
  if(input.action==='mail_delivery')return json({policy:await saveMailDelivery(owner.id,input,{status:connectionStatus})});
  if(input.action==='tick'){const policy=await mailDelivery(owner.id);return json({...await reminderTick(),attention:await attentionTick(owner.id,{signal:req.signal}),alerts:(await db.mailAlerts(owner.id)).filter(x=>!x.seen&&proactiveDeliverable(x,policy)),mailDelivery:policy})}throw new Error('Unknown device operation.');
 }
 if(req.method!=='GET')csrf(req);
 if(path==='auth'){
  const input=await body(req),email=cleanEmail(input.email),password=String(input.password||'');
  const ip=digest(req.headers.get('x-forwarded-for')||'local');if(!await db.limit('login:'+ip,20,900))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  if(password.length<8||password.length>128)throw new Error('Use a password between 8 and 128 characters.');
  let user=await db.userByEmail(email);
  if(email===ownerEmail()&&!user){if(!process.env.OWNER_PASSWORD_HASH||!verifyPassword(password,process.env.OWNER_PASSWORD_HASH))return json({error:'Email or password is incorrect.'},401);user=await db.createUser(email,process.env.OWNER_PASSWORD_HASH,true)}
  else if(input.mode==='signup'){if(email===ownerEmail())throw new Error('This address is reserved for the owner. Sign in instead.');if(user)throw new Error('An account already exists. Sign in instead.');if(!await db.limit('signup:'+ip,5,3600))return json({error:'Please try creating an account later.'},429);user=await db.createUser(email,passwordHash(password))}
  if(!user||!verifyPassword(password,user.password))return json({error:'Email or password is incorrect.'},401);
  const token=newToken();await db.addSession(digest(token),user.id);(await cookies()).set('andrea_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*86400});return json({user:{email:user.email,owner:canAccessLaptop(user)}});
 }
 const user=await current();if(!user)return json({error:'Sign in to continue.'},401);
 if(path==='attention'){
  if(req.method==='GET')return json(await attentionState(user));
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const input=await body(req);
  if(input.action==='delivery')return json({policy:await saveMailDelivery(user.id,input,{status:connectionStatus})});
  if(input.action==='tick'){if(!await db.limit('attention-tick:'+user.id,8,60))return json({error:'Please wait before checking again.'},429);return json({tick:await attentionTick(user.id,{signal:req.signal}),...await attentionState(user)})}
  if(input.action==='watch'){const text=String(input.request||'').slice(0,4000);if(!mailWatchIntent(text))throw new Error('Describe the email watch you want.');return json(await mailWatchAnswer(user,{text,identity:input.identity,signal:req.signal}))}
  if(input.action==='read'){await db.readMailAlerts(user.id,input.ids);return json({ok:true})}
  if(['pause','resume','delete'].includes(input.action)){
   if(input.action==='resume'&&!(await connectionStatus(user)).gmail.connected)throw new Error('Reconnect Gmail first.');
   if(!await db.changeMailWatch(user.id,String(input.id),input.action))return json({error:'Watch not found.'},404);return json(await attentionState(user));
  }
  throw new Error('Unknown attention operation.');
 }
 if(path==='logout'){await db.removeSession(digest((await cookies()).get('andrea_session')?.value||''));(await cookies()).delete('andrea_session');return json({ok:true})}
 if(path==='connections'){
  if(req.method==='GET')return json({connections:await connectionStatus(user)});
  const input=await body(req);if(!providers.includes(input.provider))throw new Error('Unknown connection.');
  if(input.action==='disconnect')await db.deleteConnection(user.id,input.provider);
  else if(input.action==='reminders'&&input.provider==='slack')await setSlackReminders(user,input.enabled===true);
  else throw new Error('Unknown connection operation.');
  return json({connections:await connectionStatus(user)});
 }
 if(path.startsWith('connect/')){
  if(req.method!=='GET')return json({error:'Method not allowed'},405);
  const [,provider,step]=path.split('/');if(!providers.includes(provider))throw new Error('Unknown connection.');
  const name='mivvy_oauth_'+provider,jar=await cookies();
  if(step==='start'){
   if(!await db.limit('oauth:'+user.id,10,600))return json({error:'Please wait before reconnecting.'},429);
   const started=await beginConnection(user,provider);jar.set(name,started.state,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/connect/'+provider,maxAge:600});return Response.redirect(started.url,303);
  }
  if(step==='callback'){
   try{await finishConnection(user,provider,{state:url.searchParams.get('state'),code:url.searchParams.get('code'),cookieState:jar.get(name)?.value});jar.set(name,'',{path:'/api/connect/'+provider,maxAge:0});return Response.redirect(appOrigin()+'/?connection='+provider+'&connection_status=connected',303)}
   catch{jar.set(name,'',{path:'/api/connect/'+provider,maxAge:0});return Response.redirect(appOrigin()+'/?connection='+provider+'&connection_status=failed',303)}
  }
  throw new Error('Unknown account-linking step.');
 }
 if(path==='me')return json({user:{email:user.email,owner:canAccessLaptop(user)},voice:identities.filter(i=>process.env['FISH_AUDIO_'+i.toUpperCase()+'_VOICE_ID']),pushKey:process.env.VAPID_PUBLIC_KEY||'',development:db.localDevelopment});
 if(path==='mobile/config'){
  if(req.method!=='GET')return json({error:'Method not allowed'},405);
  const device=canAccessLaptop(user)?(await db.documents(user.id)).find(d=>d.kind==='device'):null;
  return json(mobileCapabilities(user,device));
 }
 if(path==='stream'){
  requireOwner(user);
  if(req.method==='GET'){
   if(!url.searchParams.get('id')){const device=(await db.documents(user.id)).find(d=>d.kind==='device'),active=await db.getStream(user.id);return json({...iceConfiguration(),protocol:'webrtc-video-v1',displays:device?.data.displays||4,activeStream:active?{id:active.id,kind:active.data.kind,monitor:active.data.monitor,status:active.data.status,revision:active.data.revision||0}:null})}
   const stream=await db.getStream(user.id,url.searchParams.get('id'));
   return stream?json({stream:{id:stream.id,expires:stream.expires,kind:stream.data.kind,monitor:stream.data.monitor,status:stream.data.status,revision:stream.data.revision||0,answer:stream.data.answer,error:stream.data.error||null}}):json({error:'Stream ended, expired or replaced.'},404);
  }
  const input=await body(req);
  if(input.action==='start'){
   const data=streamOffer(input),device=(await db.documents(user.id)).find(d=>d.kind==='device');
   if(!device||Date.now()-device.data.lastSeen>25000||device.data.streams!==true)return json({error:'Open the updated Windows companion with Laptop web enabled first.'},409);
   streamMode(data,device.data.displays||8);
   if(!await db.limit('stream-start:'+user.id,12,60))return json({error:'Please wait before starting another stream.'},429);
   const stream=await db.startStream(user.id,data);return json({stream:{id:stream.id,expires:stream.expires,status:'pending'}});
  }
  const id=String(input.id||'');if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Stream ID missing.');
  if(input.action==='stop'){await db.stopStream(user.id,id);return json({ok:true})}
  if(input.action==='heartbeat'){const row=await db.updateStream(user.id,id,{},true);if(row?.data.status==='failed')return json({error:row.data.error||'Stream failed.'},409);return row?json({expires:row.expires,kind:row.data.kind,monitor:row.data.monitor,revision:row.data.revision||0}):json({error:'Stream expired.'},404)}
  if(input.action==='mode'){
   const device=(await db.documents(user.id)).find(d=>d.kind==='device'),mode=streamMode(input,device?.data.displays||8);
   const row=await db.updateStream(user.id,id,mode,true);return row?json({ok:true,kind:row.data.kind,monitor:row.data.monitor,revision:row.data.revision||0}):json({error:'Stream expired.'},404);
  }
  throw new Error('Unknown stream operation.');
 }
 if(path==='transcribe'){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(Number(req.headers.get('content-length')||0)>1_500_000)return json({error:'Voice turn is too long. Use sentences under 40 seconds.'},413);
  if(!await db.limit('transcribe:'+user.id,user.owner?400:80,86400))return json({error:'Daily transcription allowance reached.'},429);
  if(!process.env.FISH_AUDIO_API_KEY)return json({error:'Cloud speech recognition is not connected.'},503);
  const input=await req.formData(),audio=input.get('audio');if(!audio||typeof audio.arrayBuffer!=='function'||audio.size<1600||audio.size>1_400_000)return json({error:'Send a voice recording between 0.05 and 40 seconds.'},400);
  const header=new Uint8Array(await audio.slice(0,44).arrayBuffer());if(String.fromCharCode(...header.slice(0,4))!=='RIFF'||String.fromCharCode(...header.slice(8,12))!=='WAVE')return json({error:'Use WAV microphone audio.'},400);
  try{return json(await transcribeVoice(audio,String(input.get('language')||'en'),{key:process.env.FISH_AUDIO_API_KEY,signal:req.signal}))}catch(error){if(error.status)return json({error:error.message},error.status);throw error}
 }
 if(path==='state'){
  if(req.method==='GET'){const docs=await db.documents(user.id);after(()=>attentionTick(user.id).catch(()=>{}));return json({account:user.email,docs:docs.filter(d=>d.kind!=='subscription'),messages:await db.messages(user.id,url.searchParams.get('conversation'))})}
  const input=await body(req);if(input.action==='delete'){await db.deleteDoc(user.id,String(input.id));return json({ok:true})}
  const data=validateEntry(input.kind,input.data||{});return json({doc:await db.putDoc(user.id,input.kind,data,typeof input.id==='string'?input.id:undefined)});
 }
 if(path==='chat'){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);const input=await body(req),text=String(input.text||'').trim(),conversation=String(input.conversation||'main').slice(0,80),identity=identities.includes(input.identity)?input.identity:'andrea';
  if(!text||text.length>4000)throw new Error('Use a message shorter than 4,000 characters.');if(/\b(?:sk-[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,})/.test(text))throw new Error('Keep API keys in server settings, outside conversation.');
  if(!await db.limit('chat:'+user.id,user.owner?300:60,86400)||!await db.limit('global-chat',1500,86400))return json({error:'The daily message allowance has been reached.'},429);
  const result=await resolveAssistantTurn(user,{text,conversation,identity,search:Boolean(input.search),signal:req.signal,request_id:input.request_id});
  if(result?.messages)return json(result);
  req.signal.throwIfAborted();const mine=await db.addMessage(user.id,conversation,'user',text,identity),reply=await db.addMessage(user.id,conversation,'assistant',result.reply,identity);return json({...result,messages:[mine,reply]});
 }
 if(path==='speak'){
  let input;
  if(req.method==='GET'){
   const id=url.searchParams.get('message_id');if(!id||id.length>120)return json({error:'Choose a saved assistant reply.'},400);
   const performance=savedPerformance(await db.messages(user.id),id);const message=performance?.reply;if(!message)return json({error:'Reply not found in your account.'},404);
   input={text:message.content,identity:message.identity,singing:performance.singing,emotion:url.searchParams.get('emotion'),format:url.searchParams.get('format')};
  }else input=await body(req);
  const identity=identities.includes(input.identity)?input.identity:'andrea';let text=String(input.text||'').slice(0,1600);const voice=process.env['FISH_AUDIO_'+identity.toUpperCase()+'_VOICE_ID'];if(!voice||!process.env.FISH_AUDIO_API_KEY)return json({error:'This voice is not connected yet.'},503);
  if(!await db.limit('speech:'+user.id,user.owner?500:80,86400)||!await db.limit('global-speech',2000,86400))return json({error:'Daily voice allowance reached. Text chat remains available.'},429);
  text=speechDelivery(text,{singing:input.singing===true,emotion:input.emotion});
  const format=input.format==='wav'?'wav':'mp3';const upstream=await fetch('https://api.fish.audio/v1/tts',{method:'POST',headers:{Authorization:'Bearer '+process.env.FISH_AUDIO_API_KEY,'Content-Type':'application/json',model:process.env.FISH_AUDIO_MODEL||'drama-3'},body:JSON.stringify({text,reference_id:voice,format,...(format==='wav'?{sample_rate:24000}:{}),latency:'balanced',normalize:true}),signal:AbortSignal.any([req.signal,AbortSignal.timeout(40000)])});if(!upstream.ok)return json({error:'The voice service could not speak ('+upstream.status+').'},502);return new Response(upstream.body,{headers:{'Content-Type':format==='wav'?'audio/wav':'audio/mpeg','Cache-Control':'private, no-store'}});
 }
 if(path==='laptop'){
  if(!canAccessLaptop(user))return json({error:'Owner access required.'},403);
  if(req.method==='GET'){const job=await db.getJob(user.id,url.searchParams.get('id')||'');return job?json({job}):json({error:'Snapshot expired. Request a new one.'},404)}
  const input=await body(req);
  if(input.action==='cancel'){if(!/^[a-f0-9-]{36}$/.test(input.id||''))throw new Error('Job ID missing.');if(!await db.limit('remote-cancel:'+user.id,30,60))return json({error:'Please wait before another cancellation.'},429);await db.cancelJob(user.id,input.id);return json({ok:true})}
  if(!['screen','camera','command'].includes(input.kind))throw new Error('Choose a snapshot or a laptop command.');
  const status=(await db.documents(user.id)).find(d=>d.kind==='device');
  if(input.kind==='command'){
   let researching=needsLiveResearch(input.request);
   if(researching&&actionShaped(input.request)){const decision=await routeUnfamiliarOwnerRequest(user,{text:String(input.request),history:await db.messages(user.id,input.conversation),identity:input.identity,signal:req.signal});researching=decision?.route==='research'}
   const payload=laptopCommand(user,input,status,{requiresDevice:!researching});if(!await db.limit('remote-command:'+user.id,6,60))return json({error:'Please wait before submitting another laptop command.'},429);
   const id=typeof input.request_id==='string'?input.request_id:undefined;if(id&&!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid request ID.');
   if(id){const previous=await db.getJob(user.id,id);if(previous){if(previous.status!=='cancelled'&&['request','identity','conversation'].some(key=>(previous.payload?.[key]??null)!==(payload[key]??null)))throw new Error('This request ID already belongs to a different instruction.');return json({job:previous})}}
   const switched=researching?await answer(user,{text:payload.request,conversation:payload.conversation||'laptop',identity:payload.identity,signal:req.signal}):await switchSharedDisplay(user,payload.request,{signal:req.signal});
   if(switched){
    req.signal.throwIfAborted();const job=await db.completedCommand(user.id,payload,{reply:switched.reply,...(Number.isInteger(switched.monitor)?{monitor:switched.monitor}:{})},id);
    if(job.status==='done'){
     await db.addMessage(user.id,payload.conversation||'laptop','user',payload.request,payload.identity,'remote-user-'+job.id);
     const reply=await db.addMessage(user.id,payload.conversation||'laptop','assistant',job.result.reply,payload.identity,'remote-assistant-'+job.id);
     job.result.message_id=reply.id;
    }
    return json({job});
   }
   req.signal.throwIfAborted();const job=await db.newJob(user.id,'command',payload,id);if(req.signal.aborted){await db.cancelJob(user.id,job.id);req.signal.throwIfAborted()}return json({job});
  }
  if(!await db.limit('capture:'+user.id,30,60))return json({error:'Please wait before taking another snapshot.'},429);if(!status||Date.now()-status.data.lastSeen>25000)return json({error:'Laptop offline. Open the desktop companion first.'},409);return json({job:await db.newJob(user.id,input.kind)});
 }
 if(path==='push'){
  const input=await body(req),subscription=input.subscription;if(!subscription||typeof subscription.endpoint!=='string'||!/^https:\/\/(?:[^/]+\.)?(?:push\.services\.mozilla\.com|fcm\.googleapis\.com|web\.push\.apple\.com|notify\.windows\.com)\//.test(subscription.endpoint)||!subscription.keys?.p256dh||!subscription.keys?.auth)throw new Error('Invalid push subscription.');await db.putDoc(user.id,'subscription',subscription,digest(subscription.endpoint));return json({ok:true});
 }
 return json({error:'Not found'},404);
 }catch(e){console.error('Andrea API:',e.name,e.code||'',String(e.message).replace(/postgres[^\s]+/g,'[database]').slice(0,100));return json({error:e.status?e.message:/connect|fetch|database|relation|syntax|Account storage/i.test(e.message)?'The service connection is not ready. Please try again shortly.':e.message||'Request failed.'},e.status||400)}
}
export const GET=route;
export const POST=route;
