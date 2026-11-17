import {test} from 'node:test';import assert from 'node:assert/strict';
import {LaptopTurn} from '../lib/laptop-turn.mjs';
test('interrupt cancels the exact owner request once and stale completion cannot cancel its replacement',()=>{
 const sent=[];let next=0;const turns=new LaptopTurn(id=>sent.push(id),()=>String(++next));
 const first=turns.begin(true);turns.stop();turns.stop();assert.deepEqual(sent,['1']);
 const second=turns.begin(true);turns.complete(first);assert.equal(turns.id,second);turns.stop();assert.deepEqual(sent,['1','2']);
});
test('completed turns and non-owner conversations never issue laptop cancellations',()=>{
 const sent=[];const turns=new LaptopTurn(id=>sent.push(id),()=> 'owner-request');
 assert.equal(turns.begin(false),null);turns.stop();assert.deepEqual(sent,[]);
 const id=turns.begin(true);turns.complete(id);turns.stop();assert.deepEqual(sent,[]);
});
