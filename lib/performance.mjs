export function singingRequest(text=''){
 text=text.replace(/^\s*(?:hey\s+)?(?:andrea|jarvis|ultron)[,\s]+/i,'').replace(/\b(arijit|jagjit|honey)\s+sing\b/gi,'$1 Singh');
 const direct=/^\s*(?:(?:please|can you|could you|would you)\s+)*(?:sing|hum)\b|\b(?:gao|gaao|gungunao)\b|गाओ|गाऊन/i.test(text);
 if(!direct&&/\b(?:play|search|find|open|youtube|listen|lagao|chalao|bajao|lagos)\b|यूट्यूब|बजाओ|चलाओ|लगाओ/i.test(text))return false;
 if(/\b(?:don['’]?t|do not|stop|never)\s+(?:sing|hum)\b/i.test(text))return false;
 if(/\b(?:how|why)\b.{0,20}\bsing/i.test(text))return false;
 return /\b(?:sing|hum|gao|gaao|gungunao)\b|गाना\s*(?:गाओ|गा)|गाऊन|गाणं\s*गा/i.test(text);
}
export const singingPolicy="The user requested a short sung performance. Return only lyrics in reply, no spoken introduction or closing commentary. Default to two short ORIGINAL lyrical lines, at most 60 words. If asked for one line, return one line. For a named copyrighted song quote no more than ten words or give a clearly original alternative. User-supplied lyrics may be performed. Use the requested mood and language. The voice service will sing the text; do not claim you cannot produce audio. actions must be empty.";
export const exactSongNotice="Exact-song singing isn’t connected yet. Fish can sing an original melody, but it cannot reproduce that recording’s tune and rhythm. I can play the real song if you ask; I won’t invent lyrics and call them the original.";
export function namedSongRequest(text,history=[]){
 if(!singingRequest(text)){
  if(/^(?:no\b.*(?:song|line|tune)|again\b|repeat\b|one more\b)/i.test(text.trim()))return namedSongRequest(history.findLast(m=>m.role==='user')?.content||'');
  return false;
 }
 if(/\b(?:original|invent|make up|improvise|something|anything|your own)\b|\bthis (?:line|lyric|text)\b/i.test(text))return false;
 if(/\b(?:called|named|by|from|cover|actual|exact|same tune|same melody)\b/i.test(text))return true;
 const tail=text.split(/\b(?:sing|hum)\b/i).at(-1).replace(/\b(?:a|an|the|me|for|please|song|line|one|single|short|two|beautiful|melodic|happy|sad|lullaby|tune|melody|your|can|you|of|to)\b/gi,'');
 if(tail.replace(/[^\w]/g,''))return true;
 const prior=history.findLast(m=>m.role==='user')?.content;return Boolean(prior&&namedSongRequest(prior));
}
export function speechDelivery(text,{singing=false,emotion='neutral'}={}){
 const moods={happy:'happy, smiling and delighted',sad:'soft, caring and reassuring',curious:'curious and interested',playful:'playful, amused',focused:'confident and deliberate',neutral:'warm, natural conversational delivery'};
 return singing?'[singing, melodic legato, sustained musical notes, expressive phrasing, gentle vibrato, a cappella, not spoken] '+text:'['+(moods[emotion]||moods.neutral)+'] '+text;
}
export function savedPerformance(messages,id){
 const reply=messages.find(m=>m.id===id&&m.role==='assistant');if(!reply)return null;
 const turns=messages.filter(m=>m.conversation===reply.conversation);const index=turns.findIndex(m=>m.id===id);
 const request=turns.slice(0,index).findLast(m=>m.role==='user');
 return {reply,singing:reply.content!==exactSongNotice&&singingRequest(request?.content||'')};
}
