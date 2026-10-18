import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanningRequest, quotePlanningBound, calculatePlanningCost, createPlanningProvider, validatePlanningResult } from '../planning-provider.mjs';
const now = '2026-10-18T00:00:00Z';
const request = () => buildPlanningRequest({ brief: 'A quiet realistic rain scene.', refs: ['A blue coat remains dry indoors.'], duration: 5, model: 'configured-story-model', maxOutputTokens: 1000 });
const pricing = () => ({ verified: true, model: 'configured-story-model', version: 'price-v1', currency: 'USD', expiresAt: '2026-10-19T00:00:00Z', sourceUrl: 'https://openai.com/api/pricing/', input: { numeratorMicroUsd: 3, denominatorTokens: 2 }, cachedInput: { numeratorMicroUsd: 1, denominatorTokens: 2 }, output: { numeratorMicroUsd: 8, denominatorTokens: 1 } });
const evidence = req => ({ verified: true, type: 'trusted-tokenizer-upper-bound', sourceUrl: 'https://studio.example/tokenizer', expiresAt: '2026-10-19T00:00:00Z', model: req.model, requestHash: req.requestHash, tokenizerVersion: 'trusted-tokenizer-v1', inputTokenUpperBound: 500 });
const blocked = error => error.status === 409;
test('planning request is bounded versioned deterministic and exact-hash bound', () => {
  const a = request(); assert.deepEqual(a, request());
  assert.equal(a.body.background, true); assert.equal(a.body.store, true);
  assert.equal(a.body.max_output_tokens, 1000); assert.equal(a.body.text.format.strict, true);
  const different = buildPlanningRequest({ brief: 'A different scene.', duration: 5, model: a.model, maxOutputTokens: 1000 });
  assert.notEqual(a.requestHash, different.requestHash);
});
test('planning upper bound requires trusted tokenizer evidence for the complete request', () => {
  const req = request(); const result = quotePlanningBound({ request: req, pricing: pricing(), tokenEvidence: evidence(req), now });
  assert.equal(result.totalMicroUsd, 8750); assert.equal(result.outputTokenUpperBound, 1000);
  for (const tokenEvidence of [undefined, { ...evidence(req), verified: false }, { ...evidence(req), requestHash: 'stale' }, { ...evidence(req), model: 'other' }, { ...evidence(req), tokenizerVersion: '' }]) assert.throws(() => quotePlanningBound({ request: req, pricing: pricing(), tokenEvidence, now }), blocked);
  req.body.input += ' '; assert.throws(() => quotePlanningBound({ request: req, pricing: pricing(), tokenEvidence: evidence(req), now }), blocked);
});
test('actual token costs split cached input and round safely with no double charge', () => {
  const result = calculatePlanningCost({ pricing: pricing(), model: 'configured-story-model', inputTokens: 10, cachedInputTokens: 4, outputTokens: 2, now });
  assert.equal(result.totalMicroUsd, 27);
  assert.deepEqual(result.components.map(c => c.tokens), [6,4,2]);
  assert.throws(() => calculatePlanningCost({ pricing: pricing(), model: 'configured-story-model', inputTokens: 1, cachedInputTokens: 2, outputTokens: 1, now }), blocked);
  const expired = pricing(); expired.expiresAt = now;
  assert.throws(() => calculatePlanningCost({ pricing: expired, model: 'configured-story-model', inputTokens: 1, outputTokens: 1, now }), blocked);
  assert.throws(() => calculatePlanningCost({ pricing: pricing(), model: 'other', inputTokens: 1, outputTokens: 1, now }), blocked);
});
test('background submission is server-authorized and polling never submits again', async () => {
  const calls = [];
  const provider = createPlanningProvider({ env: { OPENAI_API_KEY: 'secret' }, fetcher: async (url, options) => { calls.push({url,options}); return {ok: true, json: async () => ({id:'resp_123',status:'queued'})}; } });
  await assert.rejects(provider.submit({request:request()}), blocked); assert.equal(calls.length,0);
  const response = await provider.submit({request:request(),authorized:true}); assert.equal(response.id,'resp_123');
  await provider.poll({responseId:'resp_123'}); await provider.poll({responseId:'resp_123'});
  assert.deepEqual(calls.map(c => c.options.method), ['POST','GET','GET']);
  assert.equal(calls[1].url,'https://api.openai.com/v1/responses/resp_123');
  await assert.rejects(provider.poll({responseId:'../other'})); assert.equal(calls.length,3);
});
test('uncertain transport outcome is propagated without retry or invented plan', async () => {
  let calls = 0;
  const provider = createPlanningProvider({ env: {OPENAI_API_KEY:'secret'}, fetcher: async () => {calls++;throw new Error('timeout');} });
  await assert.rejects(provider.submit({request:request(),authorized:true}),/timeout/); assert.equal(calls,1);
});
test('completed malformed screenplay retains response and measured usage for reconciliation', async () => {
  const provider = createPlanningProvider({ env: { OPENAI_API_KEY: 'secret' }, fetcher: async () => ({ ok: true, json: async () => ({ id: 'resp_123', status: 'completed', usage: {input_tokens: 10, output_tokens: 5, input_tokens_details:{cached_tokens:2}}, output: [] }) }) });
  const response = await provider.poll({responseId:'resp_123'});
  assert.equal(response.id,'resp_123'); assert.equal(response.plan,undefined); assert.ok(response.planError);
  assert.deepEqual(response.usage,{inputTokens:10,outputTokens:5,cachedInputTokens:2});
});
test('missing models raw media references and invalid output limits cannot produce requests', () => {
  for (const patch of [{model:undefined},{refs:[{image_url:'https://assets.example/a.png'}]},{maxOutputTokens:0},{duration:0}]) assert.throws(() => buildPlanningRequest({brief:'A scene',duration:5,model:'configured-story-model',maxOutputTokens:100,...patch}));
});

