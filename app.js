/* Gata App — Arabic-first messaging PWA */
(function(){
'use strict';
var SUPABASE_URL='https://gncoeyferzqhyhfwwmyr.supabase.co';
var SUPABASE_KEY='sb_publishable_N0YCbA8bfJMOZ3JVRj2TlA_iBJQrpsp';
var db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var user=null,currentConversation=null,currentPeer=null,channel=null,heartbeat=null,mediaRecorder=null,recordedChunks=[],profileData=null,language=localStorage.getItem('gata-language')||'ar';
function privacyPref(key,defaultValue){try{var v=localStorage.getItem('gata-privacy-'+key);return v===null?defaultValue:v==='true';}catch(e){return defaultValue;}}
function setPrivacyPref(key,value){try{localStorage.setItem('gata-privacy-'+key,String(!!value));}catch(e){toast('تعذر حفظ الإعداد على الجهاز');}}
function applyPrivacySettings(){if($('privacy-last-seen'))$('privacy-last-seen').checked=privacyPref('last-seen',true);if($('privacy-read-receipts'))$('privacy-read-receipts').checked=privacyPref('read-receipts',true);}
function formatBytes(n){if(!n)return'0 بايت';var units=['بايت','KB','MB','GB'];var i=0;while(n>=1024&&i<units.length-1){n/=1024;i++;}return(i===0?Math.round(n):n.toFixed(1))+' '+units[i];}
async function loadStorageStats(){if(!user)return;var status=$('storage-status');status.textContent='جاري حساب مساحة الملفات...';$('storage-refresh-btn').disabled=true;try{var all=[];async function walk(folder,depth){if(depth>5)return;var offset=0;while(true){var res=await db.storage.from('gata-media').list(folder,{limit:100,offset:offset,sortBy:{column:'name',order:'asc'}});if(res.error)throw res.error;var rows=res.data||[];for(var i=0;i<rows.length;i++){var item=rows[i];if(item.id===null){await walk(folder?folder+'/'+item.name:item.name,depth+1);}else all.push(item);}if(rows.length<100)break;offset+=100;}}await walk(user.id,0);var total=0,images=0,audio=0;all.forEach(function(file){var size=Number(file.metadata&&file.metadata.size||0);total+=size;var mime=String(file.metadata&&file.metadata.mimetype||'');if(mime.indexOf('image/')===0)images++;else if(mime.indexOf('audio/')===0||/\.(webm|ogg|mp3|m4a|wav)$/i.test(file.name))audio++;});$('storage-total').textContent=formatBytes(total);$('storage-count').textContent=all.length;$('storage-images').textContent=images;$('storage-audio').textContent=audio;$('storage-progress-bar').style.width=(total?Math.min(100,total/(100*1024*1024)*100):0)+'%';status.textContent=all.length?'تم تحديث بيانات ملفاتك.':'مفيش ملفات مرفوعة في حسابك حتى الآن.';}catch(err){status.textContent='تعذر قراءة مساحة الملفات: '+(err.message||'تحقق من صلاحيات التخزين.');}finally{$('storage-refresh-btn').disabled=false;}}

var $=function(id){return document.getElementById(id);};
var translations={
 ar:{login:'تسجيل الدخول',signup:'إنشاء حساب',conversations:'المحادثات',newChat:'محادثة جديدة',searchHint:'اكتب اسم المستخدم للبحث عنه.',search:'بحث',send:'إرسال',write:'اكتب رسالتك...',online:'متصل',offline:'غير متصل',welcome:'أهلاً بيك في جتاب',welcomeText:'ابدأ محادثة جديدة وابحث عن أصحابك باسم المستخدم.',empty:'لسه مفيش محادثات. ابدأ واحدة جديدة!',noResults:'ملقيناش مستخدم بالاسم ده.',settings:'الإعدادات',language:'اللغة',account:'حسابك',logout:'تسجيل الخروج',find:'بحث',start:'ابدأ محادثة'},
 en:{login:'Sign in',signup:'Create account',conversations:'Chats',newChat:'New chat',searchHint:'Search by username.',search:'Search',send:'Send',write:'Write a message...',online:'Online',offline:'Offline',welcome:'Welcome to Gata',welcomeText:'Start a new chat and find people by username.',empty:'No chats yet. Start a new one!',noResults:'No user found with that username.',settings:'Settings',language:'Language',account:'Your account',logout:'Log out',find:'Search',start:'Start chatting'}
};
function tr(k){return (translations[language]||translations.ar)[k]||k;}
function toast(msg){var el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2800);}
function note(msg){$('auth-note').textContent=msg||'';}
function applyTheme(){
 var light=localStorage.getItem('gata-theme')==='light';
 document.body.classList.toggle('light',light);
 var icon=light?'🌙':'☀️';
 ['theme-toggle','theme-toggle-auth'].forEach(function(id){
  var b=$(id);if(b){b.textContent=icon;b.setAttribute('aria-label',light?'التبديل للوضع الليلي':'التبديل للوضع النهاري');b.title=light?'الوضع الليلي':'الوضع النهاري';}
 });
 var meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute('content',light?'#edf4f8':'#0a1020');
}
function toggleTheme(){
 var next=document.body.classList.contains('light')?'dark':'light';
 try{localStorage.setItem('gata-theme',next);}catch(e){}
 applyTheme();
}
window.gataToggleTheme=toggleTheme;

function safe(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function initials(s){var a=String(s||'G').trim().split(/\s+/);return (a[0][0]||'G').toUpperCase();}
function setAvatar(el,url){if(!el)return;if(url)el.innerHTML='<img class="avatar-image" src="'+safe(url)+'" alt="">';else el.textContent='G';}
function avatarHTML(url,name){return url?'<div class="avatar"><img class="avatar-image" src="'+safe(url)+'" alt=""></div>':'<div class="avatar">'+safe(initials(name))+'</div>';}
function isMedia(content){
 try{
  if(content&&typeof content==='object')return content.kind&&content.path?content:null;
  var raw=String(content||'').trim();
  var marker=raw.indexOf('GATA_MEDIA:');
  if(marker>=0)raw=raw.slice(marker+11).trim();
  if(raw.charAt(0)==='{'){
   var data=JSON.parse(raw);
   if(data&&data.path&&(data.kind==='image'||data.kind==='audio'))return data;
  }
 }catch(e){}
 return null;
}
async function mediaUrl(path){var r=await db.storage.from('gata-media').createSignedUrl(path,3600);if(r.error)throw r.error;return r.data.signedUrl;}
async function uploadMedia(file,kind){
 if(!currentConversation||!file)return;
 var allowed=kind==='image'?['image/jpeg','image/png','image/webp']:['audio/webm','audio/ogg','audio/mp4','audio/mpeg'];
 if(!allowed.includes(file.type)){toast('نوع الملف غير مدعوم');return;}
 if(file.size>(kind==='image'?5:25)*1024*1024){toast('حجم الملف أكبر من المسموح');return;}
 var ext=(file.name&&file.name.split('.').pop()||(kind==='image'?'jpg':'webm')).toLowerCase().replace(/[^a-z0-9]/g,'');
 var path=user.id+'/'+currentConversation+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
 toast('جاري رفع الملف...');
 var up=await db.storage.from('gata-media').upload(path,file,{contentType:file.type,upsert:false});
 if(up.error){toast('تعذر رفع الملف: '+up.error.message);return;}
 var payload={kind:kind,path:path,name:file.name||('voice.'+ext),mime:file.type};
 var ins=await db.from('messages').insert({conversation_id:currentConversation,sender_id:user.id,content:'GATA_MEDIA:'+JSON.stringify(payload)}).select().single();
 if(ins.error){await db.storage.from('gata-media').remove([path]);toast('تعذر إرسال الملف: '+ins.error.message);return;}
 await renderMessage(ins.data);$('messages').scrollTop=$('messages').scrollHeight;
}
function openImagePreview(url){var layer=$('image-preview'),img=$('image-preview-content');img.src=url;layer.classList.remove('hidden');$('close-image-preview').focus();}
function closeImagePreview(){var layer=$('image-preview');layer.classList.add('hidden');$('image-preview-content').removeAttribute('src');}
function dateLabel(s){return new Date(s).toLocaleTimeString(language==='ar'?'ar-EG':'en-US',{hour:'2-digit',minute:'2-digit'});}
function showAuth(tab){$('auth-view').classList.remove('hidden');$('chat-view').classList.add('hidden');$('login-form').classList.toggle('hidden',tab==='signup');$('signup-form').classList.toggle('hidden',tab!=='signup');$('show-login').classList.toggle('active',tab!=='signup');$('show-signup').classList.toggle('active',tab==='signup');note('');}
function applyLanguage(){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.body.dir=document.documentElement.dir;$('message-input').placeholder=tr('write');$('settings-title');$('language-select').value=language;var labels=document.querySelectorAll('[data-i18n]');labels.forEach(function(el){el.textContent=tr(el.dataset.i18n);});}
async function ensureProfile(){
 var res=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();
 if(res.error)throw res.error;
 if(res.data){profileData=res.data;return res.data;}
 var meta=user.user_metadata||{};
 var uname=String(meta.username||'').toLowerCase();
 if(!uname){throw new Error('الحساب ده محتاج اسم مستخدم. تواصل مع الدعم.');}
 var ins=await db.from('profiles').insert({id:user.id,username:uname,display_name:meta.display_name||uname}).select().single();
 if(ins.error)throw ins.error;profileData=ins.data;return ins.data;
}
async function enterApp(){
 $('auth-view').classList.add('hidden');$('chat-view').classList.remove('hidden');
 var p=await ensureProfile();$('my-handle').textContent='@'+p.username;$('settings-user').textContent='@'+p.username;$('settings-display-name').textContent=p.display_name||p.username;$('profile-display-name').value=p.display_name||'';$('profile-bio-input').value=p.bio||'';$('profile-bio-count').textContent=($('profile-bio-input').value||'').length;$('profile-status-input').value=String(p.status_text||'').indexOf('GATA_STATUS:')===0?'':(p.status_text||'');$('profile-status-count').textContent=($('profile-status-input').value||'').length;setAvatar($('chat-avatar'),p.avatar_url);setAvatar($('settings-avatar'),p.avatar_url);
 if(privacyPref('last-seen',true))await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);
 applyPrivacySettings();await loadConversations();startHeartbeat();subscribeGlobal();
}


function parseStatusPayload(profile){
 if(!profile)return {type:'text',text:''};
 if(profile.status_media_path&&['image','video','audio'].includes(profile.status_media_kind))return {type:profile.status_media_kind,path:profile.status_media_path,text:profile.status_caption||''};
 return {type:'text',text:profile.status_text||''};
}
function statusIsActive(p){
 var t=p&&p.status_updated_at?new Date(p.status_updated_at).getTime():0;
 return !!(p&&(p.status_text||p.status_media_path)&&t&&Date.now()-t>=0&&Date.now()-t<86400000);
}
async function showStatusViewer(profileId){
 var panel=$('status-viewer'),content=$('status-viewer-content'),owner=$('status-viewer-owner'),time=$('status-viewer-time'),del=$('delete-my-status');
 panel.classList.remove('hidden');content.innerHTML='<span>جاري تحميل الحالة...</span>';owner.textContent='';time.textContent='';del.classList.add('hidden');
 var data=null;
 if(profileId===user.id)data=profileData||await ensureProfile();
 else{var q=await db.from('profiles').select('id,username,display_name,avatar_url,status_text,status_media_path,status_media_kind,status_caption,status_updated_at').eq('id',profileId).maybeSingle();if(q.error||!q.data){content.textContent='تعذر تحميل الحالة';return;}data=q.data;}
 if(!statusIsActive(data)){content.textContent='انتهت صلاحية الحالة';return;}
 var payload=parseStatusPayload(data),name=data.display_name||data.username||'مستخدم جتا';
 owner.textContent=(profileId===user.id?'حالتي':'حالة '+name);
 time.textContent='نُشرت '+new Date(data.status_updated_at).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'});
 content.innerHTML='';
 if(payload.type==='text'){
  var textNode=document.createElement('div');textNode.className='status-viewer-text';textNode.textContent=payload.text||'';content.appendChild(textNode);
 }else{
  try{
   var signed=await db.storage.from('gata-statuses').createSignedUrl(payload.path,3600);
   if(signed.error)throw signed.error;
   var media;
   if(payload.type==='image'){media=document.createElement('img');media.alt='صورة الحالة';}
   else if(payload.type==='video'){media=document.createElement('video');media.controls=true;media.playsInline=true;media.autoplay=true;}
   else{media=document.createElement('audio');media.controls=true;media.autoplay=true;}
   media.src=signed.data.signedUrl;content.appendChild(media);
   if(payload.text){var caption=document.createElement('p');caption.className='status-viewer-text';caption.textContent=payload.text;content.appendChild(caption);}
  }catch(err){content.textContent='تعذر تحميل الملف. تأكد من اتصال الإنترنت.';}
 }
 if(profileId===user.id)del.classList.remove('hidden');
}
async function saveStatusValue(value){
 var now=new Date().toISOString();
 var result=await db.from('profiles').update({status_text:value,status_media_path:null,status_media_kind:null,status_caption:null,status_updated_at:now}).eq('id',user.id);
 if(result.error)throw result.error;
 if(profileData){profileData.status_text=value;profileData.status_media_path=null;profileData.status_media_kind=null;profileData.status_caption=null;profileData.status_updated_at=now;}
 await loadConversations();
}
async function publishTextStatus(){
 var input=$('quick-status-text'),value=input.value.trim();
 if(!value){toast('اكتب الحالة الأول');input.focus();return;}
 if(value.length>80){toast('الحالة لا تزيد عن 80 حرف');return;}
 try{await saveStatusValue(value);input.value='';toast('تم نشر حالتك لمدة 24 ساعة');}
 catch(err){toast('تعذر نشر الحالة: '+err.message);}
}
async function publishStatusFile(file,kind){
 if(!file||!user)return;
 var allowed=kind==='image'?['image/jpeg','image/png','image/webp']:kind==='video'?['video/mp4','video/webm']:['audio/webm','audio/ogg','audio/mp4','audio/mpeg'];
 if(!allowed.includes(file.type)){toast('صيغة الملف غير مدعومة');return;}
 var limit=kind==='image'?5*1024*1024:25*1024*1024;
 if(file.size>limit){toast('حجم الملف أكبر من المسموح');return;}
 var ext=(file.name.split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
 var path=user.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
 var note=$('status-compose-note');note.textContent='جاري رفع الحالة...';
 var up=await db.storage.from('gata-statuses').upload(path,file,{contentType:file.type,upsert:false});
 if(up.error){note.textContent='';toast('تعذر رفع الحالة: '+up.error.message);return;}
 var caption=$('quick-status-text').value.trim();
 var now=new Date().toISOString();
 var saved=await db.from('profiles').update({status_text:null,status_media_path:path,status_media_kind:kind,status_caption:caption||null,status_updated_at:now}).eq('id',user.id);
 if(saved.error){await db.storage.from('gata-statuses').remove([path]);note.textContent='';toast('تعذر حفظ الحالة: '+saved.error.message);return;}
 if(profileData){profileData.status_text=null;profileData.status_media_path=path;profileData.status_media_kind=kind;profileData.status_caption=caption||null;profileData.status_updated_at=now;}
 $('quick-status-text').value='';note.textContent='تم نشر الحالة وستختفي بعد 24 ساعة';await loadConversations();toast('تم نشر الحالة بنجاح');
}
async function recordStatusAudio(){
 var btn=$('record-status-audio');
 if(statusRecorder&&statusRecorder.state==='recording'){statusRecorder.stop();btn.textContent='🎙 تسجيل صوتي';btn.disabled=true;return;}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){toast('تسجيل الصوت غير مدعوم في المتصفح ده');return;}
 try{
  var stream=await navigator.mediaDevices.getUserMedia({audio:true}),chunks=[];
  var types=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'],mime=types.find(function(t){return MediaRecorder.isTypeSupported(t);});
  statusRecorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
  statusRecorder.ondataavailable=function(e){if(e.data.size)chunks.push(e.data);};
  statusRecorder.onstop=async function(){
   stream.getTracks().forEach(function(t){t.stop();});
   var blob=new Blob(chunks,{type:statusRecorder.mimeType||'audio/webm'}),type=blob.type.split(';')[0]||'audio/webm';
   btn.disabled=false;
   var ext=type==='audio/ogg'?'ogg':type==='audio/mp4'?'mp4':'webm';
   await publishStatusFile(new File([blob],'status-voice.'+ext,{type:type}),'audio');
  };
  statusRecorder.start();btn.textContent='■ إيقاف وإرسال';toast('التسجيل بدأ؛ اضغط إيقاف وإرسال عند الانتهاء');
 }catch(err){toast('اسمح باستخدام الميكروفون لتسجيل الحالة');}
}
async function deleteMyStatus(){
 if(!confirm('تحذف حالتك الحالية؟'))return;
 var payload=parseStatusPayload(profileData);
 if(payload.path){var removed=await db.storage.from('gata-statuses').remove([payload.path]);if(removed.error){toast('تعذر حذف ملف الحالة: '+removed.error.message);return;}}
 var result=await db.from('profiles').update({status_text:null,status_media_path:null,status_media_kind:null,status_caption:null,status_updated_at:null}).eq('id',user.id);
 if(result.error){toast('تعذر حذف الحالة: '+result.error.message);return;}
 if(profileData){profileData.status_text=null;profileData.status_media_path=null;profileData.status_media_kind=null;profileData.status_caption=null;profileData.status_updated_at=null;}
 $('status-viewer').classList.add('hidden');await loadConversations();toast('تم حذف حالتك');
}

var statusRecorder=null;
async function loadFriendStatuses(conversationIds){
 var list=$('friend-status-list');if(!list)return;
 list.innerHTML='';
 function addStatus(p,isMine){
  var name=isMine?'حالتي':(p.display_name||p.username||'صديق');
  var item=document.createElement('button');item.type='button';item.className='friend-status-item'+(isMine?' mine':'');
  var avatar=p.avatar_url?'<span class="friend-status-avatar"><img src="'+safe(p.avatar_url)+'" alt=""></span>':'<span class="friend-status-avatar">'+avatarHTML(null,name)+'</span>';
  item.innerHTML=avatar+'<strong>'+safe(name)+'</strong>';
  item.classList.add('has-status');item.addEventListener('click',function(){showStatusViewer(isMine?user.id:p.id);});
  list.appendChild(item);
 }
 addStatus(profileData||{},true);
 if(!conversationIds||!conversationIds.length){list.insertAdjacentHTML('beforeend','<span class="status-empty">ابدأ محادثة لعرض حالات أصدقائك</span>');return;}
 var members=await db.from('conversation_members').select('user_id').in('conversation_id',conversationIds);
 if(members.error){list.insertAdjacentHTML('beforeend','<span class="status-empty">تعذر تحميل الحالات</span>');return;}
 var peerIds=[...new Set((members.data||[]).map(function(m){return m.user_id;}).filter(function(id){return id&&id!==user.id;}))];
 if(!peerIds.length){list.insertAdjacentHTML('beforeend','<span class="status-empty">لسه مفيش حالات جديدة</span>');return;}
 var profiles=await db.from('profiles').select('id,username,display_name,avatar_url,status_text,status_media_path,status_media_kind,status_caption,status_updated_at').in('id',peerIds);
 if(profiles.error){list.insertAdjacentHTML('beforeend','<span class="status-empty">تعذر تحميل الحالات</span>');return;}
 var now=Date.now();
 var active=(profiles.data||[]).filter(function(p){return statusIsActive(p);});
 if(!active.length){list.insertAdjacentHTML('beforeend','<span class="status-empty">لا توجد حالات جديدة</span>');return;}
 active.forEach(function(p){addStatus(p,false);});
}

async function loadConversations(){
 var box=$('conversation-list');box.innerHTML='<div class="empty-state">جاري تحميل المحادثات...</div>';
 var mem=await db.from('conversation_members').select('conversation_id').eq('user_id',user.id);
 if(mem.error){box.innerHTML='<div class="empty-state">'+safe(mem.error.message)+'</div>';return;}
 if(!mem.data.length){await loadFriendStatuses([]);box.innerHTML='<div class="empty-state">'+safe(tr('empty'))+'</div>';return;}
 var ids=mem.data.map(function(x){return x.conversation_id;});
 var conv=await db.from('conversations').select('id,title,is_group,created_at').in('id',ids).order('created_at',{ascending:false});
 if(conv.error){box.innerHTML='<div class="empty-state">'+safe(conv.error.message)+'</div>';return;}
 await loadFriendStatuses(ids);
 box.innerHTML='';
 for(var i=0;i<conv.data.length;i++){
  var c=conv.data[i];var members=await db.from('conversation_members').select('user_id').eq('conversation_id',c.id);
  var peerId=(members.data||[]).map(function(m){return m.user_id;}).find(function(id){return id!==user.id;});
  var peer=null;if(peerId){var pr=await db.from('profiles').select('username,display_name,last_seen,avatar_url').eq('id',peerId).maybeSingle();peer=pr.data;}
  var name=c.title||(peer?(peer.display_name||peer.username):'محادثة');
  var latest=await db.from('messages').select('content,created_at,sender_id').eq('conversation_id',c.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
  var preview=peer?'@'+peer.username:'ابدأ المحادثة';
  var time='';
  if(latest.data){
   var media=isMedia(latest.data.content);
   preview=media?'مرفق':String(latest.data.content||'');
   if(latest.data.sender_id===user.id)preview='أنت: '+preview;
   time=dateLabel(latest.data.created_at);
  }
  var unreadCount=0;
  try{
   var incoming=await db.from('messages').select('id').eq('conversation_id',c.id).neq('sender_id',user.id);
   if(!incoming.error&&incoming.data&&incoming.data.length){
    var messageIds=incoming.data.map(function(m){return m.id;});
    var readRows=await db.from('message_reads').select('message_id').eq('reader_id',user.id).in('message_id',messageIds);
    if(!readRows.error){var readSet=new Set((readRows.data||[]).map(function(x){return x.message_id;}));unreadCount=messageIds.filter(function(id){return !readSet.has(id);}).length;}
   }
  }catch(err){}
  if(currentConversation===c.id)unreadCount=0;
  var b=document.createElement('div');b.className='conversation-item'+(currentConversation===c.id?' active':'');b.setAttribute('role','button');b.tabIndex=0;
  b.dataset.search=(name+' '+(peer&&peer.username||'')+' '+preview).toLocaleLowerCase();b.innerHTML=avatarHTML(peer&&peer.avatar_url,name)+'<div class="conversation-info"><strong>'+safe(name)+'</strong><span class="conversation-preview">'+safe(preview)+'</span></div><div class="conversation-side">'+(time?'<time class="conversation-time">'+safe(time)+'</time>':'')+(unreadCount?'<span class="unread-badge" aria-label="'+unreadCount+' رسائل غير مقروءة">'+(unreadCount>99?'99+':unreadCount)+'</span>':'')+'</div><button class="delete-chat-btn" type="button" title="حذف الدردشة" aria-label="حذف الدردشة">🗑</button>';
  b.addEventListener('click',(function(id,p,n){return function(){openConversation(id,p,n);};})(c.id,peerId,name));
  b.addEventListener('keydown',(function(id,p,n){return function(ev){if((ev.key==='Enter'||ev.key===' ')&&ev.target===b){ev.preventDefault();openConversation(id,p,n);}};})(c.id,peerId,name));
  b.querySelector('.delete-chat-btn').addEventListener('click',function(ev){ev.stopPropagation();deleteConversation(c.id,name);});box.appendChild(b);
 }
 filterConversations();
}
function filterConversations(){
 var input=$('chat-search'),box=$('conversation-list');if(!input||!box)return;
 var term=input.value.trim().toLocaleLowerCase();var cards=box.querySelectorAll('.conversation-item');var shown=0;
 cards.forEach(function(card){var hay=(card.dataset.search||card.textContent||'').toLocaleLowerCase();var match=!term||hay.includes(term);card.style.display=match?'':'none';if(match)shown++;});
 var empty=box.querySelector('.chat-filter-empty');if(empty)empty.remove();
 if(term&&cards.length&&shown===0){var msg=document.createElement('div');msg.className='empty-state chat-filter-empty';msg.textContent='ملقيناش محادثة بالاسم ده.';box.appendChild(msg);}
}
async function deleteConversation(id,name){
 if(!confirm('حذف دردشة '+name+' من قائمة محادثاتك؟ لن تُحذف الرسائل من حساب الطرف الآخر.'))return;
 var result=await db.from('conversation_members').delete().eq('conversation_id',id).eq('user_id',user.id);
 if(result.error){toast('تعذر حذف الدردشة: '+result.error.message);return;}
 if(currentConversation===id){currentConversation=null;currentPeer=null;showChats();$('active-chat').classList.add('hidden');$('welcome-panel').classList.remove('hidden');}
 toast('تم حذف الدردشة من قائمتك');
 await loadConversations();
}
async function showPublicProfile(profileId){var panel=$('public-profile-view');panel.classList.remove('hidden');$('public-profile-name').textContent='جاري تحميل الملف الشخصي...';$('public-profile-handle').textContent='';$('public-profile-gataid').textContent='—';$('public-profile-joined').textContent='—';$('public-profile-status').textContent='—';$('public-profile-status-card').classList.add('hidden');setAvatar($('public-profile-avatar'),null);var data=null;if(profileId===user.id){data=profileData||await ensureProfile();}else{var result=await db.from('profiles').select('id,username,display_name,avatar_url,gata_id,created_at,last_seen,bio,status_text,status_updated_at').eq('id',profileId).maybeSingle();if(result.error||!result.data){$('public-profile-name').textContent='تعذر تحميل الملف الشخصي';$('public-profile-note').textContent='ممكن يكون الحساب غير متاح حاليًا.';return;}data=result.data;}var name=data.display_name||data.username||'مستخدم جتا';$('public-profile-name').textContent=name;$('public-profile-bio').textContent=data.bio||'لم يكتب نبذة شخصية بعد.';$('public-profile-handle').textContent='@'+(data.username||'—');$('public-profile-gataid').textContent=data.gata_id||'غير متاح';$('public-profile-joined').textContent=data.created_at?new Date(data.created_at).toLocaleDateString('ar-EG',{year:'numeric',month:'long'}):'غير متاح';var online=data.last_seen&&(Date.now()-new Date(data.last_seen).getTime()<65000);$('public-profile-status').textContent=profileId===user.id?'حسابك':(online?'متصل الآن':'غير متصل');var statusTime=data.status_updated_at?new Date(data.status_updated_at):null;var age=statusTime?Date.now()-statusTime.getTime():Infinity;var parsedStatus=parseStatusPayload(data);var activeStatus=!!(data.status_text&&statusTime&&age>=0&&age<24*60*60*1000);if(activeStatus){$('public-profile-status-text').textContent=parsedStatus.type==='text'?parsedStatus.text:('حالة '+(parsedStatus.type==='image'?'بصورة':parsedStatus.type==='video'?'بفيديو':'صوتية'));$('public-profile-status-time').textContent='نُشرت '+statusTime.toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'});$('public-profile-status-card').classList.remove('hidden');}$('public-profile-note').textContent=profileId===user.id?'دي صفحتك الشخصية كما تظهر داخل جتا آب.':'دي المعلومات العامة المتاحة للحساب على جتا آب.';setAvatar($('public-profile-avatar'),data.avatar_url);}
async function openConversation(id,peerId,name){
 var workspace=$('chat-view').querySelector('.workspace');
 if(!workspace.classList.contains('chat-open')){try{history.pushState({gataChat:true},'','#chat');}catch(e){}}
 workspace.classList.add('chat-open');
 currentConversation=id;currentPeer=peerId;$('welcome-panel').classList.add('hidden');$('active-chat').classList.remove('hidden');
 $('chat-name').textContent=name||'محادثة';$('chat-avatar').textContent=initials(name);if(currentPeer){var pa=await db.from('profiles').select('avatar_url').eq('id',currentPeer).maybeSingle();setAvatar($('chat-avatar'),pa.data&&pa.data.avatar_url);}else setAvatar($('chat-avatar'),null);$('chat-person').onclick=function(){if(currentPeer)showPublicProfile(currentPeer);};$('chat-avatar').onclick=function(){if(currentPeer)showPublicProfile(currentPeer);};
 await refreshPeerStatus();await loadMessages();await loadConversations();
}
async function refreshPeerStatus(){
 if(!currentPeer){$('chat-status').textContent=tr('offline');return;}
 var r=await db.from('profiles').select('last_seen').eq('id',currentPeer).maybeSingle();
 var online=r.data&&r.data.last_seen&&(Date.now()-new Date(r.data.last_seen).getTime()<65000);
 $('chat-status').textContent=online?tr('online'):tr('offline');
}
async function loadMessages(){
 var box=$('messages');box.innerHTML='';
 var r=await db.from('messages').select('id,sender_id,content,created_at').eq('conversation_id',currentConversation).order('created_at',{ascending:true}).limit(150);
 if(r.error){box.innerHTML='<div class="empty-state">'+safe(r.error.message)+'</div>';return;}
 var incoming=[];
 r.data.forEach(function(m){renderMessage(m);if(m.sender_id!==user.id)incoming.push(m.id);});
 if(incoming.length&&privacyPref('read-receipts',true)){var rows=incoming.map(function(id){return {message_id:id,reader_id:user.id};});await db.from('message_reads').upsert(rows,{onConflict:'message_id,reader_id',ignoreDuplicates:true});}
 box.scrollTop=box.scrollHeight;
}
async function renderMessage(m){
 var box=$('messages'),div=document.createElement('div');div.className='bubble'+(m.sender_id===user.id?' mine':'');div.dataset.id=m.id;box.appendChild(div);
 var body=document.createElement('div'),media=isMedia(m.content);
 if(media){try{var url=await mediaUrl(media.path);if(media.kind==='image'){var im=document.createElement('img');im.src=url;im.alt='صورة مرسلة';im.className='sent-image';im.loading='lazy';im.addEventListener('click',function(){openImagePreview(url);});im.setAttribute('role','button');im.setAttribute('tabindex','0');im.setAttribute('aria-label','فتح الصورة بحجم أكبر');im.addEventListener('keydown',function(ev){if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();openImagePreview(url);}});body.appendChild(im);}else{var au=document.createElement('audio');au.controls=true;au.preload='metadata';au.src=url;au.className='sent-audio';body.appendChild(au);}}catch(err){body.textContent='تعذر تحميل المرفق';}}
 else body.textContent=m.content;
 var meta=document.createElement('div');meta.className='bubble-meta';var time=document.createElement('span');time.textContent=dateLabel(m.created_at);meta.appendChild(time);
 if(m.sender_id===user.id&&privacyPref('read-receipts',true)){var read=await db.from('message_reads').select('message_id').eq('message_id',m.id).neq('reader_id',user.id);var rs=document.createElement('span');rs.className='read-state';rs.textContent=read.data&&read.data.length?'✓✓':'✓';meta.appendChild(rs);}
 if(!media){var copy=document.createElement('button');copy.className='message-delete';copy.type='button';copy.textContent='نسخ';copy.title='نسخ الرسالة';copy.addEventListener('click',async function(){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(String(m.content||''));}else{var ta=document.createElement('textarea');ta.value=String(m.content||'');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();}toast('تم نسخ الرسالة');}catch(err){toast('تعذر نسخ الرسالة');}});meta.appendChild(copy);if(m.sender_id===user.id){var edit=document.createElement('button');edit.className='message-delete';edit.type='button';edit.textContent='تعديل';edit.title='تعديل الرسالة';edit.addEventListener('click',async function(){var next=prompt('عدّل نص الرسالة:',String(m.content||''));if(next===null)return;next=next.trim();if(!next){toast('الرسالة لا يمكن أن تكون فارغة');return;}if(next.length>4000){toast('الرسالة أطول من المسموح');return;}var upd=await db.from('messages').update({content:next}).eq('id',m.id).eq('sender_id',user.id).select().single();if(upd.error){toast('تعذر تعديل الرسالة: '+upd.error.message);return;}m.content=next;body.textContent=next;toast('تم تعديل الرسالة');});meta.appendChild(edit);}}var del=document.createElement('button');del.className='message-delete';del.type='button';del.textContent='حذف';del.title='حذف للطرفين';del.addEventListener('click',async function(){if(!confirm('حذف الرسالة من عندك وعند الطرف الآخر؟'))return;var d=await db.from('messages').delete().eq('id',m.id);if(d.error)toast('تعذر حذف الرسالة: '+d.error.message);});meta.appendChild(del);div.appendChild(body);div.appendChild(meta);
}
async function sendMessage(e){
 e.preventDefault();var input=$('message-input'),content=input.value.trim();if(!content||!currentConversation)return;
 input.value='';var r=await db.from('messages').insert({conversation_id:currentConversation,sender_id:user.id,content:content}).select().single();
 if(r.error){toast('تعذر إرسال الرسالة: '+r.error.message);input.value=content;return;}
 await renderMessage(r.data);$('messages').scrollTop=$('messages').scrollHeight;
}
function subscribeGlobal(){
 if(channel)db.removeChannel(channel);
 channel=db.channel('gata-live-'+user.id)
 .on('postgres_changes',{event:'*',schema:'public',table:'messages'},function(payload){var m=payload.new||payload.old;if(currentConversation&&m.conversation_id===currentConversation){if(payload.eventType==='INSERT'&&m.sender_id!==user.id){renderMessage(m);if(privacyPref('read-receipts',true))db.from('message_reads').upsert({message_id:m.id,reader_id:user.id},{onConflict:'message_id,reader_id',ignoreDuplicates:true});$('messages').scrollTop=$('messages').scrollHeight;}else if(payload.eventType==='UPDATE'){var el=document.querySelector('[data-id="'+m.id+'"]');if(el&&!isMedia(m.content)){var body=el.firstElementChild;if(body)body.textContent=m.content;}}else if(payload.eventType==='DELETE'){var el=document.querySelector('[data-id="'+m.id+'"]');if(el)el.remove();}}loadConversations();})
 .on('postgres_changes',{event:'*',schema:'public',table:'message_reads'},function(payload){var m=payload.new||payload.old;var el=document.querySelector('[data-id="'+m.message_id+'"] .read-state');if(el&&privacyPref('read-receipts',true))el.textContent='✓✓';})
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},function(){refreshPeerStatus();})
 .subscribe();
}
function startHeartbeat(){if(heartbeat)clearInterval(heartbeat);heartbeat=setInterval(async function(){if(user&&privacyPref('last-seen',true))await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);if(currentConversation)refreshPeerStatus();},30000);}
function openModal(){$('modal-title').textContent='محادثة جديدة';$('modal-hint').textContent='اكتب اسم المستخدم للبحث عنه.';$('search-form').classList.remove('hidden');$('modal').classList.remove('hidden');$('user-search').value='';$('search-results').innerHTML='';$('user-search').focus();}
async function openContacts(){
 $('modal-title').textContent='جهات الاتصال';$('modal-hint').textContent='الأشخاص الذين بدأت معهم محادثات على جتاب.';$('search-form').classList.add('hidden');$('search-results').innerHTML='<div class="empty-state">جاري تحميل جهات الاتصال...</div>';$('modal').classList.remove('hidden');
 var box=$('search-results');
 var mem=await db.from('conversation_members').select('conversation_id').eq('user_id',user.id);
 if(mem.error){box.textContent='تعذر تحميل جهات الاتصال: '+mem.error.message;return;}
 var ids=[...new Set((mem.data||[]).map(function(x){return x.conversation_id;}))];
 if(!ids.length){box.innerHTML='<div class="empty-state">لسه مفيش جهات اتصال. ابدأ محادثة جديدة لإضافتهم هنا.</div>';return;}
 var conv=await db.from('conversations').select('id,title,is_group').in('id',ids).order('created_at',{ascending:false});
 if(conv.error){box.textContent='تعذر تحميل القائمة: '+conv.error.message;return;}
 var contacts=[];
 for(var i=0;i<conv.data.length;i++){
  var c=conv.data[i],members=await db.from('conversation_members').select('user_id').eq('conversation_id',c.id);
  var peerId=(members.data||[]).map(function(m){return m.user_id;}).find(function(id){return id!==user.id;});
  if(!peerId)continue;
  var pr=await db.from('profiles').select('id,username,display_name,avatar_url,last_seen').eq('id',peerId).maybeSingle();
  if(pr.data&&!contacts.some(function(x){return x.id===pr.data.id;}))contacts.push({profile:pr.data,conversation:c});
 }
 box.innerHTML='';
 if(!contacts.length){box.innerHTML='<div class="empty-state">مفيش جهات اتصال لعرضها حاليًا.</div>';return;}
 contacts.forEach(function(item){var p=item.profile,c=item.conversation,name=p.display_name||p.username;var row=document.createElement('div');row.className='result-user';row.innerHTML=avatarHTML(p.avatar_url,name)+'<div class="contact-details"><strong>'+safe(name)+'</strong><div class="muted">@'+safe(p.username)+'</div></div><button class="primary-btn" type="button">فتح</button>';row.querySelector('button').onclick=function(){$('modal').classList.add('hidden');openConversation(c.id,p.id,name);};box.appendChild(row);});
}
async function searchUsers(e){
 e.preventDefault();var term=$('user-search').value.trim().replace(/^@/,'').toLowerCase();if(term.length<8){toast('اسم المستخدم لازم يكون 8 أحرف على الأقل');return;}
 var r=await db.from('profiles').select('id,username,display_name').eq('username',term).neq('id',user.id).limit(10);
 var box=$('search-results');box.innerHTML='';
 if(r.error){box.textContent='تعذر البحث: '+r.error.message;return;}
 if(!r.data.length){box.textContent=tr('noResults');return;}
 r.data.forEach(function(p){var row=document.createElement('div');row.className='result-user';row.innerHTML='<div class="avatar">'+safe(initials(p.display_name||p.username))+'</div><div><strong>'+safe(p.display_name||p.username)+'</strong><div class="muted">@'+safe(p.username)+'</div></div><button class="primary-btn">مراسلة</button>';row.querySelector('button').addEventListener('click',function(){startDirectChat(p);});box.appendChild(row);});
}
async function startDirectChat(peer){
 if(!user||!peer||!peer.id||peer.id===user.id){toast('اختار حسابًا صحيحًا لبدء المحادثة');return;}
 toast('جاري تجهيز المحادثة...');
 var result=await db.rpc('get_or_create_direct_conversation',{p_peer_id:peer.id});
 if(result.error){toast('تعذر إنشاء المحادثة: '+result.error.message);return;}
 var cid=result.data;
 if(!cid){toast('تعذر إنشاء المحادثة: قاعدة البيانات لم تُرجع رقم المحادثة');return;}
 $('modal').classList.add('hidden');
 await openConversation(cid,peer.id,peer.display_name||peer.username);
 toast('المحادثة جاهزة');
}
async function login(e){e.preventDefault();note('جاري تسجيل الدخول...');var r=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(r.error){note('تعذر تسجيل الدخول: '+r.error.message);return;}user=r.data.user;try{await enterApp();}catch(err){note('تم تسجيل الدخول لكن تعذر تحميل الحساب: '+err.message);}}
async function signup(e){
 e.preventDefault();var username=$('signup-username').value.trim().toLowerCase(),name=$('signup-name').value.trim(),email=$('signup-email').value.trim(),password=$('signup-password').value;
 if(!/^(?=.*\d)[a-z0-9_]{8,24}$/.test(username)){note('اسم المستخدم لازم يكون 8-24 حرف إنجليزي أو رقم أو _ ويحتوي على رقم.');return;}
 if(password.length<8){note('كلمة المرور لازم تكون 8 أحرف على الأقل.');return;}
 note('جاري إنشاء الحساب...');
 var check=await db.from('profiles').select('id').eq('username',username).maybeSingle();if(check.data){note('اسم المستخدم مستخدم بالفعل. اختار اسم تاني.');return;}
 var r=await db.auth.signUp({email:email,password:password,options:{data:{username:username,display_name:name}}});
 if(r.error){note('تعذر إنشاء الحساب: '+r.error.message);return;}
 if(r.data.session){user=r.data.user;try{await enterApp();}catch(err){note('الحساب اتعمل لكن فيه مشكلة: '+err.message);}}
 else{note('تم إنشاء الحساب! افتح بريدك الإلكتروني وأكد الحساب، وبعدها سجّل الدخول.');showAuth('login');}
}
async function logout(){if(channel)await db.removeChannel(channel);if(heartbeat)clearInterval(heartbeat);await db.auth.signOut({scope:'local'});user=null;currentConversation=null;showAuth('login');}
async function changeAvatar(file){
 if(!file||!user)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('اختار صورة JPG أو PNG أو WebP');return;}if(file.size>5*1024*1024){toast('الصورة أكبر من 5 ميجابايت');return;}
 var ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=user.id+'/avatar-'+Date.now()+'.'+ext;toast('جاري تحديث الصورة...');
 var up=await db.storage.from('gata-avatars').upload(path,file,{contentType:file.type,upsert:false});if(up.error){toast('تعذر رفع الصورة: '+up.error.message);return;}
 var url=db.storage.from('gata-avatars').getPublicUrl(path).data.publicUrl,upd=await db.from('profiles').update({avatar_url:url}).eq('id',user.id);if(upd.error){toast('تعذر حفظ الصورة: '+upd.error.message);return;}
 if(profileData)profileData.avatar_url=url;setAvatar($('chat-avatar'),url);setAvatar($('settings-avatar'),url);toast('تم تحديث الصورة الشخصية');
}
async function saveProfileName(){
 var input=$('profile-display-name'),name=input.value.trim(),bio=$('profile-bio-input').value.trim(),status=$('profile-status-input').value.trim();if(!status&&profileData&&profileData.status_media_path)status='';
 if(!name){toast('اكتب اسم عرض صحيح');input.focus();return;}
 if(name.length>32){toast('اسم العرض طويل جدًا');return;}
 if(bio.length>160){toast('النبذة لا تزيد عن 160 حرف');return;}
 if(status.length>80&&String(status).indexOf('GATA_STATUS:')!==0){toast('الحالة لا تزيد عن 80 حرف');return;}
 var btn=$('save-profile-btn');btn.disabled=true;btn.textContent='جاري الحفظ...';
 var now=new Date().toISOString();var keepMedia=!status&&profileData&&profileData.status_media_path;var statusTime=keepMedia?profileData.status_updated_at:(status?now:null);var r=await db.from('profiles').update({display_name:name,bio:bio||null,status_text:status||null,status_media_path:keepMedia?profileData.status_media_path:null,status_media_kind:keepMedia?profileData.status_media_kind:null,status_caption:keepMedia?profileData.status_caption:null,status_updated_at:statusTime}).eq('id',user.id);
 btn.disabled=false;btn.textContent='حفظ التغييرات';
 if(r.error){toast('تعذر حفظ الملف الشخصي: '+r.error.message);return;}
 if(profileData){profileData.display_name=name;profileData.bio=bio||null;if(!keepMedia){profileData.status_text=status||null;profileData.status_media_path=null;profileData.status_media_kind=null;profileData.status_caption=null;profileData.status_updated_at=status?now:null;}}$('settings-display-name').textContent=name;
 toast('تم حفظ الاسم والنبذة والحالة بنجاح');await loadConversations();
}
async function refreshApp(){var btn=$('refresh-app-btn');if(btn){btn.disabled=true;btn.textContent='…';}toast('جاري تحديث جتاب...');try{if('serviceWorker' in navigator){var reg=await navigator.serviceWorker.getRegistration();if(reg)await reg.unregister();}if('caches' in window){var keys=await caches.keys();await Promise.all(keys.filter(function(k){return k.indexOf('gata-shell-')===0;}).map(function(k){return caches.delete(k);}));}}catch(e){}window.location.reload();}
function decodeSessionClaims(token){try{var part=String(token||'').split('.')[1];if(!part)return{};var normalized=part.replace(/-/g,'+').replace(/_/g,'/');while(normalized.length%4)normalized+='=';return JSON.parse(atob(normalized));}catch(e){return{};}}
function currentDeviceDetails(){var ua=navigator.userAgent||'',browser='متصفح الإنترنت';if(/Edg\//.test(ua))browser='Microsoft Edge';else if(/SamsungBrowser/.test(ua))browser='Samsung Internet';else if(/OPR\//.test(ua))browser='Opera';else if(/Firefox\//.test(ua))browser='Firefox';else if(/Chrome\//.test(ua))browser='Google Chrome';else if(/Safari\//.test(ua))browser='Safari';var platform=navigator.userAgentData&&navigator.userAgentData.platform||navigator.platform||'';if(/Android/i.test(ua))platform='Android';else if(/iPhone|iPad|iPod/i.test(ua))platform='iOS';else if(/Win/i.test(platform))platform='Windows';else if(/Mac/i.test(platform))platform='macOS';else if(/Linux/i.test(platform))platform='Linux';return{browser:browser,platform:platform||'غير معروف'};}
async function loadSessionInfo(){var status=$('session-action-status');status.textContent='جاري قراءة معلومات الجلسة الحالية...';var result=await db.auth.getSession();if(result.error){status.textContent='تعذر قراءة الجلسة: '+result.error.message;return;}var session=result.data.session;if(!session){status.textContent='مفيش جلسة دخول نشطة على الجهاز ده.';return;}var device=currentDeviceDetails(),claims=decodeSessionClaims(session.access_token);$('session-device-name').textContent=device.browser;$('session-device-platform').textContent=device.platform;$('session-account').textContent=(session.user&&session.user.email)||'حسابك';$('session-id').textContent=claims.session_id?String(claims.session_id).slice(0,8)+'…'+String(claims.session_id).slice(-4):'غير متاح';$('session-expiry').textContent=session.expires_at?new Date(session.expires_at*1000).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}):'غير متاح';status.textContent='دي معلومات جلسة الدخول المفتوحة على الجهاز الحالي.';}
async function signOutOtherSessions(){var btn=$('signout-other-sessions');if(!confirm('تسجيل الخروج من كل الجلسات الأخرى؟ الجهاز الحالي هيفضل مفتوح، لكن الأجهزة الأخرى هتحتاج تسجل الدخول من جديد.'))return;btn.disabled=true;btn.textContent='جاري إنهاء الجلسات الأخرى...';var result=await db.auth.signOut({scope:'others'});btn.disabled=false;btn.textContent='تسجيل الخروج من الأجهزة الأخرى';if(result.error){$('session-action-status').textContent='تعذر إنهاء الجلسات الأخرى: '+result.error.message;return;}$('session-action-status').textContent='تم طلب إنهاء الجلسات الأخرى. قد تظل رموز الدخول الحالية صالحة لفترة قصيرة حتى تنتهي صلاحيتها.';toast('تم تسجيل الخروج من الجلسات الأخرى');}
function openFilePicker(input){if(!input)return;try{if(typeof input.showPicker==='function'){input.showPicker();return;}}catch(e){}input.click();}
function showChats(){
 var workspace=$('chat-view').querySelector('.workspace');
 workspace.classList.remove('hidden');
 $('updates-panel').classList.add('hidden');
 workspace.classList.remove('chat-open');
 if(location.hash==='#chat'){try{history.replaceState({},' ',location.pathname+location.search);}catch(e){}}
}
function showUpdates(){
 var workspace=$('chat-view').querySelector('.workspace');
 if(workspace)workspace.classList.add('hidden');
 $('updates-panel').classList.remove('hidden');
 closeTopMenu();
}
function closeTopMenu(){var menu=$('top-menu'),toggle=$('top-menu-toggle');if(menu)menu.classList.add('hidden');if(toggle)toggle.setAttribute('aria-expanded','false');}
function initEvents(){
 $('show-login').onclick=function(){showAuth('login');};$('show-signup').onclick=function(){showAuth('signup');};
 $('top-menu-toggle').onclick=function(ev){ev.stopPropagation();var menu=$('top-menu'),open=menu.classList.toggle('hidden')===false;this.setAttribute('aria-expanded',open?'true':'false');};document.addEventListener('click',function(ev){if(!ev.target.closest('.top-menu-wrap'))closeTopMenu();});
 $('theme-toggle').onclick=toggleTheme;$('theme-toggle-auth').onclick=toggleTheme;
 $('login-form').addEventListener('submit',login);$('signup-form').addEventListener('submit',signup);$('message-form').addEventListener('submit',sendMessage);
 $('back-to-chats').onclick=function(){if(location.hash==='#chat'&&history.state&&history.state.gataChat){history.back();}else{showChats();}};
 window.addEventListener('popstate',function(){showChats();});
 $('chat-search').addEventListener('input',filterConversations);
 $('refresh-app-btn').onclick=function(){closeTopMenu();refreshApp();};$('new-chat-btn').onclick=function(){closeTopMenu();openModal();};$('contacts-btn').onclick=function(){closeTopMenu();openContacts();};
 var bottomNav=$('bottom-nav');if(bottomNav){bottomNav.addEventListener('click',function(ev){var item=ev.target.closest('[data-nav]');if(!item)return;var key=item.getAttribute('data-nav');if(key==='chats'){showChats();bottomNav.querySelectorAll('.bottom-nav-item').forEach(function(b){b.classList.toggle('active',b===item);if(b===item)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});showChats();return;}if(key==='updates'){showUpdates();bottomNav.querySelectorAll('.bottom-nav-item').forEach(function(b){b.classList.toggle('active',b===item);if(b===item)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});return;}toast('القسم ده هيتاح قريبًا');});}$('welcome-new-chat').onclick=openModal;$('close-modal').onclick=function(){$('modal').classList.add('hidden');};$('search-form').addEventListener('submit',searchUsers);
 $('close-image-preview').onclick=closeImagePreview;$('image-preview').addEventListener('click',function(ev){if(ev.target===$('image-preview'))closeImagePreview();});document.addEventListener('keydown',function(ev){if(ev.key==='Escape'){$('status-viewer').classList.add('hidden');closeTopMenu();closeImagePreview();$('modal').classList.add('hidden');$('settings-panel').classList.add('hidden');$('public-profile-view').classList.add('hidden');}});
 $('logout-btn').onclick=function(){closeTopMenu();logout();};$('open-my-profile').onclick=function(){showPublicProfile(user.id);};$('profile-bio-input').addEventListener('input',function(){$('profile-bio-count').textContent=this.value.length;});$('profile-status-input').addEventListener('input',function(){$('profile-status-count').textContent=this.value.length;});$('close-public-profile').onclick=function(){$('public-profile-view').classList.add('hidden');};$('public-profile-view').onclick=function(ev){if(ev.target===$('public-profile-view'))$('public-profile-view').classList.add('hidden');};$('settings-btn').onclick=function(){$('settings-panel').classList.remove('hidden');if(profileData){$('settings-display-name').textContent=profileData.display_name||profileData.username;$('settings-user').textContent='@'+profileData.username;$('profile-display-name').value=profileData.display_name||'';$('profile-bio-input').value=profileData.bio||'';$('profile-bio-count').textContent=($('profile-bio-input').value||'').length;$('profile-status-input').value=String(profileData.status_text||'').indexOf('GATA_STATUS:')===0?'':(profileData.status_text||'');$('profile-status-count').textContent=($('profile-status-input').value||'').length;setAvatar($('settings-avatar'),profileData.avatar_url);}};$('close-settings').onclick=function(){$('settings-panel').classList.add('hidden');};$('save-profile-btn').onclick=saveProfileName;$('settings-account-row').onclick=function(){$('profile-editor').classList.toggle('hidden');};$('settings-privacy-row').onclick=function(){$('privacy-panel').classList.toggle('hidden');applyPrivacySettings();};$('settings-storage-row').onclick=function(){$('storage-panel').classList.toggle('hidden');if(!$('storage-panel').classList.contains('hidden'))loadStorageStats();};$('settings-device-row').onclick=function(){$('device-panel').classList.toggle('hidden');if(!$('device-panel').classList.contains('hidden'))loadSessionInfo();};$('signout-other-sessions').onclick=signOutOtherSessions;$('settings-help-row').onclick=function(){$('help-panel').classList.toggle('hidden');$('about-panel').classList.add('hidden');};$('settings-about-row').onclick=function(){$('about-panel').classList.toggle('hidden');$('help-panel').classList.add('hidden');};$('storage-refresh-btn').onclick=loadStorageStats;$('privacy-last-seen').onchange=function(){setPrivacyPref('last-seen',this.checked);if(this.checked&&user)db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);toast(this.checked?'تم تفعيل مشاركة آخر ظهور':'تم إيقاف مشاركة آخر ظهور');};$('privacy-read-receipts').onchange=function(){setPrivacyPref('read-receipts',this.checked);toast(this.checked?'تم تفعيل تأكيدات القراءة':'تم إيقاف تأكيدات القراءة');};
 $('language-select').onchange=function(){language=this.value;localStorage.setItem('gata-language',language);applyLanguage();};

 $('publish-text-status').onclick=publishTextStatus;
 $('pick-image-status').onclick=function(){openFilePicker($('status-media-input'));};
 $('pick-video-status').onclick=function(){openFilePicker($('status-video-input'));};
 $('status-media-input').onchange=function(){if(this.files&&this.files[0])publishStatusFile(this.files[0],'image');this.value='';};
 $('status-video-input').onchange=function(){if(this.files&&this.files[0])publishStatusFile(this.files[0],'video');this.value='';};
 $('record-status-audio').onclick=recordStatusAudio;
 $('close-status-viewer').onclick=function(){$('status-viewer').classList.add('hidden');$('status-viewer-content').innerHTML='';};
 $('status-viewer').onclick=function(ev){if(ev.target===$('status-viewer')){$('status-viewer').classList.add('hidden');$('status-viewer-content').innerHTML='';}};
 $('delete-my-status').onclick=deleteMyStatus;

 $('attach-image-btn').onclick=function(){openFilePicker($('image-file-input'));};
 $('image-file-input').onchange=function(){if(this.files&&this.files[0])uploadMedia(this.files[0],'image');this.value='';};
 $('record-audio-btn').onclick=async function(){
  if(mediaRecorder&&mediaRecorder.state==='recording'){mediaRecorder.stop();this.textContent='🎙';this.classList.remove('recording');return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){toast('تسجيل الصوت غير مدعوم في هذا المتصفح');return;}
  try{var stream=await navigator.mediaDevices.getUserMedia({audio:true});recordedChunks=[];var audioTypes=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'];var chosen=audioTypes.find(function(t){return MediaRecorder.isTypeSupported(t);});mediaRecorder=chosen?new MediaRecorder(stream,{mimeType:chosen}):new MediaRecorder(stream);
   mediaRecorder.ondataavailable=function(e){if(e.data.size)recordedChunks.push(e.data);};
   mediaRecorder.onstop=function(){var blob=new Blob(recordedChunks,{type:mediaRecorder.mimeType||'audio/webm'});stream.getTracks().forEach(function(t){t.stop();});var mime=(blob.type.split(';')[0]||'audio/webm');if(!['audio/webm','audio/ogg','audio/mp4','audio/mpeg'].includes(mime)){toast('صيغة التسجيل غير مدعومة على هذا الجهاز');return;}var ext=mime==='audio/ogg'?'ogg':mime==='audio/mp4'?'mp4':mime==='audio/mpeg'?'mp3':'webm';uploadMedia(new File([blob],'voice.'+ext,{type:mime}),'audio');};
   mediaRecorder.start();this.textContent='■';this.classList.add('recording');toast('التسجيل شغال… اضغط الزر مرة تانية للإرسال');
  }catch(err){toast('لازم تسمح باستخدام الميكروفون');}
 };
 $('change-avatar-btn').onclick=function(){openFilePicker($('avatar-file-input'));};
 $('avatar-file-input').onchange=function(){if(this.files&&this.files[0])changeAvatar(this.files[0]);this.value='';};
}
async function boot(){initEvents();applyTheme();applyLanguage();var s=await db.auth.getSession();if(s.data.session){user=s.data.session.user;try{await enterApp();}catch(e){showAuth('login');note('تعذر تحميل الحساب: '+e.message);}}else showAuth('login');}
document.addEventListener('DOMContentLoaded',boot);
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});}
})();