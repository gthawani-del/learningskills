import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash} from '../domain.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {applyScreenplayCommand} from '../public/screenplay-core.js';
import {applyDepartmentCommand,departmentPlanningContext} from '../public/department-plan-core.js';
import {applyStoryboardHandoffCommand,currentStoryboardShot,currentStoryboardSequence} from '../public/storyboard-handoff-core.js';
import {applyReferenceProductionCommand,normalizeReferenceProductionArchive} from '../public/reference-production-core.js';
import {storyboardProductionContext,normalizeStoryboardFrameDocument} from '../public/storyboard-production-core.js';
import {buildStoryboardFrameInput,storyboardFrameRequirements,storyboardFrameOutput,STORYBOARD_FRAME_CONFIGURATIONS,STORYBOARD_FRAME_PROMPT_MAX_BYTES} from '../storyboard-frame-input.mjs';
import {reviewedFalInputSchema,validateFalInput,createProviderClients} from '../providers.mjs';

// Deterministic compiler/provider contracts only. These synthetic server rows
// deliberately grant no real approvals, sharing rights, paid jobs or model quality.
const endpoint='bytedance/seedream/v5/pro/edit',now='2026-10-19T00:00:00.000Z';
const uuid=n=>String(n).padStart(8,'0')+'-0000-4000-8000-'+String(n).padStart(12,'0');
const approvedBase=p=>[{artifactId:'brief',version:p.creativeBrief.currentVersion,decision:'approved'},{artifactId:'screenplay',version:p.screenplay.currentVersion,decision:'approved'}];
const approvals=p=>[...approvedBase(p),...departmentPlanningContext(p,approvedBase(p)).departments.map(unit=>({artifactId:'department:'+unit.id,version:unit.current.version,decision:'approved'}))];
function fixture({aspectRatio='16:9',approvedAspect=aspectRatio,characters=1,dedup=false,inferredAspect=false,characterIds=null}={}){
 let project={id:'frame_project',ownerId:'owner',title:'A letter',premise:'A station keeper finds a letter.',direction:'Deliberate watercolor illustration with visible paper grain.',language:'Hinglish',duration:60,format:'short_film',version:1,createdAt:now,story:{version:1,treatment:'',scenes:[]},shots:[],production:{records:[]}};
 project=applyBriefCommand(project,{expectedVersion:project.version,action:'suggest'});
 project=applyBriefCommand(project,{expectedVersion:project.version,action:'update',changes:{aspectRatio:approvedAspect,visualStyle:'Deliberate watercolor illustration with visible paper grain.',setting:'The supplied station at night.',tone:'Restrained.',constraints:['Preserve the original folded letter.','Do not invent product claims or logos.']}});
 if(inferredAspect)Object.assign(project.creativeBrief.versions.at(-1).fields.aspectRatio,{status:'inferred',source:'rule',evidence:[]});
 const people=(characterIds??Array.from({length:characters},(_,i)=>'person_'+i)).map((id,i)=>({id,name:'Keeper '+i,description:'The station keeper role; appearance details are undecided.'}));
 const source={title:'A letter',logline:'A keeper waits.',treatment:'An ordinary moment of trust.',characters:people,scenes:[{id:'station',heading:'INT. STATION — NIGHT',action:'The keepers hold the folded letter beside the practical lamp.',dialogue:[{id:'spoken_line',characterId:people[0].id,text:'CANONICAL_SPOKEN_WORDS_MUST_NOT_BECOME_IMAGE_OVERLAY',direction:'Quietly.'}],durationSeconds:60}]};
 project=applyScreenplayCommand(project,{expectedVersion:project.version,action:'save',document:source});
 project=applyDepartmentCommand(project,{expectedVersion:project.version,action:'prepare'},approvedBase(project));
 project=applyStoryboardHandoffCommand(project,{expectedVersion:project.version,action:'prepare'},approvals(project));
 const shotId=currentStoryboardSequence(project).shots[0].shotId;
 const document={sceneId:'station',title:'The exact start',purpose:'Reveal the letter and motivated practical light.',action:source.scenes[0].action,characterIds:people.map(p=>p.id),dialogueIds:['spoken_line'],durationSeconds:60,timingBasis:'planning_estimate',framing:'Medium, eye level, letter in foreground.',camera:'Camera on the south side at eye level; normal perspective with readable background.',lighting:'Warm practical lamp from frame left, restrained cool window fill from frame right.',startState:'Letter remains folded in the left hand; keeper faces screen right.',endState:'Later motion may unfold the letter; this is not pictured evidence.',continuity:'Preserve left-hand letter, lamp position, facing direction and each approved outfit.',requirements:[{id:'spatial',requirement:'Keep the folded letter on the left and lamp at frame left.',priority:'mandatory',acceptanceEvidence:'Human inspects the stored frame against the exact staging.',failureCondition:'Flipped hands or a changed lamp position.'}],referenceRequirements:[{id:'identity_req',role:'identity',characterIds:[],direction:'Preserve the pictured identity anchors.'},{id:'look_req',role:'look',characterIds:[],direction:'Keep each approved outfit.'},{id:'location_req',role:'location',characterIds:[],direction:'Use the exact station location.'}],controls:[{id:'locked_camera',direction:'The still uses the intended camera position; movement is not demonstrated.',classification:'route_verification_required'}],audioCues:[{id:'future_audio',type:'dialogue',direction:'Canonical speech belongs to future audio; do not render it as text.'}],performancePath:'audio_first'};
 project=applyStoryboardHandoffCommand(project,{expectedVersion:project.version,action:'update',shotId,document},approvals(project));
 project=applyStoryboardHandoffCommand(project,{expectedVersion:project.version,action:'review_sequence',acknowledgeShotChanges:true},approvals(project));
 project=applyReferenceProductionCommand(project,{expectedVersion:project.version,action:'prepare'},approvals(project));
 const assets=[],selected=new Map();let n=0,candidateNumber=1000;
 const select=(subject,asset)=>{
  const event={version:project.referenceProduction.selections.length+1,subjectId:subject.id,subjectVersion:subject.currentVersion,candidateId:uuid(candidateNumber++),assetId:asset.id,assetVersion:asset.version,review:{criteriaAcknowledged:true},createdAt:now};
  project.referenceProduction.selections.push(event);selected.set(subject.id,event);return event;
 };
 const makeAsset=role=>{const id=uuid(++n),asset={id,projectId:project.id,version:1,mime:'image/png',checksum:'a'.repeat(64),storageKey:project.ownerId+'/'+project.id+'/asset_'+n,role,bucket:'director-media'};assets.push(asset);return asset;};
 for(const person of people){const subject=project.referenceProduction.subjects.find(s=>s.id==='identity:'+person.id);select(subject,makeAsset('character_identity'));}
 for(const person of people){
  const subject=project.referenceProduction.subjects.find(s=>s.id==='look:'+person.id),identity=selected.get('identity:'+person.id);
  subject.versions.at(-1).identityBinding={subjectId:identity.subjectId,subjectVersion:identity.subjectVersion,selectionVersion:identity.version,assetId:identity.assetId,assetVersion:identity.assetVersion};
  const asset=dedup?assets.find(a=>a.id===identity.assetId):makeAsset('wardrobe');select(subject,asset);
 }
 select(project.referenceProduction.subjects.find(s=>s.id==='location:station'),makeAsset('location'));
 // The reference archive is real normalized creative data; candidate ownership
 // and actual approval races are independently exercised by HTTP/store QA.
 assert.deepEqual(normalizeReferenceProductionArchive(project.referenceProduction),project.referenceProduction);
 const visible=people.map(p=>p.id).sort(),bindings=[...visible.map(characterId=>({role:'identity',characterId})),...visible.map(characterId=>({role:'look',characterId})),{role:'location',characterId:null}].map(({role,characterId})=>{
  const subjectId=role+':'+(characterId??'station'),selection=selected.get(subjectId);
  return {role,characterId,subjectId,subjectVersion:selection.subjectVersion,selectionVersion:selection.version,assetId:selection.assetId,assetVersion:selection.assetVersion};
 });
 const contract=currentStoryboardShot(project,shotId),sequence=currentStoryboardSequence(project),spec={version:1,contractVersion:contract.version,sourceVersion:contract.sourceVersion,sequenceVersion:sequence.version,document:{direction:'Preserve the exact reviewed staging; make a single proposed start-state frame.',visibleCharacterIds:visible,aspectRatio,referenceBindings:bindings,referenceDecisions:document.referenceRequirements.map(r=>({requirementId:r.id,disposition:'bound',rationale:'Use the exact approved source-compatible image anchors.'}))},createdAt:now};
 project.storyboardProduction={shots:[{shotId,currentVersion:1,versions:[spec]}],selections:[]};
 const unique=[];for(const binding of bindings)if(!unique.some(a=>a.id===binding.assetId&&a.version===binding.assetVersion))unique.push(assets.find(a=>a.id===binding.assetId&&a.version===binding.assetVersion));
 const shot={shotId,current:structuredClone(spec),contract:structuredClone(contract),sourceStale:false,referenceStale:false,directionApproved:true,uniqueReferenceAssets:structuredClone(unique),output:{...STORYBOARD_FRAME_CONFIGURATIONS[aspectRatio],aspectRatio}};
 const referenceUrls=unique.map(asset=>'https://frame-fixture.supabase.co/storage/v1/object/sign/'+asset.bucket+'/'+asset.storageKey+'?token=private_'+asset.id);
 const referenceCandidates=project.referenceProduction.selections.map(s=>({id:s.candidateId,projectId:project.id,subjectId:s.subjectId,subjectVersion:s.subjectVersion,assetId:s.assetId,assetVersion:s.assetVersion,origin:'uploaded',jobId:null,createdAt:now}));
 const approvedRows=[...approvals(project),...project.storyboardHandoff.shots.map(s=>({artifactId:'shot_contract:'+s.id,version:s.currentVersion,decision:'approved'})),{artifactId:'storyboard_sequence',version:sequence.version,decision:'approved'},...project.referenceProduction.subjects.map(s=>({artifactId:'reference_brief:'+s.id,version:s.currentVersion,decision:'approved'})),...project.referenceProduction.selections.map(s=>({artifactId:'reference_selection:'+s.subjectId,version:s.version,decision:'approved'})),{artifactId:'storyboard_brief:'+shotId,version:spec.version,decision:'approved'}];
 return {project,shot,referenceUrls,source,assets,referenceCandidates,approvedRows};
}
const build=f=>buildStoryboardFrameInput({...f,model:{endpoint}});
const context=input=>JSON.parse(input.prompt.split('\n\nREVIEWED_STORYBOARD_FRAME_CONTEXT_JSON\n')[1]);
function resync(f){f.shot.current=structuredClone(f.project.storyboardProduction.shots[0].versions.at(-1));f.shot.contract=structuredClone(currentStoryboardShot(f.project,f.shot.shotId));return f;}
const output=(size,changes={})=>({images:[{url:'https://v3.fal.media/files/frame.png',content_type:'image/png',...size,...changes}],has_nsfw_concepts:[false]});

