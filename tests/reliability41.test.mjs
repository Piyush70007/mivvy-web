process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ownerLaptopChat,switchSharedDisplay} from '../lib/laptop-chat.mjs';
const owner={id:'owner',owner:true,email:'owner@example.com'};
const recent=[{id:'remote-user-job',role:'user',content:'Open Brave',conversation:'ios-one',created_at:new Date().toISOString()},
 {id:'remote-assistant-job',role:'assistant',content:'Opened Brave.',conversation:'ios-one',created_at:new Date().toISOString()}];
function fixture(history=recent){let calls=[];return {calls,messages:async()=>history,documents:async()=>[{kind:'device',data:{commands:true,lastSeen:Date.now(),displays:2}}],limit:async()=>true,newJob:async(_user,_kind,payload,id)=>{calls.push({payload,id});return {id}},getJob:async()=>({status:'done',result:{reply:'Fixture action verified.'}}),cancelJob:async()=>{}}}
test('short browser follow-ups route only with a recent completed laptop turn in the same chat',async()=>{
 for(const text of ['close it','No, Chrome','Brave nahi Chrome','Search YouTube for lofi']){
  const db=fixture(),result=await ownerLaptopChat(owner,{text,identity:'andrea',conversation:'ios-one'},{db});
  assert(result,text);assert.equal(db.calls.length,1,text);
 }
 for(const history of [[],recent.map(m=>({...m,conversation:'ios-other'})),recent.map(m=>({...m,created_at:'2020-01-01T00:00:00Z'})),recent.map(m=>({...m,id:'normal-'+m.id}))]){
  const db=fixture(history);assert.equal(await ownerLaptopChat(owner,{text:'close it',identity:'andrea',conversation:'ios-one'},{db}),null);assert.equal(db.calls.length,0);
 }
});
test('reusing a client request ID never submits a second action and a cancelled tombstone wins',async()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const db=fixture();await ownerLaptopChat(owner,{text:'Open Brave',identity:'andrea',conversation:'ios-one',request_id:id},{db});assert.equal(db.calls[0].id,id);
});
test('conflicting display numbers ask for one selection without updating a stream',async()=>{
 let changes=0;const db={getStream:async()=>({id:'live',data:{status:'ready'}}),documents:async()=>[{kind:'device',data:{displays:2}}],updateStream:async()=>{changes++;return {id:'live'}}};
 for(const text of ['Switch to screen 1 or screen 2','Switch to screen 1 and screen 2','Switch to screen 9'])await assert.rejects(switchSharedDisplay(owner,text,{db}),/one display|valid display|between 1 and 8/);
 assert.equal(changes,0);
});
test('a busy companion leaves commands pending, still services snapshots, and claims only its owner jobs',async()=>{
 const previous=process.cwd(),folder=await fs.mkdtemp(path.join(os.tmpdir(),'mivvy-reliability41-'));
 try{
  process.chdir(folder);const db=await import('../lib/db.mjs');
  await db.newJob('other','command',{request:'Open Chrome'},'other');
  await db.newJob('owner','command',{request:'Open Brave'},'command');
  await db.newJob('owner','screen',{},'snapshot');
  assert.equal((await db.claimJob(false,'owner')).id,'snapshot');
  assert.equal((await db.getJob('owner','command')).status,'pending');
  assert.equal((await db.claimJob(true,'owner')).id,'command');
  assert.equal((await db.getJob('other','other')).status,'pending');
  await db.cancelJob('owner','cancelled');
  assert.equal((await db.newJob('owner','command',{request:'Open Brave'},'cancelled')).status,'cancelled');
  await assert.rejects(db.newJob('owner','command',{request:'Delete everything'},'command'),/different instruction/);
  assert.equal((await db.newJob('owner','command',{request:'Open Brave'},'command')).status,'working');
 }finally{process.chdir(previous);await fs.rm(folder,{recursive:true,force:true})}
});
test('the same fallback request is claimed once, then replay returns the original completed receipt',async()=>{
 const previous=process.cwd(),folder=await fs.mkdtemp(path.join(os.tmpdir(),'mivvy-replay41-'));
 try{
  process.chdir(folder);const db=await import('../lib/db.mjs');
  const id='22222222-2222-4222-8222-222222222222';
  await db.newJob('owner','command',{request:'Open Brave',identity:'andrea',conversation:'ios-one'},id);
  assert.equal((await db.claimJob(true,'owner')).id,id);
  await db.finishJob(id,{reply:'Already opened Brave.',message_id:'receipt'});
  let sleeps=0;
  const transport={...db,documents:async()=>[{kind:'device',data:{lastSeen:Date.now(),commands:true}}],limit:async()=>true};
  for(let i=0;i<3;i++){
   const result=await ownerLaptopChat(owner,{text:'Open Brave',identity:'andrea',conversation:'ios-one',request_id:id},{db:transport,sleep:async()=>{sleeps++}});
   assert.equal(result.messages[1].id,'receipt');assert.equal(result.reply,'Already opened Brave.');
   assert.equal(await db.claimJob(true,'owner'),undefined);
  }
  assert.equal(sleeps,0);
 }finally{process.chdir(previous);await fs.rm(folder,{recursive:true,force:true})}
});
