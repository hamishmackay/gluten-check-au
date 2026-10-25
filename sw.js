const CACHE='gluten-check-au-v4';
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('gluten-check-au-')).map(key=>caches.delete(key)));await self.clients.claim()})())});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode==='navigate'&&url.origin===self.location.origin){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request)));return}if(url.origin===self.location.origin&&event.request.method==='GET'){event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))}});