test('storyboard compiler retains exact camera, lighting, start state, continuity and all reviewed source fields',()=>{
 const f=fixture(),before=structuredClone(f),input=build(f),ctx=context(input);
 assert.deepEqual(build(f),input);assert.deepEqual(f,before);assert.deepEqual(ctx.shotContract.document,f.shot.contract.document);assert.deepEqual(ctx.frameSpec.document,f.shot.current.document);
 assert.deepEqual(ctx.sourceScene,{id:'station',heading:f.source.scenes[0].heading,action:f.source.scenes[0].action});assert.deepEqual(ctx.sourceCharacters,f.source.characters);
 assert.equal(ctx.shotContract.document.camera,f.shot.contract.document.camera);assert.equal(ctx.shotContract.document.lighting,f.shot.contract.document.lighting);assert.equal(ctx.shotContract.document.startState,f.shot.contract.document.startState);assert.equal(ctx.shotContract.document.continuity,f.shot.contract.document.continuity);
 for(const item of ctx.departments)assert.deepEqual(item.document,f.project.departmentPlanning.departments.find(d=>d.id===item.id).versions.at(-1).document);
 assert.equal(ctx.brief.visualStyle.value,'Deliberate watercolor illustration with visible paper grain.');assert.equal(input.prompt.includes(f.source.scenes[0].dialogue[0].text),false);
 assert.match(input.prompt,/START STATE/);assert.match(input.prompt,/future temporal context/);assert.match(input.prompt,/not visible text or evidence of speech/);assert.match(ctx.evidenceScope,/No motion/);
});

