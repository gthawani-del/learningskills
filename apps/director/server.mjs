import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createDirectorAPI} from './api.mjs';
const files={'/':'index.html','/index.html':'index.html','/favicon.ico':'favicon.svg','/favicon.svg':'favicon.svg','/styles.css':'styles.css','/studio-v2.css':'studio-v2.css','/creative-brief-core.js':'creative-brief-core.js','/screenplay-core.js':'screenplay-core.js','/originality-core.js':'originality-core.js','/screenplay-project.js':'screenplay-project.js','/production-records-core.js':'production-records-core.js','/production-library.js':'production-library.js','/revision-impact.js':'revision-impact.js','/cloud-migration.js':'cloud-migration.js','/api-client.js':'api-client.js','/device-drafts.js':'device-drafts.js','/app.js':'app.js','/admin':'admin.html','/admin.html':'admin.html','/admin.js':'admin.js'};
export async function createHandler(options={}){
 const api=await createDirectorAPI(options),env=options.env||process.env;
 return async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(!['GET','POST','PATCH'].includes(req.method)){res.writeHead(405,{'Allow':'GET, POST, PATCH'});return res.end();}
 if(req.method!=='GET'){
 const origin=req.headers.origin;const expected=env.APP_ORIGIN||`${env.VERCEL?'https':'http'}://${req.headers.host}`;
 if(origin&&origin!==expected)throw Object.assign(new Error('Cross-origin requests are not allowed.'),{status:403});
 if((req.headers['sec-fetch-site']||'')==='cross-site')throw Object.assign(new Error('Cross-site requests are not allowed.'),{status:403});
 if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('Use a JSON request.'),{status:415});
 }
 if(path.startsWith('/api/')){let body={};if(req.method!=='GET'){
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>3*1024*1024)throw Object.assign(new Error('Request exceeds 3 MB.'),{status:413});chunks.push(chunk);}
 try{body=JSON.parse(Buffer.concat(chunks).toString());if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw Object.assign(new Error('Invalid JSON request.'),{status:400});}}
 return await api(req,res,path,body);}
 const name=files[path];if(!name){res.writeHead(404);return res.end('Not found');}
 const content=await readFile(new URL(`public/${name}`,import.meta.url));const type=name.endsWith('.svg')?'image/svg+xml':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html';res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store'});res.end(content);
 }catch(e){if(!res.headersSent){res.writeHead(e.status||500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:e.status?e.message:'The request could not finish. Your draft is preserved.'}));}else res.end();}};
}
export async function createServer(options={}){return http.createServer(await createHandler(options));}
if(process.argv[1]===fileURLToPath(import.meta.url)){const server=await createServer();server.listen(Number(process.env.PORT)||3000,'127.0.0.1',()=>console.log('Director Studio running on loopback.'));}
