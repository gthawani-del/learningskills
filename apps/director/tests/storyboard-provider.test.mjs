import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {hash} from '../domain.mjs';
import {LocalStore} from '../store.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {applyScreenplayCommand} from '../public/screenplay-core.js';
import {applyDepartmentCommand,departmentPlanningContext,DEPARTMENT_IDS} from '../public/department-plan-core.js';
import {applyStoryboardHandoffCommand,storyboardHandoffContext,STORYBOARD_HANDOFF_GUIDANCE} from '../public/storyboard-handoff-core.js';
import {preparePlanningRequest,planningCreativeContext,planningSchemaHash,departmentPlanningSchemaHash,departmentRevisionSchemaHash,storyboardPlanningSchemaHash} from '../planning-profile.mjs';
import {buildPlanningRequest,createPlanningProvider,validatePlanningResult,PLANNING_VERSION,DEPARTMENT_PLANNING_VERSION,DEPARTMENT_REVISION_VERSION,STORYBOARD_PLANNING_VERSION} from '../planning-provider.mjs';
import {createPlanningController} from '../planning.mjs';
import {planningScope} from '../planning-policy.mjs';
import {grantPlanningConsent,reservePlanningCall,claimPlanningCall} from '../planning-consent.mjs';
import {validateModelPublication} from '../model-registry.mjs';
import {routePlanning} from '../planning-router.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';

