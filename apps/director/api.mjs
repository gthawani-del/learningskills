import {createPlanningController} from './planning.mjs';
import {changeScreenplay} from './screenplay.mjs';
import {screenplayContext} from './public/screenplay-core.js';
import {createPlanningProvider} from './planning-provider.mjs';
import {visiblePlanningCall} from './planning-store.mjs';
import {applyBriefCommand,briefPlanningContext} from './public/creative-brief-core.js';
import {planningCreativeContext} from './planning-profile.mjs';
import {validatePlanningResult} from './planning-provider.mjs';
import {selectRoutes} from './model-router.mjs';
import {createCostQuote} from './cost-quotes.mjs';
import {routingTasks,knownRoutingTask,taskCandidates,routingCatalogExplanation} from './routing-task-catalog.mjs';
import {quoteRequirements} from './quote-input.mjs';
import {staffRole,staffPermissions,adminCommand} from './operations.mjs';
import {applyProductionRecord,recordDependencies} from './production-records.mjs';
import {productionState} from './production-state.mjs';
import {createImportController} from './imports.mjs';
import {createMediaStorage} from './media-storage.mjs';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {LocalStore,SupabaseStore} from './store.mjs';
import {fail,newProject,patchProject,proposalFor,skills,hash} from './domain.mjs';
import {createProviderClients} from './providers.mjs';
import {createJobController} from './jobs.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const assetRoles=new Set(['character_identity','wardrobe','location','visual_style','prop','shot_reference','master_song','dialogue','script','voice_reference','ambience']);
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(v=>{const i=v.indexOf('=');return i<0?['','']:[v.slice(0,i).trim(),v.slice(i+1)];}));
export function validateUpload(body){
 if(typeof body.name!=='string'||body.name.length<1||body.name.length>240||!assetRoles.has(body.role)||!['project','shot'].includes(body.scope))fail(400,'Choose a valid filename, reference role and scope.');
 if(typeof body.base64!=='string'||body.base64.length>2800000||!(/^[A-Za-z0-9+/]*={0,2}$/).test(body.base64))fail(400,'Upload a file up to 2 MB.');
 const bytes=Buffer.from(body.base64,'base64');if(bytes.length<1||bytes.length>2*1024*1024)fail(413,'Upload a file up to 2 MB.');
 const head=bytes.subarray(0,16);const a=head.toString('ascii');
 let mime;if(head[0]===255&&head[1]===216&&head[2]===255)mime='image/jpeg';
 else if(head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
 else if(a.startsWith('RIFF')&&a.slice(8,12)==='WEBP')mime='image/webp';
 else if(a.startsWith('%PDF-'))mime='application/pdf';
 else if(a.startsWith('RIFF')&&a.slice(8,12)==='WAVE')mime='audio/wav';
 else if(a.slice(4,8)==='ftyp')mime='video/mp4';
 else if(a.startsWith('ID3')||(head[0]===255&&(head[1]&224)===224))mime='audio/mpeg';
 else if(['text/plain','text/markdown'].includes(body.mime)&&!bytes.includes(0))mime=body.mime;
 else fail(415,'This file type is not supported or its content does not match. Use JPEG, PNG, WEBP, MP4, WAV, MP3, PDF, TXT or MD.');
 if(body.mime&&body.mime!==mime&&!(mime==='video/mp4'&&body.mime==='video/quicktime'))fail(415,'File content does not match its declared type.');
 return {bytes,mime};
}
export async function createDirectorAPI({env=process.env,fetcher=fetch,store:providedStore,providers:providedProviders,planningProvider:providedPlanningProvider}={}){
 const demo=env.DIRECTOR_DEMO==='1'&&env.NODE_ENV!=='production'&&!env.VERCEL;
 const connected=!!(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY);
 const store=providedStore||(demo?await new LocalStore(env.DIRECTOR_DATA_FILE||'/tmp/director-studio/projects.json').init():connected?new SupabaseStore({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,fetcher}):null);
 const providers=providedProviders||createProviderClients({env,fetcher});
 const loginAttempts=new Map();
 const jobs=store&&!demo?createJobController({store,providers}):null;
 const isAdmin=user=>!!staffRole(user?.id,env);
 // Remains closed until planning has its own verified quote and durable reservation.
 const planning=false;
 const planningController=store?createPlanningController({store,provider:providedPlanningProvider||createPlanningProvider({env,fetcher}),env}):null;
 const mediaStorage=createMediaStorage({env,fetcher,demo});
 const imports=store?createImportController({store,storage:mediaStorage}):null;
 const cookie=(name,token,maxAge,path='/')=>`${name}=${token}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${env.NODE_ENV==='production'||env.VERCEL?'; Secure':''}`;
 const clearSession=()=>[cookie('director_session','',0),cookie('director_refresh','',0,'/api')];
 const sessionHeaders=session=>{
 if(!session?.user?.id||!session.access_token||!session.refresh_token||![session.access_token,session.refresh_token].every(t=>typeof t==='string'&&/^[A-Za-z0-9._~-]{1,8192}$/.test(t)))fail(502,'The account service returned an incomplete session. Please sign in again.');
 const lifetime=Number.isFinite(session.expires_in)?Math.max(1,Math.min(Math.floor(session.expires_in),3600)):3600;
 return {'Set-Cookie':[cookie('director_session',session.access_token,lifetime),cookie('director_refresh',session.refresh_token,30*86400,'/api')]};
 };
 const refreshing=new Map();
 const refreshSession=async token=>{if(!token||token.length>8192)fail(401,'Sign in again to continue.');let pending=refreshing.get(token);if(!pending){pending=store.refresh(token);refreshing.set(token,pending);}try{return await pending;}finally{if(refreshing.get(token)===pending)refreshing.delete(token);}};
 return async(req,res,path,body={})=>{
 const reply=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));};
 const jar=cookies(req),token=jar.director_session,refreshToken=jar.director_refresh;const user=demo?{id:'demo-user',email:'local-development'}:store&&token?await store.user(token):null;
 if(path==='/api/config'&&req.method==='GET')return reply(200,{mode:demo?'demo':'supabase',user:user?{id:user.id,email:user.email,isAdmin:isAdmin(user),staffRole:staffRole(user.id,env)}:null,session:{refreshAvailable:!!(connected&&!demo&&refreshToken)},capabilities:{planning,planningControls:!!store,media:false,uploads:!!store,localExport:demo&&env.DIRECTOR_LOCAL_RENDER==='1'},uploadMaxBytes:2*1024*1024});
 if(path==='/api/auth/login'&&req.method==='POST'){
 if(!connected||demo)fail(503,'Sign-in is not configured for this environment.');
 if(typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length>1024)fail(400,'Enter an email and password.');
 const ip=req.socket?.remoteAddress||'serverless';const key=ip+':'+body.email.toLowerCase();const hit=loginAttempts.get(key)||{n:0,start:Date.now()};if(Date.now()-hit.start>600000){hit.n=0;hit.start=Date.now();}if(hit.n>=8)fail(429,'Too many sign-in attempts. Try again later.');hit.n++;loginAttempts.set(key,hit);if(loginAttempts.size>1000)loginAttempts.delete(loginAttempts.keys().next().value);
 const session=await store.login(body.email,body.password);if(!session.access_token||!session.user)fail(401,'Sign-in failed. Check your credentials.');loginAttempts.delete(key);
 return reply(200,{user:{id:session.user.id,email:session.user.email}},sessionHeaders(session));}
 if(path==='/api/auth/refresh'&&req.method==='POST'){
 if(!connected||demo)fail(503,'Sign-in is not configured for this environment.');
 try{const session=await refreshSession(refreshToken);return reply(200,{user:{id:session.user?.id,email:session.user?.email}},sessionHeaders(session));}
 catch(error){if(error.status===401)return reply(401,{error:'Your session ended. Sign in again; your draft is preserved.'},{'Set-Cookie':clearSession()});throw error;}}
 if(path==='/api/auth/logout'&&req.method==='POST'){
 let current=token;if(store&&!demo){if(!user&&refreshToken)try{current=(await refreshSession(refreshToken)).access_token;}catch(error){if(error.status!==401)throw error;current=null;}
 if(current)try{await store.request('/auth/v1/logout?scope=local',{method:'POST',token:current});}catch(error){if(error.status!==401)throw error;}}
 return reply(200,{ok:true},{'Set-Cookie':clearSession()});}
 if(!store)fail(503,'Configure the server Supabase connection before saving projects.');
 if(!user)fail(401,'Sign in to access your workspace.');
 if(path==='/api/imports'&&req.method==='POST')return reply(200,{project:await imports.start(user.id,body)});
 if(path==='/api/skills'&&req.method==='GET')return reply(200,{skills});
 if(path==='/api/projects'){
 if(req.method==='GET')return reply(200,{projects:await store.list(user.id)});
 if(req.method==='POST')return reply(201,{project:await store.create(newProject(body,user.id))});}
 if(path==='/api/jobs'&&req.method==='GET'){const projects=await store.list(user.id);const jobs=(await Promise.all(projects.map(p=>store.records('jobs',p.id)))).flat();return reply(200,{jobs});}
 if(path.startsWith('/api/admin/')){
 const role=staffRole(user.id,env),permissions=staffPermissions(role);if(!role)fail(403,'Administrator access is required.');
 const permit=permission=>{if(!permissions.includes(permission))fail(403,'Your staff role cannot access this operation.');};
 if(path==='/api/admin/control'&&req.method==='GET'){permit('controls.read');return reply(200,{role,permissions,control:await store.generationControl(),generationEnabled:false});}
 if(path==='/api/admin/audit'&&req.method==='GET'){permit('audit.read');return reply(200,{commands:await store.operationalAudit(),scope:'operational commands',limit:100});}
 if(path==='/api/admin/commands'&&req.method==='POST'){const request=adminCommand(body,user.id,role);return reply(200,await store.operationalCommand(request));}
 if(path==='/api/admin/registry'&&req.method==='GET'){permit('registry.read');return reply(200,{models:await store.registry()});}
 if(path==='/api/admin/overview'&&req.method==='GET'){permit('jobs.read');const ps=await store.list(user.id);const jobs=(await Promise.all(ps.map(p=>store.records('jobs',p.id)))).flat();return reply(200,{scope:'staff-owned projects only',projects:ps.length,jobs,productionEnabled:false});}
 fail(404,'Operation not found.');}
 const match=path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);if(!match)fail(404,'API route not found.');
 const [,id,action]=match;if(!uuid.test(id))fail(400,'Invalid project ID.');const project=await store.get(id,user.id);
 if(!action&&req.method==='GET')return reply(200,{project});
 if(project.importState?.status==='awaiting_media'&&req.method!=='GET'&&action!=='import-complete'&&!/^import-assets\/[0-9a-f-]+$/.test(action||''))fail(409,'This cloud copy is still importing. Reopen the device draft and choose Save to workspace to finish before editing or approving it.');
 if(!action&&req.method==='PATCH'){const next=patchProject(project,body);if(body.shots){const allowed=await store.records('assets',id);if(next.shots.some(s=>s.clipAssetId&&!allowed.some(a=>a.id===s.clipAssetId&&a.mime==='video/mp4')||s.referenceAssetId&&!allowed.some(a=>a.id===s.referenceAssetId&&a.mime.startsWith('image/'))))fail(400,'A selected clip is unavailable.');}return reply(200,{project:await store.save(next,project.version)});}
 const importAsset=action?.match(/^import-assets\/([0-9a-f-]+)$/);
 if(importAsset&&req.method==='POST'){const file=validateUpload(body);const asset=await imports.upload(user.id,id,importAsset[1],file);const {storageKey,...visible}=asset;return reply(200,{asset:{...visible,url:`/api/projects/${id}/assets/${asset.id}/content`}});}
 if(action==='import-complete'&&req.method==='POST')return reply(200,{project:await imports.complete(user.id,id)});
 if(action==='screenplay'&&req.method==='GET')return reply(200,{screenplayContext:screenplayContext(project,await store.records('approvals',id))});
 if((action==='screenplay'||action==='screenplay/apply-proposal')&&req.method==='POST')return reply(200,await changeScreenplay({project,body,actorId:user.id,store,applying:action==='screenplay/apply-proposal'}));
 if(action==='brief'&&req.method==='GET')return reply(200,{briefContext:briefPlanningContext(project,await store.records('approvals',id))});
 if((action==='brief'||action==='brief/apply-proposal')&&req.method==='POST'){
  const applying=action==='brief/apply-proposal',allowed=applying?['expectedVersion','callId']:['expectedVersion','action','changes'];
  if(Object.keys(body).some(k=>!allowed.includes(k))||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||(!applying&&!['interpret','suggest','update'].includes(body.action)))fail(400,'Supply a current project version and a supported creative brief edit.');
  if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen it before reviewing the brief.');
  const approvals=await store.records('approvals',id);let command=body;
  if(applying){
   if(!uuid.test(body.callId||''))fail(400,'Choose a saved interpretation proposal.');
   const saved=await store.readPlanningCall(user.id,id,body.callId),proposal=saved.result?.briefProposal;
   if(saved.reservation.operation!=='interpret_brief'||saved.result?.providerStatus!=='completed'||!proposal)fail(409,'This call has no completed interpretation proposal to review.');
   validatePlanningResult(proposal,saved.request);
   const input=JSON.parse(saved.request.body.input);
   if(hash(input.context)!==hash(planningCreativeContext(project,approvals)))fail(409,'The source brief or reviewed decisions changed. Keep the current brief and prepare a new interpretation if needed.');
   command={expectedVersion:body.expectedVersion,action:'apply_proposal',proposal};
  }
  const next=applyBriefCommand(project,command,approvals),saved=next.version===project.version?project:await store.save(next,project.version);
  return reply(200,{project:saved,briefContext:briefPlanningContext(saved,approvals)});
 }
 const planningRead=action?.match(/^planning-calls\/([0-9a-f-]+)$/);
 if(planningRead&&req.method==='GET'){
  if(!uuid.test(planningRead[1]))fail(400,'Invalid planning call identity.');
  const saved=await store.readPlanningCall(user.id,id,planningRead[1]);return reply(200,{call:visiblePlanningCall(saved),result:saved.result??null});
 }
 if(action==='planning'&&req.method==='GET')return reply(200,await planningController.summary(user.id,id));
 const consentRevoke=action?.match(/^planning-consents\/([0-9a-f-]+)\/revoke$/),planningPoll=action?.match(/^planning-calls\/([0-9a-f-]+)\/(poll|resume|release)$/);
 if(req.method==='POST'&&(action==='planning-consents'||action==='planning-calls'||consentRevoke||planningPoll)){
 const allowed=planningPoll?(planningPoll[2]==='poll'?['requestId']:['requestId','expectedVersion']):consentRevoke?['requestId','expectedVersion','reason']:action==='planning-consents'?['requestId','expectedVersion','maxMicroUsd','finishReserveMicroUsd','maxCalls']:['requestId','expectedVersion','consentId','operation'];
 if(Object.keys(body).some(k=>!allowed.includes(k))||!uuid.test(body.requestId||'')||(!planningPoll||planningPoll[2]!=='poll')&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1))fail(400,'Supply a request identity, project version and supported planning fields.');
 const c={...body,actorId:user.id,projectId:id};
 if(planningPoll){if(!uuid.test(planningPoll[1]))fail(400,'Invalid planning call identity.');return reply(200,{call:visiblePlanningCall(planningPoll[2]==='poll'?await planningController.poll(user.id,id,planningPoll[1]):await planningController[planningPoll[2]](c,planningPoll[1]))});}
 if(consentRevoke){if(!uuid.test(consentRevoke[1])||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>1000)fail(400,'Supply an authorization and a reason of 5–1000 characters.');return reply(200,{consent:await planningController.revoke({...c,consentId:consentRevoke[1]})});}
 if(action==='planning-consents'){if(!Number.isSafeInteger(body.maxMicroUsd)||body.maxMicroUsd<=0||!Number.isSafeInteger(body.finishReserveMicroUsd)||body.finishReserveMicroUsd<0||!Number.isSafeInteger(body.maxCalls)||body.maxCalls<1||body.maxCalls>10)fail(400,'Supply integer USD limits and 1–10 planning calls.');return reply(200,{consent:await planningController.consent(c)});}
 if(!uuid.test(body.consentId||'')||!['initial_plan','revise_plan','interpret_brief','write_script','revise_script'].includes(body.operation))fail(400,'Supply a scoped planning consent and operation.');
 return reply(200,{call:visiblePlanningCall(await planningController.start(c))});
 }
 if(action==='plan'&&req.method==='POST'){
 if(!planning)fail(503,'AI planning is not enabled. You can write the story manually.');
 if(body.authorizePlanning!==true)fail(402,'Confirm the planning operation before submitting.');
 const plan=await providers.planFilm({brief:project.premise+'\nDirection: '+project.direction+'\nLanguage: '+project.language,durationSeconds:project.duration,authorized:true});
 const next=patchProject(project,{story:{treatment:plan.treatment,scenes:plan.scenes},shots:plan.shots.map(s=>({id:s.id,title:s.description.slice(0,70),description:s.description,duration:s.durationSeconds,camera:s.camera,dialogue:s.dialogue,continuity:s.continuity,sceneId:s.sceneId,framing:'medium'})),title:plan.title});
 return reply(200,{project:await store.save(next,project.version)});}
 if(action==='spending'&&req.method==='GET'){if(typeof store.spendingSummary!=='function')fail(503,'Saved spending controls are not configured.');return reply(200,await store.spendingSummary(user.id,id));}
 const revokeMatch=action?.match(/^spending-authorizations\/([0-9a-f-]+)\/revoke$/);
 if((action==='spending-authorizations'||revokeMatch)&&req.method==='POST'){
 const allowed=revokeMatch?['requestId','expectedVersion','reason']:['requestId','expectedVersion','quoteId','maxMicroUsd','finishReserveMicroUsd'];
 if(Object.keys(body).some(k=>!allowed.includes(k))||!uuid.test(body.requestId||'')||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1)fail(400,'Supply a request identity, project version and supported spending fields.');
 if(revokeMatch&&(!uuid.test(revokeMatch[1])||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>1000))fail(400,'Supply a valid authorization and a reason of 5–1000 characters.');
 if(!revokeMatch&&(!/^[a-f0-9]{64}$/.test(body.quoteId||'')||!Number.isSafeInteger(body.maxMicroUsd)||body.maxMicroUsd<=0||!Number.isSafeInteger(body.finishReserveMicroUsd)||body.finishReserveMicroUsd<0))fail(400,'Supply a saved quote and integer USD spending limits.');
 const command={...body,actorId:user.id,projectId:id};if(revokeMatch)command.authorizationId=revokeMatch[1];
 const method=revokeMatch?'revokeCostAuthorization':'authorizeCostQuote';if(typeof store[method]!=='function')fail(503,'Saved spending controls are not configured.');
 return reply(200,{authorization:await store[method](command)});
 }
 if(action==='routes'&&req.method==='GET')return reply(200,{tasks:routingTasks,scope:routingCatalogExplanation,generationAuthorized:false});
 if((action==='routes'||action==='quotes')&&req.method==='POST'){
 const allowed=action==='routes'?['task','requirements','intent']:['task','requirements','intent','requestId','expectedVersion','modelId','artifactId','artifactVersion','input'];
 if(Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Unsupported routing or quote field.');
 if(!knownRoutingTask(body.task))fail(400,'Choose a known production task.');
 const requestFingerprint=hash(body);
 if(action==='quotes'&&body.requestId!==undefined){if(!uuid.test(body.requestId))fail(400,'Use a valid quote request UUID.');if(typeof store.replayCostQuote!=='function')fail(503,'Saved spending controls are not configured.');const previous=await store.replayCostQuote({actorId:user.id,projectId:id,requestId:body.requestId,requestFingerprint});if(previous)return reply(200,{quote:previous,saved:true});}
 const models=taskCandidates(body.task,await store.registry()),now=new Date();
 const routing=selectRoutes({task:body.task,requirements:body.requirements??{},intent:body.intent,models,now});
 if(action==='routes')return reply(200,routing);
 if(body.expectedVersion!==project.version)fail(409,'This project changed. Reopen it before requesting a quote.');
 const model=models.find(m=>m.id===body.modelId);if(!model||!routing.eligibleForQuote.includes(model.id))fail(409,'No verified route is eligible for this quote.');
 const requirements=quoteRequirements({task:body.task,requirements:body.requirements??{},model,input:body.input});
 const quote=createCostQuote({project,artifactId:body.artifactId,artifactVersion:body.artifactVersion,task:body.task,requirements,intent:body.intent,model,input:body.input,now});
 if(body.requestId!==undefined){const saved=await store.persistCostQuote({actorId:user.id,projectId:id,requestId:body.requestId,expectedVersion:body.expectedVersion,requestFingerprint,quote,input:body.input});return reply(201,{quote:saved,saved:true});}
 return reply(200,{quote});
 }
 if(action==='production-records'&&req.method==='GET')return reply(200,{production:project.production||{records:[]},dependencies:recordDependencies(project)});
 if(action==='production-records'&&req.method==='POST'){const next=applyProductionRecord(project,body,await store.records('assets',id));return reply(200,{project:next.version===project.version?project:await store.save(next,project.version)});}
 if(action==='production-state'&&req.method==='GET')return reply(200,{production:productionState(project,await store.records('assets',id),await store.records('approvals',id))});
 if(action==='approvals'&&req.method==='POST'){
 if(!['approved','rejected','revoked'].includes(body.decision)||!Number.isSafeInteger(body.version))fail(400,'Invalid approval decision.');return reply(201,{approval:await store.approve(project,body,user.id)});}
 if(action==='approvals'&&req.method==='GET')return reply(200,{approvals:await store.records('approvals',id)});
 if(action==='assets'&&req.method==='GET')return reply(200,{assets:(await store.records('assets',id)).map(({storageKey,...a})=>({...a,url:`/api/projects/${id}/assets/${a.id}/content`}))});
 if(action==='assets'&&req.method==='POST'){
 const {bytes,mime}=validateUpload(body);if(body.scope==='shot'&&!project.shots.some(s=>s.id===body.shotId))fail(400,'Select a valid shot for this reference.');
 const assetId=randomUUID(),storageKey=`${user.id}/${id}/${assetId}`;
 if(demo){const dir=env.DIRECTOR_ASSET_DIR||'/tmp/director-studio/assets';await mkdir(dir,{recursive:true});await writeFile(join(dir,assetId),bytes,{mode:0o600});}
 else {const response=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/director-media/${storageKey}`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':mime,'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(30000)});if(!response.ok)fail(502,'Private upload failed. Retry without losing your draft.');}
 const asset=await store.add('assets',{id:assetId,projectId:id,name:body.name,mime,role:body.role,scope:body.scope,shotId:body.shotId||null,version:1,storageKey,size:bytes.length,checksum:hash(bytes.toString('base64'))});const {storageKey:unused,...visible}=asset;return reply(201,{asset:{...visible,url:`/api/projects/${id}/assets/${assetId}/content`}});}
 const content=action?.match(/^assets\/([0-9a-f-]+)\/content$/);
 if(content&&req.method==='GET'){const asset=(await store.records('assets',id)).find(a=>a.id===content[1]);if(!asset)fail(404,'Reference not found.');let bytes;
 if(demo)bytes=await readFile(join(env.DIRECTOR_ASSET_DIR||'/tmp/director-studio/assets',asset.id));
 else {const response=await fetcher(`${env.SUPABASE_URL}/storage/v1/object/authenticated/director-media/${asset.storageKey}`,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`},signal:AbortSignal.timeout(30000)});if(!response.ok)fail(502,'Reference retrieval failed.');bytes=Buffer.from(await response.arrayBuffer());}
 res.writeHead(200,{'Content-Type':asset.mime.startsWith('image/')||asset.mime.startsWith('video/')||asset.mime.startsWith('audio/')?asset.mime:'application/octet-stream','Content-Disposition':`attachment; filename="reference-${asset.id}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);}
 if(action==='proposals'&&req.method==='POST'){const proposal=proposalFor(project,body,await store.records('assets',id));await store.add('audit',{id:randomUUID(),projectId:id,actorId:user.id,type:'direction_prepared',details:proposal});return reply(201,{proposal});}
 if(action==='jobs'&&req.method==='GET')return reply(200,{jobs:await store.records('jobs',id)});
 const jobMatch=action?.match(/^jobs\/([0-9a-f-]+)(?:\/(dispatch|poll))?$/);
 if(jobMatch){if(!uuid.test(jobMatch[1]))fail(400,'Invalid job ID.');if(!jobs)fail(409,'Live model jobs are unavailable in local development.');
 const scope={actorId:user.id,projectId:id,jobId:jobMatch[1]};
 if(req.method==='GET'&&!jobMatch[2])return reply(200,{job:await store.readJob(user.id,id,jobMatch[1])});
 if(req.method==='POST'&&['dispatch','poll'].includes(jobMatch[2]))return reply(200,{job:await jobs[jobMatch[2]](scope)});}
 if(action==='jobs'&&req.method==='POST'){
 if(!jobs)fail(409,'Live model jobs are unavailable in local development.');
 if(![body.proposalId,body.authorizationId,body.workUnitId].every(x=>typeof x==='string'&&uuid.test(x))||typeof body.idempotencyKey!=='string'||body.idempotencyKey.length<8||body.idempotencyKey.length>200)fail(400,'Supply approved proposal, authorization, work unit and request identities.');
 const proposal=await store.readProposal(id,body.proposalId);if(!proposal)fail(404,'Verified proposal not found.');
 const job=await store.reserve({p_actor_id:user.id,p_project_id:id,p_work_unit_id:body.workUnitId,p_proposal_id:body.proposalId,p_authorization_id:body.authorizationId,p_idempotency_key:body.idempotencyKey,p_payload_hash:proposal.payload_hash});return reply(201,{job});}
 if(action==='generate'&&req.method==='POST')fail(409,'Generation is held: no model profile has passed execution and quality validation. A verified quote and budget authorization are required.');
 if(action==='export'&&req.method==='POST'){
 if(!demo||env.DIRECTOR_LOCAL_RENDER!=='1')fail(503,'Hosted sound-preserving export is not configured. Accepted assets remain available.');
 const approvals=await store.records('approvals',id);const script=screenplayContext(project,approvals);if(project.screenplay&&!script.approved)fail(409,'Review and approve the current screenplay and its source comparison before export.');if(!project.shots.length||project.shots.some(s=>{const last=approvals.filter(a=>a.artifactId===s.id&&a.version===s.version).at(-1);return last?.decision!=='approved';}))fail(409,'Approve each current shot version before export.');
 const {renderFilm}=await import('./render.mjs');const bytes=await renderFilm({project,assets:await store.records('assets',id),assetDir:env.DIRECTOR_ASSET_DIR||'/tmp/director-studio/assets'});
 res.writeHead(200,{'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="director-film.mp4"','Cache-Control':'no-store'});return res.end(bytes);}

 fail(404,'Operation not found.');
 };
}
