import {test} from 'node:test';
import assert from 'node:assert/strict';
import {needsLiveResearch,searchEvidence,researchAnswer,publicResearchURL} from '../lib/live-research.mjs';
import {speechDelivery} from '../lib/performance.mjs';
const sources=[{title:'Cricket statistics',url:'https://www.icc-cricket.com/players/example',summary:'Fixture international runs: 17266',content:'Fixture ODI runs 10773, Test runs 4876, T20I runs 1617. IPL is separate.',date:'2026-01-01'}];
test('web and phone automatically research sports totals, current facts, Hindi and follow-ups',()=>{
 for(const text of ['Tell me total scores of MS Dhoni','MS Dhoni career runs','Dhoni ne kitne run banaye','धोनी के कुल रन कितने हैं','Who won the match today?','Weather in Berlin tomorrow','Latest NVIDIA news','What is the current EUR INR exchange rate?','How many goals has Messi scored?','Research AI jobs in Germany','Show Ruturaj career statistics','How many runs has Smriti Mandhana scored?','Who is the current CEO of Microsoft?'])assert.equal(needsLiveResearch(text),true,text);
 assert(needsLiveResearch('What about ODIs?',[{role:'user',content:'MS Dhoni total runs'}]));
});
test('ordinary chat, personal account questions and browser/media commands are not silently searched',()=>{
 for(const text of ['Hello Andrea','Tell me a joke','What is two plus two?','Read my Gmail','What is on my laptop screen?','Add a reminder for Dhoni match','Open Chrome','Play Arijit song','Search YouTube for lofi','Search Arijit song and play it on Chrome','Translate latest news to Hindi','Remember my favorite team is India'])assert.equal(needsLiveResearch(text),false,text);
});
test('search retrieves source text with the existing key and rejects unusable/private link results',async()=>{
 let sent;const result=await searchEvidence('MS Dhoni total runs',{key:'fixture',fetcher:async(url,options)=>{
  sent={url,...JSON.parse(options.body)};
  return {ok:true,json:async()=>({results:[...sources,{url:'http://127.0.0.1/private',content:'secret'},sources[0],{url:'https://empty.example',title:'No body'}]})};
 }});
 assert.equal(sent.need_content,true);assert.equal(sent.count,5);assert(sent.query.length<=128);assert.equal(result.results.length,1);assert.equal(result.results[0].content,sources[0].content);
 for(const url of ['file:///C:/private','javascript:alert(1)','https://user:pass@example.com','https://localhost/','http://192.168.1.1/','https://example.com:8080/'])assert.equal(publicResearchURL(url),null);
});
test('actual evidence reaches the model, sources persist in text, and model-proposed mutations are discarded',async()=>{
 let messages;const result=await researchAnswer('Tell me total scores of MS Dhoni',[],'andrea',{search:async()=>({results:sources,sources:sources.map(({title,url})=>({title,url})),checkedAt:'2026-11-17T00:00:00Z'}),complete:async input=>{messages=input;return {reply:'International runs: 17,266 [1]. IPL is separate.',actions:[{kind:'task',data:{title:'Unrequested'}}]}}});
 assert.match(messages[0].content,/untrusted/);assert.match(messages.at(-1).content,/17266/);assert.match(result.reply,/Sources:/);assert.match(result.reply,/icc-cricket/);assert.deepEqual(result.actions,[]);assert.equal(result.research.verified,true);
});
test('empty results and provider failure report an actual failed lookup instead of inventing numbers',async()=>{
 let model=0;
 const empty=await researchAnswer('MS Dhoni stats',[],'jarvis',{search:async()=>({results:[],sources:[]}),complete:async()=>{model++}});
 assert.equal(empty.research.verified,false);assert.match(empty.reply,/searched/);
 const failed=await researchAnswer('MS Dhoni stats',[],'jarvis',{search:async()=>{throw Error('HTTP 503')},complete:async()=>{model++}});
 assert.match(failed.reply,/could not reach web research/i);assert.equal(model,0);
});
test('cancelled research cannot become a late spoken answer',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(researchAnswer('MS Dhoni runs',[],'andrea',{signal:controller.signal,search:async()=>{throw Error('network cancelled')}}));
});
test('sources remain in chat but are not read as long URLs by any voice',()=>{
 const text='International runs: 17,266 [1].\n\nSources:\n[1] Example — https://www.example.com/very/long/url';
 const spoken=speechDelivery(text,{emotion:'focused'});
 assert.match(spoken,/17,266/);assert.doesNotMatch(spoken,/Sources:|https:|\[1\]/);
 assert.match(spoken,/confident/);
});
test('a short sports follow-up retains the player in its actual search query',async()=>{
 let query;
 await researchAnswer('What about ODIs?',[{role:'user',content:'Tell me total scores of MS Dhoni'}],'andrea',{
  search:async text=>{query=text;return {results:sources,sources:sources.map(({title,url})=>({title,url})),checkedAt:'now'}},
  complete:async()=>({reply:'ODI career runs from the supplied source [1].'})});
 assert.match(query,/Dhoni/);assert.match(query,/ODIs/);
});
