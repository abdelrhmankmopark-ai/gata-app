/* Gata App — Arabic-first messaging PWA */
(function(){
'use strict';
var SUPABASE_URL='https://gncoeyferzqhyhfwwmyr.supabase.co';
var SUPABASE_KEY='sb_publishable_N0YCbA8bfJMOZ3JVRj2TlA_iBJQrpsp';
var db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var user=null,currentConversation=null,currentPeer=null,channel=null,heartbeat=null,mediaRecorder=null,recordedChunks=[],profileData=null,language=localStorage.getItem('gata-language')||'ar';
var $=function(id){return document.getElementById(id);};
var translations={
 ar:{login:'تسجيل الدخول',signup:'إنشاء حساب',conversations:'المحادثات',newChat:'محادثة جديدة',searchHint:'اكتب اسم المستخدم للبحث عنه.',search:'بحث',send:'إرسال',write:'اكتب رسالتك...',online:'متصل',offline:'غير متصل',welcome:'أهلاً بيك في جتاب',welcomeText:'ابدأ محادثة جديدة وابحث عن أصحابك باسم المستخدم.',empty:'لسه مفيش محادثات. ابدأ واحدة جديدة!',noResults:'ملقيناش مستخدم بالاسم ده.',settings:'الإعدادات',language:'اللغة',account:'حسابك',logout:'تسجيل الخروج',find:'بحث',start:'ابدأ محادثة'},
 en:{login:'Sign in',signup:'Create account',conversations:'Chats',newChat:'New chat',searchHint:'Search by username.',search:'Search',send:'Send',write:'Write a message...',online:'Online',offline:'Offline',welcome:'Welcome to Gata',welcomeText:'Start a new chat and find people by username.',empty:'No chats yet. Start a new one!',noResults:'No user found with that username.',settings:'Settings',language:'Language',account:'Your account',logout:'Log out',find:'Search',start:'Start chatting'}
};
function tr(k){return (translations[language]||translations.ar)[k]||k;}
function toast(msg){var el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2800);}
function note(msg){$('auth-note').textContent=msg||'';}
function safe(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function initials(s){var a=String(s||'G').trim().split(/\s+/);return (a[0][0]||'G').toUpperCase();}
function setAvatar(el,url){if(!el)return;if(url)el.innerHTML='<img class="avatar-image" src="'+safe(url)+'" alt="">';else el.textContent='G';}
function avatarHTML(url,name){return url?'<div class="avatar"><img class="avatar-image" src="'+safe(url)+'" alt=""></div>':'<div class="avatar">'+safe(initials(name))+'</div>';}
function isMedia(content){try{return content.indexOf('GATA_MEDIA:')===0?JSON.parse(content.slice(11)):null;}catch(e){return null;}}
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
async function enableNotifications(){if(!('Notification' in window)){toast('المتصفح لا يدعم الإشعارات');return;}var p=await Notification.requestPermission();toast(p==='granted'?'تم تفعيل الإشعارات أثناء فتح التطبيق':'لم يتم السماح بالإشعارات');}
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
 var p=await ensureProfile();$('my-handle').textContent='@'+p.username;$('settings-user').textContent='@'+p.username;setAvatar($('chat-avatar'),p.avatar_url);
 await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);
 await loadConversations();startHeartbeat();subscribeGlobal();
}
async function loadConversations(){
 var box=$('conversation-list');box.innerHTML='<div class="empty-state">جاري تحميل المحادثات...</div>';
 var mem=await db.from('conversation_members').select('conversation_id').eq('user_id',user.id);
 if(mem.error){box.innerHTML='<div class="empty-state">'+safe(mem.error.message)+'</div>';return;}
 if(!mem.data.length){box.innerHTML='<div class="empty-state">'+safe(tr('empty'))+'</div>';return;}
 var ids=mem.data.map(function(x){return x.conversation_id;});
 var conv=await db.from('conversations').select('id,title,is_group,created_at').in('id',ids).order('created_at',{ascending:false});
 if(conv.error){box.innerHTML='<div class="empty-state">'+safe(conv.error.message)+'</div>';return;}
 box.innerHTML='';
 for(var i=0;i<conv.data.length;i++){
  var c=conv.data[i];var members=await db.from('conversation_members').select('user_id').eq('conversation_id',c.id);
  var peerId=(members.data||[]).map(function(m){return m.user_id;}).find(function(id){return id!==user.id;});
  var peer=null;if(peerId){var pr=await db.from('profiles').select('username,display_name,last_seen,avatar_url').eq('id',peerId).maybeSingle();peer=pr.data;}
  var name=c.title||(peer?(peer.display_name||peer.username):'محادثة');
  var b=document.createElement('button');b.className='conversation-item'+(currentConversation===c.id?' active':'');
  b.innerHTML=avatarHTML(peer&&peer.avatar_url,name)+'<div class="conversation-info"><strong>'+safe(name)+'</strong><span>@'+safe(peer?peer.username:'')+'</span></div>';
  b.addEventListener('click',(function(id,p,n){return function(){openConversation(id,p,n);};})(c.id,peerId,name));box.appendChild(b);
 }
}
async function openConversation(id,peerId,name){
 currentConversation=id;currentPeer=peerId;$('welcome-panel').classList.add('hidden');$('active-chat').classList.remove('hidden');
 $('chat-name').textContent=name||'محادثة';$('chat-avatar').textContent=initials(name);if(currentPeer){var pa=await db.from('profiles').select('avatar_url').eq('id',currentPeer).maybeSingle();setAvatar($('chat-avatar'),pa.data&&pa.data.avatar_url);}else setAvatar($('chat-avatar'),null);
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
 if(incoming.length){var rows=incoming.map(function(id){return {message_id:id,reader_id:user.id};});await db.from('message_reads').upsert(rows,{onConflict:'message_id,reader_id',ignoreDuplicates:true});}
 box.scrollTop=box.scrollHeight;
}
async function renderMessage(m){
 var box=$('messages'),div=document.createElement('div');div.className='bubble'+(m.sender_id===user.id?' mine':'');div.dataset.id=m.id;
 var body=document.createElement('div'),media=isMedia(m.content);
 if(media){try{var url=await mediaUrl(media.path);if(media.kind==='image'){var im=document.createElement('img');im.src=url;im.alt='صورة مرسلة';im.className='sent-image';body.appendChild(im);}else{var au=document.createElement('audio');au.controls=true;au.preload='metadata';au.src=url;au.className='sent-audio';body.appendChild(au);}}catch(err){body.textContent='تعذر تحميل المرفق';}}
 else body.textContent=m.content;
 var meta=document.createElement('div');meta.className='bubble-meta';var time=document.createElement('span');time.textContent=dateLabel(m.created_at);meta.appendChild(time);
 if(m.sender_id===user.id){var read=await db.from('message_reads').select('message_id').eq('message_id',m.id).neq('reader_id',user.id);var rs=document.createElement('span');rs.className='read-state';rs.textContent=read.data&&read.data.length?'✓✓':'✓';meta.appendChild(rs);}
 var del=document.createElement('button');del.className='message-delete';del.type='button';del.textContent='حذف';del.title='حذف للطرفين';del.addEventListener('click',async function(){if(!confirm('حذف الرسالة من عندك وعند الطرف الآخر؟'))return;var d=await db.from('messages').delete().eq('id',m.id);if(d.error)toast('تعذر حذف الرسالة: '+d.error.message);});meta.appendChild(del);div.appendChild(body);div.appendChild(meta);box.appendChild(div);
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
 .on('postgres_changes',{event:'*',schema:'public',table:'messages'},function(payload){var m=payload.new||payload.old;if(currentConversation&&m.conversation_id===currentConversation){if(payload.eventType==='INSERT'&&m.sender_id!==user.id){renderMessage(m);db.from('message_reads').upsert({message_id:m.id,reader_id:user.id},{onConflict:'message_id,reader_id',ignoreDuplicates:true});$('messages').scrollTop=$('messages').scrollHeight;if(document.hidden&&'Notification' in window&&Notification.permission==='granted'){new Notification('رسالة جديدة على جتاب',{body:'وصلك رسالة جديدة',icon:'./icon.svg'});}}else if(payload.eventType==='DELETE'){var el=document.querySelector('[data-id="'+m.id+'"]');if(el)el.remove();}}loadConversations();})
 .on('postgres_changes',{event:'*',schema:'public',table:'message_reads'},function(payload){var m=payload.new||payload.old;var el=document.querySelector('[data-id="'+m.message_id+'"] .read-state');if(el)el.textContent='✓✓';})
 .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},function(){refreshPeerStatus();})
 .subscribe();
}
function startHeartbeat(){if(heartbeat)clearInterval(heartbeat);heartbeat=setInterval(async function(){if(user)await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id);if(currentConversation)refreshPeerStatus();},30000);}
function openModal(){$('modal').classList.remove('hidden');$('user-search').value='';$('search-results').innerHTML='';$('user-search').focus();}
async function searchUsers(e){
 e.preventDefault();var term=$('user-search').value.trim().replace(/^@/,'').toLowerCase();if(term.length<8){toast('اسم المستخدم لازم يكون 8 أحرف على الأقل');return;}
 var r=await db.from('profiles').select('id,username,display_name').eq('username',term).neq('id',user.id).limit(10);
 var box=$('search-results');box.innerHTML='';
 if(r.error){box.textContent='تعذر البحث: '+r.error.message;return;}
 if(!r.data.length){box.textContent=tr('noResults');return;}
 r.data.forEach(function(p){var row=document.createElement('div');row.className='result-user';row.innerHTML='<div class="avatar">'+safe(initials(p.display_name||p.username))+'</div><div><strong>'+safe(p.display_name||p.username)+'</strong><div class="muted">@'+safe(p.username)+'</div></div><button class="primary-btn">مراسلة</button>';row.querySelector('button').addEventListener('click',function(){startDirectChat(p);});box.appendChild(row);});
}
async function startDirectChat(peer){
 var ids=[user.id,peer.id].sort();var key=ids.join(':');
 var existing=await db.from('conversations').select('id').eq('direct_key',key).maybeSingle();
 var cid=existing.data&&existing.data.id;
 if(!cid){
  var created=await db.from('conversations').insert({created_by:user.id,direct_key:key,is_group:false}).select('id').single();
  if(created.error){toast('تعذر إنشاء المحادثة: '+created.error.message);return;}cid=created.data.id;
  var added=await db.from('conversation_members').insert([{conversation_id:cid,user_id:user.id},{conversation_id:cid,user_id:peer.id}]);
  if(added.error){toast('تم إنشاء المحادثة لكن تعذرت إضافة الطرف الآخر: '+added.error.message);return;}
 }
 $('modal').classList.add('hidden');await openConversation(cid,peer.id,peer.display_name||peer.username);toast('المحادثة جاهزة');
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
async function logout(){if(channel)await db.removeChannel(channel);if(heartbeat)clearInterval(heartbeat);await db.auth.signOut();user=null;currentConversation=null;showAuth('login');}
async function changeAvatar(file){
 if(!file||!user)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('اختار صورة JPG أو PNG أو WebP');return;}if(file.size>5*1024*1024){toast('الصورة أكبر من 5 ميجابايت');return;}
 var ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=user.id+'/avatar-'+Date.now()+'.'+ext;toast('جاري تحديث الصورة...');
 var up=await db.storage.from('gata-avatars').upload(path,file,{contentType:file.type,upsert:false});if(up.error){toast('تعذر رفع الصورة: '+up.error.message);return;}
 var url=db.storage.from('gata-avatars').getPublicUrl(path).data.publicUrl,upd=await db.from('profiles').update({avatar_url:url}).eq('id',user.id);if(upd.error){toast('تعذر حفظ الصورة: '+upd.error.message);return;}
 if(profileData)profileData.avatar_url=url;setAvatar($('chat-avatar'),url);toast('تم تحديث الصورة الشخصية');
}
async function refreshApp(){var btn=$('refresh-app-btn');if(btn){btn.disabled=true;btn.textContent='…';}toast('جاري تحديث جتاب...');try{if('serviceWorker' in navigator){var reg=await navigator.serviceWorker.getRegistration();if(reg)await reg.unregister();}if('caches' in window){var keys=await caches.keys();await Promise.all(keys.filter(function(k){return k.indexOf('gata-shell-')===0;}).map(function(k){return caches.delete(k);}));}}catch(e){}window.location.reload();}
function openFilePicker(input){if(!input)return;try{if(typeof input.showPicker==='function'){input.showPicker();return;}}catch(e){}input.click();}
function initEvents(){
 $('show-login').onclick=function(){showAuth('login');};$('show-signup').onclick=function(){showAuth('signup');};
 $('login-form').addEventListener('submit',login);$('signup-form').addEventListener('submit',signup);$('message-form').addEventListener('submit',sendMessage);
 $('refresh-app-btn').onclick=refreshApp;$('new-chat-btn').onclick=openModal;$('welcome-new-chat').onclick=openModal;$('close-modal').onclick=function(){$('modal').classList.add('hidden');};$('search-form').addEventListener('submit',searchUsers);
 $('logout-btn').onclick=logout;$('settings-btn').onclick=function(){$('settings-panel').classList.remove('hidden');};$('close-settings').onclick=function(){$('settings-panel').classList.add('hidden');};
 $('language-select').onchange=function(){language=this.value;localStorage.setItem('gata-language',language);applyLanguage();};
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
 $('enable-notifications-btn').onclick=enableNotifications;
}
async function boot(){initEvents();applyLanguage();var s=await db.auth.getSession();if(s.data.session){user=s.data.session.user;try{await enterApp();}catch(e){showAuth('login');note('تعذر تحميل الحساب: '+e.message);}}else showAuth('login');}
document.addEventListener('DOMContentLoaded',boot);
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});}
})();