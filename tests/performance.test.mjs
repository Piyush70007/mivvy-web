import {test} from 'node:test';
import assert from 'node:assert/strict';
import {singingRequest,speechDelivery,savedPerformance,namedSongRequest,exactSongNotice} from '../lib/performance.mjs';

test('artist surname transcription does not hijack YouTube playback or search',()=>{
 for(const text of ['YouTube pe gana Lagos arijit sing ka','Play song of arijit sing on browser on youtube','play arijit sing song','Search arijit sing and play the first result you will get','Play a song by Sing','Arijit sing']){
  assert(!singingRequest(text),text);assert(!namedSongRequest(text),text);
 }
 assert(singingRequest('Sing a song by Arijit sing'));
 assert(singingRequest('Can you sing this YouTube song in your voice?'));
});
test('named songs never silently become invented covers',()=>{
 assert(namedSongRequest('Sing the Fate of Ophelia from Taylor Swift'));assert(namedSongRequest('Sing Perfect'));
 assert(!namedSongRequest('Sing two original uplifting lines'));
 const turns=[{id:'q',role:'user',conversation:'a',content:'Sing Perfect'},{id:'r',role:'assistant',conversation:'a',content:exactSongNotice}];assert(!savedPerformance(turns,'r').singing);
});
test('singing is a performance, while play and stop remain ordinary requests',()=>{
 assert(singingRequest('Sing one line for me'));assert(singingRequest('Can you hum a tune?'));
 for(const text of ['Play a song','Stop singing','Do not sing','How do birds sing?'])assert(!singingRequest(text));
 assert.match(speechDelivery('A brighter day.',{singing:true}),/singing, melodic legato/);
 assert.match(speechDelivery('Hello.',{emotion:'happy'}),/smiling and delighted/);
});
test('saved voice replay resolves singing from its own conversation only',()=>{
 const turns=[{id:'q1',role:'user',conversation:'a',content:'Sing a short original song'},{id:'q2',role:'user',conversation:'b',content:'Hello'},{id:'a1',role:'assistant',conversation:'a',content:'A brighter day.'},{id:'a2',role:'assistant',conversation:'b',content:'Hi!'}];
 assert(savedPerformance(turns,'a1').singing);assert(!savedPerformance(turns,'a2').singing);assert.equal(savedPerformance(turns,'absent'),null);
});
