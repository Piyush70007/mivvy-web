export const defaultTimeZone='Asia/Kolkata';
export function validTimeZone(zone=defaultTimeZone){
 try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();return zone}catch{throw new Error('Choose a valid timezone.')}
}
export function requestedTimeZone(text,fallback=defaultTimeZone){
 if(/\b(?:german(?:y)?|berlin)\s+time\b|\b(?:in|for)\s+(?:germany|berlin)\b|Europe\/Berlin|\bCE[DS]?T\b/i.test(text))return 'Europe/Berlin';
 if(/\bindia(?:n)?\s+time\b|Asia\/Kolkata|\bIST\b/i.test(text))return defaultTimeZone;
 if(/\bUTC\b|\bGMT\b/i.test(text))return 'UTC';
 return fallback;
}
export function wallParts(date,zone){
 return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:validTimeZone(zone),year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function zoneOffset(date,zone){const p=wallParts(date,zone);return (Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-Math.floor(date.getTime()/1000)*1000)/60000}
export function wallTimeToISO(parts,zone=defaultTimeZone){
 const p={second:0,...parts},wall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);let instant=wall;
 for(let i=0;i<4;i++)instant=wall-zoneOffset(new Date(instant),zone)*60000;
 const actual=wallParts(new Date(instant),zone);
 if(['year','month','day','hour','minute','second'].some(k=>actual[k]!==p[k]))throw new Error('That local time does not exist because the clocks change. Please choose another time.');
 // Autumn clock changes repeat an hour. Ask instead of silently choosing an occurrence.
 if([-3600000,3600000].some(delta=>{const other=wallParts(new Date(instant+delta),zone);return ['year','month','day','hour','minute','second'].every(k=>other[k]===p[k])}))throw new Error('That time occurs twice because the clocks change. Please specify the UTC offset.');
 return new Date(instant).toISOString();
}
export function formatReminder(data){
 const zone=validTimeZone(data.timeZone||defaultTimeZone);
 return new Date(data.at).toLocaleString('en-GB',{timeZone:zone,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'})+(zone==='Europe/Berlin'?' · German time':zone===defaultTimeZone?' · India time':'');
}
