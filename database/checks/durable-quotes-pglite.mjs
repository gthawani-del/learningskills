// Isolated PostgreSQL/WASM proof. No network, Supabase, provider or production credentials.
// Requires an already installed PGlite package; set PGLITE_PACKAGE to its index.js if needed.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {hash} from '../../apps/director/domain.mjs';
import {createCostQuote} from '../../apps/director/cost-quotes.mjs';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_PACKAGE||'/tmp/director-pg-proof/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(),base=new URL('../',import.meta.url),passed=[];
const owner='11111111-1111-4111-8111-111111111111',projectId='22222222-2222-4222-8222-222222222222';
const query=async(sql,args=[])=>db.query(sql,args);
const rpc=async(name,args)=>{const {rows}=await query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args);return rows[0].value;};
async function denied(action,pattern){await db.exec('savepoint denied_case');try{await action();throw Error('Expected denial did not occur');}catch(e){assert.match(e.message,pattern);}finally{await db.exec('rollback to savepoint denied_case; release savepoint denied_case');}}
try{
 await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid()RETURNS uuid LANGUAGE sql AS 'select null::uuid';`);
 for(const name of ['director-foundation.sql','director-dispatch-claims.sql','20261017235051_production_record_currentness.sql','director-recursive-approval-guards.sql','director-durable-quotes.sql'])await db.exec(await readFile(new URL(name,base),'utf8'));
 let fixture=await readFile(new URL('checks/recursive-approval-local.sql',base),'utf8');fixture=fixture.slice(fixture.indexOf('\nBEGIN;\n-- Fixture'),fixture.indexOf('\nROLLBACK;')).replaceAll("'fixture-hash'",`'${hash({version:1,treatment:'A keeper waits.'})}'`);
 await db.exec(fixture);passed.push('recursive positive/revocation/reference/cycle fixtures');
 const project=(await query('select brief from public.director_projects where id=$1',[projectId])).rows[0].brief;project.id=projectId;
 const now=Date.now(),expiry=new Date(now+600000).toISOString();
 const model={id:'LOCAL_TEST',provider:'fal',endpoint:'verified/media',model_version:'route-v1',active:true,execution_tested:true,quality_validated:true,capabilities:{tasks:['image_edit']},price_version:'price-v1',schema_evidence:{verified:true,version:'schema-v1',sourceUrl:'https://example.test/schema',endpoint:'verified/media',modelVersion:'route-v1',inputSchemaHash:'a'.repeat(64),expiresAt:expiry},price_evidence:{verified:true,configurationVerified:true,configuration:{},version:'price-v1',currency:'USD',unit:'second',unitMicroUsd:125,rounding:'ceil',expiresAt:expiry,sourceUrl:'https://example.test/pricing'}};
 await query('insert into public.director_models(id,provider,endpoint,model_version,active,execution_tested,quality_validated,capabilities,price_version,schema_evidence,price_evidence)values($1,$2,$3,$4,true,true,true,$5,$6,$7,$8)',[model.id,model.provider,model.endpoint,model.model_version,model.capabilities,model.price_version,model.schema_evidence,model.price_evidence]);
 await db.exec('set local role service_role');
 const payload={duration:1.2},quote={...createCostQuote({project,artifactId:'story',artifactVersion:1,model,task:'image_edit',requirements:{},input:payload,now}),projectVersion:1};
 const request=randomUUID(),fingerprint=hash({task:'image_edit',input:payload,expectedVersion:1,requestId:request});
 const saved=await rpc('director_persist_quote',[owner,projectId,1,request,fingerprint,quote,payload]);assert.equal(saved.quote.id,quote.id);assert.equal(saved.replayed,false);
 const retry=await rpc('director_persist_quote',[owner,projectId,1,request,fingerprint,{...quote,id:'b'.repeat(64)},payload]);assert.equal(retry.replayed,true);assert.equal(retry.quote.id,quote.id);assert.equal(retry.proposal.id,saved.proposal.id);
 const preflight=await rpc('director_spending_replay',[owner,projectId,request,fingerprint]);assert.equal(preflight.quote.id,quote.id);
 await denied(()=>rpc('director_spending_replay',[owner,projectId,request,'f'.repeat(64)]),/spending_idempotency_conflict/);passed.push('durable quote + original-time replay + fingerprint conflict');
 await denied(()=>rpc('director_persist_quote',[owner,projectId,1,randomUUID(),'c'.repeat(64),{...quote,id:'c'.repeat(64),expiresAt:new Date(now-1000).toISOString()},payload]),/quote_contract_invalid/);
 await denied(()=>rpc('director_persist_quote',[owner,projectId,0,randomUUID(),'c'.repeat(64),quote,payload]),/project_version_conflict/);passed.push('expired and stale quotes rejected');
 // Authorization is financial consent only, even with no budget and revoked creative approval.
 const storyArtifact=(await query("select id from public.director_artifacts where project_id=$1 and logical_key='story'",[projectId])).rows[0].id;
 await query("insert into public.director_approvals(project_id,artifact_id,actor_id,decision)values($1,$2,$3,'revoked')",[projectId,storyArtifact,owner]);
 const authRequest=randomUUID(),authExpiry=new Date(now+240000).toISOString(),args=[owner,projectId,1,authRequest,quote.id,500,0,authExpiry];const auth=await rpc('director_authorize_quote',args);assert.equal(auth.authorization.max_micro_usd,500);assert.equal((await rpc('director_authorize_quote',args)).replayed,true);passed.push('consent separate from creative approval/budget; authorization replay');
 await query("update public.director_models set model_version='changed' where id=$1",[model.id]);await denied(()=>rpc('director_authorize_quote',[owner,projectId,1,randomUUID(),quote.id,500,0,authExpiry]),/quote_contract_invalid/);await query("update public.director_models set model_version='route-v1' where id=$1",[model.id]);passed.push('registry change invalidates authorization');
 await query("insert into public.director_approvals(project_id,artifact_id,actor_id,decision)values($1,$2,$3,'approved')",[projectId,storyArtifact,owner]);
 await rpc('director_set_project_budget',[owner,projectId,1,randomUUID(),500,0]);
 const units=[];for(let i=0;i<3;i++){const id=randomUUID();units.push(id);await query('insert into public.director_work_units(id,project_id,logical_key,artifact_id)values($1,$2,$3,$4)',[id,projectId,'unit-'+i,storyArtifact]);}
 const reserve=unit=>rpc('director_reserve_job',[owner,projectId,unit,saved.proposal.id,auth.authorization.id,randomUUID(),quote.payloadHash]);
 await query("update public.director_models set model_version='changed' where id=$1",[model.id]);await denied(()=>reserve(units[0]),/quote_contract_invalid/);await query("update public.director_models set model_version='route-v1' where id=$1",[model.id]);
 const first=await reserve(units[0]),second=await reserve(units[1]);assert.equal(first.reserved_micro_usd,250);assert.equal(second.reserved_micro_usd,250);
 await denied(()=>reserve(units[2]),/budget_exceeded|project_budget_exceeded/);passed.push('sequential reservations conserve cap and deny third spend (not multiclient race proof)');
 await query("update public.director_models set model_version='changed' where id=$1",[model.id]);await denied(()=>rpc('director_claim_job',[first.id]),/quote_contract_invalid/);assert.equal((await query('select status from public.director_jobs where id=$1',[first.id])).rows[0].status,'reserved');await query("update public.director_models set model_version='route-v1' where id=$1",[model.id]);assert.equal((await rpc('director_claim_job',[first.id])).status,'submitted');passed.push('post-authorization registry changes block reservation and claim; unchanged quote claims successfully');
 await query("update public.director_jobs set status='unknown',charge_state='unknown' where id=$1",[first.id]);
 await denied(()=>rpc('director_set_project_budget',[owner,projectId,1,randomUUID(),499,0]),/project_budget_below_existing_exposure/);
 const revokeArgs=[owner,projectId,1,randomUUID(),auth.authorization.id,'Stop further generation'];const revoked=await rpc('director_revoke_authorization',revokeArgs);assert.ok(revoked.authorization.revoked_at);assert.equal((await rpc('director_revoke_authorization',revokeArgs)).replayed,true);
 assert.equal((await query('select charge_state from public.director_jobs where id=$1',[first.id])).rows[0].charge_state,'unknown');await denied(()=>reserve(units[2]),/authorization_invalid/);passed.push('unknown hold retained across cap reduction rejection and authorization revocation');

 const compositeInput={duration:1.25,num_images:2,image_size:{width:1000,height:500},text:'A😀e\u0301'};
 const component=(id,unit,numeratorMicroUsd,denominatorUnits=1,extra={})=>({id,unit,rate:{numeratorMicroUsd,denominatorUnits},rounding:'ceil',...extra});
 const compositeModel={...model,price_version:'tariff-v1',price_evidence:{verified:true,configurationVerified:true,configuration:{},version:'tariff-v1',currency:'USD',expiresAt:expiry,sourceUrl:'https://example.test/tariff',tariff:{schemaVersion:1,version:'tariff-v1',components:[component('base','request',10),component('seconds','second',3,2),component('images','image',11,1,{includedUnits:1}),component('pixels','megapixel',5),component('unicode','character',1,1,{characterCounting:'unicode_codepoint'}),component('utf16','character',1,1,{characterCounting:'utf16_code_unit'}),component('utf8','character',1,1,{characterCounting:'utf8_byte'}),component('thousands','thousand_character',80,1,{characterCounting:'unicode_codepoint'}),component('minimum','second',3,1,{minimumUnits:2})]}}};
 await query('update public.director_models set price_version=$1,price_evidence=$2 where id=$3',[compositeModel.price_version,compositeModel.price_evidence,model.id]);
 const composite={...createCostQuote({project,artifactId:'story',artifactVersion:1,model:compositeModel,task:'image_edit',requirements:{},input:compositeInput,now}),projectVersion:1};
 const compositeSaved=await rpc('director_persist_quote',[owner,projectId,1,randomUUID(),hash({compositeInput}),composite,compositeInput]);assert.equal(compositeSaved.quote.totalMicroUsd,composite.totalMicroUsd);
 const compositeAuth=await rpc('director_authorize_quote',[owner,projectId,1,randomUUID(),composite.id,composite.totalMicroUsd*2,0,authExpiry]);assert.ok(compositeAuth.authorization.id);
 const modified=structuredClone(composite);modified.id='d'.repeat(64);modified.components[0].costMicroUsd++;await denied(()=>rpc('director_persist_quote',[owner,projectId,1,randomUUID(),'d'.repeat(64),modified,compositeInput]),/quote_contract_invalid/);

 const contracts=[{name:'scalar',model,quote,payload},{name:'composite',model:compositeModel,quote:composite,payload:compositeInput}];
 for(const contract of contracts){
 const paths=[['schema_evidence','expiresAt'],['schema_evidence','version'],['schema_evidence','sourceUrl'],['schema_evidence','verified'],['price_evidence','expiresAt'],['price_evidence','version'],['price_evidence','sourceUrl'],['price_evidence','configuration'],['price_evidence','verified'],['price_evidence','configurationVerified']];
 if(contract.name==='scalar')paths.push(['price_evidence','unitMicroUsd']);else paths.push(['price_evidence','tariff','components',0,'rate','numeratorMicroUsd'],['price_evidence','tariff','components',0,'rate','denominatorUnits']);
 for(const path of paths)for(const omitted of [false,true]){
 const badModel=structuredClone(contract.model),badQuote=structuredClone(contract.quote),quotePath=[path[0]==='schema_evidence'?'schemaEvidence':'priceEvidence',...path.slice(1)];
 const alter=(object,path)=>{let parent=object;for(const key of path.slice(0,-1))parent=parent[key];if(omitted)delete parent[path.at(-1)];else parent[path.at(-1)]=null;};alter(badModel,path);alter(badQuote,quotePath);
 if(path[1]==='version'&&path[0]==='schema_evidence'){if(omitted)delete badQuote.schemaVersion;else badQuote.schemaVersion=null;}
 if(path[1]==='configuration'){if(omitted)delete badQuote.priceConfiguration;else badQuote.priceConfiguration=null;}
 if(path[1]==='unitMicroUsd'){if(omitted)delete badQuote.unitMicroUsd;else badQuote.unitMicroUsd=null;}
 const check=(await query('select public.director_quote_contract_valid($1,$2,jsonb_populate_record(null::public.director_models,$3)) as ok',[badQuote,contract.payload,badModel])).rows[0].ok;assert.equal(check,false,`${contract.name} ${path.join('.')} ${omitted?'omitted':'null'} must hold`);
 }
 }
 passed.push('scalar/composite omitted and JSON-null expiry/version/source/verification/configuration/rate matrices fail closed');
 const tokenModel=structuredClone(compositeModel);tokenModel.price_evidence.tariff.components=[component('tokens','output_token',1)];await query('update public.director_models set price_evidence=$1 where id=$2',[tokenModel.price_evidence,model.id]);
 const tokenQuote={...composite,id:'e'.repeat(64),priceEvidence:tokenModel.price_evidence,components:[{id:'tokens',unit:'output_token',quantityNumerator:'1',quantityDenominator:'1',billableNumerator:'1',billableDenominator:'1',includedUnits:0,minimumUnits:0,rounding:'ceil',costMicroUsd:1}],totalMicroUsd:1};await denied(()=>rpc('director_persist_quote',[owner,projectId,1,randomUUID(),'e'.repeat(64),tokenQuote,compositeInput]),/quote_contract_invalid/);
 passed.push('exact composite second/image/megapixel/Unicode+UTF16+UTF8/thousand-character/request arithmetic, allowances/minima, tamper rejection and token hold');

 const profile={verified:true,task:'image_edit',modelId:model.id,endpoint:model.endpoint,modelVersion:model.model_version,evidenceVersion:'intent-v1',expiresAt:new Date(now+120000).toISOString(),evaluatedAt:new Date(now-1000).toISOString(),sourceUrl:'https://example.test/intent',sampleCount:20,styles:['photoreal']};
 const profileModel={...model,routing_profiles:[profile]},profileQuote={...quote,intent:{style:'photoreal'},intentEvidence:{evidenceVersion:profile.evidenceVersion,evidenceHash:hash(profile),expiresAt:profile.expiresAt,evaluatedAt:profile.evaluatedAt},expiresAt:profile.expiresAt};delete profileQuote.id;profileQuote.id=hash(profileQuote);
 await query('update public.director_models set price_version=$1,price_evidence=$2,routing_profiles=$3 where id=$4',[model.price_version,model.price_evidence,[profile],model.id]);
 assert.ok((await rpc('director_persist_quote',[owner,projectId,1,randomUUID(),hash({profile}),profileQuote,payload])).proposal.id);
 const checkIntent=async candidate=>(await query('select public.director_quote_contract_valid($1,$2,jsonb_populate_record(null::public.director_models,$3)) as ok',[candidate,payload,profileModel])).rows[0].ok;
 for(const field of ['evidenceVersion','evidenceHash','expiresAt','evaluatedAt'])for(const omitted of [false,true]){const bad=structuredClone(profileQuote);if(omitted)delete bad.intentEvidence[field];else bad.intentEvidence[field]=null;assert.equal(await checkIntent(bad),false);}
 assert.equal(await checkIntent({...profileQuote,expiresAt:quote.expiresAt}),false);assert.equal(await checkIntent({...profileQuote,intentEvidence:{...profileQuote.intentEvidence,evidenceVersion:'other'}}),false);
 const expiredProfile=structuredClone(profileModel);expiredProfile.routing_profiles[0].expiresAt=new Date(now-1000).toISOString();const expiredIntent=structuredClone(profileQuote);expiredIntent.intentEvidence.expiresAt=expiredProfile.routing_profiles[0].expiresAt;assert.equal((await query('select public.director_quote_contract_valid($1,$2,jsonb_populate_record(null::public.director_models,$3)) as ok',[expiredIntent,payload,expiredProfile])).rows[0].ok,false);
 passed.push('meaningful intent requires fresh model-bound profile metadata/hash attestation; null/omitted/mismatched/expired attestations and overlong quote expiry held');
 const permissions=(await query("select has_function_privilege('anon','public.director_persist_quote(uuid,uuid,integer,uuid,text,jsonb,jsonb)','EXECUTE') as anon,has_function_privilege('authenticated','public.director_authorize_quote(uuid,uuid,integer,uuid,text,bigint,bigint,timestamptz)','EXECUTE') as customer")).rows[0];assert.equal(permissions.anon,false);assert.equal(permissions.customer,false);passed.push('customer RPC execution denied; functional RPCs executed as service_role');
 await db.exec('ROLLBACK');for(const table of ['public.director_projects','auth.users','public.director_jobs'])assert.equal(Number((await query('select count(*) n from '+table)).rows[0].n),0);passed.push('rollback leaves no fixture users/projects/jobs');
 const evidence={environment:'isolated PGlite PostgreSQL/WASM; no production database',passed,limitations:['single-connection sequential transactions; no true cross-session lock race proof','no paid provider calls, production credentials, cloud Auth or Storage tests','trusted server canonical hashes; SQL compares exact stored JSON payload/snapshots'],productionApplied:false};console.log(JSON.stringify(evidence,null,2));if(process.env.PROOF_OUTPUT)await writeFile(process.env.PROOF_OUTPUT,JSON.stringify(evidence,null,2)+'\n');
}catch(error){console.error('PROOF FAILED:',error.message,error.where||'');process.exitCode=1;}finally{await db.close();}