test('all three native aspect configurations have exact image-mode route requirements and no square cropping',()=>{
 for(const [aspectRatio,size]of Object.entries(STORYBOARD_FRAME_CONFIGURATIONS)){
  const f=fixture({aspectRatio}),input=build(f);assert.deepEqual(input.image_size,size);assert.equal(input.num_images,1);assert.equal(input.output_format,'png');assert.equal(input.sync_mode,false);assert.equal(input.enable_safety_checker,true);assert.equal(input.enhance_prompt_mode,'standard');
  assert.deepEqual(storyboardFrameRequirements(f.shot),{modality:'image',inputModes:['image','text'],resolution:size.width+'x'+size.height,aspectRatio,identityReferences:true});assert.deepEqual(validateFalInput(endpoint,input),input);
 }
 const unsupported=fixture({approvedAspect:'4:3'});assert.throws(()=>build(unsupported),/aspect must match/);
 assert.doesNotThrow(()=>build(fixture({approvedAspect:'4:3',inferredAspect:true})));assert.throws(()=>storyboardFrameRequirements({current:{document:{aspectRatio:'__proto__'}}}),/supported storyboard frame aspect/);
 const forged=fixture();forged.shot.output.width=1024;assert.throws(()=>build(forged),/dimensions changed/);
});

