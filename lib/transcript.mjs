export function cleanTranscript(value){return typeof value==='string'?value.replace(/<\|[^>]{0,120}\|>/g,'').replace(/[ \t]+/g,' ').trim().slice(0,4000):''}
