import * as database from './db.mjs';
import {answer as normalAnswer} from './assistant.mjs';
import {ownerLaptopChat} from './laptop-chat.mjs';
import {needsLiveResearch} from './live-research.mjs';
import {actionShaped,routeUnfamiliarOwnerRequest} from './agent-routing.mjs';
import {connectionIntent} from './connected-assistant.mjs';
import {personalToolRequest} from './personal-tools.mjs';
import {canAccessLaptop} from './security.mjs';
export async function resolveAssistantTurn(user,input,{db=database,desktop=ownerLaptopChat,classify=routeUnfamiliarOwnerRequest,answer=normalAnswer}={}){
 const {text,conversation,signal}=input;
 if(connectionIntent(text)||personalToolRequest(text))return answer(user,input);
 const factual=needsLiveResearch(text);
 if(factual&&!actionShaped(text))return answer(user,input);
 const direct=await desktop(user,input);if(direct)return direct;
 if(canAccessLaptop(user)){
  const history=await db.messages(user.id,conversation);
  if(personalToolRequest(text,history))return answer(user,{...input,history});
  let route;
  try{route=await classify(user,{...input,history})}
  catch(error){signal?.throwIfAborted();return {reply:'I couldn’t prepare that task just now. No computer action was started. Please try again.',emotion:'focused',actions:[]}}
  if(route?.route==='desktop')return desktop(user,input,{goalRouted:true});
  if(route?.route==='research')return answer(user,{...input,search:true,history});
  if(route&&['chat','clarify'].includes(route.route))return {...route,applied:[],sources:[]};
 }
 return answer(user,input);
}
