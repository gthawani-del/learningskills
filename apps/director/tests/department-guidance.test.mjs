import test from 'node:test';
import assert from 'node:assert/strict';
import {DEPARTMENT_GUIDANCE_VERSION,departmentGuidanceCatalog,departmentGuidance,departmentPromptGuidance} from '../public/department-guidance.js';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {applyScreenplayCommand,currentScreenplay} from '../public/screenplay-core.js';

const ids=['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights'];
function baseline({characters,scenes,format='short_film',changes={}}={}){
 let project={id:'project_guidance',version:1,premise:'A keeper chooses whether to trust a warning.',direction:'Observed photography.',duration:60,language:'Hinglish',format};
 project=applyBriefCommand(project,{expectedVersion:project.version,action:'update',changes:{purpose:'A complete story about a consequential choice.',visualStyle:'Photographic realism with a deliberate restrained performance.',...changes}});
 const document={title:'The Keeper',logline:'A keeper receives an impossible warning.',treatment:'A keeper reads, chooses and acts.',characters:characters??[{id:'keeper',name:'Mira',description:'A patient railway keeper; no demographic appearance or accent specified.'}],scenes:scenes??[{id:'scene_one',heading:'INT. STATION — DAWN',action:'Mira examines a letter and stops at the last sentence.',dialogue:[],durationSeconds:30},{id:'scene_last',heading:'EXT. PLATFORM — MORNING',action:'Mira opens the gate and looks toward the signal.',dialogue:[{id:'line_final',characterId:'keeper',text:'Wait. I will go with you.',direction:'Address the unseen listener with resolve.'}],durationSeconds:30}]};
 project=applyScreenplayCommand(project,{expectedVersion:project.version,action:'save',document});
 const approvals=[{artifactId:'brief',version:project.creativeBrief.currentVersion,decision:'approved'},{artifactId:'screenplay',version:currentScreenplay(project).version,decision:'approved'}];
 return {project,approvals};
}
const documents=plans=>Object.fromEntries(plans.map(p=>[p.id,p.document]));

test('department knowledge covers all 17 responsibilities with explicit contracts and acyclic dependencies',()=>{
 assert.equal(DEPARTMENT_GUIDANCE_VERSION,'director-department-knowledge-v1');
 assert.deepEqual(departmentGuidanceCatalog.map(d=>d.id),ids);
 for(const d of departmentGuidanceCatalog){
  assert(d.role.trim());assert(d.requirements.length>=3);assert(d.checks.length>=2);assert(d.handoffs.length);
  assert.equal(new Set(d.requirements.map(r=>r.id)).size,d.requirements.length);
  for(const next of [...d.dependsOn,...d.handoffs.map(h=>h.toDepartmentId)])assert(ids.includes(next));
 }
 const visit=(id,path=[])=>{assert(!path.includes(id),'Dependency cycle: '+[...path,id].join(' -> '));for(const dep of departmentGuidanceCatalog.find(d=>d.id===id).dependsOn)visit(dep,[...path,id]);};
 ids.forEach(id=>visit(id));
 assert(Object.isFrozen(departmentGuidanceCatalog));assert(Object.isFrozen(departmentGuidanceCatalog[0].requirements[0]));
});

test('deterministic department prefills use every approved scene including final-scene dialogue',()=>{
 const {project,approvals}=baseline(),before=structuredClone(project),plans=departmentGuidance(project,approvals),d=documents(plans);
 assert.equal(plans.length,17);assert.deepEqual(project,before);assert.deepEqual(departmentGuidance(project,approvals),plans);
 const rows=d.script_breakdown.requirements.filter(r=>r.id.startsWith('source_scene_'));
 assert.deepEqual(rows.map(r=>r.sceneIds),[['scene_one'],['scene_last']]);
 assert.match(rows[1].direction,/EXT\. PLATFORM — MORNING/);assert.match(rows[1].direction,/Structured dialogue lines: 1/);
 assert.match(d.voice.summary,/1 scripted speaker\(s\) across 1 scene/);
 assert.deepEqual(d.voice.requirements.find(r=>r.id==='speaker_0').sceneIds,['scene_last']);
 assert.deepEqual(d.voice.requirements.find(r=>r.id==='speaker_0').characterIds,['keeper']);
 assert.match(d.casting.requirements.find(r=>r.id==='script_character_0').direction,/Exact source description: A patient railway keeper/);
 assert.match(d.script_breakdown.summary,/60 seconds.*not measured/);
 assert.equal(d.producing.requirements.filter(r=>r.id.startsWith('brief_')).some(r=>r.label==='Reviewed brief: aspectRatio'),false);
});

