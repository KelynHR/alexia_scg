import { HttpError } from './config.js';
let database;
export async function db() {
  if (!database) {
    database = (async () => {
      if (process.env.DATABASE_URL) {
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        return {query:(text,params=[]) => sql.query(text,params)};
      }
      if (process.env.VERCEL) throw new HttpError(503,'La agenda está pendiente de conectar su base de datos.');
      const { DatabaseSync } = await import('node:sqlite');
      const { mkdirSync,readFileSync } = await import('node:fs');
      const { dirname,resolve } = await import('node:path');
      const path = process.env.SQLITE_PATH || resolve('data/reservas.sqlite');
      if (path !== ':memory:') mkdirSync(dirname(path),{recursive:true});
      const sqlite = new DatabaseSync(path);
      sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
      sqlite.exec(readFileSync(new URL('../database/schema.sql',import.meta.url),'utf8'));
      return {query:async (text,params=[]) => {
        const bindings=[];
        const query=text.replace(/\$(\d+)/g,(_,n) => {bindings.push(params[Number(n)-1]);return '?';});
        return sqlite.prepare(query).all(...bindings);
      }};
    })().catch(err => {database = undefined;throw err;});
  }
  return database;
}
export const uniqueViolation = error => error.code === '23505' || [1555,2067].includes(error.errcode);
