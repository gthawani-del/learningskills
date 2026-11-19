// Uses existing music fixture/storage/handler; synthetic provider, no network generation.
import {createServer} from '../server.mjs';
import {randomUUID} from 'node:crypto';
import {musicTreatmentFixture} from './music-treatment-fixture-server.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';
import {planningRequiredSchemaHash} from '../planning-profile.mjs';
import {songSession} from './song-provider-fixture-server.mjs';
const f=await musicTreatmentFixture({prepared:true}),model=reviewedPlanningFixture(f.store.state.models[0],{operations:['write_script','revise_script','plan_departments','revise_departments','director_turn']});
model.capabilities.planning.directorConversationVersion='director_conversation_v1';model.schema_evidence.inputSchemaHash=planningRequiredSchemaHash(model);f.store.state.models=[model];
f.planningProvider.submit=async({request})=>{const c=JSON.parse(request.body.input).context;return {id:'resp_director_browser_'+randomUUID().replaceAll('-',''),status:'completed',usage:{inputTokens:30,outputTokens:40,cachedInputTokens:0},directorProposal:{kind:'director_conversation_v1',message:'Preserve the approved cast and original recording. Let us revise only the second passage.',sourceDigest:c.sourceDigest,nextAction:{kind:'prepare_script_revision',sceneIds:[c.sceneIds[1]],departmentIds:[],instruction:'Strengthen the second passage emotionally; preserve every other sequence and the master recording.'},limitations:['Synthetic provider response; no media inspected.']}};};
const server=await createServer(f);server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({projectId:f.project.id,port:server.address().port,session:songSession,originalBase64:f.original.toString('base64')})));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
