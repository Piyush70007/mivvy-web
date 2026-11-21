import * as db from './db.mjs';

// Deterministic metadata triage: polling spends no LLM or speech credits.
export function positiveInterview(mail){
 const text=[mail.subject,mail.snippet].filter(Boolean).join(' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 if(/unfortunately|regret to inform|not (?:be )?(?:moving|proceeding|selected)|unsuccessful|rejected|rejection|other candidates|won't be (?:moving|proceeding)|nicht weiter|Absage|अस्वीकृत/i.test(text))return false;
 if(/interview (?:tips|advice|preparation guide)|webinar|newsletter|loan|personal finance|credit card|popular in your network/i.test(text))return false;
 return /interview (?:invitation|scheduled|confirmation)|(?:your|the) interview (?:time|is scheduled)|invit(?:e|ed|ation).{0,45}(?:interview|assessment)|(?:schedule|book|confirm).{0,35}(?:your |an? )?interview|(?:moving|proceed|progress|advance|selected|shortlisted).{0,55}(?:next|interview|hiring stage)|next (?:interview|hiring|recruitment) (?:step|stage|round)|next step with.{0,80}(?:interview|record|assessment)|interview.{0,40}(?:next (?:step|round)|availability)|Vorstellungsgespräch.{0,40}(?:Einladung|Termin)|Einladung.{0,35}Vorstellungsgespräch|इंटरव्यू.{0,30}(?:आमंत्रण|अगले|तारीख)/i.test(text);
}
export function relevantJobMail(mail){
 const text=[mail.subject,mail.snippet].filter(Boolean).join(' ');
 if(/loan|credit card|personal finance|popular in your network/i.test(text))return false;
 return /\b(?:application|interview|recruiter|recruitment|hiring|job offer|assessment|candidate|shortlisted|vacanc)/i.test(text)||/Bewerbung|Vorstellungsgespräch|नौकरी|इंटरव्यू/i.test(text);
}
export async function mailDelivery(userID,{storage=db}={}){
 return (await storage.documents(userID)).find(d=>d.id==='mail-delivery-policy')?.data||{};
}
export async function saveMailDelivery(userID,input,{storage=db,status}={}){
 if(input.autoSpeak!=='positive_interview'||typeof input.slackPositive!=='boolean')throw new Error('Choose positive interview updates and an explicit Slack preference.');
 if(input.slackPositive&&status&&!(await status({id:userID})).slack?.connected)throw new Error('Link your own Slack DM first.');
 const policy={autoSpeak:'positive_interview',slackPositive:input.slackPositive,from:Date.now()};
 await storage.putDoc(userID,'notification_policy',policy,'mail-delivery-policy');return policy;
}
export function proactiveDeliverable(alert,policy){
 if(policy.autoSpeak!=='positive_interview')return true;
 return alert.data?.positiveInterview===true&&Number(alert.data?.receivedAt)>=policy.from&&Date.parse(alert.created_at||'')>=policy.from;
}