test('image order follows complete canonical role bindings with no asset or signed-token leaks in the prompt',()=>{
 const f=fixture({characters:2}),input=build(f),ctx=context(input);
 assert.deepEqual(input.image_urls,f.referenceUrls);assert.deepEqual(ctx.inputImages.flatMap(i=>i.roles.map(r=>({role:r.role,characterId:r.characterId}))),f.shot.current.document.referenceBindings.map(({role,characterId})=>({role,characterId})));
 assert.deepEqual(ctx.inputImages.map(i=>i.imageNumber),[1,2,3,4,5]);for(const group of ctx.inputImages)for(const role of group.roles)assert.deepEqual(role.document,f.project.referenceProduction.subjects.find(s=>s.id===role.subjectId).versions.at(-1).document);
 assert.equal(input.prompt.includes('?token='),false);assert.equal(input.prompt.includes('storage/v1/object/sign/'),false);
 const swapped=[...f.referenceUrls];[swapped[0],swapped[1]]=[swapped[1],swapped[0]];assert.throws(()=>buildStoryboardFrameInput({...f,referenceUrls:swapped,model:{endpoint}}),/exact approved private asset/);
});

test('one approved asset may retain identity and look roles while deduplicating image count for tariff calculation',()=>{
 const f=fixture({dedup:true}),input=build(f),images=context(input).inputImages;
 assert.equal(f.shot.current.document.referenceBindings.length,3);assert.equal(input.image_urls.length,2);assert.deepEqual(images[0].roles.map(r=>r.role),['identity','look']);assert.deepEqual(images[1].roles.map(r=>r.role),['location']);assert.equal(images[0].assetId,f.shot.current.document.referenceBindings[0].assetId);
});