test('token bound provenance must be fresh and context-window claims reserve the full verified window', () => {
  const req = request();
  for (const patch of [{expiresAt:now},{sourceUrl:'http://unverified.example'},{type:'characters-divided-by-four'}]) assert.throws(() => quotePlanningBound({request:req,pricing:pricing(),tokenEvidence:{...evidence(req),...patch},now}),blocked);
  const context={...evidence(req),type:'context-window-upper-bound',contextWindowTokens:1047576,inputTokenUpperBound:1047576};
  const quote=quotePlanningBound({request:req,pricing:pricing(),tokenEvidence:context,now});
  assert.equal(quote.inputTokenUpperBound,1047576); assert.equal(quote.quoteKind,'maximum_reservation_not_expected_cost');
  assert.throws(() => quotePlanningBound({request:req,pricing:pricing(),tokenEvidence:{...context,inputTokenUpperBound:500},now}),blocked);
});
test('missing usage metadata preserves accepted response identity and unresolved accounting', async () => {
  const provider=createPlanningProvider({env:{OPENAI_API_KEY:'secret'},fetcher:async()=>({ok:true,json:async()=>({id:'resp_123',status:'completed',usage:{input_tokens:10,output_tokens:1},output:[]})})});
  const response=await provider.poll({responseId:'resp_123'});
  assert.equal(response.id,'resp_123');assert.equal(response.usage,null);assert.ok(response.usageError);assert.ok(response.planError);
});

test('unknown provider status preserves accepted identity and usage without retry', async () => {
  let calls=0;
  const provider=createPlanningProvider({env:{OPENAI_API_KEY:'secret'},fetcher:async()=>{calls++;return{ok:true,json:async()=>({id:'resp_123',status:'new_provider_state',usage:{input_tokens:10,output_tokens:1,input_tokens_details:{cached_tokens:0}}})};}});
  const response=await provider.submit({request:request(),authorized:true});
  assert.equal(response.id,'resp_123');assert.equal(response.status,'unknown');assert.ok(response.normalizationError);
  assert.deepEqual(response.usage,{inputTokens:10,outputTokens:1,cachedInputTokens:0});assert.equal(calls,1);
});
test('malformed completed output retains response identity instead of throwing after submission', async () => {
  for(const output of [{not:'an array'},[null],[{content:{not:'an array'}}],[{content:[null]}],[{content:[{type:'output_text',text:{not:'text'}}]}]]){
    let calls=0;
    const provider=createPlanningProvider({env:{OPENAI_API_KEY:'secret'},fetcher:async()=>{calls++;return{ok:true,json:async()=>({id:'resp_123',status:'completed',output})};}});
    const response=await provider.submit({request:request(),authorized:true});
    assert.equal(response.id,'resp_123');assert.equal(response.plan,undefined);assert.equal(response.status,'unknown');assert.equal(response.usage,null);assert.ok(response.normalizationError);assert.equal(calls,1);
  }
});

