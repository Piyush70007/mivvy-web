export function mergeMessages(previous,incoming){const rows=new Map();for(const message of [...previous,...incoming])rows.set(message.id,message);return [...rows.values()].sort((a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0)).slice(-250)}
export function viewportBox({height,offsetTop=0,scale=1,layoutHeight}){return {height:Math.round(height),top:Math.round(offsetTop),keyboard:scale<1.05&&layoutHeight-height>130}}
export function sameAccount(expected,incoming){return Boolean(expected&&incoming&&expected===incoming)}