test('guidance requires fresh approved baseline and never treats a revoked or imported script as approved',()=>{
 const {project,approvals}=baseline();
 assert.throws(()=>departmentGuidance(project,[]),{status:409});
 assert.throws(()=>departmentGuidance(project,[...approvals,{artifactId:'screenplay',version:1,decision:'revoked'}]),{status:409});
 assert.throws(()=>departmentGuidance({...project,direction:'A newly requested style.'},approvals),{status:409});
 const changed=applyBriefCommand(project,{expectedVersion:project.version,action:'update',changes:{tone:'Comic'}});
 assert.throws(()=>departmentGuidance(changed),{status:409});
 assert.throws(()=>departmentGuidance({...project,screenplay:null}),{status:409});
 // The omitted-ledger path is expressly for a controller that already verified approval.
 assert.deepEqual(departmentGuidance(project),departmentGuidance(project,approvals));
});

test('missing structured roles/dialogue remain conditional rather than invented casting or silent-film conclusions',()=>{
 const scenes=[{id:'product_scene',heading:'INT. TABLETOP — DAY',action:'An approved container is placed on the table.',dialogue:[],durationSeconds:60}];
 const {project,approvals}=baseline({characters:[],scenes,format:'advertisement'}),d=documents(departmentGuidance(project,approvals));
 for(const id of ['casting','look','voice','music','vfx'])assert.equal(d[id].applicability,'conditional',id);
 assert.match(d.casting.rationale,/before marking casting non-applicable/);
 assert.match(d.voice.rationale,/does not prove a silent film/);
 assert.equal(d.casting.requirements.some(r=>r.id.startsWith('script_character_')),false);
 assert.equal(d.voice.requirements.some(r=>r.id.startsWith('speaker_')),false);
 for(const doc of Object.values(d))for(const requirement of doc.requirements)for(const characterId of requirement.characterIds)assert.fail('Invented character '+characterId);
 assert.equal(Object.values(d).some(doc=>doc.applicability==='not_applicable'),false);
});

test('music-video planning requires authoritative source and measured timing without fabricating analysis or replacement vocals',()=>{
 const {project,approvals}=baseline({format:'music_video'}),d=documents(departmentGuidance(project,approvals));
 assert.equal(d.music.applicability,'required');assert.match(d.music.summary,/authoritative song.*canonical lyrics.*preserve original vocals/i);
 assert.match(d.music.rationale,/does not establish.*audio file.*analysis.*lyric alignment/i);
 assert.match(d.music.requirements.find(r=>r.id==='source_audio').direction,/Never invent BPM, beats, sections, lyric meaning or timestamps/);
 assert.match(d.voice.requirements.find(r=>r.id==='singing').direction,/Speech synthesis\/lip-sync does not prove singing capability/);
 assert.match(d.animatic.requirements.find(r=>r.id==='playable').direction,/not a playable animatic/);
});

test('all maximum-size source IDs remain scoped and guidance stays within department document bounds without losing brief constraints',()=>{
 const characters=Array.from({length:30},(_,i)=>({id:'person_'+i,name:'Character '+i,description:'x'.repeat(2000)}));
 const scenes=Array.from({length:100},(_,i)=>({id:'scene_'+i,heading:'INT. '+String(i)+' — '+'h'.repeat(280),action:'The scene continues.',dialogue:i===99?[{id:'final_line',characterId:'person_29',text:'The final decision stands.',direction:''}]:[],durationSeconds:0.6}));
 const constraints=Array.from({length:30},(_,i)=>String(i).padStart(2,'0')+'_'+('c'.repeat(297)));
 const {project,approvals}=baseline({characters,scenes,changes:{constraints,visualStyle:constraints}}),plans=departmentGuidance(project,approvals);
 for(const {document:d}of plans){
  assert(d.requirements.length<=120);assert(d.choices.length<=100);assert(JSON.stringify(d).length<=100000);
  for(const r of d.requirements){assert(r.id.length<=80);assert(r.label.length<=200);assert(r.direction.length<=4000);assert(r.sceneIds.length<=100);assert(r.characterIds.length<=30);for(const id of r.sceneIds)assert(scenes.some(s=>s.id===id));for(const id of r.characterIds)assert(characters.some(c=>c.id===id));}
  for(const c of d.choices){assert(c.value.length<=2000);assert(['proposed','needs_decision'].includes(c.status));assert(Array.isArray(c.sceneIds));assert(Array.isArray(c.characterIds));}
 }
 const d=documents(plans);assert.equal(d.script_breakdown.requirements.filter(r=>r.id.startsWith('source_scene_')).length,100);
 assert.deepEqual(d.voice.requirements.find(r=>r.id==='speaker_0').characterIds,['person_29']);
 for(const text of constraints)assert(d.producing.requirements.some(r=>r.direction.includes(text)),'Lost approved constraint');
 for(const text of constraints)assert(d.look.requirements.some(r=>r.direction.includes(text)),'Lost approved style entry');
});