const validPlan=()=>({title:'Rain',treatment:'A quiet observation.',scenes:[{id:'s1',description:'A room.'}],shots:[{id:'shot1',sceneId:'s1',description:'A person observes rain.',durationSeconds:5,dialogue:'',camera:'Locked medium shot.',continuity:'Dry blue coat.'}]});
test('result validator enforces unique identities scene membership and authorized duration',()=>{
 assert.deepEqual(validatePlanningResult(validPlan(),request()),validPlan());
 for(const mutate of [p=>{p.scenes.push({...p.scenes[0]});},p=>{p.shots.push({...p.shots[0]});},p=>{p.shots[0].sceneId='missing';},p=>{p.shots[0].durationSeconds=-1;},p=>{p.shots[0].durationSeconds=16;},p=>{p.shots[0].durationSeconds=4;},p=>{p.shots[0].id='';}]){
  const plan=validPlan();mutate(plan);assert.throws(()=>validatePlanningResult(plan,request()));
 }
});
test('invalid creative result retains usage and accepted identity on submission and saved-request polling',async()=>{
 const plan=validPlan();plan.shots[0].durationSeconds=4;
 const data={id:'resp_123',status:'completed',usage:{input_tokens:10,output_tokens:5,input_tokens_details:{cached_tokens:0}},output:[{content:[{type:'output_text',text:JSON.stringify(plan)}]}]};
 const calls=[];
 const provider=createPlanningProvider({env:{OPENAI_API_KEY:'secret'},fetcher:async(url,options)=>{calls.push(options.method);return{ok:true,json:async()=>data};}});
 for(const snapshot of [await provider.submit({request:request(),authorized:true}),await provider.poll({responseId:'resp_123',request:request()})]){
  assert.equal(snapshot.id,'resp_123');assert.equal(snapshot.plan,undefined);assert.ok(snapshot.planError);assert.equal(snapshot.usage.outputTokens,5);
 }
 assert.deepEqual(calls,['POST','GET']);
});

