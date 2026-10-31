const ROOT=new URL('./',self.location.href)
const CACHE=`optix-static-v2-${ROOT.pathname}`
const OFFLINE=new URL('offline.html',ROOT).href
const PRECACHE=['offline.html','manifest.webmanifest','icon-192.png','icon-512.png'].map(path=>new URL(path,ROOT).href)
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('optix-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())))
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url)
 if(request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname)||request.headers.has('Authorization'))return
 if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match(OFFLINE).then(response=>response||Response.error())));return}
 const relative=url.pathname.slice(ROOT.pathname.length)
 if(!/^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg)$/.test(relative))return
 event.respondWith(caches.match(request).then(async cached=>{if(cached)return cached;const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone())}return response}))
})