const now='2026-10-19T00:00:00.000Z',expiresAt='2099-01-01T00:00:00.000Z';
const denied=error=>error.status===409;
const script=()=>({title:'The Platform Letter',logline:'A keeper decides whether to wait.',treatment:'Mira reads a letter and waits for the final train.',characters:[{id:'mira',name:'Mira',description:'A station keeper reading the letter.'}],scenes:[{id:'station',heading:'INT. STATION — NIGHT',action:'Mira unfolds the letter.',dialogue:[{id:'line_a',characterId:'mira',text:'Kal phir milenge.',direction:'Quietly.'}],durationSeconds:30},{id:'platform',heading:'EXT. PLATFORM — NIGHT',action:'Mira raises her lamp.',dialogue:[],durationSeconds:30}]});
const baseApprovals=p=>[{id:'brief_approval',artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved',ordinal:1},{id:'screenplay_approval',artifactId:'screenplay',version:p.screenplay.currentVersion,decision:'approved',ordinal:2}];
const approvals=p=>[...baseApprovals(p),...departmentPlanningContext(p,baseApprovals(p)).departments.map((unit,index)=>({id:'department_'+unit.id,artifactId:'department:'+unit.id,version:unit.current.version,decision:'approved',ordinal:index+3}))];
function project({sourceText=null,facts=null}={}){
  let p={id:'storyboard_project',ownerId:'owner',title:'The Platform Letter',premise:'A station keeper finds a letter from tomorrow.',direction:'Observational realism.',language:'Hinglish',duration:60,format:'short_film',version:1,story:{version:1,treatment:'',scenes:[]},shots:[],production:{records:[]},createdAt:now};
  p=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});
  if(facts)p=applyBriefCommand(p,{expectedVersion:p.version,action:'update',changes:facts});
  if(sourceText)p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'add_source',source:{title:'User source',text:sourceText,permittedUse:'reference_only'}});
  p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:script()});
  return applyDepartmentCommand(p,{expectedVersion:p.version,action:'prepare'},baseApprovals(p));
}
function profile(operations=['plan_storyboard']){
  const endpoint='https://api.openai.com/v1/responses',model='synthetic-storyboard-model';
  return reviewedPlanningFixture({id:'O-storyboard-test',provider:'openai',endpoint,model_version:model,active:true,execution_tested:true,quality_validated:true,capabilities:{planning:{enabled:true,version:'synthetic-storyboard',background:true,providerRetentionAcknowledged:true,contextWindowTokens:100000,maxOutputTokens:4000,maxRequestBytes:200000,tokenBoundEvidence:{verified:true,type:'context-window-upper-bound',model,contextWindowTokens:100000,tokenizerVersion:'reviewed-test-window',sourceUrl:'https://example.test/tokens',expiresAt}}},schema_evidence:{verified:true,version:'storyboard-schema',sourceUrl:'https://example.test/schema',expiresAt,endpoint,modelVersion:model,inputSchemaHash:operations.includes('plan_storyboard')?storyboardPlanningSchemaHash:operations.includes('revise_departments')?departmentRevisionSchemaHash:operations.includes('plan_departments')?departmentPlanningSchemaHash:planningSchemaHash},price_version:'storyboard-price',price_evidence:{verified:true,version:'storyboard-price',model,currency:'USD',sourceUrl:'https://example.test/pricing',expiresAt,input:{numeratorMicroUsd:1,denominatorTokens:1},cachedInput:{numeratorMicroUsd:0,denominatorTokens:1},output:{numeratorMicroUsd:2,denominatorTokens:1}}},{operations});
}
const prepare=(p=project(),m=profile(),a=approvals(p))=>preparePlanningRequest(p,m,'plan_storyboard',now,a);
function shot(scene){return {sceneId:scene.id,title:'Observe '+scene.id,purpose:'Show the approved scene action clearly.',action:scene.action,characterIds:['mira'],dialogueIds:scene.dialogue.map(line=>line.id),durationSeconds:scene.durationSeconds,timingBasis:'planning_estimate',framing:'Medium at eye level.',camera:'Locked frame; motivate any change through the actual action.',lighting:'Practical lamp with a soft ambient falloff.',startState:'Mira stands at the existing source location.',endState:'The approved action settles before the cut.',continuity:'Keep the same lamp, letter, wardrobe and screen direction.',requirements:[{id:'source_action',requirement:'Preserve the approved visible action and canonical spoken line.',priority:'mandatory',acceptanceEvidence:'Later review sees the specified action and hears only the approved source dialogue.',failureCondition:'An invented line, changed prop or unreadable action.'}],referenceRequirements:[{id:'identity',role:'identity',characterIds:['mira'],direction:'Review a consistent character reference before footage; no asset is selected here.'}],controls:[{id:'locked_camera',direction:'Keep the intended frame stable.',classification:'route_verification_required'}],audioCues:[{id:'scene_audio',type:scene.dialogue.length?'dialogue':'silence',direction:scene.dialogue.length?'Use the exact approved source dialogue ID once.':'Retain the approved quiet pause; sound is reviewed later.'}],performancePath:scene.dialogue.length?'audio_first':'silent_or_ambient'};}
const proposal=()=>({shots:script().scenes.map((scene,index)=>({id:'shot_'+(index+1),document:shot(scene)}))});
const complete=output=>({id:'resp_storyboard',status:'completed',usage:{input_tokens:100,output_tokens:200,input_tokens_details:{cached_tokens:10}},output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]});
function preparedProject(){const p=project();return applyStoryboardHandoffCommand(p,{expectedVersion:p.version,action:'prepare'},approvals(p));}
const currentProposal=p=>({shots:storyboardHandoffContext(p,approvals(p)).shots.map(unit=>({id:unit.id,document:structuredClone(unit.current.document)}))});

test('storyboard planning has a separate reviewed v6 contract and truthful planning-only controls',()=>{
  const p=project(),prepared=prepare(p),request=prepared.request,context=JSON.parse(request.body.input).context;
  assert.equal(STORYBOARD_PLANNING_VERSION,'director-planning-v6');assert.equal(request.version,STORYBOARD_PLANNING_VERSION);assert.equal(request.operation,'plan_storyboard');assert.equal(request.body.text.format.name,'storyboard_handoff_proposal');
  const schema=request.body.text.format.schema;assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.shots.maxItems,200);assert.deepEqual(schema.properties.shots.items.properties.document.properties.controls.items.properties.classification.enum,['prompt_only','reference_required','route_verification_required']);
  assert.equal(prepared.quote.totalMicroUsd,108000);assert.equal(prepared.quote.quoteKind,'maximum_reservation_not_expected_cost');assert.equal(context.storyboardHandoff.prerequisites.departmentsApproved,true);
  assert.deepEqual(validatePlanningResult(proposal(),request),proposal());assert.notEqual(storyboardPlanningSchemaHash,departmentRevisionSchemaHash);
});

