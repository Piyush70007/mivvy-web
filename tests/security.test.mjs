process.env.OWNER_EMAIL='owner@example.com';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {passwordHash,verifyPassword,canAccessLaptop,validateEntry,safeEqual} from '../lib/security.mjs';
import {laptopIntent} from '../lib/assistant.mjs';
test('owner access requires both server role and exact owner account',()=>{assert.equal(canAccessLaptop({email:'owner@example.com',owner:false}),false);assert.equal(canAccessLaptop({email:'other@example.com',owner:true}),false);assert.equal(canAccessLaptop({email:'owner@example.com',owner:true}),true);assert.equal(canAccessLaptop(null),false)});

test('missing owner configuration cannot grant laptop access',()=>{const previous=process.env.OWNER_EMAIL;try{delete process.env.OWNER_EMAIL;assert.equal(canAccessLaptop({email:'',owner:true}),false);assert.equal(canAccessLaptop({email:'owner@example.com',owner:true}),false)}finally{if(previous===undefined)delete process.env.OWNER_EMAIL;else process.env.OWNER_EMAIL=previous}});
test('password hashes use distinct salts and verify without plaintext storage',()=>{const a=passwordHash('A test password!'),b=passwordHash('A test password!');assert.notEqual(a,b);assert(verifyPassword('A test password!',a));assert(!verifyPassword('Wrong password',a));assert(!verifyPassword('A test password!','broken'))});
test('device tokens are compared exactly',()=>{assert(safeEqual('abc','abc'));assert(!safeEqual('abc','ab'));assert(!safeEqual('',''))});
test('tool validation rejects past reminders and malformed budgets',()=>{assert.throws(()=>validateEntry('reminder',{title:'Call',at:'yesterday'}));assert.throws(()=>validateEntry('expense',{title:'Food',amount:-100}));assert.throws(()=>validateEntry('device',{title:'hijack'}));assert.equal(validateEntry('task',{title:'Read',owner:true}).owner,undefined);assert.equal(validateEntry('reminder',{title:'Call',at:new Date(Date.now()+3600000)}).notified,false)});
test('camera and screen require explicit laptop request',()=>{assert.equal(laptopIntent('Can you show me the screen of my laptop?'),'screen');assert.equal(laptopIntent('open camera of my laptop'),'camera');assert.equal(laptopIntent('What is a laptop camera?'),null);assert.equal(laptopIntent('Create a website about cameras'),null)});
