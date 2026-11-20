import {createHash} from 'node:crypto';
import {smallTalk,researchQuestion} from './live-research.mjs';
const normalized=text=>String(text).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function answerCacheSpec({user,conversation,identity,text,history=[],docs=[],research=false,model=''}){
 const question=normalized(text),social=smallTalk(text);
 if(!user?.id||!question||question.length>1000)return null;
 // Never memoize actions, private tools, live account state, or explicit refreshes.
 if(/\b(?:send|reply|delete|buy|purchase|apply|open|close|play|pause|volume|switch|save|add|set|remind|remember|create|record|log|track|gmail|email|inbox|slack|screen|camera|laptop|password|token|api key|refresh|recheck|update|again|new joke)\b|खोल|बंद|भेज|याद दिला/i.test(question))return null;
 if(!social&&!research&&!/^(?:what (?:is|are)|who (?:is|was)|how (?:do|does|can)|why |explain |define |tell me about )/i.test(question))return null;
 // A follow-up must be regenerated against the current conversation.
 if(!social&&/\b(?:that|this|those|it|them|same|previous|above|mine|my|your)\b|^(?:and |what about |how about |aur |और )/i.test(question))return null;
 const context=history.slice();
 // Repeating the same standalone question should reuse its answer, rather
 // than invalidate itself merely because the first answer entered history.
 while(context.length>=2&&context.at(-1)?.role==='assistant'&&context.at(-2)?.role==='user'&&normalized(context.at(-2).content)===question)context.splice(-2);
 const key=createHash('sha256').update(JSON.stringify({v:1,user:user.id,conversation,identity,question:research?researchQuestion(text,context):question,research,model,
  history:social?[]:context.slice(-6).map(m=>({role:m.role,content:m.content})),
  docs:docs.filter(d=>!['device','subscription'].includes(d.kind)).map(d=>({id:d.id,kind:d.kind,data:d.data})).sort((a,b)=>a.id.localeCompare(b.id))})).digest('hex');
 return {key,ttl:research?30:social?300:600};
}
export async function cachedAnswer(spec,load,{userID,get,put,signal}={}){
 if(!spec)return load();
 signal?.throwIfAborted();
 let old;try{old=await get(userID,spec.key)}catch{/* Cache failure must not break chat. */}
 signal?.throwIfAborted();
 if(old)return {...old.result,cache:{hit:true,expiresAt:old.expires}};
 const result=await load();signal?.throwIfAborted();
 const safe=!result.accountData&&!result.applied?.length&&!result.actions?.length&&!result.job&&!result.remoteJob&&!result.sent&&result.delivery!=='singing'&&result.research?.verified!==false
  &&!/(?:could not|couldn't|temporarily unavailable|try again|not verified|no item was saved)/i.test(result.reply||'');
 if(!safe)return result;
 const expires=new Date(Date.now()+spec.ttl*1000).toISOString();
 try{await put(userID,spec.key,result,expires)}catch{/* An answer remains usable without caching. */}
 return {...result,cache:{hit:false,expiresAt:expires}};
}
