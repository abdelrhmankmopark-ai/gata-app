/* Gata App — Arabic-first messaging PWA */
(function(){
'use strict';
var SUPABASE_URL='https://gncoeyferzqhyhfwwmyr.supabase.co';
var SUPABASE_KEY='sb_publishable_N0YCbA8bfJMOZ3JVRj2TlA_iBJQrpsp';
var db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var user=null,currentConversation=null,currentPeer=null,channel=null,heartbeat=null,language=localStorage.getItem('gata-language')||'ar';
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
function dateLabel(s){return new Date(s).toLocaleTimeString(language==='ar'?'ar-EG':'en-US',{hour:'2-digit',minute:'2-digit'});}
function showAuth(tab){$('auth-view').classList.remove('hidden');$('chat-view').classList.add('hidden');$('login-form').classList.toggle('hidden',tab==='signup');$('signup-form').classList.toggle('hidden',tab!=='signup');$('show-login').classList.toggle('active',tab!=='signup');$('show-signup').classList.toggle('active',tab==='signup');note('');}
function applyLanguage(){document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.body.dir=document.documentElement.dir;$('message-input').placeholder=tr('write');$('settings-title');$('language-select').value=language;var labels=document.querySelectorAll('[data-i18n]');labels.forEach(function(el){el.textContent=tr(el.dataset.i18n);});}
async function ensureProfile(){
 var res=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();
 if(res.error)throw res.error;
 if(res.data)return res.data;
 var meta=user.user_metadata||{};
 var uname=String(meta.username||'').toLowerCase();
 if(!uname){throw new Error('الحساب ده محتاج اسم مستخدم. تواصل مع الدعم.');}
 var ins=await db.from('profiles').insert({id:user.id,username:uname,display_name:meta.display_name||uname}).select().single();
 if(ins.error)throw ins.error;return ins.data;
}
async function enterApp(){
 $('auth-view').classList.add('hidden');$('chat-view').classList.remove('hidden');
 var p=await ensureProfile();$('my-handle').textContent='@'+p.username;$('settings-user').textContent='@'+p.username;
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
  var peer=null;if(peerId){var pr=await db.from('profiles').select('username,display_name,last_seen').eq('id',peerId).maybeSingle();peer=pr.data;}
  var name=c.title||(peer?(peer.display_name||peer.username):'محادثة');
  var b=document.createElement('button');b.className='conversation-item'+(currentConversation===c.id?' active':'');
  b.innerHTML='<div class="avatar">'+safe(initials(name))+'</div><div class="conversation-info"><strong>'+safe(name)+'</strong><span>@'+safe(peer?peer.username:'')+'</span></div>';
  b.addEventListener('click',(function(id,p,n){return function(){openConversation(id,p,n);};})(c.id,peerId,name));box.appendChild(b);
 }
}
async function openConversation(id,peerId,name){
 currentConversation=id;currentPeer=peerId;$('welcome-panel').classList.add('hidden');$('active-chat').classList.remove('hidden');
 $('chat-name').textContent=name||'محادثة';$('chat-avatar').textContent=initials(name);
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
 var box=$('messages');var div=document.createElement('div');div.className='bubble'+(m.sender_id===user.id?' mine':'');div.dataset.id=m.id;
 var meta='<div class="bubble-meta"><span>'+safe(dateLabel(m.created_at))+'</span>';
 if(m.sender_id===user.id){var read=await db.from('message_reads').select('message_id').eq('message_id',m.id).neq('reader_id',user.id);meta+='<span class="read-state">'+(read.data&&read.data.length?'✓✓':'✓')+'</span>';}
 meta+='<button class="message-delete" type="button" title="حذف للطرفين" aria-label="حذف الرسالة">حذف</button></div>';div.innerHTML='<div>'+safe(m.content)+'</div>'+meta;div.querySelector('.message-delete').addEventListener('click',async function(){if(!confirm('حذف الرسالة من عندك وعند الطرف الآخر؟'))return;var d=await db.from('messages').delete().eq('id',m.id);if(d.error)toast('تعذر حذف الرسالة: '+d.error.message);});box.appendChild(div);
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
 .on('postgres_changes',{event:'*',schema:'public',table:'messages'},function(payload){var m=payload.new||payload.old;if(currentConversation&&m.conversation_id===currentConversation){if(payload.eventType==='INSERT'&&m.sender_id!==user.id){renderMessage(m);db.from('message_reads').upsert({message_id:m.id,reader_id:user.id},{onConflict:'message_id,reader_id',ignoreDuplicates:true});$('messages').scrollTop=$('messages').scrollHeight;}else if(payload.eventType==='DELETE'){var el=document.querySelector('[data-id="'+m.id+'"]');if(el)el.remove();}}loadConversations();})
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
function initEvents(){
 $('show-login').onclick=function(){showAuth('login');};$('show-signup').onclick=function(){showAuth('signup');};
 $('login-form').addEventListener('submit',login);$('signup-form').addEventListener('submit',signup);$('message-form').addEventListener('submit',sendMessage);
 $('new-chat-btn').onclick=openModal;$('welcome-new-chat').onclick=openModal;$('close-modal').onclick=function(){$('modal').classList.add('hidden');};$('search-form').addEventListener('submit',searchUsers);
 $('logout-btn').onclick=logout;$('settings-btn').onclick=function(){$('settings-panel').classList.remove('hidden');};$('close-settings').onclick=function(){$('settings-panel').classList.add('hidden');};
 $('language-select').onchange=function(){language=this.value;localStorage.setItem('gata-language',language);applyLanguage();};
}
async function boot(){initEvents();applyLanguage();var s=await db.auth.getSession();if(s.data.session){user=s.data.session.user;try{await enterApp();}catch(e){showAuth('login');note('تعذر تحميل الحساب: '+e.message);}}else showAuth('login');}
document.addEventListener('DOMContentLoaded',boot);
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});}
})();