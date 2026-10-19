import test from 'node:test';
import assert from 'node:assert/strict';
import { hash } from '../domain.mjs';
import { buildPlanningRequest, validatePlanningResult, createPlanningProvider, PLANNING_VERSION } from '../planning-provider.mjs';
import { preparePlanningRequest, planningSchemaHash, planningCreativeContext } from '../planning-profile.mjs';
import { planningScope, decidePlanningPath } from '../planning-policy.mjs';
import { applyBriefCommand } from '../public/creative-brief-core.js';
import { applyScreenplayCommand, screenplayPlanningContext } from '../public/screenplay-core.js';

const now = '2026-10-19T00:00:00.000Z';
const blocked = error => error.status === 409;
function document() {
  return {title:'The Last Platform',logline:'A station keeper decides whether to trust tomorrow.',treatment:'Mira finds a letter, then chooses to keep the last train waiting.',characters:[{id:'mira',name:'Mira',description:'A station keeper who measures every decision carefully.'}],scenes:[
    {id:'scene_a',heading:'INT. STATION OFFICE — NIGHT',action:'Mira unfolds a rain-stained letter.',dialogue:[{id:'line_a',characterId:'mira',text:'Tomorrow has terrible handwriting.',direction:'Quiet amusement.'}],durationSeconds:22},
    {id:'scene_b',heading:'EXT. PLATFORM — NIGHT',action:'Mira raises her lamp. The train slows.',dialogue:[],durationSeconds:18},
  ]};
}
function project() {
  const p={id:'writing_project',ownerId:'owner',title:'Platform',premise:'A station keeper finds a letter from tomorrow.',direction:'Observational realism.',language:'English',duration:60,format:'short_film',version:1,story:{version:1,treatment:'',scenes:[]},shots:[],production:{records:[]},createdAt:now};
  return applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});
}
const approvals = p => [{id:'brief_approval',artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved',ordinal:1}];
function profile() {
  const endpoint='https://api.openai.com/v1/responses',version='writing-test-model',expiresAt='2099-01-01T00:00:00.000Z';
  return {id:'O-writing-test',provider:'openai',endpoint,model_version:version,active:true,execution_tested:true,quality_validated:true,capabilities:{planning:{enabled:true,version:'writing-test',background:true,providerRetentionAcknowledged:true,contextWindowTokens:10000,maxOutputTokens:2000,maxRequestBytes:200000,tokenBoundEvidence:{verified:true,model:version,contextWindowTokens:10000,type:'context-window-upper-bound',tokenizerVersion:'reviewed-window',sourceUrl:'https://example.com/tokens',expiresAt}}},schema_evidence:{verified:true,version:'writing-schema',endpoint,modelVersion:version,inputSchemaHash:planningSchemaHash,sourceUrl:'https://example.com/schema',expiresAt},price_version:'writing-price',price_evidence:{verified:true,version:'writing-price',model:version,currency:'USD',sourceUrl:'https://example.com/pricing',expiresAt,input:{numeratorMicroUsd:1,denominatorTokens:1},cachedInput:{numeratorMicroUsd:0,denominatorTokens:1},output:{numeratorMicroUsd:2,denominatorTokens:1}}};
}
const prepare = (p,operation='write_script',m=profile(),a=approvals(p)) => preparePlanningRequest(p,m,operation,now,a);
function currentProject() {
  const p=project();
  return applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:document()});
}
function revise(p,sceneIds=['scene_b']) {
  return applyScreenplayCommand(p,{expectedVersion:p.version,action:'set_revision',revisionRequest:{instruction:'Make the final action quieter, with no change elsewhere.',sceneIds}});
}
const completed = output => ({id:'resp_screenplay',status:'completed',usage:{input_tokens:30,output_tokens:60,input_tokens_details:{cached_tokens:5}},output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]});

test('screenplay generation has its own strict reviewed schema and no shot-duration fiction',()=>{
  const p=project(),prepared=prepare(p),request=prepared.request;
  assert.equal(PLANNING_VERSION,'director-planning-v3');assert.equal(request.operation,'write_script');
  assert.equal(request.body.text.format.name,'screenplay_proposal');assert.equal(request.body.text.format.strict,true);
  assert.equal(request.body.text.format.schema.additionalProperties,false);
  assert.equal(request.body.text.format.schema.properties.shots,undefined);
  assert.equal(request.body.text.format.schema.properties.scenes.items.properties.durationSeconds.maximum,3600);
  assert.deepEqual(JSON.parse(request.body.input).context.screenplay,screenplayPlanningContext(p));
  assert.deepEqual(validatePlanningResult(document(),request),document());
  assert.equal(document().scenes.reduce((n,s)=>n+s.durationSeconds,0),40); // Editorial estimate need not fake a measured 60-second film.
  assert.equal(prepared.quote.quoteKind,'maximum_reservation_not_expected_cost');assert.equal(prepared.quote.totalMicroUsd,14000);
});

