import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hash} from '../domain.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {applyScreenplayCommand} from '../public/screenplay-core.js';
import {applyDepartmentCommand,departmentPlanningContext,DEPARTMENT_IDS} from '../public/department-plan-core.js';
import {preparePlanningRequest,planningCreativeContext,planningSchemaHash,departmentPlanningSchemaHash,planningProfile} from '../planning-profile.mjs';
import {buildPlanningRequest,validatePlanningResult,createPlanningProvider,PLANNING_VERSION,DEPARTMENT_PLANNING_VERSION} from '../planning-provider.mjs';
import {routePlanning} from '../planning-router.mjs';
import {planningScope,decidePlanningPath} from '../planning-policy.mjs';
import {grantPlanningConsent,reservePlanningCall,claimPlanningCall} from '../planning-consent.mjs';
import {normalizeModelDraft,validateModelPublication} from '../model-registry.mjs';
import {createPlanningController} from '../planning.mjs';
import {LocalStore} from '../store.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';

const now='2026-10-19T00:00:00.000Z',expiresAt='2099-01-01T00:00:00.000Z';
const script=()=>({title:'A Quiet Platform',logline:'A station keeper decides whether to wait.',treatment:'A letter arrives before the final train. Mira chooses to wait.',characters:[{id:'mira',name:'Mira',description:'A station keeper who reads the letter carefully.'}],scenes:[{id:'station',heading:'INT. STATION — NIGHT',action:'Mira opens the letter.',dialogue:[{id:'line1',characterId:'mira',text:'Kal phir milenge.',direction:'Quietly, holding back a smile.'}],durationSeconds:30},{id:'platform',heading:'EXT. PLATFORM — NIGHT',action:'Mira raises the lamp.',dialogue:[],durationSeconds:30}]});
function sourceProject(){
  let p={id:'dept_project',ownerId:'owner',title:'A Quiet Platform',premise:'A station keeper finds a letter from tomorrow.',direction:'Observational realism.',language:'Hinglish',duration:60,format:'short_film',version:1,story:{version:1,treatment:'',scenes:[]},shots:[],production:{records:[]},createdAt:now};
  p=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});
  return applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:script()});
}
const approvals=p=>[{id:'brief_review',artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved',ordinal:1},{id:'script_review',artifactId:'screenplay',version:p.screenplay.currentVersion,decision:'approved',ordinal:2}];
function plannedProject(){const p=sourceProject();return applyDepartmentCommand(p,{expectedVersion:p.version,action:'prepare'},approvals(p));}
function model(operations=['plan_departments']){
  const endpoint='https://api.openai.com/v1/responses',version='synthetic-department-model';
  const profile={id:'O-department-test',provider:'openai',endpoint,model_version:version,active:true,execution_tested:true,quality_validated:true,capabilities:{planning:{enabled:true,version:'department-test',background:true,providerRetentionAcknowledged:true,contextWindowTokens:100000,maxOutputTokens:4000,maxRequestBytes:200000,tokenBoundEvidence:{verified:true,type:'context-window-upper-bound',model:version,contextWindowTokens:100000,tokenizerVersion:'synthetic-reviewed-window',sourceUrl:'https://example.test/tokens',expiresAt}}},schema_evidence:{verified:true,version:'department-schema',sourceUrl:'https://example.test/schema',expiresAt,endpoint,modelVersion:version,inputSchemaHash:operations.includes('plan_departments')?departmentPlanningSchemaHash:planningSchemaHash},price_version:'department-price',price_evidence:{verified:true,version:'department-price',model:version,currency:'USD',sourceUrl:'https://example.test/pricing',expiresAt,input:{numeratorMicroUsd:1,denominatorTokens:1},cachedInput:{numeratorMicroUsd:0,denominatorTokens:1},output:{numeratorMicroUsd:2,denominatorTokens:1}}};
  return reviewedPlanningFixture(profile,{operations});
}
const prepare=(p=plannedProject(),m=model(),a=approvals(p))=>preparePlanningRequest(p,m,'plan_departments',now,a);
const proposal=p=>({departments:departmentPlanningContext(p,approvals(p)).departments.map(unit=>({id:unit.id,document:structuredClone(unit.current.document)}))});
const complete=output=>({id:'resp_departments',status:'completed',usage:{input_tokens:100,output_tokens:200,input_tokens_details:{cached_tokens:10}},output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]});
const denied=error=>error.status===409;

test('department planning has a separate v4 schema and reviewed operation without changing existing v3 requests',()=>{
  const p=plannedProject(),prepared=prepare(p),request=prepared.request;
  assert.equal(PLANNING_VERSION,'director-planning-v3');assert.equal(DEPARTMENT_PLANNING_VERSION,'director-planning-v4');
  assert.equal(request.version,DEPARTMENT_PLANNING_VERSION);assert.equal(request.operation,'plan_departments');
  assert.equal(request.body.text.format.name,'department_proposal');assert.equal(request.body.text.format.strict,true);
  const schema=request.body.text.format.schema;assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.departments.minItems,17);assert.equal(schema.properties.departments.maxItems,17);
  assert.notEqual(departmentPlanningSchemaHash,planningSchemaHash);assert.equal(prepared.quote.totalMicroUsd,108000);assert.equal(prepared.quote.quoteKind,'maximum_reservation_not_expected_cost');
  const context=JSON.parse(request.body.input).context;assert.deepEqual(context.screenplay.current.document,script());assert.equal(context.departmentPlanning.prerequisites.screenplayApproved,true);assert.ok(context.departmentPlanning.guidance);
  assert.deepEqual(validatePlanningResult(proposal(p),request),proposal(p));
  const old=buildPlanningRequest({brief:'An original film.',duration:60,model:'old-reviewed-model',maxOutputTokens:1000});assert.equal(old.version,PLANNING_VERSION);assert.equal(old.body.text.format.name,'film_plan');
});

