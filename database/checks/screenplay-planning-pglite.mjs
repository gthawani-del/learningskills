// Disposable PostgreSQL/WASM proof. No native project or provider calls.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {newProject,hash} from '../../apps/director/domain.mjs';
import {applyBriefCommand,currentBrief} from '../../apps/director/public/creative-brief-core.js';
import {applyScreenplayCommand,currentScreenplay,screenplayOriginality,screenplayPlanningContext} from '../../apps/director/public/screenplay-core.js';
import {buildPlanningRequest,quotePlanningBound} from '../../apps/director/planning-provider.mjs';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_PACKAGE||'/tmp/director-pg-proof/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(),base=new URL('../',import.meta.url),passed=[];
const owner='11111111-1111-4111-8111-111111111111',foreign='99999999-9999-4999-8999-999999999999';
const query=(s,a=[])=>db.query(s,a),rpc=async(n,a)=>(await query(`select public.${n}(${a.map((_,i)=>'$'+(i+1)).join(',')}) value`,a)).rows[0].value;
async function denied(action,pattern){await db.exec('savepoint denial');try{await action();throw Error('Expected rejection missing');}catch(e){assert.match(e.message,pattern);}finally{await db.exec('rollback to savepoint denial;release savepoint denial');}}
async function artifact(p,key,content,version){const id=randomUUID();await query('insert into public.director_artifacts(id,project_id,logical_key,kind,version,content,content_hash)values($1,$2,$3,$3,$4,$5,$6)',[id,p.id,key,version,content,hash(content)]);return id;}
async function save(p){await query('update public.director_projects set brief=$1 where id=$2',[p,p.id]);}
const approve=(p,{report=screenplayOriginality(p),ack=true,decision='approved',actor=owner,archive=p.screenplay,version=p.version}={})=>rpc('director_approve_screenplay',[actor,p.id,version,p.screenplay.currentVersion,archive,report,ack,decision]);
try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql as 'select null::uuid';");
 for(const f of ['director-foundation.sql','director-dispatch-claims.sql','20261017235051_production_record_currentness.sql','director-recursive-approval-guards.sql','director-durable-quotes.sql','20261018002640_director_operational_controls.sql','director-planning-consent.sql','director-structured-brief-planning.sql','director-screenplay-planning.sql']){try{await db.exec(await readFile(new URL(f,base),'utf8'));}catch(e){console.error('INSTALL FAILED',f,e.message,e.position);throw e;}}
 await db.exec('begin');await query('insert into auth.users(id)values($1),($2)',[owner,foreign]);await db.exec('update public.director_operational_controls set generation_paused=false where id=1');
 let p=newProject({title:'The cup',premise:'A potter repairs a cup.'},owner);p=applyBriefCommand(p,{expectedVersion:p.version,action:'suggest'});
 const original='Beneath the battered copper lantern the potter carefully joined the broken blue porcelain cup before sunrise.';
 p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'add_source',source:{title:'Owned draft',text:original,permittedUse:'user_owned'}});
 p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'use_source',sourceId:p.screenplay.sources[0].id});
 await query('insert into public.director_projects(id,owner_id,title,brief)values($1,$2,$3,$4)',[p.id,owner,p.title,p]);
 const briefId=await artifact(p,'brief',currentBrief(p),p.creativeBrief.currentVersion),storyId=await artifact(p,'story',p.story,p.story.version),scriptId=await artifact(p,'screenplay',currentScreenplay(p),p.screenplay.currentVersion);
 await db.exec('set local role service_role');
 assert.equal(await rpc('director_artifact_is_current',[p.id,scriptId]),true);
 await denied(()=>approve(p),/screenplay_review_required/);passed.push('current script artifact recognized; unapproved brief and unresolved source findings hold approval');
 await query("insert into public.director_approvals(project_id,artifact_id,actor_id,decision)values($1,$2,$3,'approved')",[p.id,briefId,owner]);
 await query("insert into public.director_approvals(project_id,artifact_id,actor_id,decision)values($1,$2,$3,'approved')",[p.id,storyId,owner]);
 await denied(()=>query("insert into public.director_approvals(project_id,artifact_id,actor_id,decision)values($1,$2,$3,'approved')",[p.id,scriptId,owner]),/screenplay_review_required/);
 const report=screenplayOriginality(p);assert.ok(report.findings.length>0);await denied(()=>approve(p),/screenplay_review_required/);
 p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'record_review',dispositions:report.findings.map(f=>({findingKey:f.key,decision:'authorized_use',note:'This is my supplied draft; declaration is not verified ownership.'}))});await save(p);
 await denied(()=>approve(p,{ack:false}),/screenplay_review_required/);
 await denied(()=>approve(p,{actor:foreign}),/not_project_owner/);
 await denied(()=>approve(p,{version:p.version-1}),/screenplay_approval_stale/);
 await denied(()=>approve(p,{archive:{...p.screenplay,revisionRequest:{instruction:'Forged',sceneIds:[]}}}),/screenplay_approval_stale/);passed.push('direct approval lacks evidence; explicit acknowledgement, ownership, revision and exact archive checked under project lock');
 for(const bad of [{...report,truncated:true},{...report,legalClearance:true},{...report,inputSignature:JSON.stringify({policyVersion:report.policyVersion,text:'Changed script',sources:[]})},{...report,inputSignature:JSON.stringify({...JSON.parse(report.inputSignature),sources:[]})}])await denied(()=>approve(p,{report:bad}),/screenplay_review_required/);
 const accepted=await approve(p);assert.equal(accepted.artifactId,'screenplay');assert.equal(accepted.originality.legalClearance,false);assert.equal(await rpc('director_current_screenplay_approved',[p.id]),true);assert.equal(await rpc('director_document_approval_ready',[p.id,'story',p.story.version]),true);passed.push('scan input independently bound to exact script text/source collection; complete declared-use review passes with limited coverage');
 const approvedP=structuredClone(p);p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'set_revision',revisionRequest:{instruction:'A quieter ending.',sceneIds:[]}});await save(p);assert.equal(await rpc('director_current_screenplay_approved',[p.id]),true);passed.push('saving a requested revision preserves current approved script until a replacement is applied');
 p=applyScreenplayCommand(p,{expectedVersion:p.version,action:'record_review',dispositions:[]});await save(p);assert.equal(await rpc('director_current_screenplay_approved',[p.id]),false);assert.equal(await rpc('director_document_approval_ready',[p.id,'story',p.story.version]),false);await denied(()=>approve(p),/screenplay_review_required/);passed.push('later review removing a use declaration holds downstream production without changing script version');
 p=structuredClone(approvedP);await save(p);await query("update public.director_projects set brief=jsonb_set(brief,'{premise}','\"Changed source premise.\"') where id=$1",[p.id]);assert.equal(await rpc('director_artifact_is_current',[p.id,scriptId]),false);assert.equal(await rpc('director_current_screenplay_approved',[p.id]),false);
 const stale={...p,premise:'Changed source premise.'};await denied(()=>approve(stale),/artifact_superseded|screenplay_review_required/);assert.equal((await approve(stale,{decision:'revoked'})).decision,'revoked');await save(p);passed.push('source-stale screenplay cannot be approved; revocation remains possible while stale');

 // A separate project exercises actual v3 planning command and SQL snapshot triggers.
 const now=Date.now(),expiresAt=new Date(now+600000).toISOString(),model='configured-test-model';
 const price={verified:true,model,version:'planning-price-v1',currency:'USD',input:{numeratorMicroUsd:2,denominatorTokens:10},cachedInput:{numeratorMicroUsd:1,denominatorTokens:10},output:{numeratorMicroUsd:10,denominatorTokens:10},sourceUrl:'https://example.test/pricing',expiresAt};
 const planning={enabled:true,version:'planning-v3',maxOutputTokens:100,contextWindowTokens:1000,maxRequestBytes:100000,tokenBoundEvidence:{verified:true,type:'context-window-upper-bound',sourceUrl:'https://example.test/context',expiresAt,tokenizerVersion:'bound-v1',model,contextWindowTokens:1000}};
 const schema={verified:true,version:'planning-schema-v3',endpoint:'https://api.openai.com/v1/responses',modelVersion:model,inputSchemaHash:'a'.repeat(64),expiresAt,sourceUrl:'https://example.test/schema'};
 await query("insert into public.director_models(id,provider,endpoint,model_version,active,execution_tested,quality_validated,capabilities,schema_evidence,price_evidence,price_version)values('OPENAI_TEST','openai',$1,$2,true,true,true,$3,$4,$5,$6)",[schema.endpoint,model,{planning},schema,price,price.version]);
 const raw=(await query("select to_jsonb(m) row from public.director_models m where id='OPENAI_TEST'")).rows[0].row,profile={fingerprint:hash(raw),expiresAt,maxCallMicroUsd:300,modelId:raw.id,modelVersion:model,priceVersion:price.version};
 let q=newProject({title:'Planning script',premise:'A traveller waits for dawn.'},owner);q=applyBriefCommand(q,{expectedVersion:q.version,action:'suggest'});await query('insert into public.director_projects(id,owner_id,title,brief)values($1,$2,$3,$4)',[q.id,owner,q.title,q]);
 const qBriefId=await artifact(q,'brief',currentBrief(q),q.creativeBrief.currentVersion);await query("insert into public.director_approvals(project_id,artifact_id,actor_id,decision)values($1,$2,$3,'approved')",[q.id,qBriefId,owner]);
 const ordinal=Number((await query('select max(ordinal) n from public.director_approvals where project_id=$1',[q.id])).rows[0].n),scope={briefScopeHash:'b'.repeat(64),approvedDecisionDigest:'c'.repeat(64),approvalOrdinal:ordinal};
 const command=(name,body)=>rpc('director_planning_command',[owner,q.id,q.version,randomUUID(),name,body,scope,profile]);
 const grant=(await command('grant_planning',{maxMicroUsd:1000,finishReserveMicroUsd:100,maxCalls:3})).result;
 const request=buildPlanningRequest({brief:q.premise,duration:60,model,maxOutputTokens:100,operation:'write_script',context:{approved:true,status:'approved',screenplay:screenplayPlanningContext(q)}});
 const boundQuote=quotePlanningBound({request,pricing:price,tokenEvidence:{verified:true,requestHash:request.requestHash,model,tokenizerVersion:'bound-v1',inputTokenUpperBound:1000,sourceUrl:'https://example.test/context',expiresAt,type:'context-window-upper-bound',contextWindowTokens:1000},now});
 const reserve={consentId:grant.id,operation:'write_script',requestHash:request.requestHash,quotedMicroUsd:300,request,boundQuote,apiRequest:{operation:'write_script'},apiRequestFingerprint:hash({operation:'write_script'})};
 const call=(await command('reserve_planning',reserve)).result;assert.equal(call.operation,'write_script');
 const changed=applyScreenplayCommand(q,{expectedVersion:q.version,action:'add_source',source:{title:'New reference',text:original,permittedUse:'reference_only'}});
 await query("update public.director_projects set brief=jsonb_set(brief,'{screenplay}',$1) where id=$2",[changed.screenplay,q.id]);
 await denied(()=>command('reserve_planning',reserve),/planning_screenplay_scope_changed/);await denied(()=>command('claim_planning',{reservationId:call.id}),/planning_screenplay_scope_changed/);
 await save(q);assert.equal((await command('claim_planning',{reservationId:call.id})).result.claimed,true);
 await query("update public.director_projects set brief=jsonb_set(brief,'{screenplay}',$1) where id=$2",[changed.screenplay,q.id]);await rpc('director_planning_record_response',[owner,q.id,call.id,'resp_known_screenplay']);assert.equal((await rpc('director_planning_read',[owner,q.id,call.id])).providerResponseId,'resp_known_screenplay');
 const settled=(await command('settle_planning',{reservationId:call.id,outcome:'completed',providerResponseId:'resp_known_screenplay',usage:{inputTokens:100,cachedInputTokens:0,outputTokens:10},actualMicroUsd:30,resultHash:hash({screenplay:'fixture'}),result:{screenplay:'fixture'}})).result;assert.equal(settled.status,'completed');assert.equal(settled.actualMicroUsd,30);passed.push('write_script v3 reserves/claims once; exact source archive change fences reserve/claim despite unchanged revision/hash; known-ID recovery and settlement survive edit');

 const permissions=(await query("select has_function_privilege('anon','public.director_approve_screenplay(uuid,uuid,integer,integer,jsonb,jsonb,boolean,text)','EXECUTE') anon,has_function_privilege('authenticated','public.director_current_screenplay_approved(uuid)','EXECUTE') authenticated")).rows[0];assert.equal(permissions.anon,false);assert.equal(permissions.authenticated,false);const security=(await query("select bool_and(not prosecdef and proconfig @> array['search_path=\"\"']) ok from pg_proc where proname in('director_approve_screenplay','director_current_screenplay_approved','director_screenplay_report_valid')")).rows[0];assert.equal(security.ok,true);passed.push('new functions are security invoker with empty search path and no browser execute; functional transitions run as service_role');
 await db.exec('rollback');assert.equal(Number((await query('select count(*) n from public.director_projects')).rows[0].n),0);assert.equal(Number((await query('select count(*) n from public.director_approvals')).rows[0].n),0);passed.push('full rollback removes synthetic projects, approvals and reservations');
 const evidence={environment:'isolated PGlite PostgreSQL/WASM; no provider/native transport',passed,productionApplied:false,limitations:['sequential single-connection proof; true concurrent-session lock races remain untested','fuzzy source matching remains trusted service code; SQL independently binds its exact input and declared-use dispositions','project source comparison is not global plagiarism detection or legal clearance']};console.log(JSON.stringify(evidence,null,2));if(process.env.PROOF_OUTPUT)await writeFile(process.env.PROOF_OUTPUT,JSON.stringify(evidence,null,2)+'\n');
}catch(error){console.error('PROOF FAILED',error.message,error.where||'',error.position||'',error.stack);process.exitCode=1;}finally{await db.close();}
