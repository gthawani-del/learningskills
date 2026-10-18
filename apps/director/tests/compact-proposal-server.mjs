// Offline provider simulation only; this fixture never contacts a model endpoint.
import {LocalStore} from '../store.mjs';
import {newProject} from '../domain.mjs';
import {planningSchemaHash} from '../planning-profile.mjs';
import {createServer} from '../server.mjs';

const store=await new LocalStore().init(),endpoint='https://api.openai.com/v1/responses',version='synthetic-planning-model',expiresAt=new Date(Date.now()+3600000).toISOString();
store.state.models=[{id:'O-local',provider:'openai',endpoint,model_version:version,active:true,execution_tested:true,quality_validated:true,capabilities:{planning:{enabled:true,version:'v1',background:true,providerRetentionAcknowledged:true,contextWindowTokens:1000,maxOutputTokens:100,maxRequestBytes:100000,tokenBoundEvidence:{verified:true,model:version,contextWindowTokens:1000,type:'context-window-upper-bound',tokenizerVersion:'synthetic-context',sourceUrl:'https://example.test/tokens',expiresAt}}},schema_evidence:{verified:true,version:'s1',endpoint,modelVersion:version,inputSchemaHash:planningSchemaHash,sourceUrl:'https://example.test/schema',expiresAt},price_version:'p1',price_evidence:{verified:true,version:'p1',model:version,currency:'USD',sourceUrl:'https://example.test/price',expiresAt,input:{numeratorMicroUsd:1,denominatorTokens:1},cachedInput:{numeratorMicroUsd:0,denominatorTokens:1},output:{numeratorMicroUsd:2,denominatorTokens:1}}}];
store.state.operationalControl.generationPaused=false;
const project=newProject({title:'Compact proposal proof',premise:'An Indian cooking oil brand wants a warm family cooking advertisement.',format:'advertisement'},'demo-user');await store.create(project);
let submits=0,polls=0;
const plan={title:'A station',treatment:'A traveller watches the morning train arrive.',scenes:[{id:'s1',description:'A station.'}],shots:Array.from({length:4},(_,i)=>({id:'shot'+i,sceneId:'s1',description:'The traveller waits.',durationSeconds:15,dialogue:'',camera:'Static medium shot.',continuity:'Same coat.'}))};
const planningProvider={submit:async()=>({id:'resp_compact_'+(++submits),status:'queued',usage:null}),poll:async({responseId,request})=>{polls++;const input=JSON.parse(request.body.input);return{id:responseId,status:'completed',usage:{inputTokens:10,outputTokens:5,cachedInputTokens:0},briefProposal:{inputSignature:input.context.inputSignature,fields:Object.fromEntries(['purpose','audience','audienceResponse','platform','aspectRatio','visualStyle','tone','setting','cast','voice','product','constraints','budget','format','duration','language'].map(key=>[key,{value:key==='purpose'?'A conflicting proposed purpose':key==='tone'?'Loud and exaggerated':key==='visualStyle'?'Natural light and restrained camera movement':null,status:['purpose','tone','visualStyle'].includes(key)?'inferred':'unknown',source:'model',evidence:[]}]))}};}};
const server=await createServer({env:{DIRECTOR_DEMO:'1',DIRECTOR_PLANNING_ENABLED:'1',OPENAI_API_KEY:'synthetic-no-network',OPENAI_STORY_MODEL:version},store,planningProvider});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:project.id,port:server.address().port})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));

