import {createHmac} from 'node:crypto';
import {appOrigin,HttpError,secrets} from './config.js';
import {db} from './db.js';
export function json(res,status,data) {
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Vary','Cookie');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(data));
}
export function errorResponse(res,error) {
  // Never log bodies, passwords, connection strings, or database error details.
  if (!(error instanceof HttpError)) console.error('agenda_error',error.code || 'internal');
  json(res,error instanceof HttpError ? error.status : 503,{error:error instanceof HttpError ? error.message : 'No pudimos completar la operación. Intenta de nuevo.'});
}
export function checkOrigin(req) {
  const origin = appOrigin();
  if (req.headers.origin !== origin) throw new HttpError(403,'Solicitud no permitida.');
}
export async function readBody(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new HttpError(415,'Formato no permitido.');
  let raw=req.body;
  if (raw === undefined) {
    const chunks=[];let size=0;
    for await (const chunk of req) {
      size+=Buffer.byteLength(chunk);
      if (size>12288) throw new HttpError(413,'El formulario es demasiado grande.');
      chunks.push(chunk);
    }
    raw=Buffer.concat(chunks).toString('utf8');
  }
  try {
    if (Buffer.isBuffer(raw)) raw=raw.toString('utf8');
    if (Buffer.byteLength(typeof raw === 'string' ? raw : JSON.stringify(raw))>12288) throw new HttpError(413,'El formulario es demasiado grande.');
    const data=typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch (e) {if(e instanceof HttpError)throw e;throw new HttpError(400,'Formulario no válido.');}
}
export async function rateLimit(req,scope,limit,windowMs) {
  const {secret}=secrets();
  // Vercel controls this header; local server uses the TCP peer.
  const ip=process.env.VERCEL ? String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim() : req.socket?.remoteAddress || 'local';
  const period=Math.floor(Date.now()/windowMs);
  const key=createHmac('sha256',secret).update(`${scope}:${ip}:${period}`).digest('hex');
  const store=await db();
  await store.query('DELETE FROM limites WHERE reset_ms < $1',[Date.now()]);
  const rows=await store.query('INSERT INTO limites (clave,hits,reset_ms) VALUES ($1,1,$2) ON CONFLICT(clave) DO UPDATE SET hits=limites.hits+1 RETURNING hits',[key,(period+1)*windowMs]);
  if (Number(rows[0].hits)>limit) throw new HttpError(429,'Demasiados intentos. Espera unos minutos y vuelve a intentar.');
}
export function query(req) { return new URL(req.url,'http://localhost').searchParams; }
