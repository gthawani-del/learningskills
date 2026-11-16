// Offline application fixture. No real creative-quality or provider claim.
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {songProviderFixture,songSession} from './song-provider-fixture-server.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {saveSongIntelligence,songIntelligenceContext,SONG_INTELLIGENCE_KIND} from '../public/song-intelligence-core.js';
import {musicTreatmentDraft} from '../public/music-treatment-core.js';
import {createHandler,createServer} from '../server.mjs';
import {call} from './animatic-fixture-server.mjs';
import {syntheticPlanningModel} from './writing-fixture-server.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';
import {planningRequiredSchemaHash} from '../planning-profile.mjs';
import {applyDepartmentCommand,departmentPlanningContext} from '../public/department-plan-core.js';
export async function musicTreatmentFixture({prepared=false,instrumental=false,durationSeconds=180,cast=false}={}){
 const f=await songProviderFixture({durationSeconds,lyrics:instrumental?'':'  नमस्ते\nHello 世界  '}),{store}=f;let p=await store.get(f.project.id,f.project.ownerId);
 const song=structuredClone(songIntelligenceContext(p,[]).document);song.sections=[0,1,2].map(i=>i*Math.round(durationSeconds*1000/3)).map((startMs,i)=>({id:'passage_'+i,type:'unknown',label:'Reviewed fixture passage '+(i+1),startMs,endMs:startMs+Math.round(durationSeconds*1000/3),basis:'user_reviewed',evidence:['Synthetic fixture timeline, not a real musical classification.']}));song.lyrics.vocalMode=instrumental?'instrumental':'sung';
 let next=saveSongIntelligence(p,{expectedVersion:p.version,document:song,acknowledgeEvidence:true},[f.asset]);await store.save(next,p.version);p=next;const context=songIntelligenceContext(p,[]);await store.approve(p,{artifactId:'record:'+context.recordId,version:context.version,decision:'approved'},p.ownerId);
 next=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});await store.save(next,p.version);p=next;await store.approve(p,{expectedVersion:p.version,artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved',acknowledgeAssumptions:true},p.ownerId);
 if(p.stage!=='story'){next={...p,stage:'story',version:p.version+1};await store.save(next,p.version);p=next;}
 const ledger=await store.records('approvals',p.id),draft=musicTreatmentDraft(p,ledger),document=structuredClone(draft);if(cast)document.characters=[{id:'traveller',name:'Traveller',description:'Original role; appearance and voice require explicit selection.'}];document.logline='A traveller follows changing light and chooses a way home.';document.treatment='A visual journey from hesitation through shared motion to a deliberate return. The original recording carries the performance.';
 for(const [i,scene]of document.scenes.entries()){scene.action=['A traveller waits at a window, watches the rain settle and picks up a coat.','Reflections, passing feet and changing light connect the journey without inventing a visible singer.','The traveller steps into the morning and leaves the door open behind them.'][i];const row=document.musicTiming.sequences[i];row.roles=[i===1?'broll':'narrative'];row.emotion=['Hesitation gives way to attention.','Attention becomes forward momentum.','Resolve settles into calm.'][i];row.performance='Use the visible action and motivated attention in this scene; retain original song vocals.';row.transition=i===2?'Hold the final settled image to the original recording endpoint.':'Cut on the reviewed passage boundary into the next change of place.';}
 const operations=['write_script','revise_script','plan_departments','revise_departments'];let model=reviewedPlanningFixture(syntheticPlanningModel(),{operations});model.capabilities.planning.songIntelligenceVersion=SONG_INTELLIGENCE_KIND;model.capabilities.planning.maxRequestBytes=200000;model.capabilities.planning.contextWindowTokens=20000;model.capabilities.planning.maxOutputTokens=4000;model.capabilities.planning.tokenBoundEvidence.contextWindowTokens=20000;model.schema_evidence.inputSchemaHash=planningRequiredSchemaHash(model);store.state.models=[model];
 const planning={requests:[],output:null,submits:0};
 const planningProvider={submit:async({request})=>{planning.submits++;planning.requests.push(structuredClone(request));const input=JSON.parse(request.body.input),id='resp_music_'+planning.submits;if(['write_script','revise_script'].includes(input.operation))return {id,status:'completed',usage:{inputTokens:30,outputTokens:40,cachedInputTokens:0},screenplay:structuredClone(planning.output||document)};
  if(input.operation==='revise_departments')return {id,status:'completed',usage:{inputTokens:30,outputTokens:40,cachedInputTokens:0},departments:{departments:input.context.departmentPlanning.revision.selectedDepartmentIds.map(id=>({id,document:{...structuredClone(input.context.departmentPlanning.departments.find(d=>d.id===id).current.document),summary:'Synthetic targeted musical camera revision.'}}))}};
  const current=await store.get(p.id,p.ownerId),approvals=await store.records('approvals',p.id),prepared=applyDepartmentCommand(current,{expectedVersion:current.version,action:'prepare'},approvals);return {id,status:'completed',usage:{inputTokens:30,outputTokens:40,cachedInputTokens:0},departments:{departments:departmentPlanningContext(prepared,approvals).departments.map(u=>({id:u.id,document:structuredClone(u.current.document)}))}};
 },poll:async()=>{throw Error('This synchronous simulated fixture has no pending provider job.');}};
 const env={...f.env,OPENAI_API_KEY:'synthetic-no-network'},options={store,providers:f.providers,storage:f.storage,env,fetcher:f.fetcher,planningProvider},handler=await createHandler(options),base=f.base;
 const get=path=>call(handler,base+path,undefined,songSession),post=async(path,body)=>{const r=await call(handler,base+path,body,songSession);if(r.status>=400)throw Object.assign(new Error(JSON.stringify(r.data)),{status:r.status});return r.data;};
 const result={...f,...options,project:p,document,draft,handler,get,post,planning};
 if(prepared){let response=await post('/screenplay',{expectedVersion:p.version,action:'save',document});p=response.project;await post('/approvals',{expectedVersion:p.version,artifactId:'screenplay',version:p.screenplay.currentVersion,decision:'approved',acknowledgeLimitedCoverage:true});response=await post('/department-plans',{expectedVersion:p.version,action:'prepare'});result.project=response.project;}
 return result;
}
export async function musicPlanningCall(f,operation){
 const project=await f.store.get(f.project.id,f.project.ownerId),quote=(await f.get('/planning/'+operation)).data;if(!quote.availability?.enabled)throw Error(JSON.stringify(quote));
 const consent=(await f.post('/planning-consents',{requestId:randomUUID(),expectedVersion:project.version,operation,expectedModelId:quote.quote.modelId,expectedProfileFingerprint:quote.quote.profileFingerprint,maxMicroUsd:100000,finishReserveMicroUsd:0,maxCalls:2})).consent;
 return f.post('/planning-calls',{requestId:randomUUID(),expectedVersion:project.version,consentId:consent.id,operation});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const f=process.argv.includes('--storyboard')?await musicStoryboardFixture():process.argv.includes('--references')?await musicReferenceFixture():await musicTreatmentFixture(),server=await createServer(f);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:f.project.id,port:server.address().port,session:songSession,originalBase64:f.original.toString('base64'),spareAssetId:f.spareAsset?.id,sourceAssetId:f.asset.id})));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));}

