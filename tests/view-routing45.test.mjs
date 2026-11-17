import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitLaptopCommand} from '../lib/laptop-chat.mjs';
import {actionShaped,routeUnfamiliarOwnerRequest} from '../lib/agent-routing.mjs';

test('routine view operations route to the paired executor without research',()=>{
 for(const text of ['scroll down','scroll up 2 pages','zoom out','zoom in','reset browser zoom','नीचे करो','ज़ूम आउट करो']){
  assert.equal(explicitLaptopCommand(text),true,text);
 }
 for(const text of ['Do not zoom out','Why zoom out?','Say "scroll down"'])assert.equal(explicitLaptopCommand(text),false,text);
});
test('unfamiliar view instructions expose actual capabilities to the owner router',async()=>{
 assert.equal(actionShaped('Zoom out so you can inspect the whole layout'),true);
 let prompt='';
 const old=process.env.OWNER_EMAIL;process.env.OWNER_EMAIL='owner@example.test';
 let result;
 try{result=await routeUnfamiliarOwnerRequest({id:'owner',owner:true,email:'owner@example.test'},{text:'Zoom out so you can inspect the whole layout'},{complete:async messages=>{prompt=messages[0].content;return {route:'desktop',reply:'',emotion:'focused'}}});}
 finally{if(old===undefined)delete process.env.OWNER_EMAIL;else process.env.OWNER_EMAIL=old;}
 assert.equal(result.route,'desktop');assert.match(prompt,/scrolling, native browser zoom/);assert.match(prompt,/never ask whether you may look/i);
});
