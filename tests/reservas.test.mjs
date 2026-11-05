import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import reservations from '../api/reservas.js';
import admin,{csvCell} from '../api/admin.js';
import {dateInMexico,validateReservation} from '../lib/config.js';
const temp=mkdtempSync(join(tmpdir(),'alexia-test-'));
process.env.SQLITE_PATH=join(temp,'reservas.sqlite');
process.env.DATABASE_URL='';delete process.env.VERCEL;
process.env.APP_ORIGIN='http://localhost:3000';
process.env.ADMIN_PASSWORD='test-only-password-123456789';
process.env.ADMIN_SESSION_SECRET='test-only-session-secret-12345678901234567890';
let cookie;
function nextWorkingDay(){const d=new Date(Date.now()+2*86400000);while([0,6].includes(d.getUTCDay()))d.setUTCDate(d.getUTCDate()+1);return dateInMexico(+d);}
const fecha=nextWorkingDay();
function payload(extra={}){return {solicitud_id:randomUUID(),nombre:'Prueba <img src=x onerror=alert(1)>',empresa:'Empresa de prueba',correo:'prueba@example.com',telefono:'442 123 4567',area:'Finanzas',reto:'=HYPERLINK("https://example.com")',fecha,hora:'09:00',modalidad:'En línea',website:'',...extra};}
async function request(handler,{method='GET',url='/api/reservas',body,origin=process.env.APP_ORIGIN,cookie:auth,ip='127.0.0.1'}={}){
 const req={method,url,body,headers:{'content-type':'application/json',origin,...(auth?{cookie:auth}:{})},socket:{remoteAddress:ip}};
 const headers={};let raw;
 const res={statusCode:200,setHeader(key,value){headers[key.toLowerCase()]=value;},end(data){raw=data;}};
 await handler(req,res);return {status:res.statusCode,headers,raw,data:String(headers['content-type']).startsWith('application/json')?JSON.parse(raw):raw};
}
test('booking, durable storage, availability privacy, retries and concurrency',async()=>{
 const input=payload();const saved=await request(reservations,{method:'POST',body:input});assert.equal(saved.status,201);assert.match(saved.data.reserva.folio,/^AX-[A-F0-9]{16}$/);assert.equal(saved.data.reserva.nombre,input.nombre);assert.match(saved.headers['cache-control'],/no-store/);
 const {DatabaseSync}=await import('node:sqlite');const disk=new DatabaseSync(process.env.SQLITE_PATH);assert.equal(disk.prepare('SELECT count(*) AS n FROM reservas').get().n,1);disk.close();
 const busy=await request(reservations,{url:'/api/reservas?month='+fecha.slice(0,7)});assert.equal(busy.status,200);assert.ok(busy.data.busy.includes(fecha+' 09:00'));assert.ok(!JSON.stringify(busy.data).includes('prueba@example.com'));assert.ok(!JSON.stringify(busy.data).includes(input.nombre));
 const retry=await request(reservations,{method:'POST',body:input});assert.equal(retry.status,200);assert.equal(retry.data.reserva.folio,saved.data.reserva.folio);
 const altered=await request(reservations,{method:'POST',body:{...input,correo:'otra@example.com'}});assert.equal(altered.status,409);
 const clock=Date.now;try{Date.now=()=>Number(new Date(fecha+'T09:00:00-06:00'))+7200000;const later=await request(reservations,{method:'POST',body:input});assert.equal(later.status,200);assert.equal(later.data.reserva.folio,saved.data.reserva.folio);}finally{Date.now=clock;}
 const overlap=await request(reservations,{method:'POST',body:payload()});assert.equal(overlap.status,409);
 const race=await Promise.all([request(reservations,{method:'POST',body:payload({hora:'10:00'})}),request(reservations,{method:'POST',body:payload({hora:'10:00'})})]);assert.deepEqual(race.map(x=>x.status).sort(),[201,409]);
 const twin=payload({hora:'11:00'});const twins=await Promise.all([request(reservations,{method:'POST',body:twin}),request(reservations,{method:'POST',body:twin})]);assert.deepEqual(twins.map(x=>x.status).sort(),[200,201]);assert.equal(twins[0].data.reserva.folio,twins[1].data.reserva.folio);
});
test('validation rejects invalid dates, slots, values, bot field and cross-origin writes',async()=>{
 for(const change of [{fecha:'2026-02-30'},{hora:'09:30'},{fecha:'2001-01-01'},{fecha:'2099-01-01'},{correo:'bad'},{area:'SQL injection'},{modalidad:'Outlook'},{nombre:'x'.repeat(121)},{website:'bot.example'},{solicitud_id:'no-uuid'}]){const result=await request(reservations,{method:'POST',body:payload(change)});assert.equal(result.status,400,JSON.stringify(change));}
 const cross=await request(reservations,{method:'POST',body:payload(),origin:'https://another.example'});assert.equal(cross.status,403);
 const day=new Date(fecha+'T12:00:00Z');while(day.getUTCDay()!==0)day.setUTCDate(day.getUTCDate()+1);assert.throws(()=>validateReservation(payload({fecha:dateInMexico(+day)})),/lunes a viernes/);
});
test('private panel requires a valid cookie, supports status/cancellation and protects CSV',async()=>{
 assert.equal((await request(admin,{url:'/api/admin'})).status,401);assert.equal((await request(admin,{url:'/api/admin?action=csv'})).status,401);
 assert.equal((await request(admin,{method:'POST',url:'/api/admin?action=login',body:{password:'wrong'}})).status,401);
 const login=await request(admin,{method:'POST',url:'/api/admin?action=login',body:{password:process.env.ADMIN_PASSWORD}});assert.equal(login.status,200);assert.match(login.headers['set-cookie'],/HttpOnly; SameSite=Strict/);cookie=login.headers['set-cookie'].split(';')[0];
 assert.equal((await request(admin,{url:'/api/admin',cookie:cookie+'bad'})).status,401);
 const list=await request(admin,{url:'/api/admin',cookie});assert.equal(list.status,200);assert.equal(list.data.reservas.length,3);assert.ok(!list.data.reservas[0].fingerprint);const row=list.data.reservas.find(r=>r.hora==='09:00');
 assert.equal((await request(admin,{method:'POST',url:'/api/admin?action=status',body:{id:row.id,estado:'cancelada'},cookie})).status,200);
 const freed=await request(reservations,{url:'/api/reservas?month='+fecha.slice(0,7)});assert.ok(!freed.data.busy.includes(fecha+' 09:00'));
 assert.equal((await request(reservations,{method:'POST',body:payload()})).status,201);
 assert.equal((await request(admin,{method:'POST',url:'/api/admin?action=status',body:{id:row.id,estado:'confirmada'},cookie})).status,409);
 const csv=await request(admin,{url:'/api/admin?action=csv',cookie});assert.equal(csv.status,200);assert.match(csv.raw,/'=HYPERLINK/);assert.match(csv.headers['cache-control'],/no-store/);
 assert.equal(csvCell(' +SUM(1,2)'), '"\' +SUM(1,2)"');assert.ok(csvCell('\t=1').startsWith('"\''));
 const body=Buffer.from(JSON.stringify({exp:Date.now()-1000,version:'unused'})).toString('base64url');const sig=createHmac('sha256',process.env.ADMIN_SESSION_SECRET).update(body).digest('base64url');assert.equal((await request(admin,{url:'/api/admin',cookie:'alexia_admin='+body+'.'+sig})).status,401);
 const oldPassword=process.env.ADMIN_PASSWORD;process.env.ADMIN_PASSWORD='test-only-changed-password-123456';assert.equal((await request(admin,{url:'/api/admin',cookie})).status,401);process.env.ADMIN_PASSWORD=oldPassword;
});
test('login throttling and production fail-closed configuration',async()=>{
 for(let i=0;i<8;i++)assert.equal((await request(admin,{method:'POST',url:'/api/admin?action=login',body:{password:'wrong'},ip:'127.0.0.9'})).status,401);
 assert.equal((await request(admin,{method:'POST',url:'/api/admin?action=login',body:{password:'wrong'},ip:'127.0.0.9'})).status,429);
 const production=spawnSync(process.execPath,['--input-type=module','-e',"import {db} from './lib/db.js';try{await db();process.exitCode=1;}catch(error){if(error.status!==503)process.exitCode=1;}"],{cwd:new URL('../',import.meta.url),env:{...process.env,VERCEL:'1',DATABASE_URL:''}});assert.equal(production.status,0);
 const saved=process.env.ADMIN_SESSION_SECRET;process.env.ADMIN_SESSION_SECRET='';assert.equal((await request(reservations,{url:'/api/reservas?month='+fecha.slice(0,7)})).status,503);process.env.ADMIN_SESSION_SECRET=saved;
});
test('service worker excludes APIs/admin and build allowlist excludes private files',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');assert.match(sw,/no-store/);assert.match(sw,/api/);assert.match(sw,/admin/);
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');assert.ok(!build.includes("'data'"));assert.ok(!build.includes("'.env'"));
});
