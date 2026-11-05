import {cp,mkdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function build(){
 const out=resolve(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 // Explicit public allowlist: no data, environment files, SQL, docs or server code.
 for(const name of ['index.html','admin.html','tablero.html','crm.html','demos.html','ejemplos.html','generador.html','validador.html','manifest.webmanifest','sw.js','icons','js','css'])await cp(resolve(root,name),resolve(out,name),{recursive:true});
 return out;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){await build();console.log('Sitio construido en dist/.');}
