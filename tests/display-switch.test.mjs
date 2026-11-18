process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displaySelection,explicitLaptopCommand,switchSharedDisplay} from '../lib/laptop-chat.mjs';
import {LiveModeSync} from '../lib/live-mode-sync.mjs';
const owner={id:'owner',owner:true,email:'owner@example.com'};
test('natural numbered and relative screen requests preserve intent',()=>{
 for(const text of ['Show me the other screen','Show me another display','Switch to the next monitor','Show doosra screen','Show me दूसरी स्क्रीन']){
  assert.deepEqual(displaySelection(text),{relative:1},text);assert.equal(explicitLaptopCommand(text),true,text);
 }
 for(const [text,monitor] of [['Show me screen 1',1],['Show me screen 2',2],['Show me the second screen',2],['Show me the first display',1]])assert.deepEqual(displaySelection(text),{monitor},text);
 assert.deepEqual(displaySelection('Show me the previous screen'),{relative:-1});
 for(const text of ['Show screen 1 and also 2','Show screen 1 or screen 2'])assert(displaySelection(text)?.error,text);
 for(const text of ['Do not show me the other screen','Explain the other screen','Show the other screen and delete files'])assert.equal(displaySelection(text),null,text);
});
test('other screen toggles from the actual shared monitor and wraps without changing the peer',async()=>{
 const row={id:'same-session',data:{kind:'screen',monitor:1,status:'ready'}},writes=[];
 const db={getStream:async()=>row,documents:async()=>[{kind:'device',data:{displays:2}}],updateStream:async(user,id,mode)=>{writes.push({user,id,mode});Object.assign(row.data,mode);return row}};
 assert.equal((await switchSharedDisplay(owner,'Show me the other screen',{db})).monitor,2);
 assert.equal((await switchSharedDisplay(owner,'Show me the other screen',{db})).monitor,1);
 assert.equal((await switchSharedDisplay(owner,'Show me the previous screen',{db})).monitor,2);
 assert(writes.every(w=>w.user==='owner'&&w.id==='same-session'));
 await assert.rejects(switchSharedDisplay(owner,'Show me the other screen',{db:{...db,documents:async()=>[{kind:'device',data:{displays:1}}]}}),/only one/);
 await assert.rejects(switchSharedDisplay({...owner,owner:false},'Show me the other screen',{db}),/Owner/);
});
test('a heartbeat started before screen 2 was selected cannot reset it to screen 1',()=>{
 const sync=new LiveModeSync(),heartbeatVersion=sync.version,request=sync.begin('screen',2);
 assert.equal(sync.observe({kind:'screen',monitor:1},heartbeatVersion),false);
 assert.equal(sync.finish(request.version,{kind:'screen',monitor:2}),true);
 assert.equal(sync.observe({kind:'screen',monitor:1},heartbeatVersion),false);
 assert.deepEqual(sync.current,{kind:'screen',monitor:2});
});
test('native acknowledgement echoes do not create another mode request',()=>{
 const sync=new LiveModeSync(),request=sync.begin('screen',2);
 sync.finish(request.version,request.mode);
 assert.equal(sync.begin('screen',2),null);assert.equal(sync.version,1);
});
test('slow earlier selections cannot overwrite the newest request',()=>{
 const sync=new LiveModeSync(),two=sync.begin('screen',2),one=sync.begin('screen',1);
 assert.equal(sync.finish(two.version,two.mode),false);assert.equal(sync.pending,true);
 assert.equal(sync.finish(one.version,one.mode),true);assert.equal(sync.current.monitor,1);
});
test('server-side voice changes are adopted after local writes finish',()=>{
 const sync=new LiveModeSync();assert(sync.observe({kind:'screen',monitor:2},sync.version));
 assert.equal(sync.current.monitor,2);
 const request=sync.begin('camera',2);assert.equal(sync.observe({kind:'screen',monitor:1},sync.version),false);
 sync.fail(request.version);assert(sync.observe({kind:'screen',monitor:1},sync.version));
 assert.deepEqual(sync.current,{kind:'screen',monitor:1});
});
test('an older server selection cannot undo a newer data-channel selection',()=>{
 const sync=new LiveModeSync();assert(sync.observe({kind:'screen',monitor:2,revision:4},0));
 assert.equal(sync.observe({kind:'screen',monitor:1,revision:3},0),false);
 assert.equal(sync.current.monitor,2);
 const request=sync.begin('screen',1);assert(sync.finish(request.version,{kind:'screen',monitor:1,revision:5}));assert.equal(sync.revision,5);
});
