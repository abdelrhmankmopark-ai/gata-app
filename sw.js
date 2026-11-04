const CACHE='gata-shell-v3';
const ASSETS=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('gata-shell-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin)return;
 if(/\\.(js|css|html)$/.test(u.pathname)||u.pathname.endsWith('/')){
  e.respondWith(fetch(e.request,{cache:'no-store'}).then(res=>{
   if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
   return res;
  }).catch(()=>caches.match(e.request).then(c=>c||caches.match('./index.html'))));
 }else{
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
 }
});