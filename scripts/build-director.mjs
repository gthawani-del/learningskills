import {cp,mkdir,rm,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['apps/director','api','docs/evidence/FAL_ENDPOINT_SCHEMAS.json','package.json','package-lock.json','vercel.json']){
 await cp(resolve(root,name),resolve(out,name),{recursive:true,filter:source=>!source.includes('/tests')});
}
const {createHandler}=await import(pathToFileURL(resolve(out,'apps/director/server.mjs')).href);
if(typeof await createHandler({env:{NODE_ENV:'production'}})!=='function')throw Error('Production handler failed validation');
for(const file of ['index.html','admin.html']){const html=await readFile(resolve(out,'apps/director/public',file),'utf8');for(const [,resource]of html.matchAll(/(?:src|href)="\/(\w[\w.-]*\.(?:js|css))"/g))await readFile(resolve(out,'apps/director/public',resource));}
console.log('Production Node package built and imported successfully: dist/ (no provider calls).');
