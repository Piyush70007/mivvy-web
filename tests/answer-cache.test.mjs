import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {shouldResearch,needsLiveResearch} from '../lib/live-research.mjs';
import {answerCacheSpec,cachedAnswer} from '../lib/answer-cache.mjs';
const input={user:{id:'one'},identity:'andrea',conversation:'one',text:'What is photosynthesis?',model:'fixture'};
test('greetings skip paid search even with the saved switch on and recent research',()=>{
 const history=[{role:'user',content:'MS Dhoni total runs'}];
 for(const text of ['How are you?','Hi, how are you today?','How are you doing today Andrea?','And how are you?','Hello Andrea','Andrea how are you','कैसे हो','aap kaise hain','aur kaise ho','Thanks','Bye']){
  assert.equal(shouldResearch(text,history,true),false,text);assert.equal(needsLiveResearch(text,history),false,text);
 }
 for(const text of ['Hi, what is the weather today?','MS Dhoni total runs','Latest cricket news'])assert.equal(shouldResearch(text,history,true),true,text);
});
test('cache scope includes user, identity, conversation, model, tool state and context',()=>{
 const first=answerCacheSpec(input);assert.equal(first.ttl,600);
 for(const patch of [{user:{id:'two'}},{identity:'jarvis'},{conversation:'two'},{model:'new'},{docs:[{id:'preference',kind:'preference',data:{body:'Hindi'}}]},{history:[{role:'user',content:'Explain for a child'}]}])assert.notEqual(answerCacheSpec({...input,...patch}).key,first.key);
 assert.equal(answerCacheSpec({...input,history:[{role:'user',content:input.text},{role:'assistant',content:'Fixture answer'}]}).key,first.key);
 assert.equal(answerCacheSpec({...input,docs:[{kind:'device',data:{lastSeen:Date.now()}}]}).key,first.key);
 assert.equal(answerCacheSpec({...input,text:'MS Dhoni total runs',research:true}).ttl,30);
 assert.equal(answerCacheSpec({...input,text:'How are you?'}).ttl,300);
});
test('actions, follow-ups, personal data and explicit refresh cannot use answer caching',()=>{
 for(const text of ['Open Chrome','Send my email','Add a reminder','Refresh MS Dhoni stats','Search again for scores','What is on my screen?','What about ODIs?','What is that?','Play music','कॅमेरा खोलो'])assert.equal(answerCacheSpec({...input,text}),null,text);
});
test('cached answers skip generation, but unsafe results and failures are never stored',async()=>{
 const spec=answerCacheSpec(input);let generated=0,saved=0;
 const old={result:{reply:'Stored answer',emotion:'happy'},expires:new Date(Date.now()+10000).toISOString()};
 const hit=await cachedAnswer(spec,async()=>{generated++;return {reply:'New'}},{userID:'one',get:async()=>old,put:async()=>saved++});
 assert.equal(hit.cache.hit,true);assert.equal(generated,0);assert.equal(saved,0);
 for(const result of [{reply:'Saved',applied:[{id:'one'}]},{reply:'Sent',sent:true},{reply:'Do it',actions:[{}]},{reply:'Open',remoteJob:{}},{reply:'Unavailable',research:{verified:false}},{reply:'Could not complete it'},{reply:'Singing',delivery:'singing'}])await cachedAnswer(spec,async()=>result,{get:async()=>null,put:async()=>saved++});
 assert.equal(saved,0);
 const miss=await cachedAnswer(spec,async()=>({reply:'Fresh',emotion:'happy'}),{get:async()=>null,put:async()=>saved++});assert.equal(miss.cache.hit,false);assert.equal(saved,1);
});
test('cache outages do not break chat and cancelled requests cannot replay or store',async()=>{
 const spec=answerCacheSpec(input),abort=new AbortController();abort.abort();let generated=0;
 await assert.rejects(cachedAnswer(spec,async()=>{generated++},{signal:abort.signal}));assert.equal(generated,0);
 const result=await cachedAnswer(spec,async()=>({reply:'Fresh'}),{get:async()=>{throw Error('offline')},put:async()=>{throw Error('offline')}});assert.equal(result.reply,'Fresh');
});
test('real assistant path skips search with search:true, reuses answers, isolates users and expires entries',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'mivvy-cache-')),cwd=process.cwd(),fetcher=global.fetch,key=process.env.DEEPSEEK_API_KEY;
 let model=0,search=0;const prompts=[];
 try{
  process.chdir(folder);process.env.DEEPSEEK_API_KEY='fixture-key';
  global.fetch=async(url,options)=>{
   if(String(url).includes('/tools/search')){search++;throw Error('Greeting triggered paid research')}
   model++;prompts.push(JSON.parse(options.body));return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'I am doing well!',emotion:'happy',actions:[]})}}]})};
  };
  const db=await import('../lib/db.mjs'),{answer}=await import('../lib/assistant.mjs');
  const args={text:'How are you?',conversation:'cache-test',identity:'andrea',search:true,history:[{role:'user',content:'MS Dhoni total runs'},{role:'assistant',content:'Fixture Sources: https://example.com'}]};
  const first=await answer(input.user,args);assert.equal(first.cache.hit,false);assert.deepEqual(first.sources,[]);assert.equal(search,0);assert.equal(model,1);assert(!JSON.stringify(prompts[0]).includes('https://example.com'));
  const second=await answer(input.user,args);assert.equal(second.cache.hit,true);assert.equal(model,1);
  await answer({id:'other'},args);assert.equal(model,2);
  // Real assistant research path: repeated exact standalone facts reuse the
  // evidence-backed answer, rather than invoking search or the model again.
  global.fetch=async(url)=>{
   if(String(url).includes('/tools/search')){search++;return {ok:true,json:async()=>({results:[{title:'Fixture stats',url:'https://www.icc-cricket.com/fixture',content:'Fixture career runs 17266'}]})}}
   model++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'Fixture career runs 17266 [1].',actions:[]})}}]})};
  };
  const stats={text:'MS Dhoni total runs',conversation:'stats',identity:'andrea',search:false,history:[]};
  const factual=await answer(input.user,stats);assert.equal(factual.research.verified,true);assert.equal(factual.cache.hit,false);
  const cached=await answer(input.user,{...stats,history:[{role:'user',content:stats.text},{role:'assistant',content:factual.reply}]});
  assert.equal(cached.cache.hit,true);assert.equal(search,1);assert.equal(model,3);
  await answer(input.user,{...stats,text:'Refresh MS Dhoni total runs'});assert.equal(search,2);assert.equal(model,4);
  await db.cacheReply('expiry','expired',{reply:'Stale'},new Date(Date.now()-1000).toISOString());assert.equal(await db.cachedReply('expiry','expired'),undefined);
  for(let n=0;n<55;n++)await db.cacheReply('bounded','key'+n,{reply:'Fixture'},new Date(Date.now()+10000).toISOString());
  assert.equal(await db.cachedReply('bounded','key0'),undefined);assert((await db.cachedReply('bounded','key54')).result.reply);
  assert.equal(await db.cachedReply('other','key54'),undefined);
 }finally{global.fetch=fetcher;process.chdir(cwd);if(key===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=key;if(!path.resolve(folder).startsWith(path.join(path.resolve(os.tmpdir()),'mivvy-cache-')))throw Error('Unexpected cleanup path');await fs.rm(folder,{recursive:true,force:true})}
});
