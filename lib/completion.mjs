// Keep malformed/truncated model output away from the tool executor.
export function parseCompletion(raw){
 const choice=raw?.choices?.[0],content=choice?.message?.content;
 if(choice?.finish_reason!=='stop')throw new Error('unfinished');
 if(typeof content!=='string'||!content.trim())throw new Error('empty');
 const cleaned=content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 const output=JSON.parse(cleaned);
 if(!output||typeof output.reply!=='string'||!output.reply.trim()||output.reply.length>10000)throw new Error('invalid reply');
 if(output.actions!==undefined&&!Array.isArray(output.actions))throw new Error('invalid actions');
 return output;
}
export async function completeAssistant(messages,{key,model,signal,fetcher=fetch}={}){
 for(let attempt=0;attempt<2;attempt++){
  signal?.throwIfAborted();
  const response=await fetcher('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000),body:JSON.stringify({model,thinking:{type:'disabled'},messages:attempt?[{role:'system',content:'Return a complete JSON object with a short reply, emotion, and actions array. Keep the reply under 120 words and at most 4 actions. Never truncate a string.'},...messages]:messages,...(!attempt?{response_format:{type:'json_object'}}:{}),max_tokens:attempt?3072:1536,temperature:.6})});
  if(!response.ok)throw new Error('The AI service is temporarily unavailable ('+response.status+').');
  const raw=await response.json();
  try{return parseCompletion(raw)}catch{
   // Some JSON-mode responses are replaced entirely by spaces by the provider.
   // The second request omits that mode. A complete plain-text answer is usable,
   // but may NEVER contain executable tool actions.
   const choice=raw?.choices?.[0],text=choice?.message?.content?.trim();
   if(attempt&&choice?.finish_reason==='stop'&&text&&text.length<=10000&&!/^[{\[`]/.test(text))return {reply:text,emotion:'neutral',actions:[],plainFallback:true};
   console.warn('Assistant completion retry',{attempt:attempt+1,finish:raw?.choices?.[0]?.finish_reason||'missing',characters:raw?.choices?.[0]?.message?.content?.length||0});
  }
 }
 throw new Error('I couldn’t finish that reply. Please send your message again.');
}
