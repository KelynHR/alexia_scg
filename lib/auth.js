import {createHash,createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {HttpError,secrets} from './config.js';
const COOKIE='alexia_admin';
const digest=v=>createHash('sha256').update(String(v)).digest();
const sign=(payload,secret)=>createHmac('sha256',secret).update(payload).digest('base64url');
export function passwordMatches(value) {return typeof value === 'string' && timingSafeEqual(digest(value),digest(secrets().password));}
export function issueCookie(res) {
  const {secret,password}=secrets();
  const body=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,nonce:randomBytes(12).toString('hex'),version:createHmac('sha256',secret).update(password).digest('hex')})).toString('base64url');
  res.setHeader('Set-Cookie',`${COOKIE}=${body}.${sign(body,secret)}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${process.env.VERCEL ? '; Secure' : ''}`);
}
export function clearCookie(res) {res.setHeader('Set-Cookie',`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${process.env.VERCEL ? '; Secure' : ''}`);}
export function requireAdmin(req) {
  const {secret,password}=secrets();
  const cookie=String(req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  try {
    const [body,sig,extra]=(cookie || '').slice(COOKIE.length+1).split('.');
    if (!body || !sig || extra || !timingSafeEqual(digest(sig),digest(sign(body,secret)))) throw new Error();
    const data=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if (!Number.isFinite(data.exp) || data.exp<Date.now() || data.version !== createHmac('sha256',secret).update(password).digest('hex')) throw new Error();
  } catch {throw new HttpError(401,'Inicia sesión para consultar las reservas.');}
}
