import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {songProviderFixture,songSession} from './song-provider-fixture-server.mjs';
import {call} from './animatic-fixture-server.mjs';
import {songIntelligenceContext,saveSongIntelligence} from '../public/song-intelligence-core.js';
async function quoted(f,operation='interpret'){return (await f.post('/music-video/intelligence/providers/quotes',{expectedVersion:f.project.version,requestId:randomUUID(),operation,modelId:operation==='interpret'?'M05':operation==='transcribe'?'M06':'M07',shareOriginalAudio:true})).quote;}
async function started(f,operation='interpret'){const quote=await quoted(f,operation),{authorization}=await f.post('/spending-authorizations',{expectedVersion:f.project.version,requestId:randomUUID(),quoteId:quote.id,maxMicroUsd:quote.totalMicroUsd,finishReserveMicroUsd:0}),body={expectedVersion:f.project.version,requestId:randomUUID(),quoteId:quote.id,authorizationId:authorization.id},result=await f.post('/music-video/intelligence/providers/start',body);return {...result,quote,body};}
async function completed(f,operation='interpret'){const run=await started(f,operation);await f.post('/music-video/intelligence/providers/poll',{jobId:run.job.id});return {...run,...await f.post('/music-video/intelligence/providers/proposal',{jobId:run.job.id})};}
test('an exact original traverses shared quoted authorization/reservation/job/result/review without auto-approval',async()=>{
 const f=await songProviderFixture(),run=await completed(f);assert.equal(run.quote.totalMicroUsd,10000);assert.equal(f.counters.submits,1);assert.equal(f.state.requests[0].authorized,true);assert.equal(run.proposal.patch.sections[0].basis,'provider_proposed');assert.equal(songIntelligenceContext(await f.store.get(f.project.id,f.project.ownerId),[]).document.observations.length,0);
 const result=await f.post('/music-video/intelligence/providers/apply',{expectedVersion:f.project.version,jobId:run.job.id,proposalFingerprint:run.fingerprint,acknowledgeListening:true});assert.equal(result.songIntelligence.document.sections[0].basis,'user_reviewed');assert.equal(result.songIntelligence.approved,false);assert.equal(result.songIntelligence.version,2);assert.equal(f.counters.submits,1);assert.equal(f.store.state.jobs[0].charge_state,'held');assert.equal(result.songIntelligence.document.master.checksum,f.asset.checksum);
});
test('signed quote requests replay without resigning and altered request identities conflict',async()=>{
 const f=await songProviderFixture(),body={expectedVersion:f.project.version,requestId:randomUUID(),operation:'interpret',modelId:'M05',shareOriginalAudio:true};const first=await f.post('/music-video/intelligence/providers/quotes',body);assert.deepEqual(await f.post('/music-video/intelligence/providers/quotes',body),{quote:first.quote,saved:true});assert.equal(f.counters.signs,1);await assert.rejects(()=>f.post('/music-video/intelligence/providers/quotes',{...body,shareOriginalAudio:false}),{status:409});assert.equal(f.counters.submits,0);
});
test('owner, private sharing, inspected duration, singing quality and canonical route gates reject unsafe requests',async()=>{
 const f=await songProviderFixture(),base={expectedVersion:f.project.version,requestId:randomUUID(),operation:'transcribe',modelId:'M06',shareOriginalAudio:true};
 for(const token of [null,'foreign-fixture-session'])assert.equal((await call(f.handler,f.base+'/music-video/intelligence/providers/quotes',base,token)).status,token?404:401);
 await assert.rejects(()=>f.post('/music-video/intelligence/providers/quotes',{...base,shareOriginalAudio:false}),{status:400});
 delete f.store.state.assets[0].decodeVerified;await assert.rejects(()=>f.post('/music-video/intelligence/providers/quotes',base),{status:409});f.store.state.assets[0].decodeVerified=true;
 f.store.state.models[1].routing_profiles[0].purposes=['speech_transcription'];await assert.rejects(()=>f.post('/music-video/intelligence/providers/quotes',base),{status:409});
 await assert.rejects(()=>f.post('/music-video/intelligence/providers/quotes',{...base,operation:'align',modelId:'M07'}),{status:422});
 assert.equal((await call(f.handler,f.base+'/quotes',{task:'transcription'},songSession)).status,400);assert.equal(f.counters.submits,0);
});
test('transcription retains original exact canonical text until reviewed replacement and can reuse output after a song edit',async()=>{
 const f=await songProviderFixture(),run=await completed(f,'transcribe');assert.equal(run.quote.totalMicroUsd,8000);let project=await f.store.get(f.project.id,f.project.ownerId),document=structuredClone(songIntelligenceContext(project,[]).document);document.lyrics={...document.lyrics,canonicalText:'Existing correction',basis:'user_corrected'};const revised=saveSongIntelligence(project,{expectedVersion:project.version,document,acknowledgeEvidence:true},[f.asset]);await f.store.save(revised,project.version);
 const preview=await f.post('/music-video/intelligence/providers/proposal',{jobId:run.job.id});assert.equal(preview.proposal.originalSourceVersion,1);assert.equal(preview.proposal.reusedAgainstCurrentSongVersion,2);const body={expectedVersion:revised.version,jobId:run.job.id,proposalFingerprint:preview.fingerprint,acknowledgeListening:true};await assert.rejects(()=>f.post('/music-video/intelligence/providers/apply',body),{status:422});const accepted=await f.post('/music-video/intelligence/providers/apply',{...body,replaceCanonical:true});assert.equal(accepted.songIntelligence.document.lyrics.canonicalText,'  Hello 世界  ');assert.equal(accepted.songIntelligence.document.alignment.length,0);assert.equal(accepted.songIntelligence.document.lyrics.singers.length,0);assert.equal(f.counters.submits,1);
});
test('ambiguous submissions hold their costs and replay without a second call; pauses prevent new work',async()=>{
 const f=await songProviderFixture({submitThrows:true}),run=await started(f);assert.equal(run.job.status,'unknown');assert.equal(run.job.charge_state,'unknown');assert.equal((await f.post('/music-video/intelligence/providers/start',run.body)).job.status,'unknown');assert.equal(f.counters.submits,1);await assert.rejects(()=>started(f),{status:409});
 const paused=await songProviderFixture();paused.store.state.operationalControl.generationPaused=true;await assert.rejects(()=>started(paused),{status:409});assert.equal(paused.counters.submits,0);
});
test('a corrected song/source or revoked review holds a reserved job before any provider dispatch',async()=>{
 const f=await songProviderFixture(),quote=await quoted(f),{authorization}=await f.post('/spending-authorizations',{expectedVersion:f.project.version,requestId:randomUUID(),quoteId:quote.id,maxMicroUsd:quote.totalMicroUsd,finishReserveMicroUsd:0});f.store.state.assets[0].durationSeconds=1;
 await assert.rejects(()=>f.post('/music-video/intelligence/providers/start',{expectedVersion:f.project.version,requestId:randomUUID(),quoteId:quote.id,authorizationId:authorization.id}),{status:409});assert.equal(f.counters.submits,0);
});

