import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash} from '../domain.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {applyScreenplayCommand} from '../public/screenplay-core.js';
import {applyDepartmentCommand,departmentPlanningContext} from '../public/department-plan-core.js';
import {applyReferenceProductionCommand,referenceProductionContext} from '../public/reference-production-core.js';
import {buildReferenceInput,referenceInputForEndpoint,referenceImageOutput,REFERENCE_PROMPT_MAX_BYTES} from '../reference-input.mjs';
import {reviewedFalInputSchema,validateFalInput,createProviderClients,FAL_ENDPOINTS} from '../providers.mjs';

// Offline adapters and synthetic source/approval records only. No paid calls.
const now='2026-10-19T00:00:00.000Z',pro='fal-ai/flux-2-pro',klein='fal-ai/flux-2/klein/9b',edit='bytedance/seedream/v5/pro/edit';
const identityUrl='https://reference-fixture.supabase.co/storage/v1/object/sign/director-reference-media/owner/project/identity.png?token=synthetic-private-token';
const script=()=>({title:'The Letter',logline:'Mira waits for the last train.',treatment:'A restrained observation of a promise.',characters:[{id:'mira',name:'Mira',description:'A station keeper carrying the letter; other appearance details remain undecided.'}],scenes:[{id:'station',heading:'INT. STATION — NIGHT',action:'Mira holds the original folded letter beside a practical lamp.',dialogue:[{id:'line_a',characterId:'mira',text:'EXACT_DIALOGUE_EXCLUDED_FROM_IMAGE_INPUT',direction:'Quietly.'}],durationSeconds:60}]});
const baseApprovals=p=>[{artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved'},{artifactId:'screenplay',version:p.screenplay.currentVersion,decision:'approved'}];
const approvals=p=>[...baseApprovals(p),...departmentPlanningContext(p,baseApprovals(p)).departments.map(unit=>({artifactId:'department:'+unit.id,version:unit.current.version,decision:'approved'})),...(p.referenceProduction?.subjects||[]).filter(s=>s.kind!=='character_look'||s.versions.at(-1).identityBinding).map(s=>({artifactId:'reference_brief:'+s.id,version:s.currentVersion,decision:'approved'}))];
function project(){
 let p={id:'project',ownerId:'owner',title:'The Letter',premise:'A station keeper finds a letter from tomorrow.',direction:'Approved deliberate watercolor treatment.',language:'Hinglish',duration:60,format:'short_film',version:1,createdAt:now};
 p=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});
 p=applyBriefCommand(p,{expectedVersion:p.version,action:'update',changes:{visualStyle:'Deliberate watercolor illustration with visible paper grain.',setting:'The specified station at night.',tone:'Quiet and restrained.',constraints:['Keep the original folded letter.','Do not add a label or logo.']}});
 p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'save',document:script()});
 p=applyDepartmentCommand(p,{expectedVersion:p.version,action:'prepare'},baseApprovals(p));
 return applyReferenceProductionCommand(p,{expectedVersion:p.version,action:'prepare'},approvals(p));
}
const subject=(p,id='identity:mira')=>referenceProductionContext(p,approvals(p)).subjects.find(s=>s.id===id);
const build=(p=project(),id='identity:mira',endpoint=pro)=>buildReferenceInput({project:p,subject:subject(p,id),model:{endpoint}});
function context(input){return JSON.parse(input.prompt.split('\n\nREVIEWED_REFERENCE_CONTEXT_JSON\n')[1]);}
function lookedProject(){
 const p=project(),identity=p.referenceProduction.subjects.find(s=>s.id==='identity:mira'),selection={version:1,subjectId:identity.id,subjectVersion:identity.currentVersion,candidateId:'11111111-1111-4111-8111-111111111111',assetId:'22222222-2222-4222-8222-222222222222',assetVersion:1,review:{criteriaAcknowledged:true},createdAt:now};
 p.referenceProduction.selections.push(selection);
 const look=p.referenceProduction.subjects.find(s=>s.id==='look:mira');
 look.versions.at(-1).identityBinding={subjectId:identity.id,subjectVersion:identity.currentVersion,selectionVersion:1,assetId:selection.assetId,assetVersion:1};
 // Provider compiler receives this row only from server context; actual owned
 // asset and approval validation are independently exercised by API/store QA.
 const row={...subject(p,'look:mira'),directionApproved:true,sourceStale:false,identityStale:false};
 return {p,row};
}
const output=(extra={})=>({images:[{url:'https://v3.fal.media/files/candidate.png',content_type:'image/png',width:1024,height:1024}],has_nsfw_concepts:[false],...extra});

