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
export async function musicTreatmentFixture({prepared=false,instrumental=false,durationSeconds=180}={}){
 const f=await songProviderFixture({durationSeconds,lyrics:instrumental?'':'  नमस्ते\nHello 世界  '}),{store}=f;let p=await store.get(f.project.id,f.project.ownerId);
 const song=structuredClone(songIntelligenceContext(p,[]).document);song.sections=[0,1,2].map(i=>i*Math.round(durationSeconds*1000/3)).map((startMs,i)=>({id:'passage_'+i,type:'unknown',label:'Reviewed fixture passage '+(i+1),startMs,endMs:startMs+Math.round(durationSeconds*1000/3),basis:'user_reviewed',evidence:['Synthetic fixture timeline, not a real musical classification.']}));song.lyrics.vocalMode=instrumental?'instrumental':'sung';
 let next=saveSongIntelligence(p,{expectedVersion:p.version,document:song,acknowledgeEvidence:true},[f.asset]);await store.save(next,p.version);p=next;const context=songIntelligenceContext(p,[]);await store.approve(p,{artifactId:'record:'+context.recordId,version:context.version,decision:'approved'},p.ownerId);
 next=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});await store.save(next,p.version);p=next;await store.approve(p,{expectedVersion:p.version,artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved',acknowledgeAssumptions:true},p.ownerId);
 if(p.stage!=='story'){next={...p,stage:'story',version:p.version+1};await store.save(next,p.version);p=next;}
 const ledger=await store.records('approvals',p.id),draft=musicTreatmentDraft(p,ledger),document=structuredClone(draft);document.logline='A traveller follows changing light and chooses a way home.';document.treatment='A visual journey from hesitation through shared motion to a deliberate return. The original recording carries the performance.';
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
if(process.argv[1]===fileURLToPath(import.meta.url)){const f=await musicTreatmentFixture(),server=await createServer(f);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:f.project.id,port:server.address().port,session:songSession,originalBase64:f.original.toString('base64')})));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));}
