/* Alexia · static assets only; reservations and admin always use the network. */
const CACHE='alexia-reservas-20261105-v1';
const FILES=['./','index.html','tablero.html','crm.html','demos.html','generador.html','validador.html','ejemplos.html','js/chart.umd.js','css/theme-refinements.css','css/reservas.css','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('alexia-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==location.origin||req.cache==='no-store'||/(^|\/)api(\/|$)/.test(url.pathname)||/\/admin(?:\.html)?\/?$/.test(url.pathname))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok&&!/no-store/i.test(response.headers.get('Cache-Control')||'')){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{}));}
  return response;
 }).catch(async()=>{const match=await caches.match(req,{ignoreSearch:true});if(match)return match;if(req.mode==='navigate')return (await caches.match('index.html'))||Response.error();return Response.error();}));
});
