import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {fail} from './domain.mjs';
const route='/api/auth/recovery';
const safeToken=v=>typeof v==='string'&&/^[A-Za-z0-9._~-]{1,8192}$/.test(v);
const same=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
const email=v=>typeof v==='string'&&v.length<=254&&/^\S+@\S+\.\S+$/.test(v);
// Recovery is a separate, short-lived capability. It never creates a normal app session.
export function createAccountRecovery({env,store,connected,demo,now=Date.now}){
 const attempts=new Map();
 const cookie=(name,value,maxAge,{lax=false}={})=>`${name}=${value}; Path=${route}; HttpOnly; SameSite=${lax?'Lax':'Strict'}; Max-Age=${maxAge}${env.NODE_ENV==='production'||env.VERCEL?'; Secure':''}`;
 const cleared=()=>[cookie('director_recovery_flow','',0,{lax:true}),cookie('director_recovery','',0)];
 function origin(){let url;try{url=new URL(env.APP_ORIGIN);}catch{fail(503,'Account recovery needs the configured application URL. Your draft is preserved.');}if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!['https:','http:'].includes(url.protocol)||(env.NODE_ENV==='production'||env.VERCEL)&&url.protocol!=='https:')fail(503,'Account recovery needs a secure application URL. Your draft is preserved.');return url.origin;}
 function available(){if(!connected||demo||!store?.requestRecovery||!store?.exchangeRecovery||!store?.updatePassword)fail(503,'Account recovery is not configured. Your draft is preserved.');}
 function limit(req){const key=req.socket?.remoteAddress||'serverless',time=now();let hit=attempts.get(key);if(!hit||time-hit.start>=600000)hit={start:time,n:0};if(hit.n>=8)fail(429,'Too many recovery attempts. Try again later.');hit.n++;attempts.set(key,hit);if(attempts.size>1000)attempts.delete(attempts.keys().next().value);}
 const exact=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Supply only the requested recovery information.');};
 return async({req,res,path,body,jar,reply,clearSession})=>{
  if(!path.startsWith(route))return false;
  available();
  if(path===route+'/start'&&req.method==='POST'){
   exact(body,['email']);if(!email(body.email))fail(400,'Enter a valid email address.');limit(req);
   const verifier=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url');
   const challenge=createHash('sha256').update(verifier).digest('base64url');
   const redirect=new URL(route+'/callback',origin());redirect.searchParams.set('state',state);
   await store.requestRecovery(body.email,redirect.href,challenge);
   reply(200,{message:'If that address has an account, a recovery link will arrive. Open it in this browser. Your draft is preserved.'},{'Set-Cookie':[cookie('director_recovery_flow',`${now()}.${verifier}.${state}`,600,{lax:true}),cookie('director_recovery','',0)]});return true;
  }
  if(path===route+'/callback'&&req.method==='GET'){
   const query=new URL(req.url,'http://localhost').searchParams,parts=(jar.director_recovery_flow||'').split('.'),code=query.get('code');
   const valid=parts.length===3&&/^\d{13}$/.test(parts[0])&&now()-Number(parts[0])>=0&&now()-Number(parts[0])<=600000&&/^[A-Za-z0-9_-]{43}$/.test(parts[1])&&same(parts[2],query.get('state'))&&typeof code==='string'&&/^[A-Za-z0-9_-]{1,512}$/.test(code)&&!query.has('error');
   let status='expired',headers=cleared();
   if(valid)try{const session=await store.exchangeRecovery(code,parts[1]);if(!session?.user?.id||!safeToken(session.access_token))throw Error('Incomplete recovery');const maxAge=Math.min(600,Number.isFinite(session.expires_in)?Math.max(1,Math.floor(session.expires_in)):600);headers=[cookie('director_recovery_flow','',0,{lax:true}),cookie('director_recovery',session.access_token,maxAge)];status='ready';}catch(error){status=error.status===401?'expired':'unavailable';}
   res.writeHead(303,{'Location':`/?account_recovery=${status}#home`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':headers});res.end();return true;
  }
  if(path===route+'/status'&&req.method==='GET'){
   const token=jar.director_recovery;const user=safeToken(token)?await store.user(token):null;reply(200,{ready:!!user});return true;
  }
  if(path===route+'/complete'&&req.method==='POST'){
   exact(body,['password']);if(typeof body.password!=='string'||body.password.length<8||body.password.length>1024)fail(400,'Choose a password with at least 8 characters.');limit(req);
   const token=jar.director_recovery;if(!safeToken(token)||!await store.user(token))fail(401,'This recovery link expired. Request a new link; your draft is preserved.');
   await store.updatePassword(token,body.password);
   reply(200,{message:'Password updated. Sign in with your new password.'},{'Set-Cookie':[...cleared(),...clearSession()]});return true;
  }
  if(path===route+'/cancel'&&req.method==='POST'){reply(200,{ok:true},{'Set-Cookie':cleared()});return true;}
  fail(404,'Recovery action not found.');
 };
}
