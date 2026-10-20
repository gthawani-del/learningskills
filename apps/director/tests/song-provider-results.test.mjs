import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newSongIntelligence} from '../public/song-intelligence-core.js';
import {analyzeSongChannels} from '../public/song-analysis-core.js';
import {technicalSongEvidence,normalizeSongIntelligence} from '../public/song-intelligence-core.js';
import {SONG_AUDIO_ENDPOINTS,prepareSongProviderInput,songProposalFromProvider,reviewSongProviderProposal} from '../song-provider-results.mjs';
const clone=structuredClone;
function fixture(operation='interpret'){
 const document=newSongIntelligence({assetId:randomUUID(),assetVersion:1,checksum:'a'.repeat(64),durationMs:180000,timingBasis:'user_reviewed'}),sourceBinding={recordId:randomUUID(),version:1,master:clone(document.master)};
 const context={operation,document,sourceBinding,jobId:randomUUID(),providerRequestId:'known-request',modelId:'reviewed-fixture',endpoint:SONG_AUDIO_ENDPOINTS[operation]};
 return {...context,input:{audio_url:'https://owned.example/signed-original.wav'}};
}
test('audio request preparation uses the exact master and canonical text without language or singer assumptions',()=>{
 const f=fixture(),transcribe=prepareSongProviderInput({...f,operation:'transcribe',audioUrl:f.input.audio_url});assert.equal(transcribe.language_code,null);assert.equal(transcribe.diarize,true);assert.deepEqual(transcribe.keyterms,[]);
 assert.match(prepareSongProviderInput({...f,audioUrl:f.input.audio_url}).prompt,/180000 milliseconds/);assert.throws(()=>prepareSongProviderInput({...f,operation:'align',audioUrl:f.input.audio_url}),/canonical lyrics/);
 f.document.lyrics={canonicalText:'  नमस्ते\n你好 🎵  ',basis:'user_supplied',languages:[],singers:[],vocalMode:'mixed'};assert.equal(prepareSongProviderInput({...f,operation:'align',audioUrl:f.input.audio_url}).text,f.document.lyrics.canonicalText);
 assert.throws(()=>prepareSongProviderInput({...f,audioUrl:'http://127.0.0.1/master.wav'}),/HTTPS/);
});
test('structured audio interpretation retains evidence as proposals and never overwrites lyrics or approval',()=>{
 const f=fixture();f.document.lyrics={canonicalText:'Keep my exact words',basis:'user_supplied',languages:['en'],singers:[],vocalMode:'sung'};
 const output={output:JSON.stringify({sections:[{id:'first',type:'verse',label:'Proposed verse',startMs:0,endMs:90000,evidence:['A repeating vocal melody.']},{id:'second',type:'unknown',label:'Unknown remainder',startMs:90000,endMs:180000,evidence:['Structure uncertain.']}],observations:[{id:'mood',category:'mood',text:'Reflective first passage',startMs:0,endMs:90000,evidence:['Sparse audible accompaniment.']}],vocalEvents:[{id:'vocal',startMs:5000,endMs:10000,uncertaintyMs:null,evidence:['A voice enters.']}]})};
 const p=songProposalFromProvider({...f,output});assert.equal(p.patch.sections[0].basis,'provider_proposed');assert.equal(p.patch.vocalEvents[0].singerId,null);assert(p.patch.observations[0].evidence[0].includes(f.jobId));assert.equal(p.approved,undefined);assert.equal(f.document.observations.length,0);
 assert.throws(()=>reviewSongProviderProposal({...f,proposal:p}),/Listen/);const accepted=reviewSongProviderProposal({...f,proposal:p,acknowledgeListening:true});assert.equal(accepted.sections[0].basis,'user_reviewed');assert.equal(accepted.lyrics.canonicalText,f.document.lyrics.canonicalText);
 for(const output of [{output:'Here is a nice song.'},{output:'{"sections":[],"observations":[],"vocalEvents":[],"approved":true}'}])assert.throws(()=>songProposalFromProvider({...f,output}));
});
test('transcription is separate from canonical lyrics and retains measured timing, missing timing and provisional speaker labels',()=>{
 const f=fixture('transcribe'),text='  नमस्ते 你好 🌏  ';
 const p=songProposalFromProvider({...f,output:{text,language_code:'hi',language_probability:0.6,words:[{text:'नमस्ते',type:'word',start:1,end:2,speaker_id:'speaker_0'},{text:' ',type:'spacing'},{text:'你好',type:'word',start:3,end:4,speaker_id:'speaker_1'},{text:'🌏',type:'word'}]}});
 assert.equal(f.document.lyrics.canonicalText,'');assert.equal(p.transcript.text,text);assert.equal(p.transcript.unresolvedWords,1);assert.deepEqual(p.transcript.speakerLabels,['speaker_0','speaker_1']);assert.equal(p.transcript.alignment[0].uncertaintyMs,null);
 const accepted=reviewSongProviderProposal({...f,proposal:p,acknowledgeListening:true,useTranscriptTiming:true});assert.equal(accepted.lyrics.canonicalText,text);assert.equal(accepted.lyrics.vocalMode,'unknown');assert.equal(accepted.lyrics.singers.length,0);assert.equal(accepted.alignment[0].words[0][4],null);
 f.document.lyrics={...f.document.lyrics,canonicalText:'Existing corrected lyrics',basis:'user_corrected'};assert.throws(()=>reviewSongProviderProposal({...f,proposal:p,acknowledgeListening:true}),/separate explicit/);
});
test('alignment uses actual canonical offsets/times; loss never becomes an invented confidence or error bound',()=>{
 const f=fixture('align');f.document.lyrics={canonicalText:'  Hello\n世界 🎵  ',basis:'user_corrected',languages:['en','zh'],singers:[],vocalMode:'mixed'};f.input.text=f.document.lyrics.canonicalText;
 const output={loss:0.01,characters:[],words:[{text:'Hello',start:0.5,end:1.2,loss:0.001},{text:'世界',start:2,end:3,loss:0.003},{text:'🎵',start:4,end:5,loss:0.1}]};
 const p=songProposalFromProvider({...f,output}),words=p.patch.alignment[0].words;assert.equal(f.document.alignment.length,0);assert.equal(f.document.lyrics.canonicalText.slice(words[1][0],words[1][1]),'世界');assert.equal(words[2][1]-words[2][0],2);assert.equal(words[0][4],null);assert.equal(words[0][2],500);
 for(const change of [x=>x.input.text='Hello 世界',x=>x.output.words[0].text='HELLO',x=>x.output.words[1].start=0.8,x=>x.output.words[2].end=181]){const a=clone({...f,output});change(a);assert.throws(()=>songProposalFromProvider(a));}
 assert.throws(()=>reviewSongProviderProposal({...f,sourceBinding:{...f.sourceBinding,version:2},proposal:p,acknowledgeListening:true}),/earlier song version/);
});
test('instrumental and malformed outputs cannot manufacture lyrics or singer identity',()=>{
 const f=fixture('transcribe');f.document.lyrics.vocalMode='instrumental';const p=songProposalFromProvider({...f,output:{text:'hallucinated words',words:[],language_code:''}});assert.throws(()=>reviewSongProviderProposal({...f,proposal:p,acknowledgeListening:true}),/instrumental/);
 assert.throws(()=>songProposalFromProvider({...f,endpoint:'elevenlabs/music/v2.5',output:{text:'wrong task',words:[]}}),/exact song/);
});
test('dense three-minute lyrics retain all six hundred measured word rows within existing storage bounds',()=>{
 const f=fixture('transcribe'),words=Array.from({length:600},(_,i)=>({text:'word'+i,type:'word',start:i*0.3,end:(i+1)*0.3})),text=words.map(w=>w.text).join(' ');f.document.technical=technicalSongEvidence(analyzeSongChannels({channels:[new Float32Array(8000*180)],sampleRate:8000}));
 const p=songProposalFromProvider({...f,output:{text,words,language_code:'en'}});f.document.lyrics={...f.document.lyrics,canonicalText:text,basis:'user_corrected'};
 const accepted=reviewSongProviderProposal({...f,proposal:p,acknowledgeListening:true,useTranscriptTiming:true});assert.equal(accepted.alignment.reduce((n,a)=>n+a.words.length,0),600);assert.equal(accepted.lyrics.canonicalText,text);assert.equal(accepted.alignment.at(-1).endMs,180000);assert.deepEqual(normalizeSongIntelligence(accepted),accepted);
});