test('new writing requires current approved brief and cannot silently replace an existing script',()=>{
  const p=project();assert.throws(()=>prepare(p,'write_script',profile(),[]),blocked);
  const stale=structuredClone(p);stale.direction='Changed direction.';assert.throws(()=>prepare(stale),blocked);
  const absent=structuredClone(p);delete absent.creativeBrief;assert.throws(()=>prepare(absent,'write_script',profile(),[]),blocked);
  assert.throws(()=>prepare(currentProject()),blocked);
  assert.throws(()=>prepare(currentProject(),'revise_script'),blocked);
});

test('complete source text and explicit revision intent bind hashes, with no silent truncation',()=>{
  let p=project();const text='Original Hinglish scene. “Kal phir milenge.”\n  Exact spacing stays.  ';
  p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'add_source',source:{title:'My supplied reference',text,permittedUse:'reference_only'}});
  const request=prepare(p).request,ctx=JSON.parse(request.body.input).context.screenplay;
  assert.equal(ctx.sources[0].text,text);assert.equal(ctx.current,null);
  const changed=structuredClone(p);changed.screenplay.sources[0].text+='One more line.';
  assert.notEqual(prepare(changed).request.requestHash,request.requestHash);
  assert.notEqual(planningScope(changed,approvals(changed)).briefScopeHash,planningScope(p,approvals(p)).briefScopeHash);
  const old=revise(currentProject()),different=structuredClone(old);different.screenplay.revisionRequest.instruction+=' Only remove the lamp.';
  assert.notEqual(prepare(old,'revise_script').request.requestHash,prepare(different,'revise_script').request.requestHash);
  const large=project();large.screenplay={currentVersion:0,versions:[],sources:[{id:'source_big',title:'Large source',text:'x'.repeat(100000),origin:'user_supplied',permittedUse:'reference_only',createdAt:now}],revisionRequest:null,reviews:[]};
  assert.throws(()=>prepare(large),/no approved constraints or source text were truncated/);
});

test('reviewed request byte limit includes full script context, schema and UTF-8 source bytes',()=>{
  const p=project(),request=prepare(p).request,bytes=Buffer.byteLength(JSON.stringify(request.body),'utf8');
  const m=profile();m.capabilities.planning.maxRequestBytes=bytes-1;
  assert.throws(()=>prepare(p,'write_script',m),/reviewed input limit/);
  const unreviewed=profile();unreviewed.schema_evidence.inputSchemaHash=hash('old-two-schema-contract');
  assert.throws(()=>prepare(p,'write_script',unreviewed),blocked);
});

test('targeted script revision deterministically preserves every unselected scene and protected choice',()=>{
  const p=revise(currentProject()),request=prepare(p,'revise_script').request,changed=document();changed.scenes[1].action='Mira lowers her lamp and listens.';
  assert.deepEqual(validatePlanningResult(changed,request),changed);
  for(const mutate of [
    d=>{d.scenes[0].action='An unrelated rewrite.';},d=>{d.scenes.reverse();},d=>{d.characters[0].description='A different character.';},
    d=>{d.title='A different title';},d=>{d.logline='New premise';},d=>{d.treatment='A different treatment';},d=>{d.scenes.push({...d.scenes[1],id:'scene_c'});},
  ]) {const invalid=structuredClone(changed);mutate(invalid);assert.throws(()=>validatePlanningResult(invalid,request));}
});

test('whole-script rewrite requires an explicit saved empty scene scope',()=>{
  const p=revise(currentProject(),[]),request=prepare(p,'revise_script').request,changed=document();changed.title='The Quiet Departure';changed.scenes[0].action='Mira burns the letter.';
  assert.deepEqual(validatePlanningResult(changed,request),changed);
  const badContext=JSON.parse(request.body.input).context;badContext.screenplay.revisionRequest.sceneIds=['unavailable_scene'];
  const invalidRequest=buildPlanningRequest({brief:'A station story.',duration:60,model:request.model,maxOutputTokens:2000,operation:'revise_script',context:badContext});
  assert.throws(()=>validatePlanningResult(changed,invalidRequest),blocked);
});

test('screenplay runtime rejects unknown fields duplicate IDs broken speakers and invalid estimates',()=>{
  const request=prepare(project()).request;
  for(const mutate of [d=>{d.originality='certified';},d=>{d.scenes[0].extra='ignored';},d=>{d.scenes[1].id=d.scenes[0].id;},d=>{d.characters.push({...d.characters[0]});},d=>{d.scenes[1].dialogue.push({...d.scenes[0].dialogue[0]});},d=>{d.scenes[0].dialogue[0].characterId='missing';},d=>{d.scenes[0].durationSeconds=0;},d=>{d.scenes[0].durationSeconds=Infinity;},d=>{d.scenes[0].durationSeconds=3601;},d=>{d.scenes[0].id='../escape';},d=>{d.logline='';},d=>{d.scenes=[];}]){
    const invalid=document();mutate(invalid);assert.throws(()=>validatePlanningResult(invalid,request));
  }
});

