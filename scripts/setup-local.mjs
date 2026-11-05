import {writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const path=new URL('../.env',import.meta.url);
try{
 await writeFile(path,`DATABASE_URL=\nAPP_ORIGIN=http://localhost:3000\nADMIN_PASSWORD=${randomBytes(18).toString('base64url')}\nADMIN_SESSION_SECRET=${randomBytes(32).toString('base64url')}\n`,{flag:'wx',mode:0o600});
 console.log('Configuración local creada. Consulta ADMIN_PASSWORD en .env para entrar al panel. No publiques ese archivo.');
}catch(error){if(error.code==='EEXIST')console.log('Ya existe .env; no se ha modificado.');else throw error;}
