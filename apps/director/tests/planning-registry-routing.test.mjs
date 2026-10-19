import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash,newProject} from '../domain.mjs';
import {routePlanning,publicPlanningRoute} from '../planning-router.mjs';
import {planningOperationEvidence,planningProfile,planningSchemaHash} from '../planning-profile.mjs';
import {planningOperationTask,knownRoutingTask} from '../routing-task-catalog.mjs';
import {createPlanningController} from '../planning.mjs';
import {LocalStore} from '../store.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {selectRoutes,publishedReviewHolds} from '../model-router.mjs';
import {reviewedFalInputSchema} from '../providers.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';

const now='2026-10-19T12:00:00.000Z',expiresAt='2099-01-01T00:00:00.000Z';
function model(id='O-registry-a',{operations=['interpret_brief','write_script'],priority=10,rate=1}={}){
 const endpoint='https://api.openai.com/v1/responses',version='registry-model-'+id;
 return reviewedPlanningFixture({id,provider:'openai',endpoint,model_version:version,active:true,execution_tested:true,quality_validated:true,capabilities:{priority,planning:{enabled:true,version:'test-planning',background:true,providerRetentionAcknowledged:true,contextWindowTokens:10000,maxOutputTokens:2000,maxRequestBytes:200000,tokenBoundEvidence:{verified:true,type:'context-window-upper-bound',model:version,contextWindowTokens:10000,tokenizerVersion:'reviewed-window',sourceUrl:'https://example.test/token-bounds',expiresAt}}},schema_evidence:{verified:true,version:'schema',sourceUrl:'https://example.test/schema',expiresAt,endpoint,modelVersion:version,inputSchemaHash:planningSchemaHash},price_version:'price',price_evidence:{verified:true,version:'price',model:version,currency:'USD',sourceUrl:'https://example.test/price',expiresAt,input:{numeratorMicroUsd:rate,denominatorTokens:1},cachedInput:{numeratorMicroUsd:0,denominatorTokens:1},output:{numeratorMicroUsd:rate*2,denominatorTokens:1}},routing_profiles:[]},{operations});
}
function film(){return applyBriefCommand(newProject({title:'Station',premise:'A station keeper finds tomorrow’s letter.'},'owner'),{expectedVersion:1,action:'suggest'});}
const approved=p=>[{id:'approval',projectId:p.id,artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved',ordinal:1}];
function route(models,extra={}){const project=film();return routePlanning({project,approvals:approved(project),models,operation:'write_script',now,...extra});}

test('planning tasks are explicit known registry roles with no historical model pin',()=>{
 for(const [operation,task]of [['interpret_brief','brief_interpretation'],['initial_plan','film_planning'],['revise_plan','film_plan_revision'],['write_script','screenplay_writing'],['revise_script','screenplay_revision']]){assert.equal(planningOperationTask(operation),task);assert.deepEqual(knownRoutingTask(task).candidateModelIds,[]);}
 assert.equal(planningOperationTask('constructor'),null);assert.equal(route([]).status,'held');assert.equal(route([]).selected,null);
});

test('operation-specific registry routing binds selected model and exact reservation without cheapest defaults',()=>{
 const cheap=model('cheap',{priority:1,rate:1}),strong=model('job-fit',{priority:50,rate:3}),wrong=model('wrong-operation',{operations:['interpret_brief'],priority:1000});
 const result=route([wrong,cheap,strong]);assert.equal(result.selectedModelId,'job-fit');assert.equal(result.context.request.model,strong.model_version);assert.equal(result.context.quote.totalMicroUsd,42000);assert.equal(result.selected.profileFingerprint,hash(strong));
 assert(result.candidates.find(c=>c.modelId==='wrong-operation').holds.includes('planning_operation_not_declared'));
 assert.deepEqual(route([strong,cheap,wrong]).candidates,result.candidates);
 const visible=publicPlanningRoute(result);assert.equal(visible.context,undefined);assert.equal(visible.model,undefined);assert.equal(JSON.stringify(visible).includes('numeratorMicroUsd'),false);assert.match(visible.policy,/never a cheapest/);
});

test('fresh reviewed operation binding and execution/quality coverage are mandatory',()=>{
 for(const mutate of [
  m=>{delete m.capabilities.planning.operations;},m=>{m.capabilities.tasks=['story_reasoning'];},m=>{m.capabilities.planning.operationBindings[1].reviewed=false;},m=>{m.capabilities.planning.operationBindings[1].modelId='other';},m=>{m.capabilities.planning.operationBindings[1].expiresAt=now;},m=>{m.capabilities.planning.operationBindings.push({...m.capabilities.planning.operationBindings[1]});},m=>{m.capabilities.reviewEvidence.quality.operations=['interpret_brief'];},m=>{m.capabilities.reviewEvidence.execution.tasks=['brief_interpretation'];},m=>{m.capabilities.reviewEvidence.quality.sampleCount=0;},m=>{m.capabilities.reviewEvidence.execution.evaluatedAt=expiresAt;},m=>{m.capabilities.reviewEvidence.quality.endpoint='https://unreviewed.test/responses';},m=>{m.capabilities.reviewEvidence.quality.expiresAt=now;},
 ]){const candidate=model();mutate(candidate);assert.equal(route([candidate]).status,'held');assert.throws(()=>planningOperationEvidence(candidate,'write_script',now),{status:409});}
 const candidate=model(),profile=planningProfile(candidate,now);assert.deepEqual(planningProfile(candidate,now,'write_script'),profile);assert.equal(planningOperationEvidence(candidate,'write_script',now).task,'screenplay_writing');
});

test('language, format, schema and cost constraints hold unsupported jobs rather than invent fallbacks',()=>{
 for(const [mutate,hold]of [[m=>{m.capabilities.languages=['English'];},'planning_language_unsupported'],[m=>{m.capabilities.planning.formats=['music_video'];},'planning_format_unsupported'],[m=>{m.capabilities.priority=-1;},'planning_priority_invalid']]){
  const candidate=model();mutate(candidate);const project=film();project.language='Hinglish';project.creativeBrief=undefined;
  const result=routePlanning({project,models:[candidate],operation:'interpret_brief',now});assert(result.candidates[0].holds.includes(hold));assert.equal(result.selected,null);
 }
 const stale=model();stale.schema_evidence.inputSchemaHash=hash('old-contract');assert.equal(route([stale]).selected,null);
 const bounded=route([model('expensive',{priority:100,rate:3}),model('fits',{priority:1})],{budgetMicroUsd:14000});assert.equal(bounded.selectedModelId,'fits');assert(bounded.candidates.find(c=>c.modelId==='expensive').holds.includes('planning_reservation_exceeds_budget'));
 assert.equal(route([model()],{budgetMicroUsd:13999}).selected,null);
});

test('explicit quality preferences use fresh measured task evaluations before priority',()=>{
 const make=(id,priority,score)=>{const candidate=model(id,{priority});candidate.routing_profiles=[{verified:true,task:'screenplay_writing',modelId:id,endpoint:candidate.endpoint,modelVersion:candidate.model_version,evidenceVersion:'screenplay-eval-'+id,sourceUrl:'https://example.test/quality',evaluatedAt:'2026-10-01T00:00:00.000Z',expiresAt,sampleCount:12,styles:['observational'],scores:{dialogue:score,coherence:90},latencyMs:5000}];return candidate;};
 const a=make('priority-only',100,65),b=make('measured-fit',1,92),intent={style:'observational',qualityGoals:[{goal:'dialogue',weight:3,minimumScore:70},{goal:'coherence',weight:1}],deadlineMs:6000};
 const result=route([a,b],{intent});assert.equal(result.selectedModelId,'measured-fit');assert(result.candidates.find(c=>c.modelId==='priority-only').holds.includes('intent_goal_below_minimum:dialogue'));assert.equal(result.selected.intentFit.score,91.5);
 b.routing_profiles[0].expiresAt=now;assert.equal(route([a,b],{intent}).selected,null);
 assert.throws(()=>route([model()],{intent:{age:19}}),{status:400});
});

test('fal planning adapters and generic OpenAI scalar routing fail closed with explicit explanations',()=>{
 const candidate=model('fal-llm');candidate.provider='fal';candidate.endpoint='openrouter/router';
 const result=route([candidate]);assert.equal(result.selected,null);assert(result.candidates[0].holds.includes('fal_structured_planning_adapter_unavailable'));
 const openai=model();const generic=selectRoutes({task:'screenplay_writing',models:[openai],now});assert(generic.candidates[0].holds.includes('structured_planning_route_required'));assert.deepEqual(generic.eligibleForQuote,[]);
 const unsupported={id:'fal-unknown',provider:'fal',endpoint:'future/vendor/model',model_version:'1',capabilities:{tasks:['draft_image']}};
 assert(selectRoutes({task:'draft_image',models:[unsupported],now}).candidates[0].holds.includes('fal_provider_adapter_unavailable'));
});

test('published fal execution and quality review expiry is checked again on every quote',()=>{
 const endpoint='bytedance/seedream/v5/pro/edit',candidate={id:'F-reviewed',provider:'fal',endpoint,model_version:'reviewed-fal-v1',active:true,execution_tested:true,quality_validated:true,capabilities:{tasks:['image_edit']},schema_evidence:{verified:true,version:'fal-schema',endpoint,modelVersion:'reviewed-fal-v1',inputSchemaHash:hash(reviewedFalInputSchema(endpoint)),sourceUrl:'https://fal.ai/schema',expiresAt},price_version:'fal-price',price_evidence:{verified:true,configurationVerified:true,configuration:{num_images:1},version:'fal-price',currency:'USD',unit:'image',unitMicroUsd:10000,rounding:'ceil',sourceUrl:'https://fal.ai/pricing',expiresAt}};
 const evidence={modelId:candidate.id,provider:'fal',endpoint,modelVersion:candidate.model_version,version:'fal-evaluation',sourceUrl:'https://example.test/fal-execution',evaluatedAt:'2026-10-01T00:00:00.000Z',expiresAt,sampleCount:5,tasks:['image_edit'],operations:[]};candidate.capabilities.reviewEvidence={execution:structuredClone(evidence),quality:structuredClone(evidence)};
 assert.deepEqual(selectRoutes({task:'image_edit',models:[candidate],now}).eligibleForQuote,[candidate.id]);
 assert.deepEqual(publishedReviewHolds(candidate,undefined,now),[]);const unreviewedTask=structuredClone(candidate);unreviewedTask.capabilities.tasks.push('reference_video');assert(publishedReviewHolds(unreviewedTask,undefined,now).length>0);
 for(const mutate of [m=>{m.capabilities.reviewEvidence.quality.expiresAt=now;},m=>{m.capabilities.reviewEvidence.execution.modelVersion='different';},m=>{m.capabilities.reviewEvidence.quality.tasks=['reference_video'];},m=>{m.capabilities.reviewEvidence.execution.sampleCount=0;}]){const bad=structuredClone(candidate);mutate(bad);const result=selectRoutes({task:'image_edit',models:[bad],now});assert.deepEqual(result.eligibleForQuote,[]);assert(result.candidates[0].holds.some(hold=>hold.endsWith('review_missing_expired_or_mismatched')));}
});

test('authorized model pin never switches to another eligible registry candidate',()=>{
 const first=model('approved',{priority:1}),other=model('new-best',{priority:100});
 assert.equal(route([first,other]).selectedModelId,'new-best');assert.equal(route([first,other],{modelId:'approved'}).selectedModelId,'approved');
 first.active=false;assert.equal(route([first,other],{modelId:'approved'}).selected,null);assert.equal(route([other],{modelId:'missing'}).selected,null);
});

async function controllerFixture(t){
 const dir=await mkdtemp(join(tmpdir(),'director-registry-routing-'));t.after(()=>rm(dir,{recursive:true,force:true}));const store=await new LocalStore(join(dir,'store.json')).init(),p=film();await store.create(p);store.state.approvals=approved(p);store.state.models=[model('approved',{priority:20}),model('alternative',{priority:1})];store.state.operationalControl.generationPaused=false;
 let submissions=0,polls=0,lastRequest;
 const provider={submit:async({request})=>{submissions++;lastRequest=request;return{id:'resp_registry_'+submissions,status:'queued',usage:null};},poll:async({responseId})=>{polls++;return{id:responseId,status:'in_progress',usage:null};}};
 const env={OPENAI_API_KEY:'synthetic-secret'},controller=createPlanningController({store,provider,env,now:()=>new Date(now)});
 return {store,p,env,provider,controller,submissions:()=>submissions,polls:()=>polls,lastRequest:()=>lastRequest};
}
const command=(f,extra={})=>({actorId:'owner',projectId:f.p.id,expectedVersion:f.p.version,requestId:randomUUID(),...extra});
async function consent(f,extra={}){const summary=await f.controller.summary('owner',f.p.id,'write_script');return f.controller.consent(command(f,{operation:'write_script',maxMicroUsd:30000,finishReserveMicroUsd:1000,maxCalls:2,expectedModelId:summary.quote.modelId,expectedProfileFingerprint:summary.quote.profileFingerprint,...extra}));}

test('controller uses registry with credentials only and binds grants to the displayed operation quote',async t=>{
 const f=await controllerFixture(t),summary=await f.controller.summary('owner',f.p.id,'write_script');assert.equal(summary.availability.enabled,true);assert.equal(summary.operation,'write_script');assert.equal(summary.task,'screenplay_writing');assert.equal(summary.quote.modelId,'approved');assert.equal(summary.quote.maxCallMicroUsd,14000);assert.equal(summary.operations.length,5);assert.equal(f.env.OPENAI_STORY_MODEL,undefined);assert.equal(f.env.DIRECTOR_PLANNING_ENABLED,undefined);
 const grant=await consent(f);assert.equal(grant.modelId,'approved');assert.equal(grant.operation,'write_script');assert.equal(f.submissions(),0);
 f.env.OPENAI_STORY_MODEL='retired-env-pin';f.env.DIRECTOR_PLANNING_ENABLED='0';assert.equal((await f.controller.summary('owner',f.p.id,'write_script')).quote.modelId,'approved');assert.equal((await f.controller.summary('owner',f.p.id,'write_script')).availability.enabled,true);
 await assert.rejects(consent(f,{expectedModelId:'alternative'}),{status:409});await assert.rejects(consent(f,{expectedProfileFingerprint:hash('old-profile')}),{status:409});
 f.store.state.operationalControl.generationPaused=true;assert.equal((await f.controller.summary('owner',f.p.id,'write_script')).availability.enabled,false);
});

test('start stays with the consent model after ranking changes and never switches after that model is held',async t=>{
 const f=await controllerFixture(t),grant=await consent(f);f.store.state.models[1].capabilities.priority=100;
 assert.equal((await f.controller.summary('owner',f.p.id,'write_script')).quote.modelId,'alternative');
 const call=await f.controller.start(command(f,{operation:'write_script',consentId:grant.id}));assert.equal(f.submissions(),1);assert.equal(f.lastRequest().model,'registry-model-approved');assert.equal(call.reservation.consentId,grant.id);
 const g=await controllerFixture(t),grant2=await consent(g);g.store.state.models[0].active=false;
 await assert.rejects(g.controller.start(command(g,{operation:'write_script',consentId:grant2.id})),{status:409});assert.equal(g.submissions(),0);
});

test('known-call checks retain original identity after registry retirement without rerouting or submission',async t=>{
 const f=await controllerFixture(t),grant=await consent(f),call=await f.controller.start(command(f,{operation:'write_script',consentId:grant.id}));f.store.state.models=[];delete f.env.OPENAI_API_KEY;f.store.state.operationalControl.generationPaused=true;
 const polled=await f.controller.poll('owner',f.p.id,call.reservation.id);assert.equal(polled.providerResponseId,'resp_registry_1');assert.equal(f.polls(),1);assert.equal(f.submissions(),1);
});