test('screenplay submit and known-ID polling preserve identity usage and no automatic application',async()=>{
  const calls=[],provider=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async(url,options)=>{calls.push({url,method:options.method});return{ok:true,json:async()=>completed(document())};}}),request=prepare(project()).request;
  const response=await provider.submit({request,authorized:true});
  assert.deepEqual(response.screenplay,document());assert.equal(response.plan,undefined);assert.equal(response.briefProposal,undefined);assert.equal(response.applied,undefined);
  const polled=await provider.poll({responseId:response.id,request});assert.deepEqual(polled.screenplay,document());
  assert.deepEqual(response.usage,{inputTokens:30,outputTokens:60,cachedInputTokens:5});
  assert.deepEqual(calls.map(call=>call.method),['POST','GET']);
});

test('malformed screenplay retains usage response identity and failure without paid repair',async()=>{
  const malformed=document();malformed.scenes[0].dialogue[0].characterId='invented_speaker';let calls=0;
  const provider=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async()=>{calls++;return{ok:true,json:async()=>completed(malformed)};}});
  const response=await provider.submit({request:prepare(project()).request,authorized:true});
  assert.equal(response.id,'resp_screenplay');assert.equal(response.status,'completed');assert.equal(response.screenplay,undefined);assert.equal(response.plan,undefined);assert.ok(response.planError);assert.equal(response.usage.outputTokens,60);assert.equal(calls,1);
});

test('saved v2 response polling remains recoverable but cannot smuggle a v3 writing operation',async()=>{
  const plan={title:'Rain',treatment:'An observation.',scenes:[{id:'s1',description:'A station.'}],shots:[{id:'shot1',sceneId:'s1',description:'A lamp in rain.',durationSeconds:5,dialogue:'',camera:'Static.',continuity:'Same lamp.'}]};
  const current=buildPlanningRequest({brief:'Rain at the station.',duration:5,model:'writing-test-model',maxOutputTokens:1000}),saved={...current,version:'director-planning-v2'};saved.requestHash=hash({version:saved.version,body:saved.body});
  const methods=[],provider=createPlanningProvider({env:{OPENAI_API_KEY:'test-secret'},fetcher:async(url,options)=>{methods.push(options.method);return{ok:true,json:async()=>completed(plan)};}});
  const response=await provider.poll({responseId:'resp_screenplay',request:saved});assert.deepEqual(response.plan,plan);assert.deepEqual(methods,['GET']);
  const forged=prepare(project()).request;forged.version='director-planning-v2';forged.requestHash=hash({version:forged.version,body:forged.body});
  await assert.rejects(provider.poll({responseId:'resp_screenplay',request:forged}),blocked);assert.deepEqual(methods,['GET']);
});

test('new writing operations require explicit creative policy and matching exact cache scope',()=>{
  const p=project(),scope=planningScope(p,approvals(p)),request=prepare(p).request;
  assert.equal(decidePlanningPath({operation:'write_script',requestHash:request.requestHash,scope,policy:{creativePlanningEnabled:true,allowedOperations:['write_script']}}).path,'llm');
  assert.equal(decidePlanningPath({operation:'revise_script',requestHash:request.requestHash,scope,policy:{creativePlanningEnabled:true,allowedOperations:['write_script']}}).path,'blocked');
  const cache={approved:true,operation:'write_script',requestHash:request.requestHash,...scope,result:document(),resultHash:hash(document())};
  assert.equal(decidePlanningPath({operation:'write_script',requestHash:request.requestHash,scope,cache}).path,'cache');
  const changed=structuredClone(p);changed.screenplay={sources:[],currentVersion:0,versions:[],revisionRequest:null,reviews:[]};
  assert.equal(decidePlanningPath({operation:'write_script',requestHash:request.requestHash,scope:planningScope(changed,approvals(changed)),cache}).path,'blocked');
});

test('film and brief planning retain bounded contexts while writing has its explicit separate context',()=>{
  const p=project(),filmContext=planningCreativeContext(p,approvals(p));assert.equal(filmContext.screenplay,undefined);
  assert.deepEqual(planningCreativeContext(p,approvals(p),'write_script').screenplay,screenplayPlanningContext(p));
  const context=planningCreativeContext(p,approvals(p),'write_script');context.screenplay.sources[0]={text:'x'.repeat(180001)};
  assert.throws(()=>buildPlanningRequest({brief:'A film',duration:60,model:'writing-test-model',maxOutputTokens:1000,operation:'write_script',context}),/bounded creative context/);
});
