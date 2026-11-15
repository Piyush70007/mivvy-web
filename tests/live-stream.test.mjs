process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireOwner,streamOffer,streamAnswer,iceConfiguration,streamIntent} from '../lib/live-stream.mjs';
const owner={owner:true,email:'owner@example.com'};
const offer={type:'offer',sdp:'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\n'};
test('live video is owner-only and accepts video receive-only offers',()=>{
 requireOwner(owner);for(const user of [null,{owner:false,email:owner.email},{owner:true,email:'other@example.com'}])assert.throws(()=>requireOwner(user),/Owner access/);
 assert.equal(streamOffer({kind:'screen',offer}).monitor,1);
 for(const sdp of [offer.sdp.replace('recvonly','sendrecv'),offer.sdp+'m=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=recvonly\r\n'])assert.throws(()=>streamOffer({kind:'camera',offer:{type:'offer',sdp}}),/receive-only/);
 assert.throws(()=>streamOffer({kind:'camera',offer,monitor:0}),/valid laptop display/);
});
test('signaling is bounded and never accepts media frames as an answer',()=>{
 assert.equal(streamAnswer({answer:{type:'answer',sdp:'v=0\r\n'}}).status,'ready');
 assert.throws(()=>streamAnswer({answer:{type:'answer',sdp:'x'.repeat(100001)}}));
 assert.equal(streamAnswer({error:'Camera unavailable'}).status,'failed');
 const saved=process.env.MIVVY_ICE_SERVERS_JSON;delete process.env.MIVVY_ICE_SERVERS_JSON;
 try{assert.equal(iceConfiguration().relayConfigured,false);process.env.MIVVY_ICE_SERVERS_JSON=JSON.stringify([{urls:'turns:relay.example:443',username:'temporary',credential:'temporary'}]);assert.equal(iceConfiguration().relayConfigured,true)}finally{if(saved===undefined)delete process.env.MIVVY_ICE_SERVERS_JSON;else process.env.MIVVY_ICE_SERVERS_JSON=saved}
});
test('screen/camera control remains distinct from a desktop command',()=>{
 assert.equal(streamIntent('Show my laptop screen'),'screen');assert.equal(streamIntent('Open my laptop camera'),'camera');assert.equal(streamIntent('Stop sharing'),'stop');assert.equal(streamIntent('Open GPT and type this in my project'),null);
});
