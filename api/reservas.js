import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {HOURS,ZONE,STATES,HttpError,dateInMexico,lastDate,validateReservation,secrets} from '../lib/config.js';
import {db,uniqueViolation} from '../lib/db.js';
import {json,errorResponse,checkOrigin,readBody,rateLimit,query} from '../lib/http.js';
function receipt(row) {
  return {folio:row.folio,nombre:row.nombre,fecha:row.fecha,hora:row.hora,modalidad:row.modalidad,estado:row.estado};
}
export default async function handler(req,res) {
  try {
    if (req.method==='GET') {
      const month=query(req).get('month');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '') || month<dateInMexico().slice(0,7) || month>lastDate().slice(0,7)) throw new HttpError(400,'Mes fuera del rango de reservas.');
      await rateLimit(req,'availability',120,60000);
      const store=await db();
      const rows=await store.query("SELECT fecha,hora FROM reservas WHERE fecha >= $1 AND fecha <= $2 AND estado <> 'cancelada'",[month+'-01',month+'-31']);
      return json(res,200,{busy:rows.map(r=>`${r.fecha} ${r.hora}`),hours:HOURS,timezone:ZONE,minDate:dateInMexico(),maxDate:lastDate()});
    }
    if (req.method!=='POST') {res.setHeader('Allow','GET, POST');throw new HttpError(405,'Método no permitido.');}
    checkOrigin(req);secrets();
    const body=await readBody(req);
    const data=validateReservation(body,Date.now(),false);
    const store=await db();
    const fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const existing=async () => (await store.query('SELECT * FROM reservas WHERE solicitud_id = $1',[data.solicitud_id]))[0];
    const replay=await existing();
    if (replay) {
      if (replay.estado==='cancelada') throw new HttpError(409,'La reserva anterior fue cancelada. Inicia una nueva solicitud.');
      if (replay.fingerprint!==fingerprint) throw new HttpError(409,'Esta solicitud ya se utilizó. Vuelve a elegir el horario.');
      return json(res,200,{ok:true,reserva:receipt(replay)});
    }
    validateReservation(body);
    await rateLimit(req,'booking',10,900000);
    const row={...data,id:randomUUID(),folio:'AX-'+randomBytes(8).toString('hex').toUpperCase(),fingerprint,fin_ms:data.inicio_ms+3600000,estado:STATES[0],creado_ms:Date.now(),actualizado_ms:Date.now()};
    try {
      const fields=['id','folio','solicitud_id','fingerprint','inicio_ms','fin_ms','fecha','hora','nombre','empresa','correo','telefono','area','reto','modalidad','estado','creado_ms','actualizado_ms'];
      await store.query(`INSERT INTO reservas (${fields.join(',')}) VALUES (${fields.map((_,i)=>'$'+(i+1)).join(',')})`,fields.map(k=>row[k]));
    } catch (error) {
      if (!uniqueViolation(error)) throw error;
      const retry=await existing();
      if (retry && retry.estado!=='cancelada' && retry.fingerprint===fingerprint) return json(res,200,{ok:true,reserva:receipt(retry)});
      throw new HttpError(409,'Ese horario acaba de ocuparse. Elige otro disponible.');
    }
    return json(res,201,{ok:true,reserva:receipt(row)});
  } catch (error) {return errorResponse(res,error);}
}
