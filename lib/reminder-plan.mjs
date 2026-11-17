import * as chrono from 'chrono-node';
import {requestedTimeZone,zoneOffset,wallTimeToISO} from './time-zones.mjs';
import {multilingualReminder} from './reminder-language.mjs';

const reminderWord=/\bremind(?:er|ers)?\b/i;
const normalize=text=>text.replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(?=[a-z])/gi,'$1 ');
export function timerPlan(text,now=new Date()){
 const value=String(text).toLowerCase().trim().replace(/[.!?]+$/,'');
 const duration=value.match(/^(?:please\s+)?(?:set|start|begin)\s+(?:a\s+)?(?:timer\s+for\s+)?(\d{1,5})\s*(seconds?|minutes?|hours?)(?:\s+(focus|break))?(?:\s+timer)?$/);
 if(!duration)return null;
 const seconds=Number(duration[1])*({second:1,minute:60,hour:3600})[duration[2].replace(/s$/,'')];
 if(!Number.isSafeInteger(seconds)||seconds<1||seconds>86400)return {actions:[],question:'Choose a timer between one second and 24 hours.'};
 return {actions:[{kind:'reminder',data:{title:duration[3]?duration[3][0].toUpperCase()+duration[3].slice(1)+' timer':'Timer',at:new Date(now.getTime()+seconds*1000).toISOString(),timeZone:'Asia/Kolkata'}}],question:''};
}
export function reminderContext(text,history=[]){
 if(!reminderWord.test(text)&&/\b(?:add|create|save|set|put|log|record|remember)\b/i.test(text))return [];
 const recent=history.slice(-10);let start=-1;
 for(let i=recent.length-1;i>=0;i--){if(recent[i].role==='assistant'&&/Saved to /i.test(recent[i].content))break;if(recent[i].role==='user'&&reminderWord.test(recent[i].content)){start=i;break}}
 const reference=/\b(?:this|that|it)\b/i.test(text);
 if(reminderWord.test(text)&&!reference)return [text];
 if(start>=0)return [...recent.slice(start).filter(m=>m.role==='user').map(m=>m.content),text];
 if(reminderWord.test(text)&&reference){const prior=recent.filter(m=>m.role==='user').at(-1);return [...(prior?[prior.content]:[]),text]}
 return [];
}
export function directReminderPlan(text,history=[],now=new Date()){
 if(multilingualReminder([text,...history.map(m=>m.content)].join(' ')))return null;
 const parts=reminderContext(text,history);if(!parts.length)return null;
 // Keep mixed or multiple saves on the batch planner.
 if(/\b(?:daily task|money space|expense|budget)\b/i.test(text)||/\breminders\b|\band (?:also )?remind\b/i.test(text))return null;
 const zone=requestedTimeZone(parts.join(' '));
 const parsed=parts.map(s=>{const source=normalize(s);return {source,results:chrono.parse(source,{instant:now,timezone:zoneOffset(now,zone)},{forwardDate:true})}});
 if(parsed.some(p=>p.results.filter(r=>r.start.isCertain('day')||r.start.isCertain('weekday')).length>1))return null;
 const results=parsed.flatMap(p=>p.results);
 const date=results.filter(r=>r.start.isCertain('day')||r.start.isCertain('weekday')).at(-1);
 const clock=results.filter(r=>r.start.isCertain('hour')).at(-1);
 const question=q=>({actions:[],question:q});
 // Extract only the requested subject, never the model's proposed title or quoted instructions.
 let title=parsed[0].source;
 for(const r of [...parsed[0].results].reverse())title=title.slice(0,r.index)+title.slice(r.index+r.text.length);
 title=title.replace(/^.*?\bremind me\b\s*(?:about|of|to)?\s*/i,'').replace(/^(?:(?:can|could|would) you |please |i want (?:you )?to )*/i,'').replace(/^(?:set|add|create|make|put)\s+(?:(?:a|the|this|that|my)\s+)?reminder\s*(?:about|of|for|to)?\s*/i,'').replace(/\b(?:german(?:y)?|berlin|india(?:n)?|UTC|GMT)\s*time\b|Europe\/Berlin|Asia\/Kolkata|\b(?:CET|CEST|IST)\b/gi,'').replace(/\s+/g,' ').replace(/(?:\b(?:at|on|in|for|by)|[.,!?])+\s*$/gi,'').trim();
 title=title.replace(/[\s.,!?]+$/g,'').replace(/\b(?:at|on|in|for|by)\s*$/i,'').trim();
 if(!title||/^(?:this|that|it|me|a reminder)$/i.test(title))return null; // Context may need semantic resolution.
 if(!date)return question('Which day should I set the reminder for “'+title+'”?');
 if(!clock)return question('What time'+(zone==='Europe/Berlin'?' in Germany':'')+' should I set the reminder for “'+title+'”?');
 const meridiem=parts.at(-1).trim().match(/^(?:at\s+)?(AM|PM)[.!]?$/i)?.[1];
 if(/\bat\s+\d{1,2}\b(?!\s*[:\d]|\s*(?:a\.?m|p\.?m|in the|in morning|in evening))/i.test(clock.text)&&!clock.start.isCertain('meridiem')&&!meridiem)return question('Do you mean AM or PM?');
 const relative=/\b(?:in|after)\s+(?:\d+|[a-z -]+)\s+(?:seconds?|minutes?|hours?|days?)\b/i.test(clock.text);
 let at;
 let hour=clock.start.get('hour');if(meridiem)hour=hour%12+(meridiem.toUpperCase()==='PM'?12:0);
 const wall={year:date.start.get('year'),month:date.start.get('month'),day:date.start.get('day'),hour,minute:clock.start.get('minute')||0};
 const explicitOffset=clock.start.isCertain('timezoneOffset')&&!relative;
 try{at=relative?clock.start.date().toISOString():explicitOffset?new Date(Date.UTC(wall.year,wall.month-1,wall.day,wall.hour,wall.minute)-clock.start.get('timezoneOffset')*60000).toISOString():wallTimeToISO(wall,zone)}catch(error){return question(error.message)}
 if(new Date(at).getTime()<=now.getTime())return question('That time has already passed. What future date and time should I use?');
 return {actions:[{kind:'reminder',data:{title,at,timeZone:explicitOffset?'UTC':zone}}],question:''};
}