test('storyboard planning requires current approved brief, screenplay and every fresh approved department',()=>{
  const p=project();assert.throws(()=>prepare(p,profile(),baseApprovals(p)),denied);assert.throws(()=>prepare(p,profile(),approvals(p).filter(a=>a.artifactId!=='screenplay')),denied);
  const stale=structuredClone(p);stale.direction='A changed source direction.';assert.throws(()=>prepare(stale),denied);
  const camera=structuredClone(departmentPlanningContext(p,approvals(p)).departments.find(unit=>unit.id==='camera').current.document);camera.summary+=' A later camera correction.';
  const changed=applyDepartmentCommand(p,{expectedVersion:p.version,action:'update',departmentId:'camera',document:camera},approvals(p));assert.throws(()=>prepare(changed,profile(),approvals(p)),denied);
});

test('complete script, raw sources, departments, guidance and compressed current-contract bindings remain in the reviewed byte limit',t=>{
  const facts={purpose:'Show an ordinary cooking moment with the supplied product.',audience:'Indian home cooks watching with sound.',audienceResponse:'Understand the ordinary cooking use without invented health claims.',platform:'YouTube',aspectRatio:'16:9',visualStyle:'Natural live-action observation.',tone:'Warm and restrained.',setting:'A real Indian home kitchen.',cast:'Mira is the named performer; demographic details remain unspecified.',voice:'Conversational Hinglish; select a real sample later.',product:'Example Oil in the supplied sealed one-litre bottle.',constraints:['Preserve the supplied label.','No invented certifications.'],budget:'Review an exact estimate before production.',format:'short_film',duration:60,language:'Hinglish'},exact='User source only.\r\n  All original spacing stays.  ';
  let p=project({sourceText:exact,facts});p=applyStoryboardHandoffCommand(p,{expectedVersion:p.version,action:'prepare'},approvals(p));
  const prepared=prepare(p),context=JSON.parse(prepared.request.body.input).context,full=storyboardHandoffContext(p,approvals(p));
  assert.deepEqual(context.screenplay.current.document,script());assert.equal(context.screenplay.sources[0].text,exact);assert.deepEqual(context.departmentPlanning.departments,departmentPlanningContext(p,approvals(p)).departments);assert.deepEqual(context.storyboardHandoff.shots,full.shots);assert.deepEqual(context.storyboardHandoff.guidance,STORYBOARD_HANDOFF_GUIDANCE);
  assert.equal(context.storyboardHandoff.inputSignature,hash(full.inputSignature));assert.equal(context.storyboardHandoff.sourceSignature,hash(full.sourceSignature));assert.equal(context.approvedArtifacts.some(a=>a.artifactId.startsWith('department:')),false);
  assert.deepEqual(context.storyboardHandoff.sequence,full.sequence);for(const [key,value]of Object.entries(facts))assert.deepEqual(context.structuredBrief.fields[key].value,value);
  const bytes=Buffer.byteLength(JSON.stringify(prepared.request.body),'utf8');assert(bytes<=200000);t.diagnostic(`Complete source, all seventeen approved departments and storyboard guidance: ${bytes} request bytes; reviewed cap remains 200000.`);
  const smaller=profile();smaller.capabilities.planning.maxRequestBytes=bytes-1;assert.throws(()=>prepare(p,smaller),/reviewed input limit/);
});

test('shot contracts reject fabricated evidence, selected assets, unsupported control claims and non-estimate timings',()=>{
  const request=prepare().request;
  for(const mutate of [x=>x.generated=true,x=>x.shots[0].document.observations=['verified'],x=>x.shots[0].document.selectedAssetId='fake',x=>x.shots[0].document.controls[0].classification='verified',x=>x.shots[0].document.referenceRequirements[0].assetId='fake',x=>x.shots[0].document.timingBasis='measured',x=>x.shots[0].document.durationSeconds=0,x=>x.shots[0].document.durationSeconds=901,x=>x.shots[0].document.action='',x=>x.shots[0].document.continuity='',x=>x.shots[0].document.requirements[0].acceptanceEvidence='',x=>x.shots[0].document.requirements[0].failureCondition='',x=>x.shots[0].document.requirements[0].priority='flexible']){
    const invalid=proposal();mutate(invalid);assert.throws(()=>validatePlanningResult(invalid,request));
  }
});