// Supplied-image local fixture: no image generator and no external service.
export async function musicReferenceFixture(){
 const f=await musicTreatmentFixture({prepared:true,cast:true}),{referencePng}=await import('./reference-fixture-server.mjs');
 const ledger=await f.store.records('approvals',f.project.id),departments=departmentPlanningContext(f.project,ledger);
 await f.post('/music-video/department-package/approve',{expectedVersion:f.project.version,expectedApprovalId:ledger.at(-1)?.id??null,departmentVersions:departments.departments.map(d=>({id:d.id,version:d.current.version})),ackPlanningOnly:true});
 const change=async(path,body)=>{const r=await f.post(path,{expectedVersion:f.project.version,...body});if(r.project)f.project=r.project;return r;};
 await change('/storyboard-handoff',{action:'prepare'});
 for(const shot of [f.project.shots[0],f.project.shots[2]]){
  const document=structuredClone(f.project.storyboardHandoff.shots.find(s=>s.id===shot.id).versions.at(-1).document);document.characterIds=['traveller'];document.referenceRequirements.push({id:'visible_identity',role:'identity',characterIds:['traveller'],direction:'Explicit fixture choice to picture the traveller.'},{id:'visible_look',role:'look',characterIds:['traveller'],direction:'Preserve the approved traveller wardrobe.'});
  await change('/storyboard-handoff',{action:'update',shotId:shot.id,document});
 }
 await change('/storyboard-handoff',{action:'review_sequence',acknowledgeShotChanges:true});
 await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'storyboard_sequence',version:f.project.storyboardHandoff.sequences.at(-1).version,decision:'approved',ackPlanningOnly:true});
 await change('/reference-production',{action:'prepare'});
 const objects=new Map(),originalGet=f.storage.get.bind(f.storage),png=referencePng();f.storage.putIfAbsent=async(key,bytes)=>objects.set(key,Buffer.from(bytes));f.storage.get=async(key,options)=>objects.has(key)?Buffer.from(objects.get(key)):originalGet(key,options);
 const upload=async(name,role)=>(await f.post('/assets',{name,mime:'image/png',role,scope:'project',base64:png.toString('base64')})).asset;
 const select=async(subjectId,asset)=>{
  const r=await change('/reference-production',{action:'add_uploaded',subjectId,assetId:asset.id});await change('/reference-production',{action:'select',subjectId,candidateId:r.candidate.id,acknowledgeReview:true});
  const selection=f.project.referenceProduction.selections.filter(s=>s.subjectId===subjectId).at(-1);await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'reference_selection:'+subjectId,version:selection.version,decision:'approved',acknowledgeReferenceReview:true});
 };
 for(const id of ['identity:traveller','look:traveller',...f.document.scenes.map(s=>'location:'+s.id)]){
  if(id.startsWith('look:'))await change('/reference-production',{action:'refresh',subjectId:id,acknowledgeSourceChange:true});
  const subject=f.project.referenceProduction.subjects.find(s=>s.id===id);await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'reference_brief:'+id,version:subject.currentVersion,decision:'approved'});
  const asset=await upload('Supplied '+id+'.png',id.startsWith('identity:')?'character_identity':id.startsWith('look:')?'wardrobe':'location');await select(id,asset);
 }
 await change('/storyboard-production',{action:'prepare'});
 f.spareAsset=await upload('Alternative supplied location.png','location');f.change=change;f.select=select;
 const previous=f.project;f.project={...previous,stage:'cast',version:previous.version+1};await f.store.save(f.project,previous.version);return f;
}