const briefFields=['purpose','audience','audienceResponse','platform','aspectRatio','visualStyle','tone','setting','cast','voice','product','constraints','budget','format','duration','language'];
function briefRequest(context={inputSignature:'input-signature',structuredBrief:null,status:'needs_review',approved:false}){return buildPlanningRequest({brief:'A quiet realistic rain scene.',refs:[],duration:5,model:'configured-story-model',maxOutputTokens:1000,operation:'interpret_brief',context});}
function briefProposal(){return{inputSignature:'input-signature',fields:Object.fromEntries(briefFields.map(key=>[key,{value:null,status:'unknown',source:'model',evidence:[]}]))};}
test('interpret brief uses separate strict schema operation and hashed saved context',()=>{
 const req=briefRequest();assert.equal(req.version,'director-planning-v2');assert.equal(req.operation,'interpret_brief');assert.equal(req.body.text.format.name,'creative_brief_proposal');
 assert.equal(req.body.text.format.schema.additionalProperties,false);assert.deepEqual(req.body.text.format.schema.properties.fields.required,briefFields);
 assert.notEqual(req.requestHash,briefRequest({inputSignature:'changed',approved:false}).requestHash);
 assert.deepEqual(validatePlanningResult(briefProposal(),req),briefProposal());
 assert.notEqual(req.body.instructions,request().body.instructions);
});
test('model brief cannot claim explicit provenance invent evidence change signature or fill unknown values',()=>{
 for(const mutate of [p=>{p.fields.purpose.source='user';},p=>{p.fields.purpose.status='explicit';},p=>{p.fields.purpose.value='Not unknown';},p=>{p.inputSignature='different';},p=>{p.fields.purpose.evidence=['invented research'];},p=>{p.fields.extra={value:null,status:'unknown',source:'model',evidence:[]};}]){
  const proposal=briefProposal();mutate(proposal);assert.throws(()=>validatePlanningResult(proposal,briefRequest()));
 }
 const hypothesis=briefProposal();hypothesis.fields.visualStyle={value:'photographic realism',status:'inferred',source:'model',evidence:['realistic rain scene']};
 assert.equal(validatePlanningResult(hypothesis,briefRequest()).fields.visualStyle.status,'inferred');
});
test('interpret response returns proposal without film plan automatic application or retry',async()=>{
 let calls=0;const output=briefProposal();
 const provider=createPlanningProvider({env:{OPENAI_API_KEY:'secret'},fetcher:async()=>{calls++;return{ok:true,json:async()=>({id:'resp_brief',status:'completed',usage:{input_tokens:20,output_tokens:20,input_tokens_details:{cached_tokens:0}},output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})};}});
 const snapshot=await provider.submit({request:briefRequest(),authorized:true});
 assert.deepEqual(snapshot.briefProposal,output);assert.equal(snapshot.plan,undefined);assert.equal(snapshot.applied,undefined);assert.equal(calls,1);
});
test('invalid interpreted brief preserves provider identity and usage without fabricating a plan',async()=>{
 const output=briefProposal();output.fields.purpose.source='user';
 const provider=createPlanningProvider({env:{OPENAI_API_KEY:'secret'},fetcher:async()=>({ok:true,json:async()=>({id:'resp_brief',status:'completed',usage:{input_tokens:20,output_tokens:20,input_tokens_details:{cached_tokens:0}},output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})})});
 const snapshot=await provider.poll({responseId:'resp_brief',request:briefRequest()});
 assert.equal(snapshot.id,'resp_brief');assert.equal(snapshot.briefProposal,undefined);assert.equal(snapshot.plan,undefined);assert.ok(snapshot.planError);assert.equal(snapshot.usage.outputTokens,20);
});

test('film preparation requires current approved structured brief and hashes bounded decision context',async()=>{
 const {preparePlanningRequest,planningCreativeContext,planningSchemaHash}=await import('../planning-profile.mjs');
 const {briefInputSignature}=await import('../public/creative-brief-core.js');
 const endpoint='https://api.openai.com/v1/responses',version='configured-story-model';
 const model={id:'O-test',provider:'openai',endpoint,model_version:version,active:true,execution_tested:true,quality_validated:true,capabilities:{planning:{enabled:true,version:'v1',background:true,providerRetentionAcknowledged:true,contextWindowTokens:1000,maxOutputTokens:100,maxRequestBytes:100000,tokenBoundEvidence:{verified:true,model:version,contextWindowTokens:1000,type:'context-window-upper-bound',tokenizerVersion:'context-test',sourceUrl:'https://example.com/tokens',expiresAt:'2099-01-01T00:00:00Z'}}},schema_evidence:{verified:true,version:'s1',endpoint,modelVersion:version,inputSchemaHash:planningSchemaHash,sourceUrl:'https://example.com/schema',expiresAt:'2099-01-01T00:00:00Z'},price_version:'price-v1',price_evidence:{...pricing(),expiresAt:'2099-01-01T00:00:00Z'}};
 const project={id:'project',premise:'A rain scene.',direction:'Quiet.',language:'English',format:'short_film',duration:5,story:{treatment:'',scenes:[]}};
 assert.equal(preparePlanningRequest(project,model,'initial_plan',now).request.operation,'initial_plan');
 project.creativeBrief={currentVersion:1,versions:[{version:1,inputSignature:briefInputSignature(project),fields:{},departmentPlan:[],questions:[]}]};
 assert.throws(()=>preparePlanningRequest(project,model,'initial_plan',now),blocked);
 assert.equal(preparePlanningRequest(project,model,'interpret_brief',now).request.operation,'interpret_brief');
 const approvals=[{id:'approval1',artifactId:'brief',version:1,decision:'approved',ordinal:1}];
 const prepared=preparePlanningRequest(project,model,'revise_plan',now,approvals);
 assert.equal(JSON.parse(prepared.request.body.input).context.approved,true);
 assert.deepEqual(JSON.parse(prepared.request.body.input).context,planningCreativeContext(project,approvals));
 const changedApprovals=[...approvals,{id:'approval2',artifactId:'brief',version:1,decision:'approved',ordinal:2}];
 assert.notEqual(planningCreativeContext(project,approvals).approvedDecisionDigest,planningCreativeContext(project,changedApprovals).approvedDecisionDigest);
 project.direction='Changed direction.';
 assert.throws(()=>preparePlanningRequest(project,model,'revise_plan',now,approvals),blocked);
});