test('department planning requires current approved brief and approved current screenplay, never legacy treatment',()=>{
  const p=plannedProject();assert.throws(()=>prepare(p,model(),[]),denied);
  assert.throws(()=>prepare(p,model(),approvals(p).slice(0,1)),denied);
  const legacy=sourceProject();delete legacy.screenplay;legacy.story.treatment='A treatment is not an approved screenplay.';assert.throws(()=>prepare(legacy,model(),approvals(p)),denied);
  const stale=structuredClone(p);stale.direction='A new visual direction.';assert.throws(()=>prepare(stale),denied);
  const revised=applyScreenplayCommand(p,{expectedVersion:p.version,action:'set_revision',revisionRequest:{instruction:'Review a different ending.',sceneIds:['platform']}});
  assert.notEqual(prepare(revised).request.requestHash,prepare(p).request.requestHash);
});

test('the complete screenplay, department choices, guidance and source approvals bind the exact request and scope',()=>{
  const p=plannedProject(),first=prepare(p).request,context=JSON.parse(first.body.input).context;
  const complete=departmentPlanningContext(p,approvals(p));assert.deepEqual(context.departmentPlanning,{...complete,inputSignature:hash(complete.inputSignature),sourceSignature:hash(complete.sourceSignature)});
  assert.deepEqual(context.screenplay.sources,[]);assert.deepEqual(context.screenplay.current.document.scenes,script().scenes);
  const changed=structuredClone(p);changed.departmentPlanning.departments.find(unit=>unit.id==='camera').versions.at(-1).document.summary+=' Favor a lower eye line.';
  assert.notEqual(prepare(changed).request.requestHash,first.requestHash);assert.notEqual(planningScope(changed,approvals(changed)).briefScopeHash,planningScope(p,approvals(p)).briefScopeHash);
  const reviewed=[...approvals(p),{artifactId:'department:camera',version:1,decision:'approved',ordinal:3}];assert.notEqual(prepare(p,model(),reviewed).request.requestHash,first.requestHash);
  const ctx=structuredClone(context);ctx.departmentPlanning.guidance={oversized:'x'.repeat(180001)};assert.throws(()=>buildPlanningRequest({brief:'Keep the full screenplay.',duration:60,model:first.model,maxOutputTokens:4000,operation:'plan_departments',context:ctx}),/no source material was truncated/);
  const small=model();small.capabilities.planning.maxRequestBytes=Buffer.byteLength(JSON.stringify(first.body),'utf8')-1;assert.throws(()=>prepare(p,small),/reviewed input limit/);
});

