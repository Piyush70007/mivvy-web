process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {laptopCommand,mobileCapabilities} from '../lib/mobile.mjs';
const owner={owner:true,email:'owner@example.com'},online={data:{lastSeen:Date.now(),commands:true}};
test('remote commands require both owner identity and an updated online companion',()=>{
 for(const user of [{owner:false,email:owner.email},{owner:true,email:'other@example.com'},null])assert.throws(()=>laptopCommand(user,{request:'Open Notepad'},online),/Owner access/);
 assert.throws(()=>laptopCommand(owner,{request:'Open Notepad'},{data:{lastSeen:Date.now()}}),/updated Windows/);
 assert.throws(()=>laptopCommand(owner,{request:'Open Notepad'},{data:{lastSeen:Date.now()-30000,commands:true}}),/updated Windows/);
 assert.deepEqual(laptopCommand(owner,{request:' Open Notepad ',identity:'ultron'},online),{request:'Open Notepad',identity:'ultron'});
 assert.throws(()=>laptopCommand(owner,{request:'sk-'+ 'a'.repeat(30)},online),/credentials/);
});
test('mobile capability response does not promise unconnected calling or Gmail sending',()=>{
 const capability=mobileCapabilities(owner,online);assert.equal(capability.laptop.commands,true);assert.equal(capability.incomingCalls.ready,false);assert.equal(capability.gmail.send,false);
 const other=mobileCapabilities({email:'other@example.com',owner:false},online);assert.equal(other.laptop.online,false);assert.equal(other.laptop.commands,false);
});
test('cloud research uses owner validation without requiring a running desktop',()=>{
 assert.deepEqual(laptopCommand(owner,{request:'MS Dhoni career stats',identity:'jarvis'},null,{requiresDevice:false}),{request:'MS Dhoni career stats',identity:'jarvis'});
 assert.throws(()=>laptopCommand({...owner,owner:false},{request:'MS Dhoni career stats'},null,{requiresDevice:false}),/Owner access/);
 assert.throws(()=>laptopCommand(owner,{request:'Open Brave'},null),/updated Windows/);
});
