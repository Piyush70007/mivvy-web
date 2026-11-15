import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directReminderPlan} from '../lib/reminder-plan.mjs';
import {planPersonalTools,parseToolPlan,personalToolRequest,savePersonalTools} from '../lib/personal-tools.mjs';
import {wallTimeToISO,formatReminder} from '../lib/time-zones.mjs';
import {validateEntry} from '../lib/security.mjs';
const now=new Date('2026-11-13T10:00:00Z');
const request='can you set a reminder of signing contract at 2 of december';
const pending=[{role:'user',content:request},{role:'assistant',content:'What time should I remind you?'},{role:'user',content:'German time'},{role:'assistant',content:'What time in Germany?'}];
test('the exact date-only failure asks for a clock without any provider call',async()=>{
 const plan=await planPersonalTools(request,[],{now,fetcher:()=>{throw new Error('A simple clarification must not wait for AI')}});
 assert.deepEqual(plan.actions,[]);assert.match(plan.question,/What time/);assert.match(plan.question,/signing contract/);
 const german=directReminderPlan('German time',pending.slice(0,2),now);assert.match(german.question,/in Germany/);assert.equal(german.actions.length,0);
 assert.match(directReminderPlan(request+', German time',[],now).question,/“signing contract”/);
});
test('a clock follow-up retains the title, December date and German winter timezone',()=>{
 assert(personalToolRequest('German time',pending.slice(0,2)));assert(personalToolRequest('9 AM',pending));
 const plan=directReminderPlan('9 AM',pending,now);assert.equal(plan.actions.length,1);
 assert.deepEqual(plan.actions[0].data,{title:'signing contract',at:'2026-12-02T08:00:00.000Z',timeZone:'Europe/Berlin'});
});
test('German reminders account for summer time and relative durations',()=>{
 const summer=directReminderPlan('Remind me to renew the contract on July 2, 2027 at 9 AM German time',[],now);
 assert.equal(summer.actions[0].data.at,'2027-07-02T07:00:00.000Z');
 assert.equal(directReminderPlan('Remind me to drink water in ten minutes',[],now).actions[0].data.at,'2026-11-13T10:10:00.000Z');
 assert.equal(directReminderPlan('Remind me to check mail tomorrow at 14:00',[],now).actions[0].data.at,'2026-11-14T08:30:00.000Z');
});
test('an absent date, ambiguous hour and clock-change gap do not save a guessed time',()=>{
 assert.match(directReminderPlan('Remind me to call Mum at 2 PM',[],now).question,/Which day/);
 const h=[{role:'user',content:'Remind me to call Mum tomorrow at 9'},{role:'assistant',content:'Do you mean AM or PM?'}];
 assert.match(directReminderPlan(h[0].content,[],now).question,/AM or PM/);assert(personalToolRequest('PM',h));
 assert.equal(directReminderPlan('PM',h,now).actions[0].data.at,'2026-11-14T15:30:00.000Z');
 assert.throws(()=>wallTimeToISO({year:2027,month:3,day:28,hour:2,minute:30},'Europe/Berlin'),/does not exist/);
});
test('new entries do not inherit unrelated pending or already saved reminder details',()=>{
 assert.equal(directReminderPlan('Add 200 for lunch to money space',pending,now),null);
 assert.match(directReminderPlan('Remind me to call Dad tomorrow',pending,now).question,/call Dad/);
 const old=[...pending,{role:'assistant',content:'Saved to Reminders: signing contract.'}];
 assert.equal(directReminderPlan('9 AM',old,now),null);
 const contextual=directReminderPlan('Add this reminder',[{role:'user',content:'Dentist appointment on January 3, 2027 at 10 AM India time.'}],now);
 assert.equal(contextual.actions[0].data.at,'2027-01-03T04:30:00.000Z');
});
test('partial model entries accompanied by a question are clarifications, never writes',()=>{
 const raw={choices:[{finish_reason:'tool_calls',message:{tool_calls:[{function:{name:'plan_personal_tools',arguments:JSON.stringify({actions:[{kind:'reminder',data:{title:'Contract',at:''}}],question:'What time in Germany?'})}}]}}]};
 assert.deepEqual(parseToolPlan(raw),{actions:[],question:'What time in Germany?'});
});
test('a saved reminder preserves its timezone in Tools data and the receipt',async()=>{
 const data={title:'Sign contract',at:'2026-12-02T08:00:00Z',timeZone:'Europe/Berlin'};
 const result=await savePersonalTools({id:'qa'},'remind me',[],{planner:async()=>({actions:[{kind:'reminder',data}],question:''}),putDoc:async(user_id,kind,data)=>({id:'qa-reminder',user_id,kind,data})});
 assert.equal(result.applied[0].data.timeZone,'Europe/Berlin');assert.match(result.reply,/09:00/);assert.match(result.reply,/German time/);
 assert.equal(formatReminder(result.applied[0].data),formatReminder(validateEntry('reminder',data)));
 assert.throws(()=>validateEntry('reminder',{...data,timeZone:'invalid/place'}),/timezone/);
});
