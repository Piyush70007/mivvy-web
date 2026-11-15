import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'andrea-test-'));process.chdir(dir);process.env.NODE_ENV='test';delete process.env.DATABASE_URL;
const db=await import('../lib/db.mjs');
test('accounts cannot read, overwrite or delete each other’s state or conversations',async()=>{const a=await db.createUser('a@example.com','hash'),b=await db.createUser('b@example.com','hash');await db.putDoc(a.id,'note',{title:'Private'},'same-id');await db.putDoc(b.id,'note',{title:'Other'},'same-id');assert.equal((await db.documents(a.id))[0].data.title,'Private');await db.deleteDoc(b.id,'same-id');assert.equal((await db.documents(a.id)).length,1);await db.addMessage(a.id,'main','user','Private conversation','andrea');assert.equal((await db.messages(b.id,'main')).length,0);const j=await db.newJob(a.id,'screen');assert.equal(await db.getJob(b.id,j.id),undefined);assert.equal((await db.getJob(a.id,j.id)).kind,'screen')});
test('jobs claimed once and request budgets enforced',async()=>{const one=await db.claimJob(),two=await db.claimJob();assert(one);assert.equal(two,undefined);assert.equal(await db.limit('test',1,60),true);assert.equal(await db.limit('test',1,60),false)});
test('remote command payload is account isolated and claimed only once',async()=>{const a=await db.userByEmail('a@example.com'),b=await db.userByEmail('b@example.com');const job=await db.newJob(a.id,'command',{request:'Read the selected chart',identity:'jarvis'});assert.equal(await db.getJob(b.id,job.id),undefined);const claimed=await db.claimJob();assert.equal(claimed.payload.request,'Read the selected chart');assert.equal(claimed.status,'working');assert.equal(await db.claimJob(),undefined);await db.finishJob(job.id,{reply:'Observed chart result'});assert.equal((await db.getJob(a.id,job.id)).result.reply,'Observed chart result')});
test('live sessions are account scoped, replace older peers and stop by exact generation',async()=>{
 const a=await db.userByEmail('a@example.com'),b=await db.userByEmail('b@example.com');
 const first=await db.startStream(a.id,{kind:'screen',status:'pending',offer:{sdp:'private offer'}});assert.equal(await db.getStream(b.id,first.id),undefined);assert.equal(await db.updateStream(b.id,first.id,{status:'ready'}),null);
 const second=await db.startStream(a.id,{kind:'camera',status:'pending'});assert.equal(await db.getStream(a.id,first.id),undefined);await db.stopStream(a.id,first.id);assert.equal((await db.getStream(a.id,second.id)).data.kind,'camera');
 await db.stopStream(b.id,second.id);assert(await db.getStream(a.id,second.id));await db.stopStream(a.id,second.id);assert.equal(await db.getStream(a.id,second.id),undefined);
});
test('cancel arriving before a remote command prevents a late ghost action',async()=>{
 const a=await db.userByEmail('a@example.com');const id='11111111-1111-4111-8111-111111111111';await db.cancelJob(a.id,id);const late=await db.newJob(a.id,'command',{request:'Open something'},id);assert.equal(late.status,'cancelled');assert.equal(await db.claimJob(),undefined);
});
test.after(async()=>{process.chdir(os.tmpdir());await fs.rm(dir,{recursive:true,force:true})});
