import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reminderMissing} from '../lib/personal-tools.mjs';
import {directReminderPlan,timerPlan} from '../lib/reminder-plan.mjs';
import {reminderLanguageText} from '../lib/reminder-language.mjs';
test('Hinglish future reminders reach the multilingual planner instead of a false missing-date question',()=>{
 const text='Kal subah 9 baje paani peene ka reminder set karo';
 assert.equal(reminderMissing(text),null);assert.equal(directReminderPlan(text,[],new Date('2026-11-17T12:00:00Z')),null);
 assert.match(reminderLanguageText(text),/tomorrow at 9 AM/);
});
test('Hindi dates and hours count as supplied while truly missing details remain missing',()=>{
 assert.equal(reminderMissing('कल सुबह 9 बजे reminder जोड़ो'),null);
 assert.equal(reminderMissing('कल reminder जोड़ो'),'time');
 assert.equal(reminderMissing('subah 9 baje reminder set karo'),'date');
});
test('timers use a bounded relative reminder without needing model calls',()=>{
 const now=new Date('2026-11-17T12:00:00Z');
 assert.equal(timerPlan('Set a timer for 10 minutes',now).actions[0].data.at,'2026-11-17T12:10:00.000Z');
 assert.equal(timerPlan('Start a 25 minute focus timer',now).actions[0].data.title,'Focus timer');
 assert.equal(timerPlan('Start a 0 second timer',now).actions.length,0);
 assert.equal(timerPlan('Start a 25 hour timer',now).actions.length,0);
 assert.equal(timerPlan('Do not start a timer',now),null);
});
