import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext,Script} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {AREAS} from '../lib/config.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('/* ---------- Reserva tu diagnóstico:');
const code=html.slice(start,html.indexOf('const esc = ',start));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(fetch){
 const {document}=parseHTML('<!doctype html><html><head></head><body><div id="agenda"></div></body></html>');
 const original=document.createElement.bind(document);
 document.createElement=tag=>{const element=original(tag);if(tag==='dialog'){element.showModal=()=>element.setAttribute('open','');element.close=()=>element.removeAttribute('open');}return element;};
 const ctx=createContext({document,fetch,FORM_AREAS:AREAS,crypto:webcrypto,Intl,Date,AbortSignal,setTimeout,console,$:s=>document.querySelector(s),esc:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
 runInContext(code+'\nglobalThis.agenda={AG,BOOKING,agendaInit,loadBusy,submitReservation,slotDate};',ctx);
 const {agenda}=ctx;agenda.agendaInit();return {document,agenda};
}
function fill(document,agenda){
 for(const [id,value] of Object.entries({'nombre':'Ana <img src=x onerror=alert(1)>','empresa':'Prueba','correo':'ana@example.com','telefono':'','reto':'Datos'}))document.getElementById('a-'+id).value=value;
 const select=document.getElementById('a-area');Object.defineProperty(select,'value',{value:'0',writable:true});
 agenda.AG.hour='09:00';
 return {preventDefault(){},currentTarget:document.getElementById('agf')};
}
test('confirmation appears only after a successful server save; failures retain fields and retries retain request ID',async()=>{
 let answer;const requests=[];
 const {document,agenda}=setup(async(url,opts)=>{
  if(!opts?.method)return {ok:true,json:async()=>({busy:[]})};
  requests.push(JSON.parse(opts.body));return new Promise(resolve=>{answer=resolve;});
 });await tick();const event=fill(document,agenda);
 const saving=agenda.submitReservation(event);assert.equal(requests.length,1);assert.equal(document.querySelector('dialog'),null);assert.equal(document.querySelector('.done2'),null);
 answer({ok:false,status:503,json:async()=>({error:'Guardado no disponible'})});await saving;
 assert.equal(document.querySelector('dialog'),null);assert.equal(document.getElementById('a-correo').value,'ana@example.com');assert.match(document.getElementById('booking-error').textContent,/Guardado no disponible/);
 const again=agenda.submitReservation(event);assert.equal(requests[0].solicitud_id,requests[1].solicitud_id);
 const sent=requests[1];answer({ok:true,status:201,json:async()=>({ok:true,reserva:{folio:'AX-PRUEBA',nombre:sent.nombre,fecha:sent.fecha,hora:sent.hora,modalidad:sent.modalidad,estado:'registrada'}})});await again;
 const dialog=document.querySelector('dialog');assert.ok(dialog.hasAttribute('open'));assert.equal(document.getElementById('reservation-title').textContent,'Gracias, Ana.');assert.equal(document.querySelectorAll('img').length,0);assert.match(document.getElementById('reservation-folio').textContent,/AX-PRUEBA/);assert.match(document.querySelector('.done2').textContent,/Tu solicitud ya está registrada/);
});
test('availability failure disables booking; conflicts do not display a confirmation',async()=>{
 let broken=false;
 const {document,agenda}=setup(async(url,opts)=>{if(broken)throw new Error('offline');if(!opts?.method)return {ok:true,json:async()=>({busy:[]})};return {ok:false,status:409,json:async()=>({error:'Horario ocupado'})};});
 await tick();const event=fill(document,agenda);await agenda.submitReservation(event);assert.equal(agenda.AG.hour,null);assert.equal(document.querySelector('dialog'),null);assert.equal(document.getElementById('a-correo').value,'ana@example.com');
 broken=true;await agenda.loadBusy();assert.equal(agenda.BOOKING.state,'error');assert.ok([...document.querySelectorAll('.slot')].every(button=>button.disabled));assert.equal(document.querySelector('#agf button[type="submit"]').disabled,true);
});
test('Querétaro slot conversion is independent of the visitor timezone and scripts parse',()=>{
 const {agenda}=setup(async()=>({ok:true,json:async()=>({busy:[]})}));assert.equal(agenda.slotDate('2026-11-09','09:00').toISOString(),'2026-11-09T15:00:00.000Z');
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/\bsrc=/.test(match[1])&&match[2].trim())new Script(match[2]);}
 assert.ok(html.includes("['agendar', 'Diagnóstico', 'n3']"));assert.ok(!code.includes('outlook.office.com'));assert.ok(!code.includes('localStorage'));
});
test('private panel treats stored names and comments as text rather than executable markup',async()=>{
 const adminHtml=readFileSync(new URL('../admin.html',import.meta.url),'utf8');const {document}=parseHTML(adminHtml);
 const payload='<img src=x onerror=alert(1)>';
 const ctx=createContext({document,URL,URLSearchParams,AbortSignal,setTimeout,matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},fetch:async url=>({ok:true,json:async()=>url.includes('session')?{ok:true}:{reservas:[{id:'1',folio:'AX-TEST',fecha:'2026-11-09',hora:'09:00',nombre:payload,empresa:payload,correo:'test@example.com',telefono:'',area:'Finanzas',reto:payload,modalidad:'En línea',estado:'registrada'}],hasMore:false}})});
 runInContext(readFileSync(new URL('../js/admin.js',import.meta.url),'utf8'),ctx);await tick();await tick();
 assert.equal(document.querySelector('.booking-card h2').textContent,payload);assert.equal(document.querySelector('img'),null);assert.ok([...document.querySelectorAll('.booking-card dd')].some(el=>el.textContent===payload));
});
