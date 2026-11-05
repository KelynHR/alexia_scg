'use strict';
const $=selector=>document.querySelector(selector);
let page=1,loading=false,theme='light';
try{theme=localStorage.getItem('alexia-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');}catch{}
function applyTheme(){document.documentElement.dataset.theme=theme;$('#theme').textContent=theme==='dark'?'Tema claro':'Tema oscuro';}
applyTheme();$('#theme').onclick=()=>{theme=theme==='dark'?'light':'dark';applyTheme();try{localStorage.setItem('alexia-theme',theme);}catch{}};
async function api(action,body,extra=''){
 const response=await fetch('/api/admin?action='+action+extra,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok){const error=new Error(data.error||'No se pudo completar la operación.');error.status=response.status;throw error;}return data;
}
function signedIn(value){$('#login').hidden=value;$('#dashboard').hidden=!value;$('#logout').hidden=!value;if(!value){$('#list').replaceChildren();$('#password').value='';}}
function filterParams(){const p=new URLSearchParams();if($('#from').value)p.set('from',$('#from').value);if($('#to').value)p.set('to',$('#to').value);if($('#state').value)p.set('estado',$('#state').value);return '&'+p.toString();}
function node(tag,text,className){const element=document.createElement(tag);if(text!=null)element.textContent=text;if(className)element.className=className;return element;}
function drawCard(reserva){
 const card=node('article',null,'booking-card'),header=node('header'),title=node('div');
 title.append(node('div',reserva.folio,'booking-folio'),node('h2',reserva.nombre),node('div',`${reserva.fecha} · ${reserva.hora} h · Centro de México`,'booking-date'));
 const badge=node('span',reserva.estado,'booking-badge');badge.dataset.state=reserva.estado;header.append(title,badge);card.append(header);
 const details=node('dl');for(const [label,value] of [['Empresa',reserva.empresa],['Correo',reserva.correo],['Teléfono / WhatsApp',reserva.telefono||'No proporcionado'],['Área',reserva.area],['Modalidad',reserva.modalidad],['Duración','60 minutos'],['Reto',reserva.reto||'Sin comentarios']]){const field=node('div');if(label==='Reto')field.className='wide';field.append(node('dt',label),node('dd',value));details.append(field);}card.append(details);
 const footer=node('footer'),select=node('select');select.setAttribute('aria-label','Estado de '+reserva.folio);
 for(const state of ['registrada','confirmada','cancelada']){const option=node('option',state[0].toUpperCase()+state.slice(1));option.value=state;option.selected=state===reserva.estado;select.append(option);}
 const save=node('button','Guardar estado');save.type='button';const result=node('span');result.setAttribute('role','status');
 save.onclick=async()=>{save.disabled=true;select.disabled=true;result.textContent='Guardando…';try{await api('status',{id:reserva.id,estado:select.value});reserva.estado=select.value;badge.textContent=reserva.estado;badge.dataset.state=reserva.estado;result.textContent=reserva.estado==='cancelada'?'Cancelada. El horario vuelve a estar disponible.':'Estado actualizado.';}catch(error){result.textContent=error.message;if(error.status===401)signedIn(false);}finally{save.disabled=false;select.disabled=false;}};
 footer.append(select,save,result);card.append(footer);return card;
}
async function load(){
 if(loading)return;loading=true;$('#message').textContent='Consultando reservas…';$('#message').classList.remove('error');$('#filters').querySelectorAll('button').forEach(b=>b.disabled=true);$('#previous').disabled=true;$('#next').disabled=true;
 try{const data=await api('list',null,filterParams()+'&page='+page);$('#list').replaceChildren(...data.reservas.map(drawCard));if(!data.reservas.length)$('#list').append(node('p','No hay reservas con estos filtros.','admin-empty'));$('#page').textContent='Página '+page;$('#previous').disabled=page===1;$('#next').disabled=!data.hasMore;$('#message').textContent=`${data.reservas.length} reservas en esta página.`;
 }catch(error){$('#message').textContent=error.message;$('#message').classList.add('error');if(error.status===401)signedIn(false);}finally{loading=false;$('#filters').querySelectorAll('button').forEach(b=>b.disabled=false);}
}
$('#login-form').onsubmit=async event=>{event.preventDefault();const button=$('#login-form button');button.disabled=true;$('#login-error').textContent='';try{await api('login',{password:$('#password').value});$('#password').value='';signedIn(true);page=1;await load();}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}};
$('#logout').onclick=async()=>{try{await api('logout',{});signedIn(false);}catch(error){$('#message').textContent=error.message;}};
$('#filters').onsubmit=event=>{event.preventDefault();page=1;load();};
$('#previous').onclick=()=>{if(page>1&&!loading){page--;load();}};$('#next').onclick=()=>{if(!loading){page++;load();}};
$('#export').onclick=async()=>{const button=$('#export');button.disabled=true;try{const response=await fetch('/api/admin?action=csv'+filterParams(),{cache:'no-store',credentials:'same-origin'});if(!response.ok){const data=await response.json();if(response.status===401)signedIn(false);throw new Error(data.error||'No se pudo exportar.');}const url=URL.createObjectURL(await response.blob());const anchor=node('a');anchor.href=url;anchor.download='reservas-alexia.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){$('#message').textContent=error.message;}finally{button.disabled=false;}};
api('session').then(()=>{signedIn(true);load();}).catch(error=>{signedIn(false);if(error.status!==401)$('#login-error').textContent=error.message;});
