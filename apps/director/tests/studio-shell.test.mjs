import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_FORMATS,productionSteps,assetCategory,filterStudioAssets} from '../public/studio-catalog.js';
import {collectStudioAssets,assetResults,studioNavigation} from '../public/studio-shell.js';
import {newProject,patchProject} from '../domain.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {draftRevision} from '../public/device-drafts.js';

test('every offered production format survives creation, targeted brief edits and device revisions',()=>{
 for(const format of PROJECT_FORMATS){
  let project=newProject({title:'Creation',premise:'Original source material.',format},'owner');
  project=applyBriefCommand(project,{expectedVersion:project.version,action:'suggest'});
  assert.equal(project.format,format);
  const other=format==='short_film'?'documentary':'short_film';
  const changed=applyBriefCommand(project,{expectedVersion:project.version,action:'update',changes:{format:other}});
  assert.equal(changed.format,other);
  assert.equal(patchProject(project,{format:other}).format,other);
  assert.equal(draftRevision(project,{format:other}).format,other);
 }
 assert.throws(()=>newProject({format:'unreviewed_custom_type'},'owner'),/format/);
 assert.throws(()=>draftRevision(newProject({},'owner'),{format:'invalid'}),/production type/);
});
test('production outlines retain stable stage identifiers and surface task-specific steps',()=>{
 const music=productionSteps('music_video');
 assert.ok(music.some(s=>s.label==='Performance & B-roll'&&s.id==='production'));
 assert.ok(music.some(s=>s.label==='Cast, look & voice'));
 assert.ok(productionSteps('documentary').some(s=>s.label==='Edit & fact review'));
 assert.deepEqual(productionSteps('image').map(s=>s.id),['brief','cast','production','export']);
});
test('asset grouping keeps identity references in Characters and filters by actual project identity',()=>{
 const rows=[{name:'Mira',mime:'image/png',role:'character_identity',projectId:'one',projectTitle:'Film'},
  {name:'Kitchen',mime:'image/png',role:'location',projectId:'one',projectTitle:'Film'},
  {name:'Cooking',mime:'video/mp4',role:'shot_reference',projectId:'two',projectTitle:'Ad'},
  {name:'Voice',mime:'audio/wav',role:'voice_reference',projectId:'two',projectTitle:'Ad'},
  {name:'Script',mime:'text/plain',role:'script',projectId:'one',projectTitle:'Film'}];
 assert.deepEqual(rows.map(assetCategory),['characters','images','videos','audio',null]);
 assert.deepEqual(filterStudioAssets(rows,{category:'characters',query:'mIrA',projectId:'one'}),[rows[0]]);
 assert.equal(filterStudioAssets(rows,{category:'characters',projectId:'two'}).length,0);
 assert.equal(filterStudioAssets(rows,{category:'videos',query:'Ad'}).length,1);
});
test('library aggregation reports partial failures, bounds concurrent reads and never merges by title',async()=>{
 let running=0,max=0;
 const projects=Array.from({length:9},(_,i)=>({id:String(i),title:'Same title',isLocal:i%2===0}));
 const result=await collectStudioAssets(projects,async project=>{
  max=Math.max(max,++running);await new Promise(resolve=>setTimeout(resolve,2));running--;
  if(project.id==='2')throw Error('Forbidden');return [{id:'same_asset_id',name:'Reference',mime:'image/png'}];
 });
 assert.ok(max<=4);assert.equal(result.rows.length,8);assert.deepEqual(result.failures,['2']);
 assert.equal(new Set(result.rows.map(a=>a.projectId)).size,8);
 assert.equal(result.rows.find(a=>a.projectId==='0').isLocal,true);
});
test('asset names, URLs, titles and navigation remain escaped user data',()=>{
 const html=assetResults([{name:'<img onerror=alert(1)>',projectTitle:'<script>',projectId:'" onclick="bad',mime:'image/png',url:'" onerror="bad'}],{category:'images'});
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('src="" onerror='));
 const nav=studioNavigation({page:'assets'});assert.match(nav,/aria-current="page"/);assert.match(nav,/>Assets</);
 for(const label of ['Home','Projects','Brand & characters','Usage & costs','Account / workspace'])assert.ok(nav.includes(label));
});

test('Characters includes versioned character records and only their exact referenced portrait version',async()=>{
 const project={id:'film',title:'Film',production:{records:[{id:'mira',type:'character',name:'Mira',currentVersion:2,versions:[{version:1,references:[]},{version:2,references:[{assetId:'identity',version:2}]}]}]}};
 const portrait={id:'identity',name:'Portrait',mime:'image/png',role:'character_identity',version:2,url:'/owned/portrait'};
 let result=await collectStudioAssets([project],async()=>[portrait]);assert.equal(result.rows.length,1);assert.equal(result.rows[0].recordId,'mira');assert.equal(result.rows[0].recordVersion,2);assert.equal(result.rows[0].url,portrait.url);
 result=await collectStudioAssets([project],async()=>[{...portrait,version:1}]);const record=result.rows.find(r=>r.recordId==='mira');assert.equal(record.url,'');assert.equal(assetCategory(record),'characters');assert.match(assetResults([record],{category:'characters'}),/No portrait selected/);
});