test('duration quotes reserve measured whole-block upper bounds for full three-minute songs without changing provider input',async()=>{
 for(const [seconds,interpret,transcribe] of [[3,10000,8000],[180,360000,24000],[181.01,370000,32000]]){const f=await songProviderFixture({durationSeconds:seconds});const a=await quoted(f),b=await quoted(f,'transcribe');assert.equal(a.totalMicroUsd,interpret);assert.equal(b.totalMicroUsd,transcribe);assert.equal(f.counters.submits,0);const saved=f.store.state.quotes[0].quote;assert.equal(saved.songIntelligenceBinding.inspectedDurationSeconds,seconds);assert.equal(saved.usageEvidence.verified,true);assert(!('duration'in f.store.state.quotes[0].input));}
});
test('same-origin private analysis ranges preserve bytes and enforce owner/source/bounds without signing external URLs',async()=>{
 const f=await songProviderFixture(),path=f.base+'/assets/'+f.asset.id+'/analysis-content',range={range:'bytes=0-31'};
 const result=await call(f.handler,path,undefined,songSession,range);assert.equal(result.status,206);assert.equal(result.headers['Content-Range'],`bytes 0-31/${f.original.length}`);assert.deepEqual(result.data,f.original.subarray(0,32));assert.equal(f.counters.signs,0);
 for(const token of [null,'foreign-fixture-session'])assert.equal((await call(f.handler,path,undefined,token,range)).status,token?404:401);
 assert.equal((await call(f.handler,path,undefined,songSession)).status,416);assert.equal((await call(f.handler,path,undefined,songSession,{range:'bytes=0-999999'})).status,416);
 delete f.store.state.assets[0].decodeVerified;assert.equal((await call(f.handler,path,undefined,songSession,range)).status,409);
});

test('hour-rounded alignment pins corrected canonical text and imports measured words only after listening review',async()=>{
 const canonical='  Hello 世界  ',f=await songProviderFixture({lyrics:canonical,durationSeconds:180}),run=await completed(f,'align');assert.equal(run.quote.totalMicroUsd,220000);assert.equal(f.state.requests[0].input.text,canonical);assert.equal(run.proposal.patch.alignment[0].words[0][4],null);assert.equal(run.proposal.patch.alignment[0].words[0][2],200);
 const accepted=await f.post('/music-video/intelligence/providers/apply',{expectedVersion:f.project.version,jobId:run.job.id,proposalFingerprint:run.fingerprint,acknowledgeListening:true});assert.equal(accepted.songIntelligence.document.lyrics.canonicalText,canonical);assert.equal(accepted.songIntelligence.wordAlignmentAvailable,true);assert.equal(accepted.songIntelligence.approved,false);assert.equal(f.counters.submits,1);
});