test('legacy shot directions and media must be adopted for free before any storyboard allowance or provider submission',async()=>{
  const p=project();p.shots=[{id:'legacy_shot',version:1,title:'The existing shot',sceneId:'station',description:'Keep this exact existing shot direction.',duration:30,framing:'Medium.',camera:'Locked.',dialogue:script().scenes[0].dialogue[0].text,continuity:'Keep the original lamp.',constraints:'Keep the label.',referenceAssetId:'existing_reference',clipAssetId:'existing_clip',productionBindings:[],status:'draft'}];
  assert.throws(()=>prepare(p),/Prepare the existing shots/);
  const store=await new LocalStore().init();store.state.projects=[p];store.state.models=[profile()];store.state.approvals=approvals(p).map(row=>({...row,projectId:p.id}));store.state.operationalControl.generationPaused=false;let submissions=0;
  const controller=createPlanningController({store,provider:{submit:async()=>{submissions++;}},env:{OPENAI_API_KEY:'synthetic'},now:()=>new Date(now)}),summary=await controller.summary(p.ownerId,p.id,'plan_storyboard');assert.equal(summary.availability.enabled,false);assert.match(summary.availability.reason,/free adoption/);
  await assert.rejects(controller.consent({actorId:p.ownerId,projectId:p.id,expectedVersion:p.version,requestId:randomUUID(),operation:'plan_storyboard',maxMicroUsd:200000,finishReserveMicroUsd:0,maxCalls:1}),denied);assert.equal(store.state.planningConsents?.length||0,0);assert.equal(submissions,0);
  const adopted=applyStoryboardHandoffCommand(p,{expectedVersion:p.version,action:'prepare'},approvals(p));assert.equal(adopted.shots[0].id,'legacy_shot');assert.equal(adopted.shots[0].referenceAssetId,'existing_reference');assert.equal(adopted.shots[0].clipAssetId,'existing_clip');assert.equal(adopted.shots[0].description,p.shots[0].description);assert.doesNotThrow(()=>prepare(adopted));
  const orphan=structuredClone(p);orphan.shots[0].sceneId='missing';assert.throws(()=>prepare(orphan),/Prepare the existing shots/);assert.throws(()=>applyStoryboardHandoffCommand(orphan,{expectedVersion:orphan.version,action:'prepare'},approvals(orphan)),denied);assert.equal(submissions,0);
});

test('storyboard coverage includes every source scene and every canonical dialogue ID exactly once in its real scene',()=>{
  const request=prepare().request;
  for(const mutate of [x=>x.shots.pop(),x=>x.shots[0].document.dialogueIds=[],x=>x.shots[0].document.sceneId='invented',x=>x.shots[1].document.dialogueIds=['line_a'],x=>x.shots[0].document.characterIds=[],x=>x.shots[0].document.dialogue='Invented spoken words.',x=>x.shots.push({...structuredClone(x.shots[0]),id:'duplicate_dialogue'})]){
    const invalid=proposal();mutate(invalid);assert.throws(()=>validatePlanningResult(invalid,request));
  }
});

test('existing identities, relative order and approved shot documents remain protected while new coverage can be inserted',()=>{
  const p=preparedProject(),units=storyboardHandoffContext(p,approvals(p)).shots,a=[...approvals(p),{id:'shot_review',artifactId:'shot_contract:'+units[0].id,version:units[0].current.version,decision:'approved',ordinal:100}],request=prepare(p,profile(),a).request,good=currentProposal(p);
  assert.deepEqual(validatePlanningResult(good,request),good);
  for(const mutate of [x=>x.shots.shift(),x=>x.shots.reverse(),x=>x.shots[0].document.camera+=' An unapproved camera change.',x=>x.shots[1].id=x.shots[0].id]){const invalid=structuredClone(good);mutate(invalid);assert.throws(()=>validatePlanningResult(invalid,request));}
  const added=structuredClone(good),inserted=structuredClone(good.shots[0]);inserted.id='extra_coverage';inserted.document.dialogueIds=[];added.shots.splice(1,0,inserted);assert.deepEqual(validatePlanningResult(added,request),added);
});

