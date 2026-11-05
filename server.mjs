import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {build} from './scripts/build.mjs';
import reservations from './api/reservas.js';
import admin from './api/admin.js';
const publicRoot=await build();
const port=Number(process.env.PORT||3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/reservas')return await reservations(req,res);
  if(url.pathname==='/api/admin')return await admin(req,res);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let path=decodeURIComponent(url.pathname);if(path==='/')path='/index.html';if(path==='/admin'||path==='/admin/')path='/admin.html';
  const file=resolve(publicRoot,'.'+path);
  if(!file.startsWith(publicRoot+sep)){res.writeHead(403);return res.end('Acceso no permitido.');}
  if(!(await stat(file)).isFile())throw new Error();
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control',path==='/admin.html'?'no-store':'no-cache');
  if(path==='/admin.html'){res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");}
  else res.setHeader('Content-Security-Policy',"frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  const data=await readFile(file);res.statusCode=200;res.end(req.method==='HEAD'?undefined:data);
 }catch{res.statusCode=404;res.end('Página no encontrada.');}
});
server.listen(port,'127.0.0.1',()=>{console.log(`Alexia: http://localhost:${port}\nPanel: http://localhost:${port}/admin\nConfiguración: .env\nDatos locales: data/reservas.sqlite`);});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
