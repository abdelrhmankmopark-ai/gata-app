/* GTA App v46 — communities and WebRTC calls */
(function(){
'use strict';
var db=window.gataDB,me=null,activeCommunity=null,communityChannel=null,callsFeed=null,callChannel=null,callSession=null,callType='audio',callScope='direct',localStream=null,peerConnections={},pendingIce={},incomingCall=null,callStartedAt=0;
var $=function(id){return document.getElementById(id);};
function say(t){var el=$('toast');if(el){el.textContent=t;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2800);}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function page(key){
 ['communities-panel','calls-panel'].forEach(function(id){$(id).classList.add('hidden');});
 var work=document.querySelector('#chat-view .workspace');if(work)work.classList.add('hidden');
 $('updates-panel').classList.add('hidden');
 $(key==='communities'?'communities-panel':'calls-panel').classList.remove('hidden');
 document.querySelectorAll('[data-nav]').forEach(function(b){var on=b.dataset.nav===key;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(key==='communities')loadCommunities();else loadCallHistory();
}
function backToChats(){
 $('communities-panel').classList.add('hidden');$('calls-panel').classList.add('hidden');
 var work=document.querySelector('#chat-view .workspace');if(work)work.classList.remove('hidden');
 document.querySelectorAll('[data-nav]').forEach(function(b){var on=b.dataset.nav==='chats';b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
}
async function loadCommunities(){
 if(!me)return;
 var box=$('community-list');box.innerHTML='<p class="muted">جاري تحميل المجتمعات...</p>';
 var r=await db.from('communities').select('id,name,description,invite_code,created_by,created_at').eq('is_public',true).order('created_at',{ascending:false}).limit(50);
 if(r.error){box.textContent='تعذر تحميل المجتمعات: '+r.error.message;return;}
 if(!r.data.length){box.innerHTML='<p class="muted">لسه مفيش مجتمعات. أنشئ أول مجتمع!</p>';return;}
 var ids=r.data.map(function(x){return x.id;});
 var m=await db.from('community_members').select('community_id').eq('user_id',me.id).in('community_id',ids);
 var joined=new Set((m.data||[]).map(function(x){return x.community_id;}));
 box.innerHTML='';
 r.data.forEach(function(c){
  var row=document.createElement('div');row.className='feature-row';
  row.innerHTML='<div class="feature-mark">♧</div><div class="feature-row-main"><strong>'+esc(c.name)+'</strong><small>'+esc(c.description||'مجتمع على جتا آب')+'</small></div><button type="button">'+(joined.has(c.id)?'فتح المجتمع':'انضمام')+'</button>';
  row.querySelector('button').addEventListener('click',async function(){if(!joined.has(c.id)){var add=await db.from('community_members').insert({community_id:c.id,user_id:me.id,role:'member'});if(add.error){say('تعذر الانضمام: '+add.error.message);return;}say('تم الانضمام للمجتمع');}openCommunity(c);});
  box.appendChild(row);
 });
}
async function createCommunity(e){
 e.preventDefault();if(!me)return;
 var name=$('community-name').value.trim(),description=$('community-description').value.trim();
 if(name.length<2){say('اسم المجتمع لازم يكون حرفين على الأقل');return;}
 var b=e.submitter;if(b){b.disabled=true;b.textContent='جاري الإنشاء...';}
 var r=await db.from('communities').insert({name:name,description:description||null,created_by:me.id,is_public:true}).select().single();
 if(r.error){say('تعذر إنشاء المجتمع: '+r.error.message);if(b){b.disabled=false;b.textContent='＋ إنشاء المجتمع';}return;}
 var m=await db.from('community_members').insert({community_id:r.data.id,user_id:me.id,role:'owner'});
 if(m.error){say('تم إنشاء المجتمع لكن تعذر تسجيل عضويتك: '+m.error.message);return;}
 $('community-create-form').reset();if(b){b.disabled=false;b.textContent='＋ إنشاء المجتمع';}
 say('تم إنشاء المجتمع بنجاح');await loadCommunities();openCommunity(r.data);
}
async function joinByCode(e){
 e.preventDefault();var code=$('community-code').value.trim().toUpperCase();
 var r=await db.from('communities').select('*').eq('invite_code',code).maybeSingle();
 if(r.error||!r.data){say('كود الدعوة غير صحيح أو المجتمع غير متاح');return;}
 var m=await db.from('community_members').upsert({community_id:r.data.id,user_id:me.id,role:'member'},{onConflict:'community_id,user_id',ignoreDuplicates:true});
 if(m.error){say('تعذر الانضمام: '+m.error.message);return;}
 $('community-join-form').reset();say('أصبحت عضوًا في المجتمع');await loadCommunities();openCommunity(r.data);
}
async function openCommunity(c){
 activeCommunity=c;$('community-list').classList.add('hidden');$('community-room').classList.remove('hidden');
 $('community-room-name').textContent=c.name;$('community-room-meta').textContent=c.description||'مجتمع جتا آب';
 $('community-invite-code').textContent='كود الدعوة: '+c.invite_code+' — شاركه مع أصدقائك';
 if(communityChannel){await db.removeChannel(communityChannel);communityChannel=null;}
 await loadCommunityMessages();
 communityChannel=db.channel('community-messages-'+c.id,{config:{private:true}}).on('postgres_changes',{event:'INSERT',schema:'public',table:'community_messages',filter:'community_id=eq.'+c.id},function(payload){renderCommunityMessage(payload.new);}).subscribe();
}
async function loadCommunityMessages(){
 var box=$('community-messages');box.innerHTML='<p class="muted">جاري تحميل الرسائل...</p>';
 var r=await db.from('community_messages').select('*').eq('community_id',activeCommunity.id).order('created_at',{ascending:true}).limit(100);
 if(r.error){box.textContent='تعذر تحميل الرسائل: '+r.error.message;return;}
 var ids=[...new Set((r.data||[]).map(function(x){return x.sender_id;}))],names={};
 if(ids.length){var p=await db.from('profiles').select('id,username,display_name').in('id',ids);(p.data||[]).forEach(function(x){names[x.id]=x.display_name||x.username;});}
 box.innerHTML='';(r.data||[]).forEach(function(x){renderCommunityMessage(x,names[x.sender_id]);});
 box.scrollTop=box.scrollHeight;
}
function renderCommunityMessage(msg,name){
 var box=$('community-messages');if(!box||!activeCommunity||msg.community_id!==activeCommunity.id)return;
 if(box.querySelector('[data-message-id="'+msg.id+'"]'))return;
 var row=document.createElement('div');row.className='community-message'+(msg.sender_id===me.id?' mine':'');row.dataset.messageId=msg.id;
 row.innerHTML='<small>'+esc(name||(msg.sender_id===me.id?'أنت':'عضو'))+' · '+new Date(msg.created_at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})+'</small><div>'+esc(msg.content)+'</div>';
 box.appendChild(row);box.scrollTop=box.scrollHeight;
}
async function sendCommunityMessage(e){
 e.preventDefault();if(!activeCommunity)return;
 var input=$('community-message-input'),content=input.value.trim();if(!content)return;
 input.disabled=true;var r=await db.from('community_messages').insert({community_id:activeCommunity.id,sender_id:me.id,content:content});
 input.disabled=false;if(r.error){say('تعذر إرسال الرسالة: '+r.error.message);return;}input.value='';
}
async function loadCallHistory(){
 if(!me)return;var box=$('call-history');box.innerHTML='<p class="muted">جاري تحميل سجل المكالمات...</p>';
 var r=await db.from('call_sessions').select('*').order('created_at',{ascending:false}).limit(30);
 if(r.error){box.textContent='تعذر تحميل السجل: '+r.error.message;return;}
 if(!r.data.length){box.innerHTML='<p class="muted">لا توجد مكالمات حتى الآن. ابدأ مكالمة من داخل محادثة.</p>';return;}
 box.innerHTML='';r.data.forEach(function(c){
  var row=document.createElement('div');row.className='feature-row';
  var label=c.scope==='community'?'مكالمة مجتمع':(c.call_type==='video'?'مكالمة فيديو':'مكالمة صوتية');
  var state={ringing:'جارية',active:'تم الاتصال',ended:'انتهت',missed:'لم يتم الرد',rejected:'مرفوضة'}[c.status]||c.status;
  row.innerHTML='<div class="feature-mark">'+(c.call_type==='video'?'▣':'☎')+'</div><div class="feature-row-main"><strong>'+label+'</strong><small>'+new Date(c.created_at).toLocaleString('ar-EG')+' · '+state+'</small></div>';
  box.appendChild(row);
 });
}
async function startDirectCall(type){
 var peer=window.gataCurrentPeerId;if(!peer){say('افتح محادثة الشخص الأول لبدء المكالمة');return;}
 await createCall(type,'direct',null,[peer]);
}
async function startCommunityCall(type){
 if(!activeCommunity)return;
 var r=await db.from('community_members').select('user_id').eq('community_id',activeCommunity.id);
 if(r.error){say('تعذر قراءة أعضاء المجتمع: '+r.error.message);return;}
 var peers=(r.data||[]).map(function(x){return x.user_id;}).filter(function(x){return x!==me.id;});
 if(!peers.length){say('مفيش أعضاء آخرين في المجتمع لبدء المكالمة');return;}
 if(peers.length>5){say('المكالمة الجماعية التجريبية تدعم حتى 6 أشخاص حاليًا');return;}
 await createCall(type||'audio','community',activeCommunity.id,peers);
}
async function createCall(type,scope,communityId,peerIds){
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.RTCPeerConnection){say('المكالمات غير مدعومة في المتصفح الحالي');return;}
 if(callSession){say('أنهِ المكالمة الحالية أولًا');return;}
 var unique=[...new Set([me.id].concat(peerIds))];if(unique.length>6){say('الحد الأقصى للمكالمة حاليًا 6 أشخاص');return;}
 var r=await db.from('call_sessions').insert({created_by:me.id,call_type:type,scope:scope,community_id:communityId,status:'ringing'}).select().single();
 if(r.error){say('تعذر إنشاء المكالمة: '+r.error.message);return;}
 var rows=unique.map(function(id){return{call_id:r.data.id,user_id:id,status:id===me.id?'joined':'invited',joined_at:id===me.id?new Date().toISOString():null};});
 var p=await db.from('call_participants').insert(rows);
 if(p.error){await db.from('call_sessions').update({status:'ended',ended_at:new Date().toISOString()}).eq('id',r.data.id);say('تعذر دعوة المشاركين: '+p.error.message);return;}
 await joinCall(r.data,type,false);
}
async function handleIncoming(row){
 if(callSession||incomingCall||row.user_id!==me.id||row.status!=='invited')return;
 var r=await db.from('call_sessions').select('*').eq('id',row.call_id).maybeSingle();if(r.error||!r.data||r.data.status!=='ringing')return;
 incomingCall=r.data;$('call-overlay').classList.remove('hidden');$('call-state').textContent='مكالمة واردة';$('call-title').textContent=r.data.call_type==='video'?'مكالمة فيديو واردة':'مكالمة صوتية واردة';$('call-subtitle').textContent=r.data.scope==='community'?'دعوة للانضمام إلى مكالمة جماعية':'شخص يتصل بك على جتا آب';
 $('call-accept').classList.remove('hidden');$('call-decline').classList.remove('hidden');$('call-hangup').classList.add('hidden');$('call-note').textContent='لن يتم تشغيل الميكروفون أو الكاميرا إلا بعد الضغط على قبول.';
}
async function acceptIncoming(){
 if(!incomingCall)return;var c=incomingCall;incomingCall=null;
 var upd=await db.from('call_participants').update({status:'joined',joined_at:new Date().toISOString()}).eq('call_id',c.id).eq('user_id',me.id);
 if(upd.error){say('تعذر قبول المكالمة: '+upd.error.message);incomingCall=c;return;}
 await joinCall(c,c.call_type,true);
}
async function joinCall(c,type,isIncoming){
 callSession=c;callType=type;callScope=c.scope;callStartedAt=Date.now();
 $('call-overlay').classList.remove('hidden');$('call-state').textContent=isIncoming?'تم الانضمام':'جاري الاتصال...';
 $('call-title').textContent=type==='video'?'مكالمة فيديو':'مكالمة صوتية';$('call-subtitle').textContent=c.scope==='community'?'مكالمة جماعية':'مكالمة فردية';
 $('call-accept').classList.add('hidden');$('call-decline').classList.add('hidden');$('call-hangup').classList.remove('hidden');
 try{
  localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:type==='video'});
  $('call-local-video').srcObject=localStream;
  $('call-media-stage').classList.toggle('video-active',type==='video');
  $('call-camera').classList.toggle('hidden',type!=='video');
  callChannel=db.channel('call:'+c.id,{config:{private:true,broadcast:{ack:true}}});
  callChannel.on('broadcast',{event:'signal'},function(message){handleSignal(message.payload||message);});
  callChannel.on('postgres_changes',{event:'*',schema:'public',table:'call_participants',filter:'call_id=eq.'+c.id},function(){syncCallPeers();});
  await new Promise(function(resolve,reject){
   callChannel.subscribe(function(status,err){if(status==='SUBSCRIBED')resolve();else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(err||new Error('تعذر الاتصال بقناة المكالمة'));});
  });
  await db.from('call_sessions').update({status:'active'}).eq('id',c.id).eq('created_by',c.created_by);
  $('call-state').textContent='متصل — في انتظار المشاركين';
  await syncCallPeers();
  await signal({kind:'ready',from:me.id});
 }catch(err){
  $('call-note').textContent='تعذر تشغيل المكالمة: '+(err&&err.message||'تحقق من صلاحيات الميكروفون والكاميرا وإعدادات Realtime.');
  say('تعذر بدء المكالمة');
 }
}
async function syncCallPeers(){
 if(!callSession)return;
 var r=await db.from('call_participants').select('user_id,status').eq('call_id',callSession.id);
 if(r.error)return;
 var active=(r.data||[]).filter(function(p){return p.user_id!==me.id&&p.status==='joined';});
 $('call-subtitle').textContent=callSession.scope==='community'?'المشاركون: '+(active.length+1):'مكالمة فردية';
 active.forEach(function(p){if(me.id.localeCompare(p.user_id)<0&&!peerConnections[p.user_id])createOffer(p.user_id);});
}
async function signal(payload){if(callChannel)await callChannel.send({type:'broadcast',event:'signal',payload:payload});}
function makePeer(peerId){
 if(peerConnections[peerId])return peerConnections[peerId];
 var pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});peerConnections[peerId]=pc;pendingIce[peerId]=[];
 (localStream?localStream.getTracks():[]).forEach(function(track){pc.addTrack(track,localStream);});
 pc.onicecandidate=function(e){if(e.candidate)signal({kind:'ice',from:me.id,to:peerId,candidate:e.candidate});};
 pc.ontrack=function(e){
  var stream=e.streams&&e.streams[0];if(!stream)return;
  var video=typeIsVideo();if(video){$('call-remote-video').srcObject=stream;$('call-media-stage').classList.add('video-active');}
  else{$('call-remote-audio').srcObject=stream;}
 };
 pc.onconnectionstatechange=function(){if(pc.connectionState==='failed'||pc.connectionState==='disconnected')$('call-state').textContent='الاتصال ضعيف أو انقطع';else if(pc.connectionState==='connected')$('call-state').textContent='المكالمة متصلة';};
 return pc;
}
function typeIsVideo(){return callType==='video';}
async function createOffer(peerId){
 try{var pc=makePeer(peerId),offer=await pc.createOffer();await pc.setLocalDescription(offer);await signal({kind:'offer',from:me.id,to:peerId,sdp:pc.localDescription});}catch(e){$('call-note').textContent='تعذر إنشاء اتصال مع أحد المشاركين: '+e.message;}
}
async function handleSignal(p){
 if(!callSession||!p||p.from===me.id||(p.to&&p.to!==me.id))return;
 if(p.kind==='ready'){if(me.id.localeCompare(p.from)<0&&!peerConnections[p.from])createOffer(p.from);return;}
 if(p.kind==='ended'){finishCall(false);return;}
 if(!p.from)return;
 try{
  var pc=makePeer(p.from);
  if(p.kind==='offer'){
   await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
   var answer=await pc.createAnswer();await pc.setLocalDescription(answer);
   await signal({kind:'answer',from:me.id,to:p.from,sdp:pc.localDescription});
   var queued=pendingIce[p.from]||[];for(var i=0;i<queued.length;i++)await pc.addIceCandidate(new RTCIceCandidate(queued[i]));pendingIce[p.from]=[];
  }else if(p.kind==='answer'){
   await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
   var q=pendingIce[p.from]||[];for(var j=0;j<q.length;j++)await pc.addIceCandidate(new RTCIceCandidate(q[j]));pendingIce[p.from]=[];
  }else if(p.kind==='ice'){
   if(pc.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(p.candidate));else(pendingIce[p.from]||(pendingIce[p.from]=[])).push(p.candidate);
  }
 }catch(e){$('call-note').textContent='حدثت مشكلة أثناء توصيل المكالمة: '+e.message;}
}
async function rejectIncoming(){
 if(!incomingCall)return;var c=incomingCall;incomingCall=null;
 await db.from('call_participants').update({status:'declined',left_at:new Date().toISOString()}).eq('call_id',c.id).eq('user_id',me.id);
 $('call-overlay').classList.add('hidden');say('تم رفض المكالمة');
}
async function endCall(){await finishCall(true);}
async function finishCall(notify){
 var c=callSession;if(!c){$('call-overlay').classList.add('hidden');incomingCall=null;return;}
 if(notify)await signal({kind:'ended',from:me.id});
 Object.keys(peerConnections).forEach(function(id){try{peerConnections[id].close();}catch(e){}});peerConnections={};pendingIce={};
 if(localStream){localStream.getTracks().forEach(function(t){t.stop();});localStream=null;}
 if(callChannel){await db.removeChannel(callChannel);callChannel=null;}
 await db.from('call_participants').update({status:'left',left_at:new Date().toISOString()}).eq('call_id',c.id).eq('user_id',me.id);
 if(c.created_by===me.id)await db.from('call_sessions').update({status:'ended',ended_at:new Date().toISOString()}).eq('id',c.id);
 callSession=null;$('call-overlay').classList.add('hidden');$('call-media-stage').classList.remove('video-active');$('call-remote-video').srcObject=null;$('call-local-video').srcObject=null;$('call-remote-audio').srcObject=null;
 if(document.querySelector('#calls-panel:not(.hidden)'))loadCallHistory();
}
function init(){
 if(!db)return;
 $('community-create-form').addEventListener('submit',createCommunity);
 $('community-join-form').addEventListener('submit',joinByCode);
 $('community-message-form').addEventListener('submit',sendCommunityMessage);
 $('community-back').onclick=async function(){if(communityChannel){await db.removeChannel(communityChannel);communityChannel=null;}activeCommunity=null;$('community-room').classList.add('hidden');$('community-list').classList.remove('hidden');};
 $('community-group-call').onclick=function(){startCommunityCall('audio');};$('community-group-video-call').onclick=function(){startCommunityCall('video');};
 $('calls-go-chats').onclick=backToChats;
 $('gata-call-audio').onclick=function(){startDirectCall('audio');};
 $('gata-call-video').onclick=function(){startDirectCall('video');};
 $('call-accept').onclick=acceptIncoming;$('call-decline').onclick=rejectIncoming;$('call-hangup').onclick=endCall;
 $('call-mute').onclick=function(){if(!localStream)return;var track=localStream.getAudioTracks()[0];if(track){track.enabled=!track.enabled;this.textContent=track.enabled?'🎙 كتم':'🔇 تشغيل الصوت';}};
 $('call-camera').onclick=function(){if(!localStream)return;var track=localStream.getVideoTracks()[0];if(track){track.enabled=!track.enabled;this.textContent=track.enabled?'📷 إيقاف الكاميرا':'📷 تشغيل الكاميرا';}};
 window.addEventListener('gata:section',function(e){page(e.detail.key);});
 db.auth.onAuthStateChange(function(_event,session){
  me=session&&session.user||null;window.gataUser=me;
  if(callsFeed){db.removeChannel(callsFeed);callsFeed=null;}
  if(me){
   callsFeed=db.channel('call-invitations-'+me.id,{config:{private:true}}).on('postgres_changes',{event:'INSERT',schema:'public',table:'call_participants',filter:'user_id=eq.'+me.id},function(payload){handleIncoming(payload.new);}).subscribe();
  }
 });
 db.auth.getSession().then(function(r){me=r.data.session&&r.data.session.user||window.gataUser||null;if(me&&!callsFeed){callsFeed=db.channel('call-invitations-'+me.id).on('postgres_changes',{event:'INSERT',schema:'public',table:'call_participants',filter:'user_id=eq.'+me.id},function(payload){handleIncoming(payload.new);}).subscribe();}});
}
document.addEventListener('DOMContentLoaded',init);
})();