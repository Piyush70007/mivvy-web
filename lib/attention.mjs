import * as db from './db.mjs';
import {checkMailWatches} from './mail-watch.mjs';
import {sendSlackToMe} from './connections.mjs';

async function deliver(event,watch){
 // Push carries a generic notice. Sender, subject and snippet stay behind login.
 if(process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_SUBJECT){
  const push=(await import('web-push')).default;push.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  const subscriptions=(await db.documents(watch.user_id)).filter(d=>d.kind==='subscription');
  for(const sub of subscriptions)try{await push.sendNotification(sub.data,JSON.stringify({title:'Mivvy · Keeping watch',body:'A new email matches '+watch.data.topic+'. Open Mivvy to review it.',id:event.id,url:'/?attention=1'}))}catch(error){if([404,410].includes(error.statusCode))await db.deleteDoc(watch.user_id,sub.id)}
 }
 // Standing Slack permission is scoped to this watch, not inferred from reminders.
 if(watch.data.slack)await sendSlackToMe({id:watch.user_id},`Mivvy · ${event.data.title}\n${event.data.from}\n${event.data.subject}\nReview in Mivvy: https://skulls-personal-ai.vercel.app/?attention=1`);
}
export async function attentionTick(userID=null,{signal}={}){const deadline=AbortSignal.timeout(45000);return checkMailWatches(userID,{notify:deliver,signal:signal?AbortSignal.any([signal,deadline]):deadline})}
export async function attentionState(user){
 const [watches,alerts,docs]=await Promise.all([db.mailWatches(user.id),db.mailAlerts(user.id),db.documents(user.id)]);
 const device=docs.find(d=>d.kind==='device'),desktopOnline=Boolean(device&&Date.now()-device.data.lastSeen<30000);
 return {watches:watches.map(({id,key,data,enabled})=>({id,key,data,enabled})),alerts,desktopOnline,pollSeconds:30,background:'The daily cloud check is catch-up only. Frequent checks need an open Mivvy client or the online desktop companion.'};
}