test('digest bindings remove duplicate signature text while retaining every brief fact, full script, source and department document within the unchanged byte bound',t=>{
  let p=sourceProject();const facts={purpose:'Show everyday cooking with the supplied product.',audience:'Indian home cooks watching with sound enabled.',audienceResponse:'Understand the ordinary cooking use without invented health claims.',platform:'YouTube',aspectRatio:'16:9',visualStyle:'Natural live-action observation.',tone:'Warm and restrained.',setting:'A real Indian home kitchen.',cast:'Mira is the named on-screen performer; demographic details remain unspecified.',voice:'Hinglish, with a conversational delivery chosen through later sample review.',product:'Example Oil in its supplied sealed 1 litre bottle.',constraints:['Preserve the supplied label exactly.','No medical claims or invented certifications.'],budget:'Review the exact estimate before any paid production.',format:'advertisement',duration:60,language:'Hinglish'};
  p=applyBriefCommand(p,{expectedVersion:p.version,action:'update',changes:facts});
  const exactSource='User reference data only.\r\n  Keep this complete source, including spacing.  ';
  p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'add_source',source:{title:'Supplied production note',text:exactSource,permittedUse:'reference_only'}});
  p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:script()});
  p=applyDepartmentCommand(p,{expectedVersion:p.version,action:'prepare'},approvals(p));
  const trusted=model(),prepared=prepare(p,trusted),context=JSON.parse(prepared.request.body.input).context,complete=departmentPlanningContext(p,approvals(p));
  const requestBytes=Buffer.byteLength(JSON.stringify(prepared.request.body),'utf8'),input=JSON.parse(prepared.request.body.input);
  const duplicateContext={...context,departmentPlanning:{...context.departmentPlanning,inputSignature:complete.inputSignature,sourceSignature:complete.sourceSignature}},duplicatedBytes=Buffer.byteLength(JSON.stringify({...prepared.request.body,input:JSON.stringify({...input,context:duplicateContext})}),'utf8');
  assert.equal(trusted.capabilities.planning.maxRequestBytes,200000);assert(requestBytes<=200000);assert(duplicatedBytes>200000);assert(requestBytes<duplicatedBytes);
  t.diagnostic(`Full sixteen-field brief, source, screenplay, seventeen plans and guidance: ${requestBytes} request bytes; duplicated canonical signatures would require ${duplicatedBytes} bytes; reviewed maximum remains 200000 bytes.`);
  assert.equal(context.departmentPlanning.inputSignature,hash(complete.inputSignature));assert.equal(context.departmentPlanning.sourceSignature,hash(complete.sourceSignature));assert.equal(context.departmentPlanning.inputSignature.length,64);
  assert.deepEqual(context.departmentPlanning.departments,complete.departments);assert.equal(context.departmentPlanning.guidance,complete.guidance);assert.deepEqual(context.screenplay.current.document,script());assert.equal(context.screenplay.sources[0].text,exactSource);
  for(const [key,value]of Object.entries(facts))assert.deepEqual(context.structuredBrief.fields[key].value,value);
  const changed=structuredClone(context);changed.departmentPlanning.sourceSignature='0'.repeat(64);
  const rebuilt=buildPlanningRequest({brief:JSON.parse(prepared.request.body.input).brief,duration:60,model:prepared.request.model,maxOutputTokens:4000,operation:'plan_departments',context:changed});assert.notEqual(rebuilt.requestHash,prepared.request.requestHash);
  const unbound=structuredClone(context);unbound.departmentPlanning.inputSignature='unbound';assert.throws(()=>buildPlanningRequest({brief:'All actual source data remains present.',duration:60,model:prepared.request.model,maxOutputTokens:4000,operation:'plan_departments',context:unbound}),denied);
});