test('an approved storyboard sequence blocks new paid planning and protects the complete order and shot count',async()=>{
  const p=preparedProject(),handoff=storyboardHandoffContext(p,approvals(p)),a=[...approvals(p),...handoff.shots.map((shot,index)=>({id:'shot_review_'+index,artifactId:'shot_contract:'+shot.id,version:shot.current.version,decision:'approved',ordinal:30+index})),{id:'sequence_review',artifactId:'storyboard_sequence',version:handoff.sequence.current.version,decision:'approved',ordinal:100}];
  assert.equal(storyboardHandoffContext(p,a).sequence.approved,true);assert.throws(()=>prepare(p,profile(),a),/already approved/);
  const store=await new LocalStore().init();store.state.projects=[p];store.state.models=[profile()];store.state.approvals=a.map(row=>({...row,projectId:p.id}));store.state.operationalControl.generationPaused=false;
  const controller=createPlanningController({store,provider:{},env:{OPENAI_API_KEY:'synthetic'},now:()=>new Date(now)}),summary=await controller.summary(p.ownerId,p.id,'plan_storyboard');assert.equal(summary.availability.enabled,false);assert.match(summary.availability.reason,/Edit a contract, reorder explicitly or reopen/);
});

test('storyboard task, schema, execution and quality must be separately reviewed with no inherited seven-operation approval',()=>{
  const p=project(),old=profile(['plan_departments']);assert.throws(()=>prepare(p,old),denied);
  const wrong=profile();wrong.schema_evidence.inputSchemaHash=departmentRevisionSchemaHash;assert.throws(()=>prepare(p,wrong),denied);
  const quality=profile();quality.capabilities.reviewEvidence.quality.operations=[];assert.throws(()=>prepare(p,quality),denied);
  const route=routePlanning({project:p,approvals:approvals(p),models:[profile()],operation:'plan_storyboard',now});assert.equal(route.task,'storyboard_planning');assert.equal(route.selectedModelId,'O-storyboard-test');
  const all=profile(['interpret_brief','initial_plan','revise_plan','write_script','revise_script','plan_departments','revise_departments','plan_storyboard']),{id,active,execution_tested,quality_validated,...draft}=structuredClone(all),review=draft.capabilities.reviewEvidence;delete draft.capabilities.reviewEvidence;
  assert.doesNotThrow(()=>validateModelPublication({modelId:id,profile:draft,review:{schemaVerified:true,pricingVerified:true,executionTested:true,qualityValidated:true,execution:review.execution,quality:review.quality,notes:'Synthetic offline eight-operation review only.'},now}));
});

test('storyboard scope and spending consent bind current sources, department reviews and the entire handoff archive',()=>{
  const p=preparedProject(),a=approvals(p),prepared=prepare(p),scope=planningScope(p,a),state={projects:[p],planningConsents:[],planningReservations:[],planningCommands:[]},base=()=>({actorId:p.ownerId,projectId:p.id,expectedVersion:p.version,requestId:randomUUID()});
  const grant=grantPlanningConsent(state,{...base(),operation:'plan_storyboard',maxMicroUsd:300000,finishReserveMicroUsd:10000,maxCalls:2},{profile:prepared.profile,scope,now});
  assert.throws(()=>reservePlanningCall(state,{...base(),consentId:grant.id,operation:'plan_departments',requestHash:prepared.request.requestHash,quotedMicroUsd:108000},{profile:prepared.profile,scope,now}),denied);
  const reservation=reservePlanningCall(state,{...base(),consentId:grant.id,operation:'plan_storyboard',requestHash:prepared.request.requestHash,quotedMicroUsd:108000},{profile:prepared.profile,scope,now}),changed=structuredClone(p);changed.storyboardHandoff.shots[0].versions.at(-1).document.purpose+=' A changed shot purpose.';
  assert.notEqual(prepare(changed).request.requestHash,prepared.request.requestHash);assert.throws(()=>claimPlanningCall(state,{...base(),reservationId:reservation.id},{profile:prepared.profile,scope:planningScope(changed,a),now}),denied);
  const reviewed=[...a,{id:'later_review',artifactId:'shot_contract:'+storyboardHandoffContext(p,a).shots[0].id,version:1,decision:'approved',ordinal:99}];assert.notEqual(prepare(p,profile(),reviewed).request.requestHash,prepared.request.requestHash);
});

