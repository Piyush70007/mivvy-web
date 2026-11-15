import {validTimeZone} from './time-zones.mjs';
import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const ownerEmail=()=>String(process.env.OWNER_EMAIL||'').trim().toLowerCase();
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password,salt=randomBytes(16).toString('hex')){return salt+':'+scryptSync(password,salt,64).toString('hex')}
export function verifyPassword(password,hash){try{const [salt,expected]=hash.split(':');const value=scryptSync(password,salt,64);const other=Buffer.from(expected,'hex');return value.length===other.length&&timingSafeEqual(value,other)}catch{return false}}
export const newToken=()=>randomBytes(32).toString('base64url');
export function safeEqual(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y)}
export function canAccessLaptop(user){const owner=ownerEmail();return Boolean(owner&&user?.owner===true&&user?.email===owner)}
export function cleanEmail(value){const email=String(value||'').trim().toLowerCase();if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Enter a valid email address.');return email}
export function validateEntry(kind,input){
 const allowed=['task','reminder','expense','budget','note','habit','preference'];if(!allowed.includes(kind))throw new Error('Unknown tool.');
 const data={};const title=String(input.title||'').trim();if(!title||title.length>240)throw new Error('Use a title between 1 and 240 characters.');data.title=title;
 if(kind==='expense'||kind==='budget'){if(input.amount===null||typeof input.amount==='boolean'||String(input.amount??'').trim()==='')throw new Error('Enter an amount before saving.');data.amount=Number(input.amount);if(!Number.isFinite(data.amount)||data.amount<0||data.amount>1e9)throw new Error('Enter a valid positive amount.');data.category=String(input.category||'Other').slice(0,40);data.currency='INR';data.month=/^\d{4}-\d{2}$/.test(input.month||'')?input.month:new Date().toISOString().slice(0,7)}
 if(kind==='reminder'){const at=new Date(input.at);if(!Number.isFinite(at.getTime())||at.getTime()<Date.now()-60000)throw new Error('Choose a future reminder time.');data.at=at.toISOString();data.timeZone=validTimeZone(input.timeZone||'Asia/Kolkata');data.notified=false}
 if(kind==='note'||kind==='preference')data.body=String(input.body||'').slice(0,12000);
 if(kind==='task'||kind==='habit'){data.done=Boolean(input.done);data.date=String(input.date||new Date().toISOString().slice(0,10)).slice(0,10)}
 return data;
}