test('all departments are covered with valid source links and no self-certified approval or newly selected look/voice',()=>{
  const p=plannedProject(),request=prepare(p).request,good=proposal(p);
  for(const mutate of [
    x=>x.departments.pop(),x=>x.departments.reverse(),x=>x.departments[0].id='unknown',x=>x.departments[1].id=x.departments[0].id,
    x=>x.approved=true,x=>x.departments[0].document.approved=true,
    x=>x.departments.find(unit=>unit.id==='camera').document.requirements[0].sceneIds=['invented_scene'],
    x=>x.departments.find(unit=>unit.id==='casting').document.choices.push({id:'picked_actor',label:'Chosen character',value:'An invented casting choice.',status:'user_selected',sceneIds:[],characterIds:['mira']}),
    x=>{x.departments[0].document.applicability='required';x.departments[0].document.requirements=[];},
    x=>{x.departments[0].document.applicability='required';x.departments[0].document.checks=[];},
  ]){const invalid=structuredClone(good);mutate(invalid);assert.throws(()=>validatePlanningResult(invalid,request));}
  assert.deepEqual(good.departments.map(unit=>unit.id),DEPARTMENT_IDS);
});

test('approved department documents and recorded user choices remain exact in generated proposals',()=>{
  let p=plannedProject();const casting=departmentPlanningContext(p,approvals(p)).departments.find(unit=>unit.id==='casting').current.document;
  casting.choices.push({id:'chosen_reference_direction',label:'User reference direction',value:'Keep the approved lamp reference.',status:'user_selected',sceneIds:['platform'],characterIds:['mira']});
  p=applyDepartmentCommand(p,{expectedVersion:p.version,action:'update',departmentId:'casting',document:casting},approvals(p));
  const a=[...approvals(p),{artifactId:'department:camera',version:1,decision:'approved',ordinal:3}],request=prepare(p,model(),a).request;
  const good=proposal(p);assert.deepEqual(validatePlanningResult(good,request),good);
  for(const mutate of [x=>x.departments.find(unit=>unit.id==='camera').document.summary+=' A different plan.',x=>x.departments.find(unit=>unit.id==='casting').document.choices.pop(),x=>x.departments.find(unit=>unit.id==='casting').document.choices.at(-1).value='A silent replacement.']){
    const invalid=structuredClone(good);mutate(invalid);assert.throws(()=>validatePlanningResult(invalid,request),denied);
  }
});

test('formerly approved stale departments can be refreshed against a newly approved script without unprotecting explicit user choices',()=>{
  let p=plannedProject();const oldApprovals=[...approvals(p),{artifactId:'department:camera',version:1,decision:'approved',ordinal:3}];
  const changedScript=script();changedScript.scenes[0].action+=' She waits before unfolding it.';
  p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:changedScript},oldApprovals);
  const a=[...oldApprovals,{artifactId:'screenplay',version:p.screenplay.currentVersion,decision:'approved',ordinal:4}],prepared=prepare(p,model(),a),context=JSON.parse(prepared.request.body.input).context;
  const camera=context.departmentPlanning.departments.find(unit=>unit.id==='camera');assert.equal(camera.stale,true);assert.equal(camera.approved,false);assert.equal(camera.approvalDecision,'approved');
  const refreshed=proposal(p);refreshed.departments.find(unit=>unit.id==='camera').document.summary+=' Review the new pause before the letter is unfolded.';
  assert.deepEqual(validatePlanningResult(refreshed,prepared.request),refreshed);
});

test('v3 profiles never inherit department eligibility; reviewed v4 operation, execution and quality evidence are required',()=>{
  const p=plannedProject(),old=model(['write_script']);assert.throws(()=>prepare(p,old),denied);
  const wrongHash=model();wrongHash.schema_evidence.inputSchemaHash=planningSchemaHash;assert.throws(()=>prepare(p,wrongHash),denied);
  const missing=model();missing.capabilities.reviewEvidence.quality.operations=[];assert.throws(()=>prepare(p,missing),denied);
  const stale=model();stale.capabilities.planning.operationBindings[0].expiresAt='2026-01-01T00:00:00.000Z';assert.throws(()=>prepare(p,stale),denied);
  assert.equal(routePlanning({project:p,approvals:approvals(p),models:[old],operation:'plan_departments',now}).selectedModelId,null);
  const route=routePlanning({project:p,approvals:approvals(p),models:[model()],operation:'plan_departments',now});assert.equal(route.selectedModelId,'O-department-test');
  assert.equal(route.task,'department_planning');assert.equal(route.context.request.version,DEPARTMENT_PLANNING_VERSION);
  const multi=model(['interpret_brief','initial_plan','revise_plan','write_script','revise_script','plan_departments']);assert.doesNotThrow(()=>planningProfile(multi,now));
  const {id,active,execution_tested,quality_validated,...draft}=structuredClone(multi),reviewEvidence=draft.capabilities.reviewEvidence;delete draft.capabilities.reviewEvidence;
  assert.doesNotThrow(()=>normalizeModelDraft(draft));assert.doesNotThrow(()=>validateModelPublication({modelId:id,profile:draft,review:{schemaVerified:true,pricingVerified:true,executionTested:true,qualityValidated:true,execution:reviewEvidence.execution,quality:reviewEvidence.quality,notes:'Synthetic offline evidence, never a real published model.'},now}));
});