test('actual core review context compiles unchanged and revoked source-image approval holds generation',t=>{
 const f=fixture({dedup:true}),facts={assets:f.assets,referenceCandidates:f.referenceCandidates,candidates:[]},ctx=storyboardProductionContext(f.project,f.approvedRows,facts),shot=ctx.shots[0];
 assert.equal(ctx.prerequisites.handoffPlanningApproved,true);assert.equal(shot.directionApproved,true);assert.equal(shot.referenceCount,2);
 const input=buildStoryboardFrameInput({...f,shot,model:{endpoint}});assert.deepEqual(input,build(f));const bytes=Buffer.byteLength(input.prompt,'utf8');assert(bytes<=STORYBOARD_FRAME_PROMPT_MAX_BYTES);t.diagnostic(`Full current own-shot/spec, selected reference documents and nine department documents: ${bytes} prompt bytes; local cap remains ${STORYBOARD_FRAME_PROMPT_MAX_BYTES}.`);
 const binding=shot.current.document.referenceBindings[0],revoked=[...f.approvedRows,{artifactId:'reference_selection:'+binding.subjectId,version:binding.selectionVersion,decision:'revoked'}],stale=storyboardProductionContext(f.project,revoked,facts).shots[0];assert.equal(stale.directionApproved,false);assert.equal(stale.referenceStale,true);assert.throws(()=>buildStoryboardFrameInput({...f,shot:stale,model:{endpoint}}),/Approve the current frame/);
});

test('mixed-case source identifiers preserve deterministic codepoint image ordering across core normalization',()=>{
 const f=fixture({characterIds:['a','Z'],dedup:true}),snapshot=f.project.storyboardProduction.shots[0].versions[0];snapshot.document=normalizeStoryboardFrameDocument(snapshot.document);resync(f);
 assert.deepEqual(snapshot.document.visibleCharacterIds,['Z','a']);assert.deepEqual(snapshot.document.referenceBindings.map(b=>b.role+':'+b.characterId),['identity:Z','identity:a','look:Z','look:a','location:null']);
 assert.deepEqual(build(f).image_urls,f.referenceUrls);
});

test('more than ten distinct required images holds without silently dropping anchors or switching to text-to-image',()=>{
 const f=fixture({characters:5});assert.equal(f.shot.uniqueReferenceAssets.length,11);assert.throws(()=>build(f),/no references were truncated/);
 const simple=fixture();for(const wrong of ['fal-ai/flux-2-pro','fal-ai/flux-2/klein/9b','unreviewed/route'])assert.throws(()=>buildStoryboardFrameInput({...simple,model:{endpoint:wrong}}),/image-edit route/);
 for(const urls of [[],simple.referenceUrls.slice(1),[...simple.referenceUrls,simple.referenceUrls[0]]])assert.throws(()=>buildStoryboardFrameInput({...simple,referenceUrls:urls,model:{endpoint}}),/complete deduplicated/);
});

test('pictured characters are explicit and offscreen source associations cannot force identity imagery',()=>{
 const f=fixture(),snapshot=f.project.storyboardProduction.shots[0].versions[0];snapshot.document.visibleCharacterIds=[];snapshot.document.referenceBindings=snapshot.document.referenceBindings.filter(b=>b.role==='location');snapshot.document.referenceDecisions=snapshot.document.referenceDecisions.map(d=>({...d,disposition:d.requirementId==='location_req'?'bound':'not_applicable',rationale:'No pictured performer is intended; the location remains required.'}));resync(f);
 f.shot.uniqueReferenceAssets=f.shot.uniqueReferenceAssets.filter(a=>a.role==='location');f.referenceUrls=f.referenceUrls.slice(-1);const input=build(f),ctx=context(input);
 assert.deepEqual(ctx.frameSpec.document.visibleCharacterIds,[]);assert.equal(ctx.sourceCharacters.length,1);assert.equal(ctx.inputImages.length,1);assert.deepEqual(ctx.inputImages[0].roles.map(r=>r.role),['location']);assert.match(input.prompt,/never put an offscreen speaker or narrator in the frame/);
});

