import test from 'node:test';
import assert from 'node:assert/strict';
import {positiveInterview,relevantJobMail,proactiveDeliverable,saveMailDelivery} from '../lib/mail-delivery.mjs';
test('only actual positive hiring progress qualifies for proactive speech',()=>{
 for(const subject of ['Your interview time: Thursday at 7 PM','Interview invitation','We would like to invite you to an interview','You have been selected for the next interview round','Please schedule your interview'])assert.equal(positiveInterview({subject}),true,subject);
 for(const subject of ['Your application was sent','Your application was viewed','Unfortunately we are not moving forward with your application','Interview tips newsletter','Personal Loan! Get ready for next season','Recruiter is popular in your network'])assert.equal(positiveInterview({subject}),false,subject);
 assert.equal(positiveInterview({subject:'Interview update',snippet:'We regret to inform you that we will not be proceeding.'}),false);
 assert.equal(relevantJobMail({subject:'Get ready for an EastWest Personal Loan!'}),false);
});
test('positive-only policy suppresses backlog and non-positive alerts',()=>{
 const policy={autoSpeak:'positive_interview',from:2000};
 assert.equal(proactiveDeliverable({data:{positiveInterview:true,receivedAt:3000},created_at:new Date(3000).toISOString()},policy),true);
 assert.equal(proactiveDeliverable({data:{positiveInterview:true,receivedAt:1000},created_at:new Date(3000).toISOString()},policy),false);
 assert.equal(proactiveDeliverable({data:{positiveInterview:true},created_at:new Date(1000).toISOString()},policy),false);
 assert.equal(proactiveDeliverable({data:{positiveInterview:false},created_at:new Date(3000).toISOString()},policy),false);
});
test('delivery is saved for this user and cannot enable unlinked Slack',async()=>{
 const calls=[],storage={putDoc:async(...args)=>calls.push(args)};
 const policy=await saveMailDelivery('owner',{autoSpeak:'positive_interview',slackPositive:true},{storage,status:async()=>({slack:{connected:true}})});
 assert.equal(policy.slackPositive,true);assert.equal(calls[0][0],'owner');assert.equal(calls[0][3],'mail-delivery-policy');
 await assert.rejects(saveMailDelivery('other',{autoSpeak:'positive_interview',slackPositive:true},{storage,status:async()=>({slack:{connected:false}})}),/Link your own Slack/);
 assert.equal(calls.length,1);
});