test('department provider preserves usage and response identity on invalid output without auto repair or application',async()=>{
  const p=plannedProject(),request=prepare(p).request,good=proposal(p),calls=[];
  const provider=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async(url,options)=>{calls.push({url,method:options.method});return {ok:true,json:async()=>complete(good)};}});
  const saved=await provider.submit({request,authorized:true});assert.deepEqual(saved.departments,good);assert.equal(saved.plan,undefined);assert.equal(saved.applied,undefined);assert.equal(saved.usage.outputTokens,200);
  assert.deepEqual((await provider.poll({responseId:saved.id,request})).departments,good);assert.deepEqual(calls.map(c=>c.method),['POST','GET']);
  const invalid=structuredClone(good);invalid.departments.pop();let count=0;
  const broken=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async()=>{count++;return {ok:true,json:async()=>complete(invalid)};}});
  const failed=await broken.submit({request,authorized:true});assert.equal(failed.id,'resp_departments');assert.equal(failed.departments,undefined);assert.ok(failed.planError);assert.equal(failed.usage.outputTokens,200);assert.equal(count,1);
});

test('malformed provider output structure retains observed usage and the original response under an unknown hold without automatic resubmission',async()=>{
  const p=plannedProject(),store=await new LocalStore().init();store.state.projects=[p];store.state.models=[model()];store.state.approvals=approvals(p).map(a=>({...a,projectId:p.id}));store.state.operationalControl.generationPaused=false;
  let submissions=0,polls=0;
  const provider=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async(url,options)=>{if(options.method==='POST')submissions++;else polls++;return {ok:true,json:async()=>({...complete(proposal(p)),output:[null]})};}});
  const controller=createPlanningController({store,provider,env:{OPENAI_API_KEY:'test-secret'},now:()=>new Date(now)}),base={actorId:p.ownerId,projectId:p.id,expectedVersion:p.version};
  const grant=await controller.consent({...base,requestId:randomUUID(),operation:'plan_departments',maxMicroUsd:200000,finishReserveMicroUsd:0,maxCalls:1});
  const command={...base,requestId:randomUUID(),operation:'plan_departments',consentId:grant.id},saved=await controller.start(command);
  assert.equal(saved.reservation.status,'unknown');assert.equal(saved.reservation.actualMicroUsd,undefined);assert.equal(saved.providerResponseId,'resp_departments');assert.deepEqual(saved.result.observedUsage,{inputTokens:100,outputTokens:200,cachedInputTokens:10});assert.ok(saved.result.planError);assert.ok(saved.result.normalizationError);assert.equal(saved.result.departments,undefined);
  assert.equal((await controller.start(command)).providerResponseId,saved.providerResponseId);assert.equal(submissions,1);
  const checked=await controller.poll(p.ownerId,p.id,saved.reservation.id);assert.equal(checked.reservation.status,'unknown');assert.deepEqual(checked.result.observedUsage,saved.result.observedUsage);assert.equal(polls,1);
  await assert.rejects(controller.start({...command,requestId:randomUUID()}),denied);assert.equal(submissions,1);assert.equal(store.state.jobs.length,0);
});