test('source, contract, spec, review and reference-selection changes reject stale generation context',()=>{
 const f=fixture();
 for(const mutate of [x=>x.project.direction='A changed film direction.',x=>x.project.departmentPlanning.departments.find(d=>d.id==='music').currentVersion++,x=>x.shot.current.document.direction='Unsaved frame change.',x=>x.project.storyboardHandoff.shots[0].versions.at(-1).version++,x=>x.project.referenceProduction.selections.push({...x.project.referenceProduction.selections[0],version:99,assetId:uuid(999)})]){
  const changed=structuredClone(f);mutate(changed);assert.throws(()=>build(changed));
 }
 for(const changes of [{directionApproved:false},{sourceStale:true},{referenceStale:true}])assert.throws(()=>build({...f,shot:{...f.shot,...changes}}),/Approve the current frame/);
 const forged=structuredClone(f);forged.shot.uniqueReferenceAssets[0].projectId='foreign';assert.throws(()=>build(forged),/owned approved storyboard input/);
});

test('look bindings must retain the exact approved identity and all required role pins',()=>{
 const f=fixture(),look=f.project.referenceProduction.subjects.find(s=>s.kind==='character_look');look.versions.at(-1).identityBinding.assetId=uuid(999);assert.throws(()=>build(f),/look no longer preserves/);
 const missing=fixture();missing.project.storyboardProduction.shots[0].versions[0].document.referenceBindings.splice(1,1);resync(missing);assert.throws(()=>build(missing),/approved identity and look/);
 const reorder=fixture();reorder.project.storyboardProduction.shots[0].versions[0].document.referenceBindings.reverse();resync(reorder);assert.throws(()=>build(reorder),/canonical order/);
});

test('every required image role needs a resolved decision and unsupported roles cannot be waived as prompt-only',()=>{
 for(const role of ['product','composition','lighting','performance']){
  const f=fixture(),shot=f.project.storyboardHandoff.shots[0].versions.at(-1);shot.document.referenceRequirements.push({id:'unsupported',role,characterIds:[],direction:'A distinct required image.'});f.project.storyboardProduction.shots[0].versions[0].document.referenceDecisions.push({requirementId:'unsupported',disposition:'not_applicable',rationale:'A forged waiver.'});resync(f);assert.throws(()=>build(f),/unsupported reference-image role/);
 }
 for(const disposition of ['unresolved','not_applicable','prompt_only']){const f=fixture();f.project.storyboardProduction.shots[0].versions[0].document.referenceDecisions[0].disposition=disposition;resync(f);assert.throws(()=>build(f),/cannot be silently waived/);}
 const missing=fixture();missing.project.storyboardProduction.shots[0].versions[0].document.referenceDecisions.pop();resync(missing);assert.throws(()=>build(missing),/every shot reference requirement/);
});

test('only server-signed owned private inputs are accepted in the exact deduplicated order',()=>{
 const f=fixture();for(const url of ['https://public.example/image.png','https://frame-fixture.supabase.co/storage/v1/object/public/director-media/owner/frame_project/asset_1?token=x','https://frame-fixture.supabase.co/storage/v1/object/sign/director-media/owner/foreign/asset_1?token=x','http://frame-fixture.supabase.co/storage/v1/object/sign/director-media/owner/frame_project/asset_1?token=x','https://u:p@frame-fixture.supabase.co/storage/v1/object/sign/director-media/owner/frame_project/asset_1?token=x']){
  const referenceUrls=[...f.referenceUrls];referenceUrls[0]=url;assert.throws(()=>buildStoryboardFrameInput({...f,referenceUrls,model:{endpoint}}),/private/);
 }
});

test('full selected facts exceeding the UTF8 prompt bound are rejected without truncation',()=>{
 const f=fixture(),snapshot=f.project.storyboardProduction.shots[0].versions[0];snapshot.document.direction='保'.repeat(Math.floor(STORYBOARD_FRAME_PROMPT_MAX_BYTES/3));resync(f);assert.throws(()=>build(f),/No included source, shot or reference text was truncated/);
});