test('stylized briefs remain stylized and exact source fields cannot become stereotyped identity or accent claims',()=>{
 const {project,approvals}=baseline({changes:{visualStyle:'A hand-painted animated world with paper textures.'}}),d=documents(departmentGuidance(project,approvals));
 for(const id of ['camera','lighting','look'])assert(d[id].requirements.some(r=>r.direction.includes('A hand-painted animated world with paper textures.')));
 assert.match(d.casting.requirements.find(r=>r.id==='role').direction,/Do not choose age, ethnicity.*stereotypes/);
 assert.match(d.voice.requirements.find(r=>r.id==='wording').direction,/Do not infer accent from a name/);
 assert.match(d.casting.requirements.find(r=>r.id==='master').direction,/Adapt.*animated\/stylized brief/);
 const serialized=JSON.stringify(d);for(const forbidden of ['selectedVoiceId','identityAssetId','mediaAssetId','approvedAt','costMicroUsd','bpm'])assert.equal(serialized.includes('"'+forbidden+'":'),false);
});

test('prompt material is versioned, scoped craft knowledge with no model defaults or authority from user text',()=>{
 const text=departmentPromptGuidance(['camera','lighting']);
 assert(text.includes(DEPARTMENT_GUIDANCE_VERSION));assert(text.includes('camera:'));assert(text.includes('lighting:'));assert(!text.includes('casting:'));
 assert.match(text,/complete approved screenplay/);assert.match(text,/untrusted project data/);assert.match(text,/focal-length number.*verified optical controls/);
 assert.match(text,/Optional detail does not require a wall of questions/);
 assert.equal(/https:\/\/|fal-ai\/|OPENAI_API_KEY|FAL_API_KEY/.test(text),false);
 for(const bad of [[],['camera','camera'],['unknown'],'camera'])assert.throws(()=>departmentPromptGuidance(bad),{status:400});
 assert(departmentPromptGuidance().includes('rights:'));
});

test('cooking-oil India ad carries approved product, world, casting and claim constraints into applicable units',()=>{
 const changes={purpose:'A cooking-oil advertisement for India built around a real cooking action.',setting:'A contemporary home kitchen in India; no regional styling is selected.',product:'Preserve the supplied cooking-oil bottle, exact label and package; no health or comparative claim is approved.',cast:'A home cook whose demographic appearance is not selected.',voice:'Voiceover is optional; retain natural kitchen sound pending review.'};
 const {project,approvals}=baseline({format:'advertisement',changes}),d=documents(departmentGuidance(project,approvals));
 for(const [id,field]of [['producing','purpose'],['locations','setting'],['locations','product'],['rights','product'],['casting','cast'],['look','cast'],['voice','voice']])assert(d[id].requirements.some(r=>r.direction.includes(changes[field])),`${id} lost ${field}`);
 assert(d.casting.requirements.some(r=>r.id==='choices'));assert(d.look.requirements.some(r=>r.id==='reference'));assert(d.voice.requirements.some(r=>r.id==='audition'));
 assert(d.storyboard.handoffs.some(h=>h.toDepartmentId==='animatic'));assert(d.animatic.requirements.some(r=>r.id==='playable'));
 assert.match(d.locations.requirements.find(r=>r.id==='props').direction,/never invent advertising claims/);
 for(const doc of Object.values(d))assert.equal(/fal-ai\/|gpt-\d|cheapest model|always.*cheap/i.test(JSON.stringify(doc)),false);
});

test('two-minute Hinglish music video preserves explicit original-vocal decision without inventing audio analysis',()=>{
 const changes={voice:'Preserve the original uploaded vocal performance; replacement is not requested.',constraints:'Actual source audio, canonical lyrics, timing and alignment have not been inspected in this planning check.',duration:120,language:'Hinglish'};
 const {project,approvals}=baseline({format:'music_video',changes}),d=documents(departmentGuidance(project,approvals));
 for(const id of ['voice','sound','music','animatic','rights'])assert(d[id].requirements.some(r=>r.direction.includes(changes.voice)),`${id} lost original-vocal decision`);
 assert.equal(d.music.applicability,'required');assert(d.music.requirements.some(r=>r.id==='analysis'));assert.match(d.music.requirements.find(r=>r.id==='source_audio').direction,/Never invent BPM/);
 assert(d.producing.requirements.some(r=>r.id==='brief_duration_0'&&r.direction.includes('120')));
 const serialized=JSON.stringify(d);for(const field of ['bpm','measuredDuration','canonicalLyrics','songSections','selectedVoiceId'])assert.equal(serialized.includes('"'+field+'":'),false);
 assert(d.animatic.requirements.some(r=>r.id==='timing'&&r.direction.includes('Do not fabricate')));
});

