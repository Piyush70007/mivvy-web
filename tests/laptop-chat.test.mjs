process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {explicitLaptopCommand,displayNumber,switchSharedDisplay,ownerLaptopChat} from '../lib/laptop-chat.mjs';
const owner={id:'owner-id',owner:true,email:'owner@example.com'};
const online={kind:'device',data:{lastSeen:Date.now(),commands:true,displays:2}};
test('explicit owner commands do not require an open live view',()=>{
 for(const text of ['play arijit song on chrome','open ChatGPT','Can you open chatgpt app','Chrome बंद करो','open chrome and play Kesariya','Switch my display to screen 2'])assert.equal(explicitLaptopCommand(text),true,text);
 for(const text of ['What is ChatGPT?','Explain how to open chrome','Say "open chrome"','Do not open Chrome','notepad mat kholo','create a reminder to open chrome','write me a poem','sing a song','tell me about my laptop'])assert.equal(explicitLaptopCommand(text),false,text);
});
test('display selection parses the requested number without changing OS layout',()=>{
 for(const [text,n] of [['Can you switch my display to screen 2',2],['Switch to screen 1',1],['show screen two',2],['screen 2 dikhao',2]])assert.equal(displayNumber(text),n,text);
 for(const text of ['do not switch to screen 2','explain screen 2','switch to screen 2 and send email','say "show screen 2"'])assert.equal(displayNumber(text),null,text);
});
test('switch updates only the owner live stream and checks available displays',async()=>{
 const updates=[],db={getStream:async()=>({id:'live-id',data:{kind:'screen',status:'ready'}}),documents:async()=>[online],updateStream:async(...args)=>{updates.push(args);return {id:'live-id'}}};
 const result=await switchSharedDisplay(owner,'Switch to screen 2',{db});assert.equal(result.monitor,2);
 assert.deepEqual(updates,[['owner-id','live-id',{kind:'screen',monitor:2},true]]);
 await assert.rejects(switchSharedDisplay(owner,'Switch to screen 3',{db}),/reports 2/);
 await assert.rejects(switchSharedDisplay({...owner,owner:false},'Switch to screen 2',{db}),/Owner access/);
 await assert.rejects(switchSharedDisplay(owner,'Switch to screen 1',{db:{getStream:async()=>null}}),/Open live screen/);
});
test('ordinary chat and another account never queue a laptop job',async()=>{
 const db=new Proxy({}, {get(){throw Error('Database must not be accessed')}});
 assert.equal(await ownerLaptopChat({...owner,owner:false},{text:'Open ChatGPT'},{db}),null);
 assert.equal(await ownerLaptopChat(owner,{text:'What is ChatGPT?'},{db}),null);
});
test('chat fallback returns the same actual desktop receipts without duplicates',async()=>{
 let queues=0,cancels=0;
 const db={documents:async()=>[online],limit:async()=>true,newJob:async()=>{queues++;return {id:'command-id'}},getJob:async()=>({status:'done',result:{reply:'Opened ChatGPT.',message_id:'remote-assistant-command-id'}}),cancelJob:async()=>{cancels++}};
 const result=await ownerLaptopChat(owner,{text:'Open ChatGPT',identity:'jarvis',conversation:'ios-own'},{db});
 assert.equal(queues,1);assert.equal(cancels,0);assert.equal(result.messages[1].id,'remote-assistant-command-id');
 assert.equal(result.messages[0].conversation,'ios-own');assert.equal(result.reply,'Opened ChatGPT.');
});
test('timeout and cancellation stop the one job without resubmitting',async()=>{
 let queued=0,cancelled=0,clock=0;
 const db={documents:async()=>[online],limit:async()=>true,newJob:async()=>{queued++;return {id:'job'}},getJob:async()=>({status:'working'}),cancelJob:async()=>{cancelled++}};
 await assert.rejects(ownerLaptopChat(owner,{text:'Open ChatGPT'},{db,now:()=>clock,sleep:async()=>{clock+=1000},timeout:2000}),/took too long/);
 assert.equal(queued,1);assert.equal(cancelled,1);
 const signal=new AbortController();signal.abort();
 await assert.rejects(ownerLaptopChat(owner,{text:'Open ChatGPT',signal:signal.signal},{db,now:()=>0}));
 assert.equal(queued,1);assert.equal(cancelled,1);
});
test('completed display receipts are persisted once and never claimed by Windows',async()=>{
 const previous=process.cwd(),folder=await fs.mkdtemp(path.join(os.tmpdir(),'mivvy-display-job-'));
 try{
  process.chdir(folder);const db=await import('../lib/db.mjs');
  const job=await db.completedCommand('owner-id',{request:'switch screen 2'},{reply:'Selected screen 2'},'test-display-id');
  const again=await db.completedCommand('owner-id',{request:'switch screen 2'},{reply:'Duplicate'},'test-display-id');
  assert.equal(again.result.reply,'Selected screen 2');assert.equal(job.result.message_id,'remote-assistant-test-display-id');
  assert.equal((await db.getJob('owner-id',job.id)).status,'done');assert.equal(await db.claimJob(),undefined);
  await assert.rejects(db.completedCommand('another-user',{}, {reply:'No access'},job.id),/unavailable/);
 }finally{process.chdir(previous);await fs.rm(folder,{recursive:true,force:true})}
});
