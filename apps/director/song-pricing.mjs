import {hash,fail} from './domain.mjs';
import {songIntelligenceContext} from './public/song-intelligence-core.js';
import {SONG_AUDIO_ENDPOINTS} from './song-provider-results.mjs';
export const SONG_PROVIDER_TASKS=Object.freeze({interpret:'song_analysis',transcribe:'transcription',align:'alignment'});
export function songOperationForTask(task){return Object.keys(SONG_PROVIDER_TASKS).find(key=>SONG_PROVIDER_TASKS[key]===task)||null;}
export function ownedSongAudio(project,assets){
 const song=songIntelligenceContext(project,[]);if(!song.available||song.holds.length)fail(409,'Save current source-bound song evidence before audio interpretation.');
 const m=song.document.master,asset=assets?.find(a=>a.id===m.assetId&&a.projectId===project.id&&a.version===m.assetVersion&&a.checksum===m.checksum&&a.role==='master_song'&&a.scope==='project');
 if(!asset)fail(409,'The exact owned original song is unavailable.');
 return {song,asset};
}
export function trustedSongDuration(asset,master){
 if(asset.bucket!=='director-source-media'||asset.sourceUploadId!==asset.id||asset.checksumAlgorithm!=='sha256-bytes'||asset.decodeVerified!==true||asset.inspectionVersion!=='director-source-inspection-v1'||!Number.isFinite(asset.durationSeconds)||asset.durationSeconds<=0||asset.durationSeconds>300||Math.abs(asset.durationSeconds*1000-master.durationMs)>250)fail(409,'Paid audio analysis requires the existing trusted source inspection/publication, with measured duration up to five minutes. Browser estimates cannot authorize duration-priced calls.');
 return asset.durationSeconds;
}
export function assertOwnedSongUrl(asset,url){
 let u;try{u=new URL(url);}catch{fail(409,'The exact private original audio must be signed by the server.');}
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443'||!/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)||!u.searchParams.get('token'))fail(409,'The exact private original audio must be signed by the server.');
 let path;try{path=decodeURIComponent(u.pathname);}catch{fail(409,'Invalid signed original-audio path.');}
 if(path!==`/storage/v1/object/sign/${asset.bucket}/${asset.storageKey}`)fail(409,'The provider request must contain this exact owned original recording.');
}
export function songQuoteFacts({project,assets,task,model,input,artifactId,artifactVersion,requirements}){
 const operation=songOperationForTask(task);if(!operation)return null;
 const {song,asset}=ownedSongAudio(project,assets),duration=trustedSongDuration(asset,song.document.master);
 if(artifactId!=='record:'+song.recordId||artifactVersion!==song.version||model.endpoint!==SONG_AUDIO_ENDPOINTS[operation]||requirements?.durationSeconds!==duration)fail(409,'Audio quotes must pin the current song record, exact endpoint and inspected duration.');
 assertOwnedSongUrl(asset,input.audio_url);
 if(operation==='align'&&(!song.document.lyrics.canonicalText.trim()||input.text!==song.document.lyrics.canonicalText||song.document.lyrics.vocalMode==='instrumental'))fail(409,'Alignment must use the exact current canonical lyrics of a vocal recording.');
 const tariff=model.price_evidence?.tariff,component=tariff?.components?.[0];
 if(tariff?.components?.length!==1||component.id!=='audio_duration'||component.unit!=='second'||component.rounding!=='ceil'||(component.includedUnits??0)!==0||(component.minimumUnits??0)!==0)fail(409,'A reviewed single-component inspected-audio duration tariff is required.');
 // Reserve a conservative whole published billing block, never understate cost
 // when the price lookup does not establish sub-block rounding. Reconcile actual
 // provider usage/charges separately; this estimate is never an invoice.
 const block=operation==='interpret'?5:operation==='transcribe'?60:3600,quantity=Math.ceil(duration/block)*block;
 return {
  songIntelligenceBinding:{recordId:song.recordId,version:song.version,master:structuredClone(song.document.master),inspectedDurationSeconds:duration,measurementVersion:asset.inspectionVersion,operation},
  usageEvidence:{verified:true,priceVersion:model.price_evidence.version,inputHash:hash(input),measurementVersion:asset.inspectionVersion,components:{audio_duration:{bounded:true,quantity}}}
 };
}
