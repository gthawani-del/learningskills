// Actual local HTTP/API fixture. Identity lookup and model responses are synthetic;
// it never contacts Supabase, OpenAI, fal or any other paid service.
import {fileURLToPath} from 'node:url';
import {LocalStore} from '../store.mjs';
import {newProject} from '../domain.mjs';
import {applyBriefCommand} from '../public/creative-brief-core.js';
import {createServer} from '../server.mjs';
import {syntheticPlanningModel} from './writing-fixture-server.mjs';
import {reviewedPlanningFixture} from './planning-fixture-profile.mjs';
export const registryActors={owner:'11111111-1111-4111-8111-111111111111',operator:'22222222-2222-4222-8222-222222222222',reviewer:'33333333-3333-4333-8333-333333333333',support:'44444444-4444-4444-8444-444444444444',customer:'55555555-5555-4555-8555-555555555555'};
export function servingPlanningModel(){const model=syntheticPlanningModel();model.id='O-serving';model.capabilities.priority=0;return reviewedPlanningFixture(model);}
export function registryCandidate(modelId='O-candidate',{operations=['write_script'],priority=50}={}){
 const model=reviewedPlanningFixture({...syntheticPlanningModel(),id:modelId},{operations});
 model.capabilities.priority=priority;model.price_evidence.input.numeratorMicroUsd=2;model.price_evidence.output.numeratorMicroUsd=3;
 const review={schemaVerified:true,pricingVerified:true,executionTested:true,qualityValidated:true,execution:structuredClone(model.capabilities.reviewEvidence.execution),quality:structuredClone(model.capabilities.reviewEvidence.quality),notes:'Synthetic offline evidence for an explicitly reviewed writing route.'};
 const profile=Object.fromEntries(['provider','endpoint','model_version','capabilities','schema_evidence','price_evidence','price_version','routing_profiles'].map(key=>[key,structuredClone(model[key])]));delete profile.capabilities.reviewEvidence;
 return {modelId,profile,review};
}
export async function registryFixtureStore(file){
 const store=await new LocalStore(file).init();store.state.models=[servingPlanningModel()];store.state.operationalControl.generationPaused=false;
 store.user=async token=>Object.values(registryActors).includes(token)?{id:token,email:'synthetic-role@example.test',user_metadata:{role:'owner',isAdmin:true}}:null;
 let project=newProject({title:'Registry routing proof',premise:'A station attendant chooses whether to keep a promise to a stranger.'},registryActors.owner);project=applyBriefCommand(project,{expectedVersion:project.version,action:'suggest'});await store.create(project);await store.approve(project,{artifactId:'brief',version:project.creativeBrief.currentVersion,decision:'approved',acknowledgeAssumptions:true},registryActors.owner);
 const env={SUPABASE_URL:'https://synthetic-auth.example.test',SUPABASE_SERVICE_ROLE_KEY:'synthetic-no-network',OPENAI_API_KEY:'synthetic-no-network',DIRECTOR_ADMIN_IDS:registryActors.owner,DIRECTOR_OPERATOR_IDS:registryActors.operator,DIRECTOR_REVIEWER_IDS:registryActors.reviewer,DIRECTOR_SUPPORT_IDS:registryActors.support};
 let submits=0;const planningProvider={submit:async()=>({id:`resp_registry_${++submits}`,status:'queued',usage:null}),poll:async()=>{throw Error('This fixture does not poll paid model output.');}};
 return {store,project,env,planningProvider,submits:()=>submits};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const f=await registryFixtureStore(),candidate=registryCandidate();const server=await createServer({env:f.env,store:f.store,planningProvider:f.planningProvider});
 server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port,projectId:f.project.id,actors:registryActors,candidate})));
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
