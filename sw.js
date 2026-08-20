const CACHE="juken-weakness-v7";
const CORE=["./","index.html","styles.css?v=7","boot.js?v=7","app.js?v=7","manifest.json?v=7"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).catch(()=>{}));
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req,{cache:"no-store"});
      const cache=await caches.open(CACHE);
      cache.put(req,fresh.clone());
      return fresh;
    }catch(error){
      const cached=await caches.match(req);
      if(cached) return cached;
      if(req.mode==="navigate") return caches.match("./");
      throw error;
    }
  })());
});