export async function musicStoryboardFixture(){
 const f=await musicReferenceFixture(),{syntheticStoryboardTransport,syntheticStoryboardFrameModel}=await import('./storyboard-production-fixture-server.mjs');
 f.project=(await f.change('/music-video/from-treatment',{acknowledgePlanning:true})).project;const song=(await f.get('/music-video')).data.musicVideo.document;song.shots.forEach(s=>s.timingBasis='user_reviewed');
 await f.change('/music-video',{document:song,acknowledgePlanning:true});
 const transport=syntheticStoryboardTransport(),read=f.storage.get.bind(f.storage),put=f.storage.putIfAbsent.bind(f.storage),written=new Set();
 f.storage.get=async(key,options)=>{if(written.has(key)||f.store.state.assets.some(a=>a.storageKey===key))return read(key,options);throw Object.assign(new Error('Synthetic object not stored.'),{status:404});};
 f.storage.putIfAbsent=async(key,...args)=>{const result=await put(key,...args);written.add(key);return result;};
 f.storage.sign=async(key,{bucket='director-media'}={})=>{if(!key.startsWith(f.project.ownerId+'/'+f.project.id+'/'))throw Error('Wrong reference scope');return 'https://song-fixture.supabase.co/storage/v1/object/sign/'+bucket+'/'+key+'?token=synthetic-no-network';};
 f.store.state.models=[syntheticStoryboardFrameModel()];const options={...f,providers:transport.providers,fetcher:transport.fetcher},handler=await createHandler(options);
 f.handler=handler;f.providers=transport.providers;f.fetcher=transport.fetcher;f.transport=transport;
 f.get=path=>call(handler,f.base+path,undefined,songSession);f.post=async(path,body)=>{const r=await call(handler,f.base+path,body,songSession);if(r.status>=400)throw Object.assign(new Error(JSON.stringify(r.data)),{status:r.status});return r.data;};
 f.change=async(path,body)=>{const r=await f.post(path,{expectedVersion:f.project.version,...body});if(r.project)f.project=r.project;return r;};
 const summary=(await f.get('/storyboard-production')).data.storyboardProductionContext;for(const shot of summary.shots)await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'storyboard_brief:'+shot.shotId,version:shot.current.version,decision:'approved',acknowledgeFrameDirection:true});
 const previous=f.project;f.project={...previous,stage:'storyboard',version:previous.version+1};await f.store.save(f.project,previous.version);
 f.generateFrame=async shotId=>{
  const quote=(await f.change('/storyboard-production/quotes',{requestId:randomUUID(),shotId,modelId:'F-storyboard-frame-local',shareReferences:true})).quote;
  const authorization=(await f.change('/spending-authorizations',{requestId:randomUUID(),quoteId:quote.id,maxMicroUsd:quote.totalMicroUsd,finishReserveMicroUsd:0})).authorization;
  const job=(await f.change('/storyboard-production/jobs',{requestId:randomUUID(),quoteId:quote.id,authorizationId:authorization.id})).job;await f.post('/jobs/'+job.id+'/poll',{});const imported=await f.post('/storyboard-production/import',{jobId:job.id});
  await f.change('/storyboard-production',{action:'select',shotId,candidateId:imported.candidate.id,acknowledgeReview:true});
  const shot=(await f.get('/storyboard-production')).data.storyboardProductionContext.shots.find(s=>s.shotId===shotId);await f.post('/approvals',{expectedVersion:f.project.version,artifactId:'storyboard_frame:'+shotId,version:shot.selection.version,decision:'approved',acknowledgeFrameReview:true});return imported;
 };return f;
}
