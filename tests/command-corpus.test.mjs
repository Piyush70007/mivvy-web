process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {explicitLaptopCommand,displayNumber,ownerLaptopChat,switchSharedDisplay} from '../lib/laptop-chat.mjs';
import {personalToolRequest,savePersonalTools} from '../lib/personal-tools.mjs';
import {connectedAnswer,connectionIntent} from '../lib/connected-assistant.mjs';
import {mutationAllowed} from '../lib/tool-intent.mjs';
const cases=JSON.parse(fs.readFileSync(new URL('./fixtures/jarvis-200.json',import.meta.url),'utf8')).commands;
const owner={id:'owner-fixture',owner:true,email:'owner@example.com'},online={kind:'device',data:{lastSeen:Date.now(),commands:true,displays:2}};
assert.equal(cases.length,200);assert.equal(new Set(cases.map(c=>c.text)).size,200);
for(const c of cases)test(`${c.id} ${c.text}`,async()=>{
 if(c.ios==='laptop'){
  assert.equal(explicitLaptopCommand(c.text),true);
  let queued=0;const db={documents:async()=>[online],limit:async()=>true,newJob:async()=>{queued++;return {id:'fixture-'+c.id}},getJob:async()=>({status:'done',result:{reply:'Fixture confirmed.',message_id:'receipt-'+c.id}}),cancelJob:async()=>assert.fail('Completed job was cancelled')};
  const result=await ownerLaptopChat(owner,{text:c.text,identity:'andrea',conversation:'ios-'+c.id},{db});
  assert.equal(queued,1);assert.equal(result.messages[1].id,'receipt-'+c.id);
  assert.equal(await ownerLaptopChat({...owner,owner:false},{text:c.text},{db}),null);
 }else if(c.kind==='personal'){
  assert.equal(explicitLaptopCommand(c.text),false);assert.equal(personalToolRequest(c.text),true);
  const data={...c.data};delete data.relativeMinutes;delete data.relativeDay;
  if(c.data.relativeMinutes||c.data.relativeDay)data.at=new Date(Date.now()+(c.data.relativeMinutes||1440)*60000).toISOString();
  if(['expense','budget'].includes(c.entry))Object.assign(data,{category:'QA',month:new Date().toISOString().slice(0,7)});
  const writes=[];const result=await savePersonalTools(owner,c.text,[],{planner:async()=>({actions:[{kind:c.entry,data}],question:''}),putDoc:async(user,kind,saved)=>{writes.push({user,kind,data:saved});return {id:'saved-'+c.id,kind,data:saved}}});
  assert.equal(writes.length,1);assert.equal(writes[0].kind,c.entry);assert.equal(result.applied[0].id,'saved-'+c.id);
  if(c.data.amount!==undefined)assert.equal(writes[0].data.amount,c.data.amount);
 }else if(c.kind==='connected'){
  assert.equal(explicitLaptopCommand(c.text),false);const intent=connectionIntent(c.text);assert(intent);
  let reads=0,sends=0;
  const result=await connectedAnswer(owner,{text:c.text,history:[],identity:'andrea'},{status:async()=>({gmail:{connected:true},slack:{connected:true}}),complete:async()=>({reply:'QA fixture content',emotion:'focused',actions:[]}),search:async()=>{reads++;return [{subject:'QA fixture',url:'https://mail.google.com/mail/u/0/#inbox/fixture',snippet:'Fixture only'}]},send:async()=>{sends++;return {sent:true,team:'QA workspace'}}});
  assert(result.reply);assert.equal(reads,intent.gmail?1:0);assert.equal(sends,intent.slack?1:0);
 }else if(c.kind==='display'){
  assert.equal(displayNumber(c.text),c.monitor);let changes=0;
  const db={getStream:async()=>({id:'same-live-session',data:{status:'ready'}}),documents:async()=>[online],updateStream:async(user,id,patch)=>{changes++;assert.equal(id,'same-live-session');assert.equal(patch.monitor,c.monitor);return {id}}};
  const result=await switchSharedDisplay(owner,c.text,{db});assert.equal(result.monitor,c.monitor);assert.equal(changes,1);
 }else{
  assert.equal(explicitLaptopCommand(c.text),false);
 }
});
test('negated saves and quoted teaching do not acquire personal-tool permission',()=>{
 for(const text of ["Do not add milk to my tasks","Please don't save that reminder","never record that expense"]){assert.equal(mutationAllowed(text),false);assert.equal(personalToolRequest(text),false)}
});
