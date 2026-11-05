import {HttpError,STATES} from '../lib/config.js';
import {db,uniqueViolation} from '../lib/db.js';
import {json,errorResponse,checkOrigin,readBody,rateLimit,query} from '../lib/http.js';
import {passwordMatches,issueCookie,clearCookie,requireAdmin} from '../lib/auth.js';
export function csvCell(value) {
  let s=String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export default async function handler(req,res) {
  try {
    const params=query(req),action=params.get('action') || 'list';
    if (req.method==='POST') {
      checkOrigin(req);
      const body=await readBody(req);
      if (action==='login') {
        await rateLimit(req,'login',8,900000);
        if (!passwordMatches(body.password)) throw new HttpError(401,'Contraseña incorrecta.');
        issueCookie(res);return json(res,200,{ok:true});
      }
      if(action==='logout') {clearCookie(res);return json(res,200,{ok:true});}
      requireAdmin(req);
      if(action!=='status' || typeof body.id!=='string' || !/^[a-f\d-]{36}$/i.test(body.id) || !STATES.includes(body.estado)) throw new HttpError(400,'Cambio no válido.');
      const store=await db();
      try {
        const rows=await store.query('UPDATE reservas SET estado=$1,actualizado_ms=$2 WHERE id=$3 RETURNING id',[body.estado,Date.now(),body.id]);
        if(!rows.length)throw new HttpError(404,'Reserva no encontrada.');
      } catch(error) {if(uniqueViolation(error))throw new HttpError(409,'No puedes reactivar la reserva: ese horario ya está ocupado.');throw error;}
      return json(res,200,{ok:true});
    }
    if(req.method!=='GET') {res.setHeader('Allow','GET, POST');throw new HttpError(405,'Método no permitido.');}
    requireAdmin(req);
    if(action==='session')return json(res,200,{ok:true});
    if(!['list','csv'].includes(action))throw new HttpError(400,'Acción no válida.');
    const from=params.get('from')||'0000-01-01',to=params.get('to')||'9999-12-31',state=params.get('estado')||'';
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to||(state&&!STATES.includes(state)))throw new HttpError(400,'Revisa los filtros.');
    const page=Number(params.get('page')||1);
    if(!Number.isInteger(page)||page<1||page>100000)throw new HttpError(400,'Página no válida.');
    const store=await db();
    const values=[from,to,state],where="fecha >= $1 AND fecha <= $2 AND ($3 = '' OR estado = $3)";
    if(action==='csv') {
      const rows=await store.query(`SELECT * FROM reservas WHERE ${where} ORDER BY fecha,hora LIMIT 10001`,values);
      if(rows.length>10000)throw new HttpError(400,'Reduce el rango de fechas para exportar hasta 10,000 reservas.');
      const columns=['folio','fecha','hora','nombre','empresa','correo','telefono','area','reto','modalidad','estado'];
      res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="reservas-alexia.csv"');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
      return res.end('\uFEFF'+[columns.map(csvCell).join(','),...rows.map(row=>columns.map(c=>csvCell(row[c])).join(','))].join('\r\n'));
    }
    const rows=await store.query(`SELECT id,folio,fecha,hora,nombre,empresa,correo,telefono,area,reto,modalidad,estado,creado_ms FROM reservas WHERE ${where} ORDER BY fecha DESC,hora DESC LIMIT 51 OFFSET $4`,[...values,(page-1)*50]);
    return json(res,200,{reservas:rows.slice(0,50),hasMore:rows.length>50,page});
  } catch(error) {return errorResponse(res,error);}
}
