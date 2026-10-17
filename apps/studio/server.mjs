import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createAPI} from './movie-api.mjs';
const files={'/':'movie.html','/movie.js':'movie.js','/movie.css':'movie.css','/media':'index.html','/app.js':'app.js','/styles.css':'styles.css'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'};
export function createServer(options={}){const api=createAPI(options);return http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;
 // This development server binds to loopback. Same-origin checks prevent cross-site paid POST requests.
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)throw Object.assign(new Error('Cross-origin requests are not allowed.'),{status:403});
 if(path.startsWith('/api/')){let body={};if(req.method==='POST'){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>110*1024*1024)throw Object.assign(new Error('Movie upload exceeds 110 MB.'),{status:413});chunks.push(chunk);}try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{throw Object.assign(new Error('Invalid JSON request.'),{status:400});}}return await api(req,res,path,body);}
 const name=files[path];if(!name){res.writeHead(404);return res.end('Not found');}const content=await readFile(new URL(`public/${name}`,import.meta.url));res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(content);
 }catch(e){if(!res.headersSent){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:'The request could not finish. Your project has been kept.'}));}else res.end();}});}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT)||3000;createServer().listen(port,'127.0.0.1',()=>console.log(`Movie studio: http://127.0.0.1:${port}`));}