test('additive live schemas leave all previously reviewed input schemas unchanged',()=>{
 const historical=JSON.parse(readFileSync(new URL('../../../docs/evidence/FAL_ENDPOINT_SCHEMAS.json',import.meta.url)));
 for(const entry of historical.endpoints.filter(e=>['minimax/h3-max/reference-to-video','elevenlabs/tts/eleven-v4','bytedance/seedream/v5/pro/edit'].includes(e.endpoint_id)))assert.equal(hash(reviewedFalInputSchema(entry.endpoint_id)),hash(entry.schema.input_schema));
 assert(FAL_ENDPOINTS.includes(pro));assert(FAL_ENDPOINTS.includes(klein));assert.equal(reviewedFalInputSchema(pro).properties.num_images,undefined);
 const schema=reviewedFalInputSchema(pro);schema.properties.prompt.type='boolean';assert.equal(reviewedFalInputSchema(pro).properties.prompt.type,'string');
});

test('reference compilation is deterministic and bound to the exact reviewed subject snapshot',()=>{
 const p=project(),row=subject(p),before=structuredClone(p),input=buildReferenceInput({project:p,subject:row,model:{endpoint:pro}});
 assert.deepEqual(input,build(p));assert.deepEqual(p,before);assert.deepEqual(row,subject(p));
 assert.deepEqual(context(input).subject.document,row.current.document);assert.equal(context(input).subject.version,row.current.version);
 const forged=structuredClone(row);forged.current.document.direction='An unsaved new appearance.';assert.throws(()=>buildReferenceInput({project:p,subject:forged,model:{endpoint:pro}}),/direction or its bound/);
});

test('image context retains complete selected source fields and excludes unrelated screenplay dialogue',()=>{
 const p=project(),input=build(p),ctx=context(input);
 assert.deepEqual(ctx.sourceSubject,script().characters[0]);assert.deepEqual(ctx.brief.visualStyle,p.creativeBrief.versions.at(-1).fields.visualStyle);assert.deepEqual(ctx.brief.constraints,p.creativeBrief.versions.at(-1).fields.constraints);
 assert.deepEqual(ctx.departments.map(d=>d.id),['casting','look','locations','lighting','continuity','rights']);
 for(const dept of ctx.departments)assert.deepEqual(dept.document,p.departmentPlanning.departments.find(d=>d.id===dept.id).versions.at(-1).document);
 assert.equal(input.prompt.includes(script().scenes[0].dialogue[0].text),false);assert.equal(input.prompt.includes('Do not infer age, ethnicity'),true);assert.equal(input.prompt.includes('do not impose photographic realism'),true);
 const location=context(build(p,'location:station'));assert.deepEqual(location.sourceSubject,{id:'station',heading:script().scenes[0].heading,action:script().scenes[0].action});assert.equal('dialogue' in location.sourceSubject,false);
});

test('source, department, snapshot and approval changes hold reference compilation before any call',()=>{
 const p=project(),row=subject(p);
 for(const mutate of [x=>x.direction='A changed source.',x=>x.departmentPlanning.departments.find(d=>d.id==='voice').currentVersion++,x=>x.referenceProduction.subjects.find(s=>s.id===row.id).versions.at(-1).document.anchor='An unsaved replacement.']){
  const changed=structuredClone(p);mutate(changed);assert.throws(()=>buildReferenceInput({project:changed,subject:row,model:{endpoint:pro}}),/direction or its bound/);
 }
 for(const changes of [{directionApproved:false},{sourceStale:true},{identityStale:true}])assert.throws(()=>buildReferenceInput({project:p,subject:{...row,...changes},model:{endpoint:pro}}),/Approve the current reference/);
 assert.throws(()=>build(p,'identity:mira',edit),/does not match/);assert.throws(()=>build(p,'identity:mira','unknown/endpoint'),/does not match/);
});

