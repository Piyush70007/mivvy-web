process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeUnfamiliarOwnerRequest,actionShaped} from '../lib/agent-routing.mjs';
import {resolveAssistantTurn} from '../lib/chat-routing.mjs';
import {shouldResearch} from '../lib/live-research.mjs';
const owner={id:'owner',owner:true,email:'owner@example.com'};
const history=[{id:'remote-assistant-one',role:'assistant',content:'Opened the Discord server FURY.',conversation:'phone'}];
test('the actual failed phone phrases are not forced into web search',()=>{
 for(const text of ['Connect to fury voice channel on discord','Connect voice channel on it','Claude js olen','You closed all the chrome'])assert.equal(shouldResearch(text,history,true),false,text);
 assert(actionShaped('Could you get the current chart onto my other monitor?'));
 assert(shouldResearch('What is the current exchange rate?',[],false));
});
test('novel wording reaches model capability reasoning with verified context, not an exact command list',async()=>{
 let messages,options;
 const result=await routeUnfamiliarOwnerRequest(owner,{text:'Hop into the voice room on that server',history},{complete:async(m,o)=>{messages=m;options=o;return {reply:'Working on it.',route:'desktop',emotion:'focused',actions:[{kind:'unrequested'}]}}});
 assert.equal(result.route,'desktop');assert.deepEqual(result.actions,[]);
 assert.match(messages[0].content,/do NOT need a prewritten command/);assert.match(messages[1].content,/FURY/);assert.match(messages[1].content,/verifiedLaptopReceipt/);assert(options.maxTokens<=650);
});
test('new goals from phone chat execute through the desktop path even with search enabled',async()=>{
 let calls=0,normal=0;const text='Connect voice channel on it';
 const result=await resolveAssistantTurn(owner,{text,search:true,conversation:'phone'},
  {db:{messages:async()=>history},desktop:async(_user,input,options)=>{calls++;assert.equal(input.text,text);return options?.goalRouted?{reply:'Verified fixture connection.',remoteJob:'one'}:null},classify:async()=>({route:'desktop'}),answer:async()=>{normal++;throw Error('Must not research a task')}});
 assert.equal(result.remoteJob,'one');assert.equal(calls,2);assert.equal(normal,0);
});
test('ambiguous speech is clarified without web search or a guessed computer action',async()=>{
 let normal=0,queued=0;const result=await resolveAssistantTurn(owner,{text:'Claude js olen',search:true,conversation:'phone'},
  {db:{messages:async()=>history},desktop:async(_u,_i,options)=>{if(options?.goalRouted)queued++;return null},classify:async()=>({route:'clarify',reply:'Did you mean Claude is open?',emotion:'curious'}),answer:async()=>{normal++}});
 assert.match(result.reply,/Claude/);assert.equal(queued,0);assert.equal(normal,0);assert.deepEqual(result.sources,[]);
});
test('new goal routing cannot grant another account laptop access',async()=>{
 let model=0;
 assert.equal(await routeUnfamiliarOwnerRequest({...owner,owner:false},{text:'Do something novel on my PC'},{complete:async()=>{model++}}),null);
 assert.equal(model,0);
});
test('greetings keep the existing cached one-answer path and classifier outages never become web actions',async()=>{
 let model=0;assert.equal(await routeUnfamiliarOwnerRequest(owner,{text:'How are you?'},{complete:async()=>{model++}}),null);assert.equal(model,0);
 const result=await resolveAssistantTurn(owner,{text:'Get the thing ready on my laptop',search:true,conversation:'phone'},
  {db:{messages:async()=>history},desktop:async()=>null,classify:async()=>{throw Error('503')},answer:async()=>{throw Error('Must not fall into search')}});
 assert.match(result.reply,/No computer action was started/);
});