test('historical v3 polling remains recoverable and department operations cannot be relabeled as older contracts',async()=>{
  const old=buildPlanningRequest({brief:'Rain on a platform.',duration:5,model:'old-model',maxOutputTokens:1000}),film={title:'Rain',treatment:'A lamp glows.',scenes:[{id:'s1',description:'A platform.'}],shots:[{id:'shot1',sceneId:'s1',description:'A lamp in rain.',durationSeconds:5,dialogue:'',camera:'Static.',continuity:'Same lamp.'}]};
  const methods=[],provider=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async(url,options)=>{methods.push(options.method);return {ok:true,json:async()=>complete(film)};}});
  assert.deepEqual((await provider.poll({responseId:'resp_departments',request:old})).plan,film);
  for(const version of ['director-planning-v2',PLANNING_VERSION]){const forged={...prepare().request,version};forged.requestHash=hash({version,body:forged.body});await assert.rejects(provider.poll({responseId:'resp_departments',request:forged}),denied);}
  const mislabeled={...old,version:DEPARTMENT_PLANNING_VERSION};mislabeled.requestHash=hash({version:mislabeled.version,body:mislabeled.body});await assert.rejects(provider.poll({responseId:'resp_departments',request:mislabeled}),denied);assert.deepEqual(methods,['GET']);
});

test('known department requests retain their exact saved knowledge pack for polling instead of adopting newer guidance',async()=>{
  const p=plannedProject(),current=prepare(p).request,context=JSON.parse(current.body.input).context;
  const previousVersion='director-department-knowledge-earlier';context.departmentPlanning.guidance=context.departmentPlanning.guidance.replaceAll(context.departmentPlanning.guidanceVersion,previousVersion);context.departmentPlanning.guidanceVersion=previousVersion;
  const saved=buildPlanningRequest({brief:'Saved prior department request.',duration:60,model:current.model,maxOutputTokens:4000,operation:'plan_departments',context}),methods=[];
  const provider=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async(url,options)=>{methods.push(options.method);return {ok:true,json:async()=>complete(proposal(p))};}});
  const response=await provider.poll({responseId:'resp_departments',request:saved});assert.deepEqual(response.departments,proposal(p));assert.deepEqual(methods,['GET']);
  assert.equal(JSON.parse(saved.body.input).context.departmentPlanning.guidanceVersion,previousVersion);assert.notEqual(saved.requestHash,current.requestHash);
});

test('department cost consent is operation-specific and stale source changes cannot reserve or claim another call',()=>{
  const p=plannedProject(),prepared=prepare(p),scope=planningScope(p,approvals(p)),state={projects:[p],planningConsents:[],planningReservations:[],planningCommands:[]};
  const base=()=>({actorId:p.ownerId,projectId:p.id,expectedVersion:p.version,requestId:randomUUID()});
  const grant=grantPlanningConsent(state,{...base(),operation:'plan_departments',maxMicroUsd:300000,finishReserveMicroUsd:10000,maxCalls:2},{profile:prepared.profile,scope,now});assert.equal(grant.generationAuthorized,false);
  const command={...base(),consentId:grant.id,operation:'plan_departments',requestHash:prepared.request.requestHash,quotedMicroUsd:prepared.quote.totalMicroUsd};
  assert.throws(()=>reservePlanningCall(state,{...command,requestId:randomUUID(),operation:'write_script'},{profile:prepared.profile,scope,now}),denied);
  const reservation=reservePlanningCall(state,command,{profile:prepared.profile,scope,now});assert.equal(reservation.submitClaimed,false);
  const changed=structuredClone(p);changed.departmentPlanning.departments[0].versions.at(-1).document.summary+=' A changed production requirement.';
  assert.throws(()=>claimPlanningCall(state,{...base(),reservationId:reservation.id},{profile:prepared.profile,scope:planningScope(changed,approvals(changed)),now}),denied);
  const first=claimPlanningCall(state,{...base(),reservationId:reservation.id},{profile:prepared.profile,scope,now});assert.equal(first.claimed,true);
  assert.throws(()=>claimPlanningCall(state,{...base(),reservationId:reservation.id},{profile:prepared.profile,scope,now}),denied);
  assert.equal(decidePlanningPath({operation:'plan_departments',requestHash:prepared.request.requestHash,scope,policy:{creativePlanningEnabled:true,allowedOperations:['plan_departments']}}).path,'llm');
});
