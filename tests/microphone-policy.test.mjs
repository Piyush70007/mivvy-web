import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

test('production permits the local WASM speech filter without allowing JavaScript eval',()=>{
 const script="import config from './next.config.mjs'; console.log(JSON.stringify(await config.headers()))";
 const rules=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'production'},encoding:'utf8'}));
 const headers=rules.find(rule=>rule.source==='/:path*').headers;
 const policy=headers.find(header=>header.key==='Content-Security-Policy').value;
 const scripts=policy.split(';').map(value=>value.trim()).find(value=>value.startsWith('script-src ')).split(/\s+/);
 assert(scripts.includes("'wasm-unsafe-eval'"),'Microphone speech filtering must be permitted in production');
 assert(!scripts.includes("'unsafe-eval'"),'JavaScript eval must remain blocked');
 assert(scripts.includes("'self'"));
 assert(policy.includes("connect-src 'self'"));
 assert.equal(headers.find(header=>header.key==='Permissions-Policy').value,'camera=(self), microphone=(self), geolocation=()');
});