test('native-aspect output normalization requires exactly one safe trusted PNG descriptor and saved dimensions',()=>{
 for(const size of Object.values(STORYBOARD_FRAME_CONFIGURATIONS))assert.deepEqual(storyboardFrameOutput(endpoint,output(size),size),{url:'https://v3.fal.media/files/frame.png',mime:'image/png',...size});
 const size=STORYBOARD_FRAME_CONFIGURATIONS['16:9'];assert.deepEqual(storyboardFrameOutput(endpoint,{images:[{url:'https://fal.media/frame.png'}]},size),{url:'https://fal.media/frame.png',mime:null,width:null,height:null});
 assert.throws(()=>storyboardFrameOutput(endpoint,output(size)),/Saved storyboard output/);assert.throws(()=>storyboardFrameOutput(endpoint,output(size),{width:1920,height:1080}),/Saved storyboard output/);assert.throws(()=>storyboardFrameOutput('fal-ai/flux-2-pro',output(size),size),/Unsupported/);
});

test('unsafe, malformed, wrongly sized, multi-image and untrusted-host outputs are held before any asset is created',()=>{
 const size=STORYBOARD_FRAME_CONFIGURATIONS['16:9'];for(const value of [{images:[]},{images:[...output(size).images,...output(size).images]},output(size,{content_type:'image/jpeg'}),output(size,{width:1024,height:1024}),output(size,{width:'1536'}),output(size,{file_size:10*1024*1024+1}),output(size,{file_size:-1}),{...output(size),has_nsfw_concepts:[true]},{...output(size),has_nsfw_concepts:[]},{...output(size),has_nsfw_concepts:['false']}])assert.throws(()=>storyboardFrameOutput(endpoint,value,size));
 for(const url of ['http://v3.fal.media/frame.png','https://fal.media.attacker.test/frame.png','https://127.0.0.1/frame.png','https://u:p@v3.fal.media/frame.png','https://v3.fal.media:444/frame.png','https://v3.fal.media/frame.png#secret','data:image/png;base64,AA'])assert.throws(()=>storyboardFrameOutput(endpoint,output(size,{url}),size));
});

test('the existing reviewed Seedream adapter submits this native multi-reference input only once with explicit authorization',async()=>{
 const input=build(fixture({dedup:true})),requests=[],provider=createProviderClients({env:{FAL_API_KEY:'synthetic-never-sent'},fetcher:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({request_id:'frame_request',status:'IN_QUEUE'})};}});
 await assert.rejects(provider.submitFalJob({endpoint,input}),/Explicit server authorization/);assert.equal(requests.length,0);
 const saved=await provider.submitFalJob({endpoint,input,authorized:true});assert.equal(requests.length,1);assert.equal(requests[0].url,'https://queue.fal.run/'+endpoint);assert.equal(requests[0].options.redirect,'error');assert.equal(requests[0].options.headers['X-Fal-No-Retry'],'1');assert.deepEqual(JSON.parse(requests[0].options.body),input);assert.equal(saved.responseUrl,'https://queue.fal.run/bytedance/seedream/requests/frame_request');
});

test('dated discovery preserves real schema and extra-input tariff evidence without implying model activation or output validation',()=>{
 const evidence=JSON.parse(readFileSync(new URL('../../../docs/evidence/FAL_STORYBOARD_ENDPOINT_2026-10-19.json',import.meta.url)));
 assert.equal(hash(evidence.schema.input_schema),hash(reviewedFalInputSchema(endpoint)));assert.equal(evidence.adapterProposal.inputSchemaHash,hash(reviewedFalInputSchema(endpoint)));assert.equal(evidence.adapterProposal.qualityValidated,false);assert.equal(evidence.adapterProposal.executionTested,false);assert.equal(evidence.adapterProposal.paidCallsMade,0);
 const price=evidence.publicPricingObservation;assert.equal(price.status,'tentative_public_price_not_account_verified');assert.equal(price.additionalInputs.eachInputAfterFirstPerOutputMicroUsd,4500);assert.deepEqual(price.examples.map(e=>e.candidateMicroUsd),[67500,108000]);assert.match(price.reviewRequired,/exact input-image count/);
});