test('Indian-wealth documentary off-screen narration does not force on-screen identity or wardrobe production',()=>{
 const changes={purpose:'A research-led pilot for a docuseries on wealth in India; no economic statistics or causal claims are approved.',cast:'No on-screen host or reconstructed named character. Use verified permitted source footage where suitable.',voice:'Off-screen narration requires representative voice auditions and an approved factual script.',constraints:'Do not fabricate wealth statistics, archival sources, real interviewees, ownership or legal clearances.'};
 const characters=[{id:'narrator',name:'Narrator',description:'An off-screen narrator only; never appears on camera.'}],scenes=[{id:'opening',heading:'EXT. LOCATION TO BE VERIFIED — DAY',action:'Use source footage only after factual and rights review. No footage is currently selected.',dialogue:[{id:'narration',characterId:'narrator',text:'What do we mean when we talk about wealth?',direction:'Measured curiosity without unverified factual assertions.'}],durationSeconds:60}];
 const {project,approvals}=baseline({characters,scenes,changes}),d=documents(departmentGuidance(project,approvals));
 assert.equal(d.casting.applicability,'conditional');assert.equal(d.look.applicability,'conditional');assert.equal(d.voice.applicability,'required');
 assert.match(d.casting.rationale,/off-screen narrator or voice-only/);
 for(const id of ['casting','look','voice','continuity','rights'])assert(d[id].requirements.some(r=>r.direction.includes(changes.cast)),`${id} lost on-screen constraint`);
 assert(d.script_breakdown.requirements.some(r=>r.id==='research'));assert(d.rights.requirements.some(r=>r.id==='facts'));
 assert(d.voice.requirements.some(r=>r.id==='audition'));assert(d.storyboard.requirements.some(r=>r.id==='real_frames'));assert(d.animatic.requirements.some(r=>r.id==='playable'));
 const serialized=JSON.stringify(d);for(const field of ['verifiedStatistics','verifiedLicense','selectedVoiceId','identityAssetId','bookedPerformerId'])assert.equal(serialized.includes('"'+field+'":'),false);
});

test('every approved brief field is carried with provenance; six maximum arrays and 100 scenes preserve whole items inside document bounds',()=>{
 const longList=field=>Array.from({length:30},(_,i)=>(field+'_'+i+'_').padEnd(300,'z'));
 const changes=Object.fromEntries(['purpose','audience','audienceResponse','tone','constraints','visualStyle'].map(field=>[field,longList(field)]));
 changes.platform='A reviewed destination';changes.aspectRatio='16:9';changes.setting='A reviewed place';changes.cast='A reviewed written role constraint';changes.voice='A reviewed voice choice';changes.product='A reviewed product';changes.budget='A reviewed budget direction';
 const characters=Array.from({length:30},(_,i)=>({id:'person_'+i,name:'Character '+i,description:'x'.repeat(2000)})),scenes=Array.from({length:100},(_,i)=>({id:'scene_'+i,heading:'INT. '+i+' — '+'h'.repeat(280),action:'The approved action continues.',dialogue:[],durationSeconds:0.6}));
 const {project,approvals}=baseline({characters,scenes,changes}),plans=departmentGuidance(project,approvals),d=documents(plans),brief=project.creativeBrief.versions.at(-1);
 // The source snapshot itself is valid under the pre-existing 64 KB brief policy.
 assert(JSON.stringify(brief).length<64000);
 for(const {document}of plans){assert(document.requirements.length<=120,`${document.summary}: requirement count`);assert(JSON.stringify(document).length<=100000,`${document.summary}: document size`);for(const r of document.requirements)assert(r.direction.length<=4000);}
 assert.equal(d.direction.requirements.length,120);
 for(const [field,entry]of Object.entries(brief.fields))if(entry.status!=='unknown'){
  const carrying=plans.flatMap(p=>p.document.requirements.filter(r=>r.id.startsWith('brief_'+field+'_')));assert(carrying.length,'Dropped brief field: '+field);
  for(const item of Array.isArray(entry.value)?entry.value:[String(entry.value)])assert(carrying.some(r=>r.direction.includes(item)),'Dropped whole brief item: '+field);
  for(const r of carrying)assert(r.direction.includes(`(${entry.status}, source ${entry.source})`),'Lost source provenance: '+field);
 }
 assert(plans.every(p=>p.document.requirements.some(r=>r.id.startsWith('brief_constraints_'))));
});