test('v6 output retains known provider identity and usage without automatic application or paid repairs',async()=>{
  const request=prepare().request,methods=[],provider=createPlanningProvider({env:{OPENAI_API_KEY:'synthetic'},fetcher:async(url,options)=>{methods.push(options.method);return {ok:true,json:async()=>complete(proposal())};}});
  const saved=await provider.submit({request,authorized:true});assert.deepEqual(saved.storyboard,proposal());assert.equal(saved.applied,undefined);assert.equal(saved.plan,undefined);assert.equal(saved.usage.outputTokens,200);assert.deepEqual((await provider.poll({responseId:saved.id,request})).storyboard,proposal());assert.deepEqual(methods,['POST','GET']);
  const bad=proposal();bad.shots[0].document.dialogueIds=[];let count=0;const invalid=createPlanningProvider({env:{OPENAI_API_KEY:'synthetic'},fetcher:async()=>{count++;return {ok:true,json:async()=>complete(bad)};}}),failed=await invalid.submit({request,authorized:true});assert.equal(failed.id,'resp_storyboard');assert.equal(failed.storyboard,undefined);assert.ok(failed.planError);assert.equal(failed.usage.outputTokens,200);assert.equal(count,1);
});

test('unknown storyboard response normalization retains observed usage and the original hold without automatic resubmission',async()=>{
  const p=project(),store=await new LocalStore().init();store.state.projects=[p];store.state.models=[profile()];store.state.approvals=approvals(p).map(row=>({...row,projectId:p.id}));store.state.operationalControl.generationPaused=false;let submissions=0,polls=0;
  const provider=createPlanningProvider({env:{OPENAI_API_KEY:'synthetic'},fetcher:async(url,options)=>{if(options.method==='POST')submissions++;else polls++;return {ok:true,json:async()=>({...complete(proposal()),output:[null]})};}}),controller=createPlanningController({store,provider,env:{OPENAI_API_KEY:'synthetic'},now:()=>new Date(now)}),base={actorId:p.ownerId,projectId:p.id,expectedVersion:p.version};
  const grant=await controller.consent({...base,requestId:randomUUID(),operation:'plan_storyboard',maxMicroUsd:200000,finishReserveMicroUsd:0,maxCalls:1}),command={...base,requestId:randomUUID(),operation:'plan_storyboard',consentId:grant.id},saved=await controller.start(command);
  assert.equal(saved.reservation.status,'unknown');assert.deepEqual(saved.result.observedUsage,{inputTokens:100,outputTokens:200,cachedInputTokens:10});assert.equal(saved.providerResponseId,'resp_storyboard');assert.equal(saved.reservation.actualMicroUsd,undefined);
  await controller.start(command);await controller.poll(p.ownerId,p.id,saved.reservation.id);assert.equal(submissions,1);assert.equal(polls,1);await assert.rejects(controller.start({...command,requestId:randomUUID()}),denied);assert.equal(submissions,1);
});

test('a storyboard operation cannot masquerade as older saved request versions',async()=>{
  const request=prepare().request;let calls=0;const provider=createPlanningProvider({env:{OPENAI_API_KEY:'synthetic'},fetcher:async()=>{calls++;return {ok:true,json:async()=>complete(proposal())};}});
  for(const version of ['director-planning-v2',PLANNING_VERSION,DEPARTMENT_PLANNING_VERSION,DEPARTMENT_REVISION_VERSION]){const forged={...request,version};forged.requestHash=hash({version,body:forged.body});await assert.rejects(provider.poll({responseId:'resp_storyboard',request:forged}),denied);}assert.equal(calls,0);
});
