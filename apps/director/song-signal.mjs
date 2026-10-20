import {fail} from './domain.mjs';
import {newSongIntelligence,normalizeSongIntelligence} from './public/song-intelligence-core.js';
const masterFor=(asset,analysis)=>({assetId:asset.id,assetVersion:asset.version,checksum:asset.checksum,durationMs:analysis.durationMs,timingBasis:'user_reviewed'});
function normalizedSignal(master,raw){
 if(!raw||raw.provenance!=='worker_decoded'||raw.version!=='director-ffmpeg-audio-features-v1')fail(422,'The isolated worker song measurement method is unavailable.');
 return normalizeSongIntelligence(newSongIntelligence(master,raw));
}
// Trusted coordinator only; worker bytes never grant source publication, spend or
// creative approval. Store only normalized measurable features and energy cues.
export async function recordInspectedSongSignal({store,claim,source,report}){
 const raw=report?.songAnalysis;if(!raw)return false;
 if(report.status!=='passed'||report.inspectionVersion!=='director-source-inspection-v1'||report.sha256!==source.sha256||report.size!==source.size||report.decodeVerified!==true||!source.mime.startsWith('audio/')||!Number.isFinite(report.durationSeconds)||Math.abs(raw.durationMs-report.durationSeconds*1000)>250)fail(422,'Song features do not match the inspected original.');
 const master={assetId:claim.uploadId,assetVersion:1,checksum:source.sha256,durationMs:raw.durationMs,timingBasis:'user_reviewed'},song=normalizedSignal(master,raw);
 await store.addAudit(claim.projectId,claim.ownerId,'song_signal_measured',{uploadId:claim.uploadId,sourceChecksum:source.sha256,technical:song.technical,sections:song.sections,inspectionVersion:report.inspectionVersion});return true;
}
export async function storedSongSignal(store,project,asset){
 if(asset.projectId!==project.id||asset.bucket!=='director-source-media'||asset.id!==asset.sourceUploadId||asset.decodeVerified!==true||asset.inspectionVersion!=='director-source-inspection-v1'||asset.checksumAlgorithm!=='sha256-bytes'||asset.role!=='master_song')fail(409,'Choose the exact inspected original song.');
 const rows=typeof store.readInspectedSongSignal==='function'?await store.readInspectedSongSignal(project.id,asset.id,asset.checksum):await store.records('audit',project.id),event=rows.filter(r=>(r.type||r.event_type)==='song_signal_measured'&&r.details?.uploadId===asset.id&&r.details.sourceChecksum===asset.checksum&&r.details.inspectionVersion===asset.inspectionVersion).sort((a,b)=>Date.parse(b.createdAt||b.created_at||0)-Date.parse(a.createdAt||a.created_at||0))[0];
 if(!event)fail(409,'Measured hosted song features are not saved yet. The original is preserved; no model call or new worker starts from this check.');
 const f=event.details.technical,master=masterFor(asset,f);if(Math.abs(f.durationMs-asset.durationSeconds*1000)>250)fail(409,'Saved song features no longer match this original.');
 const raw={version:f.version,provenance:f.provenance,durationMs:f.durationMs,audioProperties:f.audioProperties,rmsDbFS:f.rmsDbFS,peakAmplitude:f.peakAmplitude,nearFullScaleSampleFraction:f.nearFullScaleSampleFraction,silent:f.silent,waveform:f.waveform.map(r=>({startMs:r[0],endMs:r[1],min:r[2],max:r[3]})),envelope:f.energy.map(r=>({startMs:r[0],endMs:r[1],rmsDbFS:r[2]})),onsets:f.onsets.map(r=>({timeMs:r[0],strength:r[1],uncertaintyMs:r[2]})),onsetEvidence:f.onsetEvidence,tempo:f.tempo,sections:event.details.sections.map(s=>({id:s.id,label:s.label,startMs:s.startMs,endMs:s.endMs,timingBasis:'provisional'}))};
 normalizedSignal(master,raw);return raw;
}