test('FLUX pro uses exactly the fixed single-request 1024 PNG configuration without unsupported num_images',()=>{
 const input=build();assert.deepEqual(input.image_size,{width:1024,height:1024});assert.equal(input.output_format,'png');assert.equal(input.sync_mode,false);assert.equal(input.enable_safety_checker,true);assert.equal(input.safety_tolerance,'2');assert.equal('num_images' in input,false);assert.equal('image_urls' in input,false);
 assert.deepEqual(validateFalInput(pro,input),input);
 for(const changes of [{num_images:1},{image_size:'square_hd'},{image_size:{width:1024}},{image_size:{width:2048,height:1024}},{image_size:{width:1024,height:1024,depth:1}},{output_format:'jpeg'},{sync_mode:true},{enable_safety_checker:false},{safety_tolerance:'5'},{safety_tolerance:undefined},{prompt:'   '}])assert.throws(()=>validateFalInput(pro,{...input,...changes}));
 assert.throws(()=>validateFalInput(pro,Object.create(input)));assert.throws(()=>validateFalInput(pro,{...input,image_size:Object.create({width:1024,height:1024})}));
});

test('FLUX Klein uses one four-step output and rejects unreviewed batches, steps, sizes and fallback fields',()=>{
 const input=build(project(),'identity:mira',klein);assert.equal(input.num_images,1);assert.equal(input.num_inference_steps,4);assert.equal(input.output_format,'png');
 for(const changes of [{num_images:2},{num_images:undefined},{num_inference_steps:8},{num_inference_steps:undefined},{image_size:{width:1024,height:512}},{fallback:'other/model'},{image_urls:[identityUrl]}])assert.throws(()=>validateFalInput(klein,{...input,...changes}));
});

test('look generation binds the exact selected identity and preserves the private signed URL only in image_urls',()=>{
 const {p,row}=lookedProject(),input=buildReferenceInput({project:p,subject:row,model:{endpoint:edit},identityUrl});
 assert.deepEqual(input.image_urls,[identityUrl]);assert.equal(input.num_images,1);assert.equal(input.enhance_prompt_mode,'standard');assert.equal(input.output_format,'png');assert.deepEqual(input.image_size,{width:1024,height:1024});assert.deepEqual(context(input).identityBinding,row.current.identityBinding);
 assert.equal(input.prompt.includes('synthetic-private-token'),false);assert.equal(input.prompt.includes('preserving facial identity'),true);
 for(const value of [undefined,'http://reference-fixture.supabase.co/storage/v1/object/sign/bucket/image.png?token=x','https://public.example/image.png','https://reference-fixture.supabase.co/storage/v1/object/public/bucket/image.png','https://user:pass@reference-fixture.supabase.co/storage/v1/object/sign/bucket/image.png?token=x','https://reference-fixture.supabase.co/storage/v1/object/sign/bucket/image.png'])assert.throws(()=>buildReferenceInput({project:p,subject:row,model:{endpoint:edit},identityUrl:value}),/signed/);
 assert.throws(()=>buildReferenceInput({project:p,subject:row,model:{endpoint:pro},identityUrl}),/does not match/);
 const initial=project();assert.throws(()=>buildReferenceInput({project:initial,subject:subject(initial),model:{endpoint:pro},identityUrl}),/without an input identity/);
});

test('replacing an identity selection invalidates a saved look even if a caller passes stale approval booleans',()=>{
 const {p,row}=lookedProject();p.referenceProduction.selections.push({...p.referenceProduction.selections[0],version:2,assetId:'33333333-3333-4333-8333-333333333333'});
 assert.throws(()=>buildReferenceInput({project:p,subject:row,model:{endpoint:edit},identityUrl}),/current approved, selected identity/);
});

test('reference input limits count UTF8 bytes and never silently truncate source constraints',()=>{
 const p=project(),record=p.referenceProduction.subjects.find(s=>s.id==='identity:mira');record.versions.at(-1).document.mustPreserve=Array.from({length:30},()=>('保'.repeat(2000)));
 const row=subject(p);assert.throws(()=>buildReferenceInput({project:p,subject:row,model:{endpoint:pro}}),/No included source text was truncated/);
 const text='保'.repeat(Math.floor(REFERENCE_PROMPT_MAX_BYTES/3)+1);assert.throws(()=>referenceInputForEndpoint(pro,{prompt:text}),/bounded/);assert.throws(()=>validateFalInput(pro,{...referenceInputForEndpoint(pro,{prompt:'small'}),prompt:text}),/bounded/);
});