test('paid brief field shapes and limits match core and support unevidenced inferred ideas',()=>{
 const allowed=briefProposal();allowed.fields.tone={value:'A restrained, uneasy mood.',status:'inferred',source:'model',evidence:[]};allowed.fields.duration={value:5,status:'inferred',source:'model',evidence:[]};
 assert.equal(validatePlanningResult(allowed,briefRequest()).fields.tone.value,'A restrained, uneasy mood.');
 for(const [key,value] of [['tone',true],['budget',20],['duration',0],['duration',3601],['tone','x'.repeat(2001)],['cast',['x'.repeat(301)]],['cast',[]],['tone','   '],['tone',null]]){
  const proposal=briefProposal();proposal.fields[key]={value,status:'inferred',source:'model',evidence:[]};assert.throws(()=>validatePlanningResult(proposal,briefRequest()));
 }
 const tooMany=briefProposal();tooMany.fields.tone={value:'Quiet',status:'inferred',source:'model',evidence:Array(5).fill('quiet')};assert.throws(()=>validatePlanningResult(tooMany,briefRequest()));
 const longEvidence=briefProposal();longEvidence.fields.tone={value:'Quiet',status:'inferred',source:'model',evidence:['x'.repeat(301)]};assert.throws(()=>validatePlanningResult(longEvidence,briefRequest()));
});

test('planning context preserves current approved character voice and reference constraints only',async()=>{
 const {planningCreativeContext}=await import('../planning-profile.mjs');
 const project={id:'project',premise:'A conversation.',direction:'Quiet.',language:'English',format:'short_film',duration:5,story:{version:2,treatment:'Current revised story.',scenes:[]},shots:[],production:{records:[{id:'character1',type:'character',name:'Mira',currentVersion:2,versions:[{version:1,name:'Mira',content:{wardrobe:'Old red coat'},references:[],dependencies:[]},{version:2,name:'Mira',content:{wardrobe:'Blue coat',identity:'Preserve the approved face.'},references:[{assetId:'portrait',version:1}],dependencies:[]}]},{id:'voice1',type:'voice',name:'Mira voice',currentVersion:1,versions:[{version:1,name:'Mira voice',content:{delivery:'Restrained, never an announcer.',voiceIdentity:'approved-voice-id'},references:[{assetId:'voice-reference',version:1}],dependencies:[]}]}]}};
 const approvals=[{artifactId:'record:character1',version:2,decision:'approved',ordinal:1},{artifactId:'record:voice1',version:1,decision:'approved',ordinal:2},{artifactId:'story',version:1,decision:'approved',ordinal:3}];
 const context=planningCreativeContext(project,approvals);
 assert.equal(context.approvedArtifacts.length,2);assert.ok(JSON.stringify(context.approvedArtifacts).includes('approved-voice-id'));assert.ok(JSON.stringify(context.approvedArtifacts).includes('Blue coat'));assert.ok(!JSON.stringify(context).includes('Old red coat'));
 assert.deepEqual(context.referenceIds,[{assetId:'portrait',version:1},{assetId:'voice-reference',version:1}]);
 const revoked=[...approvals,{artifactId:'record:voice1',version:1,decision:'rejected',ordinal:4}];
 assert.notEqual(planningCreativeContext(project,revoked).approvedDecisionDigest,context.approvedDecisionDigest);
 assert.equal(planningCreativeContext(project,revoked).approvedArtifacts.length,1);
 const huge=structuredClone(project);huge.production.records[0].versions[1].content.identity='x'.repeat(31000);
 assert.throws(()=>planningCreativeContext(huge,approvals),blocked);
});
