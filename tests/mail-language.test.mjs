import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectionIntent,connectedAnswer} from '../lib/connected-assistant.mjs';
const corpus=JSON.parse(fs.readFileSync(new URL('./fixtures/connected-mail-language.json',import.meta.url),'utf8'));
test('natural mail requests and incidental punctuation use the Gmail read tool',()=>{for(const text of corpus.read)assert.equal(connectionIntent(text)?.gmail,true,text);for(const text of corpus.ignore)assert.equal(connectionIntent(text),null,text)});
test('the exact failed EXE request reaches job-email search and cannot send Slack',async()=>{
 let searched=0,sent=0;const result=await connectedAnswer({id:'fixture'},{text:'tell m,e recent job emails i got'},{status:async()=>({gmail:{connected:true},slack:{connected:true}}),search:async(_u,query)=>{searched++;assert.match(query,/interview/);return[{subject:'Job application',snippet:'We received your application.',url:'https://mail.google.com/'}]},complete:async()=>({reply:'One recent application email was found.'}),send:async()=>{sent++}});
 assert.equal(searched,1);assert.equal(sent,0);assert.match(result.reply,/application email/);
});
