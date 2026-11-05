export const HOURS = ['09:00','10:00','11:00','12:00','13:00','16:00','17:00'];
export const AREAS = ['Finanzas','Contraloría y Administración','Cobranza','Comercial','Mercadotecnia','Ventas Digitales','Operaciones','Almacén e Inventarios','Gestión de rutas','Supply Chain','Manufactura','RH y Desarrollo Organizacional','Tecnologías de la información'];
export const MODES = ['En línea','Presencial en Querétaro'];
export const STATES = ['registrada','confirmada','cancelada'];
export const ZONE = 'America/Mexico_City';
export const HORIZON_DAYS = 90;
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function secrets() {
  const password = process.env.ADMIN_PASSWORD || '';
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (password.length < 16 || secret.length < 32) throw new HttpError(503,'La agenda está pendiente de configuración.');
  return {password, secret};
}
export function appOrigin() {
  const value = process.env.APP_ORIGIN || (!process.env.VERCEL ? 'http://localhost:3000' : '');
  try {
    const url = new URL(value);
    if (value !== url.origin || (process.env.VERCEL && url.protocol !== 'https:')) throw new Error();
    return url.origin;
  } catch { throw new HttpError(503,'La agenda está pendiente de configuración.'); }
}
export function dateInMexico(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function lastDate(now = Date.now()) { return dateInMexico(now + HORIZON_DAYS * 86400000); }
export function validateDay(value, now = Date.now(), temporal = true) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400,'Fecha no válida.');
  const day = new Date(value + 'T12:00:00-06:00');
  if (!Number.isFinite(+day) || dateInMexico(+day) !== value) throw new HttpError(400,'Fecha no válida.');
  if (temporal && (value < dateInMexico(now) || value > lastDate(now))) throw new HttpError(400,'Elige una fecha dentro de los próximos 90 días.');
  if ([0,6].includes(day.getUTCDay())) throw new HttpError(400,'Elige un día de lunes a viernes.');
  return value;
}
export function validateReservation(body, now = Date.now(), temporal = true) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400,'Datos no válidos.');
  const str = (key,max,required=true) => {
    const v = body[key];
    if (v != null && typeof v !== 'string') throw new HttpError(400,'Revisa los datos del formulario.');
    const text = (v || '').trim();
    if ((required && !text) || text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new HttpError(400,'Revisa los datos del formulario.');
    return text;
  };
  if (str('website',1000,false)) throw new HttpError(400,'No se pudo registrar la solicitud.');
  const data = {nombre:str('nombre',120),empresa:str('empresa',160),correo:str('correo',254).toLowerCase(),telefono:str('telefono',32,false),area:str('area',100),reto:str('reto',2000,false),modalidad:str('modalidad',50),fecha:validateDay(body.fecha,now,temporal),hora:str('hora',5)};
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.correo)) throw new HttpError(400,'Escribe un correo válido.');
  if (data.telefono && !/^[+\d\s().-]{7,32}$/.test(data.telefono)) throw new HttpError(400,'Revisa el teléfono.');
  if (!AREAS.includes(data.area) || !MODES.includes(data.modalidad) || !HOURS.includes(data.hora)) throw new HttpError(400,'Selecciona un área, modalidad y horario válidos.');
  data.inicio_ms = +new Date(`${data.fecha}T${data.hora}:00-06:00`);
  if (temporal && data.inicio_ms < now + 3600000) throw new HttpError(400,'Reserva con al menos una hora de anticipación.');
  if (typeof body.solicitud_id !== 'string' || !/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(body.solicitud_id)) throw new HttpError(400,'Recarga el formulario e intenta de nuevo.');
  return {...data, solicitud_id:body.solicitud_id.toLowerCase()};
}