test('submission is one explicitly authorized async POST with no automatic retry or server-controlled response URL',async()=>{
 const calls=[],client=createProviderClients({env:{FAL_API_KEY:'synthetic-never-sent'},fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({request_id:'reference_1',status:'IN_QUEUE',response_url:'https://attacker.example/response'})};}}),input=build();
 await assert.rejects(client.submitFalJob({endpoint:pro,input}),/Explicit server authorization/);assert.equal(calls.length,0);
 const saved=await client.submitFalJob({endpoint:pro,input,authorized:true});assert.equal(calls.length,1);assert.equal(calls[0].url,'https://queue.fal.run/'+pro);assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.headers['X-Fal-No-Retry'],'1');assert.equal(calls[0].options.headers['x-app-fal-disable-fallback'],'true');assert.equal(saved.responseUrl,'https://queue.fal.run/fal-ai/flux-2-pro/requests/reference_1');assert.deepEqual(JSON.parse(calls[0].options.body),input);
 await client.getFalJob({endpoint:klein,requestId:'known_klein',result:true});assert.equal(calls.at(-1).url,'https://queue.fal.run/fal-ai/flux-2/requests/known_klein');
});

test('ambiguous submit failure does not retry, and known queue polling does not resubmit',async()=>{
 let calls=0;const client=createProviderClients({env:{FAL_API_KEY:'synthetic'},fetcher:async()=>{calls++;throw Error('Simulated ambiguous transport.');}});
 await assert.rejects(client.submitFalJob({endpoint:pro,input:build(),authorized:true}),/ambiguous transport/);assert.equal(calls,1);
 await assert.rejects(client.getFalJob({endpoint:pro,requestId:'known_request'}),/ambiguous transport/);assert.equal(calls,2);
 await assert.rejects(client.getFalJob({endpoint:pro,requestId:'../../forged'}),/Invalid request ID/);assert.equal(calls,2);
});

test('one trusted output descriptor is normalized without asserting absent metadata or fetching media',()=>{
 const descriptor=referenceImageOutput(pro,output());assert.deepEqual(descriptor,{url:'https://v3.fal.media/files/candidate.png',mime:'image/png',width:1024,height:1024});
 assert.deepEqual(referenceImageOutput(edit,{images:[{url:'https://fal.media/files/unreported.png'}]}),{url:'https://fal.media/files/unreported.png',mime:null,width:null,height:null});
 assert.deepEqual(referenceImageOutput(klein,output()),descriptor);
});

test('unexpected output quantity, safety flags and missing Klein safety evidence are held',()=>{
 for(const value of [{images:[]},{images:[...output().images,...output().images]},output({has_nsfw_concepts:[true]}),output({has_nsfw_concepts:[]}),output({has_nsfw_concepts:['false']}),output({has_nsfw_concepts:[false,false]})])assert.throws(()=>referenceImageOutput(pro,value));
 assert.throws(()=>referenceImageOutput(klein,{images:output().images}),/required safety/);assert.throws(()=>referenceImageOutput('unreviewed/model',output()),/Unsupported/);
});

test('output descriptors reject SSRF, credentials, non-PNG, size and dimension mismatches before ingestion',()=>{
 for(const url of ['http://v3.fal.media/file.png','https://fal.media.attacker.test/file.png','https://attacker.test/fal.media/file.png','https://127.0.0.1/file.png','https://user:secret@fal.media/file.png','https://v3.fal.media:8443/file.png','https://v3.fal.media/file.png#fragment','data:image/png;base64,AAAA'])assert.throws(()=>referenceImageOutput(pro,{images:[{url}]}));
 for(const changes of [{content_type:'image/jpeg'},{width:2048},{width:'1024'},{height:1023},{file_size:10*1024*1024+1},{file_size:-1},{file_size:1.2}])assert.throws(()=>referenceImageOutput(pro,{images:[{...output().images[0],...changes}]}));
});

test('observed discovery evidence does not claim approval, completed execution or an unambiguous Klein tariff',()=>{
 const evidence=JSON.parse(readFileSync(new URL('../../../docs/evidence/FAL_REFERENCE_ENDPOINTS_2026-10-19.json',import.meta.url)));
 assert.equal(evidence.adapter.paidCallsMade,0);assert.equal(evidence.adapter.qualityValidated,false);assert.equal(evidence.adapter.executionTested,false);
 assert.equal(evidence.endpoints.find(e=>e.endpoint_id===pro).configuredCandidate.proposedUnit,'request');assert.equal(evidence.endpoints.find(e=>e.endpoint_id===pro).configuredCandidate.proposedUnitMicroUsd,30000);assert.equal(evidence.endpoints.find(e=>e.endpoint_id===klein).configuredCandidate.status,'held_ambiguous_rounding');
 assert.equal(JSON.stringify(evidence).includes('fal account:'),false);
});
