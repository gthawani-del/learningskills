import {createAccountRecovery} from './account-recovery.mjs';
import {createStoryboardProductionController} from './storyboard-production.mjs';
import {animaticContext,saveAnimatic} from './public/animatic-core.js';
import {musicVideoContext,saveMusicVideo} from './public/music-video-core.js';
import {storyboardProductionContext} from './public/storyboard-production-core.js';
import {createReferenceController} from './reference-production.mjs';
import {createPlanningController} from './planning.mjs';
import {changeDepartmentPlans} from './department-plans.mjs';
import {changeStoryboardHandoff} from './storyboard-handoff.mjs';
import {storyboardHandoffContext} from './public/storyboard-handoff-core.js';
import {departmentPlanningContext} from './public/department-plan-core.js';
import {DEPARTMENT_GUIDANCE_VERSION} from './public/department-guidance.js';
import {modelRegistryCommand} from './model-registry.mjs';
import {changeScreenplay} from './screenplay.mjs';
import {screenplayContext} from './public/screenplay-core.js';
import {createPlanningProvider} from './planning-provider.mjs';
import {visiblePlanningCall} from './planning-store.mjs';
import {applyBriefCommand,briefPlanningContext} from './public/creative-brief-core.js';
import {planningCreativeContext,planningSchemaHash,departmentPlanningSchemaHash,departmentRevisionSchemaHash,storyboardPlanningSchemaHash} from './planning-profile.mjs';
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
import {createMediaIngestion,SOURCE_UPLOAD_MAX_BYTES} from './media-ingestion.mjs';
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
export async function createDirectorAPI({env=process.env,fetcher=fetch,store:providedStore,providers:providedProviders,planningProvider:providedPlanningProvider,storage:providedStorage}={}){
 const demo=env.DIRECTOR_DEMO==='1'&&env.NODE_ENV!=='production'&&!env.VERCEL;
 const connected=!!(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY);
 const store=providedStore||(demo?await new LocalStore(env.DIRECTOR_DATA_FILE||'/tmp/director-studio/projects.json').init():connected?new SupabaseStore({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY,fetcher}):null);
 const providers=providedProviders||createProviderClients({env,fetcher});
 const loginAttempts=new Map();
 const jobs=store&&(!demo||providedProviders)?createJobController({store,providers}):null;
 const isAdmin=user=>!!staffRole(user?.id,env);
 // Remains closed until planning has its own verified quote and durable reservation.
 const planning=false;
 const planningController=store?createPlanningController({store,provider:providedPlanningProvider||createPlanningProvider({env,fetcher}),env}):null;
 const mediaStorage=providedStorage||createMediaStorage({env,fetcher,demo});
 const resumableUploads=!!store&&!demo&&env.DIRECTOR_RESUMABLE_UPLOADS==='1';
 const ingestion=store?createMediaIngestion({store,storage:mediaStorage,enabled:resumableUploads}):null;
 const referenceController=store?createReferenceController({store,providers,storage:mediaStorage,fetcher,generationConfigured:!!providedProviders||!demo&&!!env.FAL_API_KEY&&(connected||!!providedStore)}):null;
 const storyboardProductionController=store?createStoryboardProductionController({store,providers,storage:mediaStorage,fetcher,generationConfigured:!!providedProviders||!demo&&!!env.FAL_API_KEY&&(connected||!!providedStore)}):null;
 const imports=store?createImportController({store,storage:mediaStorage}):null;
 const cookie=(name,token,maxAge,path='/')=>`${name}=${token}; Path=${path}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${env.NODE_ENV==='production'||env.VERCEL?'; Secure':''}`;
 const clearSession=()=>[cookie('director_session','',0),cookie('director_refresh','',0,'/api')];
 const sessionHeaders=session=>{
 if(!session?.user?.id||!session.access_token||!session.refresh_token||![session.access_token,session.refresh_token].every(t=>typeof t==='string'&&/^[A-Za-z0-9._~-]{1,8192}$/.test(t)))fail(502,'The account service returned an incomplete session. Please sign in again.');
 const lifetime=Number.isFinite(session.expires_in)?Math.max(1,Math.min(Math.floor(session.expires_in),3600)):3600;
 return {'Set-Cookie':[cookie('director_session',session.access_token,lifetime),cookie('director_refresh',session.refresh_token,30*86400,'/api')]};
 };
 const recovery=createAccountRecovery({env,store,connected,demo});
 const refreshing=new Map();
 const refreshSession=async token=>{if(!token||token.length>8192)fail(401,'Sign in again to continue.');let pending=refreshing.get(token);if(!pending){pending=store.refresh(token);refreshing.set(token,pending);}try{return await pending;}finally{if(refreshing.get(token)===pending)refreshing.delete(token);}};
 return async(req,res,path,body={})=>{
 const reply=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));};
 const jar=cookies(req),token=jar.director_session,refreshToken=jar.director_refresh;
 if(await recovery({req,res,path,body,jar,reply,clearSession}))return;
 const user=demo?{id:'demo-user',email:'local-development'}:store&&token?await store.user(token):null;
 if(path==='/api/config'&&req.method==='GET')return reply(200,{mode:demo?'demo':'supabase',user:user?{id:user.id,email:user.email,isAdmin:isAdmin(user),staffRole:staffRole(user.id,env)}:null,session:{refreshAvailable:!!(connected&&!demo&&refreshToken)},capabilities:{planning,planningControls:!!store,media:false,uploads:!!store,resumableUploads,localExport:demo&&env.DIRECTOR_LOCAL_RENDER==='1'},uploadMaxBytes:2*1024*1024,sourceUploadMaxBytes:resumableUploads?SOURCE_UPLOAD_MAX_BYTES:0});
 if(path==='/api/auth/login'&&req.method==='POST'){
 if(!connected||demo)fail(503,'Sign-in is not configured for this environment.');
 if(typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length>1024)fail(400,'Enter an email and password.');
 const ip=req.socket?.remoteAddress||'serverless';const key=ip+':'+body.email.toLowerCase();const hit=loginAttempts.get(key)||{n:0,start:Date.now()};if(Date.now()-hit.start>600000){hit.n=0;hit.start=Date.now();}if(hit.n>=8)fail(429,'Too many sign-in attempts. Try again later.');hit.n++;loginAttempts.set(key,hit);if(loginAttempts.size>1000)loginAttempts.delete(loginAttempts.keys().next().value);
 const session=await store.login(body.email,body.password);if(!session.access_token||!session.user)fail(401,'Sign-in failed. Check your credentials.');loginAttempts.delete(key);
 return reply(200,{user:{id:session.user.id,email:session.user.email}},sessionHeaders(session));}
 if(path==='/api/auth/signup'&&req.method==='POST'){
 if(!connected||demo||typeof store?.signup!=='function')fail(503,'Account creation is not configured for this environment. Your draft is preserved.');
 if(typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email)||typeof body.password!=='string'||body.password.length<8||body.password.length>1024)fail(400,'Enter a valid email and a password of at least 8 characters.');
 const key='signup:'+(req.socket?.remoteAddress||'serverless'),hit=loginAttempts.get(key)||{n:0,start:Date.now()};if(Date.now()-hit.start>600000){hit.n=0;hit.start=Date.now();}if(hit.n>=8)fail(429,'Too many account attempts. Try again later.');hit.n++;loginAttempts.set(key,hit);if(loginAttempts.size>1000)loginAttempts.delete(loginAttempts.keys().next().value);
 let result;try{result=await store.signup(body.email,body.password);}catch(error){if(error.status===429)throw error;fail(error.status===502?502:400,'Account creation could not finish. Check your details or sign in if you already have an account. Your draft is preserved.');}
 if(result?.access_token)return reply(200,{user:{id:result.user?.id,email:result.user?.email},confirmationRequired:false},sessionHeaders(result));
 if(!result?.id&&!result?.user?.id)fail(502,'The account service did not return a usable response. Your draft is preserved.');
 return reply(200,{confirmationRequired:true});}
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
 if(path==='/api/admin/registry/commands'&&req.method==='POST'){const request=modelRegistryCommand(body,user.id,role);return reply(200,await store.registryCommand(request));}
 if(path==='/api/admin/registry'&&req.method==='GET'){permit('registry.read');const results=await Promise.allSettled([store.registry(),store.registryManagement()]);const error=results.find(r=>r.status==='rejected');if(error)throw error.reason;return reply(200,{models:results[0].value,...results[1].value,planningSchemas:{legacy:{requestVersion:'director-planning-v3',inputSchemaHash:planningSchemaHash,operations:['interpret_brief','initial_plan','revise_plan','write_script','revise_script']},departments:{requestVersion:'director-planning-v4',inputSchemaHash:departmentPlanningSchemaHash,operations:['plan_departments'],guidance:DEPARTMENT_GUIDANCE_VERSION},departmentRevisions:{requestVersion:'director-planning-v5',inputSchemaHash:departmentRevisionSchemaHash,operations:['revise_departments'],guidance:DEPARTMENT_GUIDANCE_VERSION},storyboard:{requestVersion:'director-planning-v6',inputSchemaHash:storyboardPlanningSchemaHash,operations:['plan_storyboard']}},scope:'Schema hashes identify implemented request contracts; they do not provide execution or quality approval.'});}
 if(path==='/api/admin/overview'&&req.method==='GET'){permit('jobs.read');const ps=await store.list(user.id);const jobs=(await Promise.all(ps.map(p=>store.records('jobs',p.id)))).flat();return reply(200,{scope:'staff-owned projects only',projects:ps.length,jobs,productionEnabled:false});}
 fail(404,'Operation not found.');}
 const match=path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);if(!match)fail(404,'API route not found.');
 const [,id,action]=match;if(!uuid.test(id))fail(400,'Invalid project ID.');const project=await store.get(id,user.id);
 if(!action&&req.method==='GET')return reply(200,{project});
 if(project.importState?.status==='awaiting_media'&&req.method!=='GET'&&action!=='import-complete'&&!/^import-assets\/[0-9a-f-]+$/.test(action||''))fail(409,'This cloud copy is still importing. Reopen the device draft and choose Save to workspace to finish before editing or approving it.');
 if(action==='source-uploads'&&req.method==='GET')return reply(200,await ingestion.list(user.id,project));
 if(action==='source-uploads'&&req.method==='POST')return reply(201,await ingestion.start(user.id,project,body));
 const sourceAction=action?.match(/^source-uploads\/([^/]+)\/(ticket|complete|cancel|publish)$/);
 if(sourceAction&&req.method==='POST'){if(Object.keys(body).length)fail(400,'Upload actions do not accept file content or storage paths.');return reply(200,await ingestion[sourceAction[2]](user.id,project,sourceAction[1]));}
 if(!action&&req.method==='PATCH'){const next=patchProject(project,body);if(body.shots){const allowed=await store.records('assets',id);if(next.shots.some(s=>s.clipAssetId&&!allowed.some(a=>a.id===s.clipAssetId&&a.mime==='video/mp4')||s.referenceAssetId&&!allowed.some(a=>a.id===s.referenceAssetId&&a.mime.startsWith('image/'))))fail(400,'A selected clip is unavailable.');}return reply(200,{project:await store.save(next,project.version)});}
 const importAsset=action?.match(/^import-assets\/([0-9a-f-]+)$/);
 if(importAsset&&req.method==='POST'){const file=validateUpload(body);const asset=await imports.upload(user.id,id,importAsset[1],file);const {storageKey,...visible}=asset;return reply(200,{asset:{...visible,url:`/api/projects/${id}/assets/${asset.id}/content`}});}
 if(action==='import-complete'&&req.method==='POST')return reply(200,{project:await imports.complete(user.id,id)});
 if(action==='storyboard-production'&&req.method==='GET')return reply(200,await storyboardProductionController.summary(user.id,project));
 if(action==='storyboard-production'&&req.method==='POST')return reply(200,await storyboardProductionController.change(user.id,project,body));
 if(action==='storyboard-production/quotes'&&req.method==='POST')return reply(201,await storyboardProductionController.quote(user.id,project,body));
 if(action==='storyboard-production/jobs'&&req.method==='POST')return reply(201,await storyboardProductionController.start(user.id,project,body));
 if(action==='storyboard-production/import'&&req.method==='POST')return reply(200,await storyboardProductionController.importOutput(user.id,project,body));
 if(action==='storyboard-production/reviews'&&req.method==='POST')return reply(200,await storyboardProductionController.review(user.id,project,body));
 if(action==='reference-production'&&req.method==='GET')return reply(200,await referenceController.summary(user.id,project));
 if(action==='reference-production'&&req.method==='POST')return reply(200,await referenceController.change(user.id,project,body));
 if(action==='reference-production/quotes'&&req.method==='POST')return reply(201,await referenceController.quote(user.id,project,body));
 if(action==='reference-production/jobs'&&req.method==='POST')return reply(201,await referenceController.start(user.id,project,body));
 if(action==='reference-production/import'&&req.method==='POST')return reply(200,await referenceController.importOutput(user.id,project,body));
 if(action==='reference-production/reviews'&&req.method==='POST')return reply(200,await referenceController.review(user.id,project,body));
 if(action==='spending-budget'&&req.method==='POST'){
  const allowed=['requestId','expectedVersion','budgetMicroUsd','finishReserveMicroUsd'];
  if(Object.keys(body).some(k=>!allowed.includes(k))||!uuid.test(body.requestId||'')||!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1||!Number.isSafeInteger(body.budgetMicroUsd)||body.budgetMicroUsd<0||!Number.isSafeInteger(body.finishReserveMicroUsd)||body.finishReserveMicroUsd<0||body.finishReserveMicroUsd>body.budgetMicroUsd)fail(400,'Supply a current project version and explicit integer USD project cap and protected reserve.');
  const result=await store.setProjectSpendingBudget({actorId:user.id,projectId:id,...body});return reply(200,{projectBudget:result.projectBudget||result});
 }
 if(action==='screenplay'&&req.method==='GET')return reply(200,{screenplayContext:screenplayContext(project,await store.records('approvals',id))});
 if(action==='department-plans'&&req.method==='GET')return reply(200,{departmentContext:departmentPlanningContext(project,await store.records('approvals',id))});
 if(action==='storyboard-handoff'&&req.method==='GET')return reply(200,{storyboardContext:storyboardHandoffContext(project,await store.records('approvals',id))});
 if((action==='storyboard-handoff'||action==='storyboard-handoff/apply-proposal')&&req.method==='POST')return reply(200,await changeStoryboardHandoff({project,body,actorId:user.id,store,applying:action==='storyboard-handoff/apply-proposal'}));
 if((action==='department-plans'||action==='department-plans/apply-proposal')&&req.method==='POST')return reply(200,await changeDepartmentPlans({project,body,actorId:user.id,store,applying:action==='department-plans/apply-proposal'}));
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
  const saved=await store.readPlanningCall(user.id,id,planningRead[1]);let storyboardSource;
  if(saved.reservation?.operation==='plan_storyboard')try{const input=JSON.parse(saved.request.body.input);storyboardSource={screenplayDocument:input.context.screenplay.current.document};}catch{storyboardSource={screenplayDocument:null};}
  return reply(200,{call:visiblePlanningCall(saved),result:saved.result??null,...(storyboardSource?{storyboardSource}:{})});
 }
 const planningSummary=action?.match(/^planning(?:\/(initial_plan|revise_plan|interpret_brief|write_script|revise_script|plan_departments|revise_departments|plan_storyboard))?$/);
 if(planningSummary&&req.method==='GET')return reply(200,await planningController.summary(user.id,id,planningSummary[1]||'interpret_brief'));
 const consentRevoke=action?.match(/^planning-consents\/([0-9a-f-]+)\/revoke$/),planningPoll=action?.match(/^planning-calls\/([0-9a-f-]+)\/(poll|resume|release)$/);
 if(req.method==='POST'&&(action==='planning-consents'||action==='planning-calls'||consentRevoke||planningPoll)){
 const allowed=planningPoll?(planningPoll[2]==='poll'?['requestId']:['requestId','expectedVersion']):consentRevoke?['requestId','expectedVersion','reason']:action==='planning-consents'?['requestId','expectedVersion','maxMicroUsd','finishReserveMicroUsd','maxCalls','operation','expectedModelId','expectedProfileFingerprint']:['requestId','expectedVersion','consentId','operation'];
 if(Object.keys(body).some(k=>!allowed.includes(k))||!uuid.test(body.requestId||'')||(!planningPoll||planningPoll[2]!=='poll')&&(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1))fail(400,'Supply a request identity, project version and supported planning fields.');
 const c={...body,actorId:user.id,projectId:id};
 if(planningPoll){if(!uuid.test(planningPoll[1]))fail(400,'Invalid planning call identity.');return reply(200,{call:visiblePlanningCall(planningPoll[2]==='poll'?await planningController.poll(user.id,id,planningPoll[1]):await planningController[planningPoll[2]](c,planningPoll[1]))});}
 if(consentRevoke){if(!uuid.test(consentRevoke[1])||typeof body.reason!=='string'||body.reason.trim().length<5||body.reason.length>1000)fail(400,'Supply an authorization and a reason of 5–1000 characters.');return reply(200,{consent:await planningController.revoke({...c,consentId:consentRevoke[1]})});}
 if(action==='planning-consents'){if(!Number.isSafeInteger(body.maxMicroUsd)||body.maxMicroUsd<=0||!Number.isSafeInteger(body.finishReserveMicroUsd)||body.finishReserveMicroUsd<0||!Number.isSafeInteger(body.maxCalls)||body.maxCalls<1||body.maxCalls>10)fail(400,'Supply integer USD limits and 1–10 planning calls.');return reply(200,{consent:await planningController.consent(c)});}
 if(!uuid.test(body.consentId||'')||!['initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments','plan_storyboard'].includes(body.operation))fail(400,'Supply a scoped planning consent and operation.');
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
 if(action==='quotes'&&['reference_image','reference_look','storyboard_frame'].includes(body.task))fail(400,'Use reference production to quote a reviewed direction; raw client image prompts are not accepted.');
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
 if(action==='animatic'&&['GET','POST'].includes(req.method)){
 const [assets,approvals,referenceCandidates,candidates]=await Promise.all([store.records('assets',id),store.records('approvals',id),store.referenceCandidates(user.id,id),store.storyboardCandidates(user.id,id)]);
 const frames=storyboardProductionContext(project,approvals,{assets,referenceCandidates,candidates});
 if(req.method==='GET')return reply(200,{animatic:animaticContext(project,frames,assets)});
 const next=saveAnimatic(project,body,frames,assets);return reply(200,{project:next.version===project.version?project:await store.save(next,project.version),animatic:animaticContext(next,frames,assets)});
 }
 if(action==='music-video'&&['GET','POST'].includes(req.method)){
 const assets=await store.records('assets',id);
 if(req.method==='GET')return reply(200,{musicVideo:musicVideoContext(project,assets)});
 const next=saveMusicVideo(project,body,assets),saved=next.version===project.version?project:await store.save(next,project.version);
 return reply(200,{project:saved,musicVideo:musicVideoContext(saved,assets)});
 }
 if(action==='production-records'&&req.method==='GET')return reply(200,{production:project.production||{records:[]},dependencies:recordDependencies(project)});
 if(action==='production-records'&&req.method==='POST'){const next=applyProductionRecord(project,body,await store.records('assets',id));return reply(200,{project:next.version===project.version?project:await store.save(next,project.version)});}
 if(action==='production-state'&&req.method==='GET')return reply(200,{production:productionState(project,await store.records('assets',id),await store.records('approvals',id),project.referenceProduction?await store.referenceCandidates(user.id,id):[],project.storyboardProduction?await store.storyboardCandidates(user.id,id):[])});
 if(action==='approvals'&&req.method==='POST'){
 if(!['approved','rejected','revoked'].includes(body.decision)||!Number.isSafeInteger(body.version))fail(400,'Invalid approval decision.');return reply(201,{approval:await store.approve(project,body,user.id)});}
 if(action==='approvals'&&req.method==='GET')return reply(200,{approvals:await store.records('approvals',id)});
 if(action==='assets'&&req.method==='GET')return reply(200,{assets:(await store.records('assets',id)).map(({storageKey,...a})=>({...a,url:`/api/projects/${id}/assets/${a.id}/content`}))});
 if(action==='assets'&&req.method==='POST'){
 const {bytes,mime}=validateUpload(body);if(body.scope==='shot'&&!project.shots.some(s=>s.id===body.shotId))fail(400,'Select a valid shot for this reference.');
 const assetId=randomUUID(),storageKey=`${user.id}/${id}/${assetId}`;
 await mediaStorage.putIfAbsent(storageKey,bytes,mime,hash(bytes.toString('base64')));
 const asset=await store.add('assets',{id:assetId,projectId:id,name:body.name,mime,role:body.role,scope:body.scope,shotId:body.shotId||null,version:1,storageKey,size:bytes.length,checksum:hash(bytes.toString('base64'))});const {storageKey:unused,...visible}=asset;return reply(201,{asset:{...visible,url:`/api/projects/${id}/assets/${assetId}/content`}});}
 const content=action?.match(/^assets\/([0-9a-f-]+)\/content$/);
 if(content&&req.method==='GET'){const asset=(await store.records('assets',id)).find(a=>a.id===content[1]);if(!asset)fail(404,'Reference not found.');let bytes;
 if(asset.bucket==='director-source-media'){
  if(asset.sourceUploadId!==asset.id||asset.decodeVerified!==true||asset.inspectionVersion!=='director-source-inspection-v1'||asset.checksumAlgorithm!=='sha256-bytes')fail(409,'Source inspection is required before playback.');
  const expiresIn=Math.min(3600,Math.max(300,Math.ceil(asset.durationSeconds||0)+120));
  const url=await mediaStorage.sign(asset.storageKey,{bucket:asset.bucket,expiresIn});
  res.writeHead(302,{'Location':url,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});return res.end();
 }
 bytes=await mediaStorage.get(asset.storageKey,{bucket:asset.bucket||'director-media'});
 const headers={'Content-Type':asset.mime.startsWith('image/')||asset.mime.startsWith('video/')||asset.mime.startsWith('audio/')?asset.mime:'application/octet-stream','Content-Disposition':`attachment; filename="reference-${asset.id}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(asset.mime.startsWith('audio/')){
  headers['Accept-Ranges']='bytes';headers['Content-Length']=bytes.length;
  const range=req.headers.range;
  if(range!==undefined){
   const match=typeof range==='string'&&range.match(/^bytes=(\d*)-(\d*)$/);let start,end;
   if(match&&(match[1]||match[2])){if(match[1]){start=Number(match[1]);end=match[2]?Number(match[2]):bytes.length-1;}else{const suffix=Number(match[2]);if(Number.isSafeInteger(suffix)&&suffix>0){start=Math.max(0,bytes.length-suffix);end=bytes.length-1;}}}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=bytes.length||end<start){res.writeHead(416,{...headers,'Content-Range':`bytes */${bytes.length}`,'Content-Length':0});return res.end();}
   end=Math.min(end,bytes.length-1);res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});return res.end(bytes.subarray(start,end+1));
  }
 }
 res.writeHead(200,headers);return res.end(bytes);}
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
 const approvals=await store.records('approvals',id);const script=screenplayContext(project,approvals);if(project.screenplay&&!script.approved)fail(409,'Review and approve the current screenplay and its source comparison before export.');if(project.storyboardHandoff&&!storyboardHandoffContext(project,approvals).planningApproved)fail(409,'Review and approve the current shot contracts and sequence before export.');if(!project.shots.length||project.shots.some(s=>{const last=approvals.filter(a=>a.artifactId===s.id&&a.version===s.version).at(-1);return last?.decision!=='approved';}))fail(409,'Approve each current shot version before export.');
 const {renderFilm}=await import('./render.mjs');const bytes=await renderFilm({project,assets:await store.records('assets',id),assetDir:env.DIRECTOR_ASSET_DIR||'/tmp/director-studio/assets'});
 res.writeHead(200,{'Content-Type':'video/mp4','Content-Disposition':'attachment; filename="director-film.mp4"','Cache-Control':'no-store'});return res.end(bytes);}

 fail(404,'Operation not found.');
 };
}
