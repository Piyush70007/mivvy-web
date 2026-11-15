'use client';
import {useEffect,useRef,useState} from 'react';

export default function LaptopLive(){
 const video=useRef(null),peer=useRef(null),channel=useRef(null),session=useRef(null),ended=useRef(false),generation=useRef(0),timers=useRef([]),modeRef=useRef('screen'),monitorRef=useRef(1);
 const [status,setStatus]=useState('Connecting…'),[kind,setKind]=useState('screen'),[monitor,setMonitor]=useState(1),[error,setError]=useState(''),[frames,setFrames]=useState(0);
 function native(event,extra={}){window.webkit?.messageHandlers?.mivvyLive?.postMessage({event,...extra})}
 async function api(body){
  const response=await fetch('/api/stream',{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Video connection failed.');return data;
 }
 async function stop(notify=true){
  ended.current=true;generation.current++;timers.current.forEach(clearInterval);timers.current=[];
  try{if(channel.current?.readyState==='open')channel.current.send('stop')}catch{}
  peer.current?.close();peer.current=null;if(video.current)video.current.srcObject=null;
  const id=session.current;session.current=null;
  if(id)fetch('/api/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop',id}),keepalive:true}).catch(()=>{});
  if(notify){setStatus('Closed');native('closed')}
 }
 async function changeMode(next,nextMonitor=monitorRef.current){
  if(ended.current)return;modeRef.current=next;monitorRef.current=nextMonitor;setKind(next);setMonitor(nextMonitor);
  if(!session.current)return;
  try{await api({action:'mode',id:session.current,kind:next,monitor:nextMonitor});native('mode',{kind:next})}
  catch(err){setError(err.message)}
 }
 useEffect(()=>{
  ended.current=false;const epoch=++generation.current,current=()=>generation.current===epoch&&!ended.current;
  const initial=new URLSearchParams(location.search).get('kind')==='camera'?'camera':'screen';setKind(initial);modeRef.current=initial;
  let frameCallback;
  async function start(){
   try{
    const config=await api();if(!current())return;
    const pc=new RTCPeerConnection({iceServers:config.iceServers});peer.current=pc;
    channel.current=pc.createDataChannel('mivvy-live-control');pc.addTransceiver('video',{direction:'recvonly'});
    pc.ontrack=event=>{
     if(!current())return;const element=video.current;if(!element)return;
     element.srcObject=event.streams[0]||new MediaStream([event.track]);element.play().catch(()=>setStatus('Tap the video to play'));
     let count=0;
     const decoded=()=>{if(!current())return;count++;if(count===1){setStatus('Live');native('connected',{kind:modeRef.current})}if(count%8===0)setFrames(count);frameCallback=element.requestVideoFrameCallback?.(decoded)};
     if(element.requestVideoFrameCallback)frameCallback=element.requestVideoFrameCallback(decoded);else element.onplaying=()=>{setStatus('Live');native('connected',{kind:modeRef.current})};
    };
    pc.onconnectionstatechange=()=>{
     if(current()&&pc.connectionState==='failed'){setError(config.relayConfigured?'Video connection failed. Close and reopen live view.':'This network could not establish direct video. Configure an authenticated TURN relay for reliable cross-network viewing.');native('error',{message:'Video connection failed.'});stop(false)}
    };
    await pc.setLocalDescription(await pc.createOffer());
    if(pc.iceGatheringState!=='complete')await new Promise(resolve=>{
     const timeout=setTimeout(resolve,7000);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timeout);resolve()}},{once:false});
    });
    if(!current())return;
    const created=await api({action:'start',kind:modeRef.current,monitor:monitorRef.current,offer:{type:'offer',sdp:pc.localDescription.sdp}});
    if(!current()){fetch('/api/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop',id:created.stream.id}),keepalive:true}).catch(()=>{});return}
    session.current=created.stream.id;native('session',{id:created.stream.id});
    timers.current.push(setInterval(()=>{if(session.current)api({action:'heartbeat',id:session.current}).catch(err=>{setError(err.message);stop(false)})},8000));
    const deadline=Date.now()+35000;
    while(current()&&Date.now()<deadline){
     const response=await fetch('/api/stream?id='+encodeURIComponent(session.current),{cache:'no-store'}),data=await response.json();
     if(!current())return;
     if(!response.ok)throw new Error(data.error||'Stream ended.');
     if(data.stream.error)throw new Error(data.stream.error);
     if(data.stream.answer){await pc.setRemoteDescription(data.stream.answer);return}
     await new Promise(resolve=>setTimeout(resolve,700));
    }
    if(current())throw new Error('The paired laptop did not establish video in time.');
   }catch(err){if(current()){setError(err.message);native('error',{message:err.message});stop(false)}}
  }
  const hidden=event=>{if(document.hidden||event.type==='pagehide')stop()};
  const nativeMode=event=>{if(['screen','camera'].includes(event.detail))changeMode(event.detail)};
  document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',hidden);window.addEventListener('mivvy-mode',nativeMode);start();
  return()=>{if(frameCallback&&video.current?.cancelVideoFrameCallback)video.current.cancelVideoFrameCallback(frameCallback);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',hidden);window.removeEventListener('mivvy-mode',nativeMode);stop(false)};
 },[]);
 return <main style={{position:'fixed',inset:0,background:'#050a0d',color:'#e0fff5',display:'flex',flexDirection:'column',fontFamily:'system-ui',fontSize:12}}>
  <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'#0b171d'}}>
   <span role="status" data-testid="live-status" style={{marginRight:'auto'}}>{error?'Connection issue':status} · {kind}{frames>0?' · '+frames+' frames':''}</span>
   <button onClick={()=>changeMode('screen')} aria-pressed={kind==='screen'}>Screen</button>
   <button onClick={()=>changeMode('camera')} aria-pressed={kind==='camera'}>Camera</button>
   {kind==='screen'&&<select aria-label="Laptop display" value={monitor} onChange={event=>changeMode('screen',Number(event.target.value))}>{[1,2,3,4].map(id=><option key={id} value={id}>Display {id}</option>)}</select>}
   <button onClick={()=>stop()} aria-label="Close live view">✕</button>
  </div>
  <div style={{position:'relative',flex:1,minHeight:0,display:'grid',placeItems:'center'}}>
   <video ref={video} autoPlay playsInline muted onClick={()=>video.current?.play()} style={{width:'100%',height:'100%',objectFit:'contain',minHeight:0}}/>
   {error&&<div role="alert" style={{position:'absolute',inset:15,display:'grid',placeContent:'center',background:'#09161ef0',textAlign:'center',padding:15,lineHeight:1.6}}>{error}<a href="/" style={{color:'#66ffca',marginTop:16}}>Open Mivvy account</a></div>}
  </div>
  <style>{`button,select{background:#102c2d;color:#dbfff2;border:1px solid #28605c;border-radius:7px;padding:6px;font:inherit}button[aria-pressed=true]{background:#216355}button{cursor:pointer}`}</style>
 </main>;
}
