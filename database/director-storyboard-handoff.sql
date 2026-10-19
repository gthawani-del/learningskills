-- Additive, source-bound storyboard shot contracts and whole-plan review.
-- CLI is unavailable in this workspace; reviewed named SQL follows the native
-- MCP migration workflow. Requires director-department-revisions.sql.
-- This increment creates no board images, animatic, model routes or paid jobs.
begin;
alter table public.director_approvals add column storyboard_evidence jsonb;
alter table public.director_planning_consents add column storyboard_handoff_snapshot jsonb not null default 'null';

-- The fixed editorial v1 graph reaches all 17 departments. Validate that graph
-- once, then inspect each exact immutable snapshot and latest owner approval.
-- No session/global cache or caller-supplied 'approved' flag grants authority.
create function public.director_storyboard_prerequisites_approved(p_project_id uuid)
returns boolean language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;department jsonb;snapshot jsonb;a public.director_artifacts;approval public.director_approvals;department_id text;n integer;editorial_version integer;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id;p.brief=p.brief||'{}'::jsonb;if p.id is null or jsonb_typeof(p.brief->'creativeBrief')is distinct from'object'or jsonb_typeof(p.brief->'screenplay')is distinct from'object'or not public.director_current_brief_approved(p.id)or not public.director_current_screenplay_approved(p.id)or jsonb_typeof(p.brief->'departmentPlanning'->'departments')is distinct from'array'or jsonb_array_length(p.brief->'departmentPlanning'->'departments')<>17 then return false;end if;
 select count(*),min(d.value::text)::jsonb into n,department from jsonb_array_elements(p.brief->'departmentPlanning'->'departments')d where d.value->>'id'='editorial';if n<>1 or jsonb_typeof(department->'currentVersion')is distinct from'number'or(department->>'currentVersion')::numeric not between 1 and 100 or(department->>'currentVersion')::numeric<>trunc((department->>'currentVersion')::numeric)then return false;end if;editorial_version=(department->>'currentVersion')::integer;
 if not public.director_department_snapshot_current(p.brief,'editorial',editorial_version)then return false;end if;
 foreach department_id in array array['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights']loop
 select count(*),min(d.value::text)::jsonb into n,department from jsonb_array_elements(p.brief->'departmentPlanning'->'departments')d where d.value->>'id'=department_id;if n<>1 then return false;end if;
 select count(*),min(v.value::text)::jsonb into n,snapshot from jsonb_array_elements(department->'versions')v where v.value->'version'=department->'currentVersion';if n<>1 then return false;end if;
 select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='department:'||department_id and x.kind='department_plan'and x.version=(department->>'currentVersion')::integer;if a.id is null or a.content is distinct from(jsonb_build_object('departmentId',department_id)||snapshot)then return false;end if;
 select x.*into approval from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;
 if approval.actor_id is distinct from p.owner_id or approval.decision is distinct from'approved'or approval.department_evidence->'acknowledgePlanningOnly'is distinct from'true'::jsonb or approval.department_evidence->>'departmentId'is distinct from department_id or approval.department_evidence->'departmentVersion'is distinct from department->'currentVersion'then return false;end if;
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_storyboard_source_current(p_document jsonb,p_source_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'storyboardHandoff';source jsonb;signature jsonb;binding jsonb;department jsonb;n integer;i integer:=0;k text;editorial_version integer;ids text[]:=array['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights'];
begin
 if p_source_version is null or p_source_version not between 1 and 50 or jsonb_typeof(archive->'sources') is distinct from 'array' then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,source from jsonb_array_elements(archive->'sources')s where s.value->'version'=to_jsonb(p_source_version);
 if n<>1 or jsonb_typeof(source->'inputSignature') is distinct from 'string' then return false;end if;signature=(source->>'inputSignature')::jsonb;
 if jsonb_typeof(signature) is distinct from 'object' or not(signature ?& array['departmentSourceSignature','departmentVersions']) or jsonb_typeof(signature->'departmentSourceSignature') is distinct from 'string' or jsonb_typeof(signature->'departmentVersions') is distinct from 'array' or jsonb_array_length(signature->'departmentVersions')<>17 or jsonb_typeof(p_document->'departmentPlanning'->'sources') is distinct from 'array' or jsonb_typeof(p_document->'departmentPlanning'->'departments') is distinct from 'array' then return false;end if;
 for k in select jsonb_object_keys(signature)loop if k not in('departmentSourceSignature','departmentVersions')then return false;end if;end loop;
 if not exists(select 1 from jsonb_array_elements(p_document->'departmentPlanning'->'sources')s where s.value->>'inputSignature'=signature->>'departmentSourceSignature' and public.director_department_revision_source_current(p_document,(s.value->>'version')::integer))then return false;end if;
 for binding in select value from jsonb_array_elements(signature->'departmentVersions')loop
 i=i+1;if jsonb_typeof(binding) is distinct from 'object' or not(binding ?& array['departmentId','version']) or binding->>'departmentId' is distinct from ids[i] or jsonb_typeof(binding->'version') is distinct from 'number' or (binding->>'version')::numeric not between 1 and 100 or (binding->>'version')::numeric<>trunc((binding->>'version')::numeric)then return false;end if;
 for k in select jsonb_object_keys(binding)loop if k not in('departmentId','version')then return false;end if;end loop;
 select count(*),min(d.value::text)::jsonb into n,department from jsonb_array_elements(p_document->'departmentPlanning'->'departments')d where d.value->>'id'=binding->>'departmentId';
 if n<>1 or department->'currentVersion' is distinct from binding->'version'then return false;end if;if binding->>'departmentId'='editorial'then editorial_version=(binding->>'version')::integer;end if;
 end loop;
 -- The fixed v1 editorial dependency DAG reaches all 17 departments. One bounded
 -- traversal validates the whole exact pinned graph without 17 repeated walks.
 return public.director_department_snapshot_current(p_document,'editorial',editorial_version);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_storyboard_contract_document_valid(p_document jsonb,p_contract jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare script jsonb;scene jsonb;line jsonb;item jsonb;ref jsonb;k text;field text;n integer;seen text[]:='{}';ids text[]:='{}';character_ids text[]:='{}';required text[]:=array['sceneId','title','purpose','action','characterIds','dialogueIds','durationSeconds','timingBasis','framing','camera','lighting','startState','endState','continuity','requirements','referenceRequirements','controls','audioCues','performancePath'];
begin
 if jsonb_typeof(p_contract) is distinct from 'object' or not(p_contract ?& required) then return false;end if;for k in select jsonb_object_keys(p_contract)loop if not(k=any(required))then return false;end if;end loop;
 foreach k in array array['sceneId','title','purpose','action','framing','camera','lighting','startState','endState','continuity','performancePath']loop if jsonb_typeof(p_contract->k) is distinct from 'string' or k not in('action','continuity')and length(btrim(p_contract->>k))<1 or length(p_contract->>k)>(case when k in('action','continuity')then 12000 when k in('title','framing')then 200 when k='sceneId'then 80 else 2000 end)then return false;end if;end loop;
 if p_contract->>'performancePath'is null or p_contract->>'performancePath'not in('silent_or_ambient','audio_first','joint_av','unresolved')then return false;end if;
 if p_contract->>'timingBasis' is distinct from 'planning_estimate' or jsonb_typeof(p_contract->'durationSeconds') is distinct from 'number' or (p_contract->>'durationSeconds')::numeric<=0 or (p_contract->>'durationSeconds')::numeric>900 or jsonb_typeof(p_contract->'characterIds') is distinct from 'array' or jsonb_array_length(p_contract->'characterIds')>30 or jsonb_typeof(p_contract->'dialogueIds') is distinct from 'array' or jsonb_array_length(p_contract->'dialogueIds')>100 then return false;end if;
 select s.value->'document' into script from jsonb_array_elements(p_document->'screenplay'->'versions')s where s.value->'version'=p_document->'screenplay'->'currentVersion';
 select count(*),min(s.value::text)::jsonb into n,scene from jsonb_array_elements(script->'scenes')s where s.value->>'id'=p_contract->>'sceneId';if n<>1 then return false;end if;
 for item in select value from jsonb_array_elements(p_contract->'characterIds')loop if jsonb_typeof(item) is distinct from 'string' or item #>> '{}'=any(character_ids) or not exists(select 1 from jsonb_array_elements(script->'characters')c where c.value->'id'=item)then return false;end if;character_ids=array_append(character_ids,item #>> '{}');end loop;
 for item in select value from jsonb_array_elements(p_contract->'dialogueIds')loop if jsonb_typeof(item) is distinct from 'string' or item #>> '{}'=any(ids)then return false;end if;ids=array_append(ids,item #>> '{}');select count(*),min(d.value::text)::jsonb into n,line from jsonb_array_elements(scene->'dialogue')d where d.value->'id'=item;if n<>1 or not(line->>'characterId'=any(character_ids))then return false;end if;end loop;
 if jsonb_typeof(p_contract->'requirements') is distinct from 'array' or jsonb_array_length(p_contract->'requirements') not between 1 and 40 then return false;end if;
 foreach k in array array['requirements','referenceRequirements','controls','audioCues']loop
 if jsonb_typeof(p_contract->k) is distinct from 'array' or jsonb_array_length(p_contract->k)>(case when k='referenceRequirements' then 30 else 40 end)then return false;end if;seen='{}';
 for item in select value from jsonb_array_elements(p_contract->k)loop
 if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') is distinct from 'string' or coalesce(item->>'id','')!~'^[A-Za-z][A-Za-z0-9_-]{0,79}$' or item->>'id'=any(seen)then return false;end if;seen=array_append(seen,item->>'id');
 if k='requirements' then
 if not(item ?& array['id','requirement','priority','acceptanceEvidence','failureCondition']) or item->>'priority' is null or item->>'priority' not in('mandatory','flexible') or jsonb_typeof(item->'requirement') is distinct from 'string' or length(btrim(item->>'requirement')) not between 1 and 12000 or jsonb_typeof(item->'acceptanceEvidence') is distinct from 'string' or length(btrim(item->>'acceptanceEvidence')) not between 1 and 2000 or jsonb_typeof(item->'failureCondition') is distinct from 'string' or length(btrim(item->>'failureCondition')) not between 1 and 1000 then return false;end if;
 for field in select jsonb_object_keys(item)loop if field not in('id','requirement','priority','acceptanceEvidence','failureCondition')then return false;end if;end loop;
 elsif k='referenceRequirements' then
 if not(item ?& array['id','role','characterIds','direction']) or item->>'role' is null or item->>'role' not in('identity','look','location','product','composition','lighting','performance') or jsonb_typeof(item->'characterIds') is distinct from 'array' or jsonb_array_length(item->'characterIds')>30 then return false;end if;for field in select jsonb_object_keys(item)loop if field not in('id','role','characterIds','direction')then return false;end if;end loop;ids='{}';for ref in select value from jsonb_array_elements(item->'characterIds')loop if jsonb_typeof(ref) is distinct from 'string' or not(ref #>> '{}'=any(character_ids)) or ref #>> '{}'=any(ids)then return false;end if;ids=array_append(ids,ref #>> '{}');end loop;
 elsif k='controls' then if not(item ?& array['id','direction','classification']) or item->>'classification' is null or item->>'classification' not in('prompt_only','reference_required','route_verification_required')then return false;end if;for field in select jsonb_object_keys(item)loop if field not in('id','direction','classification')then return false;end if;end loop;
 else if not(item ?& array['id','type','direction']) or item->>'type' is null or item->>'type' not in('dialogue','music','ambience','effect','silence')then return false;end if;for field in select jsonb_object_keys(item)loop if field not in('id','type','direction')then return false;end if;end loop;
 end if;
 if k<>'requirements' and (jsonb_typeof(item->'direction') is distinct from 'string' or length(btrim(item->>'direction')) not between 1 and 2000)then return false;end if;
 end loop;end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_storyboard_projection_matches(p_document jsonb,p_shot_id text,p_contract jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare flat jsonb;script jsonb;scene jsonb;dialogue text;constraints text;n integer;
begin
 if jsonb_typeof(p_document->'shots') is distinct from 'array' then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,flat from jsonb_array_elements(p_document->'shots')s where s.value->>'id'=p_shot_id;if n<>1 then return false;end if;
 select s.value->'document' into script from jsonb_array_elements(p_document->'screenplay'->'versions')s where s.value->'version'=p_document->'screenplay'->'currentVersion';select s.value into scene from jsonb_array_elements(script->'scenes')s where s.value->>'id'=p_contract->>'sceneId';
 select coalesce(string_agg(d.value->>'text',E'\n' order by ref.ordinality),'')into dialogue from jsonb_array_elements(p_contract->'dialogueIds')with ordinality ref(value,ordinality)join lateral jsonb_array_elements(scene->'dialogue')d on d.value->'id'=ref.value;
 select coalesce(string_agg(r.value->>'requirement',E'\n' order by r.ordinality),'')into constraints from jsonb_array_elements(p_contract->'requirements')with ordinality r(value,ordinality)where r.value->>'priority'='mandatory';
 if length(dialogue)>100000 or length(constraints)>60000 then return false;end if;
 return coalesce(flat->'title'=p_contract->'title' and flat->'description'=p_contract->'action' and flat->'duration'=p_contract->'durationSeconds' and flat->'framing'=p_contract->'framing' and flat->'camera'=p_contract->'camera' and flat->'sceneId'=p_contract->'sceneId' and flat->'continuity'=p_contract->'continuity' and flat->>'dialogue'=dialogue and flat->>'constraints'=constraints and jsonb_typeof(flat->'version')='number' and (flat->>'version')::numeric between 1 and 2147483647 and (flat->>'version')::numeric=trunc((flat->>'version')::numeric),false);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

-- Saving a draft may retain historical sources or older sequence pins while the
-- user repairs one contract. Validate its exact source-bound flat projection;
-- freshness, complete coverage and acceptance criteria are approval gates below.
create function public.director_storyboard_archive_projection_valid(p_document jsonb)
returns boolean language plpgsql immutable security invoker set search_path=''as $$
declare archive jsonb:=p_document->'storyboardHandoff';sequence jsonb;binding jsonb;record jsonb;snapshot jsonb;source jsonb;signature jsonb;source_script jsonb;bound_document jsonb;seen text[]:='{}';n integer;i integer:=0;
begin
 if jsonb_typeof(archive)is distinct from'object'or jsonb_typeof(archive->'sources')is distinct from'array'or jsonb_array_length(archive->'sources')not between 1 and 50 or jsonb_typeof(archive->'shots')is distinct from'array'or jsonb_array_length(archive->'shots')not between 1 and 200 or jsonb_typeof(archive->'sequences')is distinct from'array'or jsonb_array_length(archive->'sequences')not between 1 and 100 or jsonb_typeof(p_document->'shots')is distinct from'array'then return false;end if;
 sequence=archive->'sequences'->-1;if jsonb_typeof(sequence->'version')is distinct from'number'or sequence->'version'is distinct from to_jsonb(jsonb_array_length(archive->'sequences'))or jsonb_typeof(sequence->'shots')is distinct from'array'or jsonb_array_length(sequence->'shots')<>jsonb_array_length(archive->'shots')or jsonb_array_length(sequence->'shots')<>jsonb_array_length(p_document->'shots')then return false;end if;
 for binding in select value from jsonb_array_elements(sequence->'shots')loop
 if jsonb_typeof(binding)is distinct from'object'or jsonb_typeof(binding->'shotId')is distinct from'string'or binding->>'shotId'=any(seen)or jsonb_typeof(binding->'version')is distinct from'number'or(binding->>'version')::numeric not between 1 and 100 or(binding->>'version')::numeric<>trunc((binding->>'version')::numeric)or p_document->'shots'->i->'id'is distinct from binding->'shotId'then return false;end if;seen=array_append(seen,binding->>'shotId');i=i+1;
 select count(*),min(s.value::text)::jsonb into n,record from jsonb_array_elements(archive->'shots')s where s.value->'id'=binding->'shotId';if n<>1 or jsonb_typeof(record->'currentVersion')is distinct from'number'or(record->>'currentVersion')::numeric not between 1 and 100 or(record->>'currentVersion')::numeric<>trunc((record->>'currentVersion')::numeric)or jsonb_typeof(record->'versions')is distinct from'array'or record->'currentVersion'is distinct from to_jsonb(jsonb_array_length(record->'versions'))or not exists(select 1 from jsonb_array_elements(record->'versions')v where v.value->'version'=binding->'version')then return false;end if;
 select count(*),min(v.value::text)::jsonb into n,snapshot from jsonb_array_elements(record->'versions')v where v.value->'version'=record->'currentVersion';if n<>1 or jsonb_typeof(snapshot->'sourceVersion')is distinct from'number'or(snapshot->>'sourceVersion')::numeric not between 1 and 50 or(snapshot->>'sourceVersion')::numeric<>trunc((snapshot->>'sourceVersion')::numeric)then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,source from jsonb_array_elements(archive->'sources')s where s.value->'version'=snapshot->'sourceVersion';if n<>1 or jsonb_typeof(source->'inputSignature')is distinct from'string'then return false;end if;signature=(source->>'inputSignature')::jsonb;source_script=((signature->>'departmentSourceSignature')::jsonb)->'screenplay'->'document';
 if jsonb_typeof(source_script)is distinct from'object'then return false;end if;
 bound_document=jsonb_set(p_document,'{screenplay}',jsonb_build_object('currentVersion',1,'versions',jsonb_build_array(jsonb_build_object('version',1,'document',source_script))),true);
 if not public.director_storyboard_contract_document_valid(bound_document,snapshot->'document')or not public.director_storyboard_projection_matches(bound_document,record->>'id',snapshot->'document')then return false;end if;
 end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_storyboard_contract_current(p_document jsonb,p_shot_id text,p_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare record jsonb;snapshot jsonb;n integer;
begin
 if p_shot_id is null or p_shot_id!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$' or p_version is null or p_version not between 1 and 100 or jsonb_typeof(p_document->'storyboardHandoff'->'shots') is distinct from 'array' then return false;end if;
 select count(*),min(s.value::text)::jsonb into n,record from jsonb_array_elements(p_document->'storyboardHandoff'->'shots')s where s.value->>'id'=p_shot_id;if n<>1 or record->'currentVersion' is distinct from to_jsonb(p_version) or jsonb_typeof(record->'versions') is distinct from 'array' then return false;end if;
 select count(*),min(v.value::text)::jsonb into n,snapshot from jsonb_array_elements(record->'versions')v where v.value->'version'=to_jsonb(p_version);
 return coalesce(n=1 and jsonb_typeof(snapshot->'sourceVersion')='number' and (snapshot->>'sourceVersion')::numeric=trunc((snapshot->>'sourceVersion')::numeric) and public.director_storyboard_source_current(p_document,(snapshot->>'sourceVersion')::integer) and public.director_storyboard_contract_document_valid(p_document,snapshot->'document') and public.director_storyboard_projection_matches(p_document,p_shot_id,snapshot->'document'),false);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_storyboard_sequence_current(p_document jsonb,p_version integer)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare archive jsonb:=p_document->'storyboardHandoff';sequence jsonb;binding jsonb;record jsonb;snapshot jsonb;script jsonb;scene jsonb;line jsonb;dialogue_id jsonb;seen_shots text[]:='{}';seen_scenes text[]:='{}';seen_dialogue text[]:='{}';i integer:=0;
begin
 if p_version is null or p_version not between 1 and 100 or jsonb_typeof(archive->'sequences') is distinct from 'array' or jsonb_array_length(archive->'sequences') not between 1 and 100 or jsonb_typeof(archive->'shots') is distinct from 'array' or jsonb_array_length(archive->'shots') not between 1 and 200 or jsonb_typeof(p_document->'shots') is distinct from 'array' then return false;end if;
 sequence=archive->'sequences'->-1;if sequence->'version' is distinct from to_jsonb(p_version) or jsonb_typeof(sequence->'shots') is distinct from 'array' or jsonb_array_length(sequence->'shots')<>jsonb_array_length(archive->'shots') or jsonb_array_length(p_document->'shots')<>jsonb_array_length(sequence->'shots') then return false;end if;
 for binding in select value from jsonb_array_elements(sequence->'shots')loop
 if jsonb_typeof(binding) is distinct from 'object' or jsonb_typeof(binding->'shotId') is distinct from 'string' or binding->>'shotId'=any(seen_shots) or jsonb_typeof(binding->'version') is distinct from 'number' or (binding->>'version')::numeric<>trunc((binding->>'version')::numeric) or not public.director_storyboard_contract_current(p_document,binding->>'shotId',(binding->>'version')::integer) or p_document->'shots'->i->'id' is distinct from binding->'shotId' then return false;end if;
 i=i+1;seen_shots=array_append(seen_shots,binding->>'shotId');select s.value into record from jsonb_array_elements(archive->'shots')s where s.value->'id'=binding->'shotId';select v.value into snapshot from jsonb_array_elements(record->'versions')v where v.value->'version'=binding->'version';seen_scenes=array_append(seen_scenes,snapshot->'document'->>'sceneId');
 for dialogue_id in select value from jsonb_array_elements(snapshot->'document'->'dialogueIds')loop if dialogue_id #>> '{}'=any(seen_dialogue)then return false;end if;seen_dialogue=array_append(seen_dialogue,dialogue_id #>> '{}');end loop;
 end loop;
 select s.value->'document'into script from jsonb_array_elements(p_document->'screenplay'->'versions')s where s.value->'version'=p_document->'screenplay'->'currentVersion';
 for scene in select value from jsonb_array_elements(script->'scenes')loop if not(scene->>'id'=any(seen_scenes))then return false;end if;for line in select value from jsonb_array_elements(scene->'dialogue')loop if not(line->>'id'=any(seen_dialogue))then return false;end if;end loop;end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

do $$
declare definition text;anchor text:='if p_key=''story'' then';artifact_anchor text:='public.director_artifact_is_current(';
begin
 definition=pg_get_functiondef('public.director_document_artifact_is_current(jsonb,text,integer)'::regprocedure);if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'storyboard_document_currentness_baseline_mismatch';end if;
 execute replace(definition,anchor,'if left(p_key,14)=''shot_contract:'' then return public.director_storyboard_contract_current(p_document,substr(p_key,15),p_version);end if; if p_key=''storyboard_sequence'' then return public.director_storyboard_sequence_current(p_document,p_version);end if; '||anchor);
 definition=pg_get_functiondef('public.director_artifact_is_current(uuid,uuid)'::regprocedure);if(length(definition)-length(replace(definition,artifact_anchor,'')))/length(artifact_anchor)<>1 then raise exception 'storyboard_content_currentness_baseline_mismatch';end if;execute replace(definition,artifact_anchor,'public.director_storyboard_legacy_artifact_is_current(');
end $$;

-- Materialize stored JSONB once to avoid repeated TOAST decompression within
-- the source/contract checks; this stores or caches no authority.
-- Keep each earlier artifact kind on its exact prior implementation. Plan kinds
-- avoid repeatedly expanding the generic SQL function's JSON subqueries.
create or replace function public.director_artifact_is_current(p_project_id uuid,p_artifact_id uuid)
returns boolean language plpgsql security invoker set search_path=''as $$
declare a public.director_artifacts;document jsonb;record jsonb;snapshot jsonb;n integer;
begin
 select x.*into a from public.director_artifacts x where x.project_id=p_project_id and x.id=p_artifact_id;if a.id is null then return false;end if;
 if left(a.logical_key,14)='shot_contract:'or a.logical_key='storyboard_sequence'or a.kind in('shot_contract','storyboard_sequence')then
 select p.brief||'{}'::jsonb into document from public.director_projects p where p.id=p_project_id;if document is null then return false;end if;
 if left(a.logical_key,14)='shot_contract:'and a.kind='shot_contract'then
 if not public.director_storyboard_contract_current(document,substr(a.logical_key,15),a.version)then return false;end if;
 select s.value into record from jsonb_array_elements(document->'storyboardHandoff'->'shots')s where s.value->>'id'=substr(a.logical_key,15);select v.value into snapshot from jsonb_array_elements(record->'versions')v where v.value->'version'=to_jsonb(a.version);return coalesce(a.content=jsonb_build_object('shotId',record->'id')||snapshot,false);
 elsif a.logical_key='storyboard_sequence'and a.kind='storyboard_sequence'then return coalesce(public.director_storyboard_sequence_current(document,a.version)and a.content=document->'storyboardHandoff'->'sequences'->-1,false);
 else return false;end if;
 end if;return public.director_storyboard_legacy_artifact_is_current(p_project_id,p_artifact_id);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_storyboard_handoff_complete(p_document jsonb)
returns boolean language plpgsql immutable security invoker set search_path=''as $$
declare record jsonb;snapshot jsonb;document jsonb;
begin
 if jsonb_typeof(p_document->'storyboardHandoff'->'shots')is distinct from'array'or jsonb_array_length(p_document->'storyboardHandoff'->'shots')<1 then return false;end if;
 for record in select value from jsonb_array_elements(p_document->'storyboardHandoff'->'shots')loop select v.value into snapshot from jsonb_array_elements(record->'versions')v where v.value->'version'=record->'currentVersion';document=snapshot->'document';if coalesce(length(btrim(document->>'action')),0)<1 or coalesce(length(btrim(document->>'continuity')),0)<1 or not exists(select 1 from jsonb_array_elements(document->'requirements')r where r.value->>'priority'='mandatory')then return false;end if;end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_current_storyboard_handoff_approved(p_project_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;sequence jsonb;binding jsonb;a public.director_artifacts;approval public.director_approvals;targets jsonb;target jsonb;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id;p.brief=p.brief||'{}'::jsonb;if p.id is null then return false;end if;
 if not(p.brief ? 'storyboardHandoff')or p.brief->'storyboardHandoff'='null'::jsonb then return true;end if;
 if not public.director_storyboard_prerequisites_approved(p.id)then return false;end if;
 sequence=p.brief->'storyboardHandoff'->'sequences'->-1;if not public.director_storyboard_sequence_current(p.brief,(sequence->>'version')::integer)or not public.director_storyboard_handoff_complete(p.brief)then return false;end if;
 targets=jsonb_build_array(jsonb_build_object('key','storyboard_sequence','version',sequence->'version'));for binding in select value from jsonb_array_elements(sequence->'shots')loop targets=targets||jsonb_build_array(jsonb_build_object('key','shot_contract:'||(binding->>'shotId'),'version',binding->'version'));end loop;
 for target in select value from jsonb_array_elements(targets)loop select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key=target->>'key'and x.version=(target->>'version')::integer;if a.id is null or not public.director_artifact_is_current(p.id,a.id)then return false;end if;select x.*into approval from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;if approval.actor_id is distinct from p.owner_id or approval.decision is distinct from 'approved'or approval.storyboard_evidence->'acknowledgePlanningOnly'is distinct from'true'::jsonb then return false;end if;end loop;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;

create function public.director_guard_storyboard_handoff_approval()returns trigger language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;a public.director_artifacts;e jsonb:=new.storyboard_evidence;
begin
 select x.*into p from public.director_projects x where x.id=new.project_id for update;p.brief=p.brief||'{}'::jsonb;select x.*into a from public.director_artifacts x where x.id=new.artifact_id and x.project_id=p.id;
 if a.kind not in('shot_contract','storyboard_sequence')then if e is not null then raise exception 'storyboard_evidence_wrong_artifact';end if;return new;end if;
 if new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;
 if new.decision='approved'and(jsonb_typeof(e)is distinct from'object'or e->>'archiveHash'is distinct from encode(sha256(convert_to((p.brief->'storyboardHandoff')::text,'UTF8')),'hex')or e->'acknowledgePlanningOnly'is distinct from'true'::jsonb or (e->>'expectedVersion')::integer is distinct from(p.brief->>'version')::integer or e->'sequenceVersion'is distinct from p.brief->'storyboardHandoff'->'sequences'->-1->'version'or not public.director_storyboard_prerequisites_approved(p.id)or not public.director_storyboard_handoff_complete(p.brief)or not public.director_artifact_is_current(p.id,a.id))then raise exception 'storyboard_review_required';end if;return new;
end $$;
create trigger storyboard_handoff_approval_guard before insert on public.director_approvals for each row execute function public.director_guard_storyboard_handoff_approval();

create function public.director_approve_storyboard_handoff(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_archive jsonb,p_sequence_version integer,p_ack_planning_only boolean,p_decision text)
returns jsonb language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;sequence jsonb;binding jsonb;a public.director_artifacts;approval public.director_approvals;e jsonb;counted integer:=0;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id for update;p.brief=p.brief||'{}'::jsonb;if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception 'not_project_owner';end if;
 if p_decision is null or p_decision not in('approved','rejected','revoked')or p_sequence_version is null or p_sequence_version not between 1 and 100 then raise exception 'storyboard_decision_invalid';end if;
 sequence=p.brief->'storyboardHandoff'->'sequences'->-1;if p_expected_version is null or(p.brief->>'version')::integer is distinct from p_expected_version or p_archive is distinct from p.brief->'storyboardHandoff'or sequence->'version'is distinct from to_jsonb(p_sequence_version)then raise exception 'storyboard_approval_stale';end if;
 if p_decision='approved'then
 if p_ack_planning_only is distinct from true or not public.director_storyboard_prerequisites_approved(p.id)or not public.director_storyboard_sequence_current(p.brief,p_sequence_version)or not public.director_storyboard_handoff_complete(p.brief)then raise exception 'storyboard_review_required';end if;
 e=jsonb_build_object('archiveHash',encode(sha256(convert_to(p_archive::text,'UTF8')),'hex'),'sequenceVersion',p_sequence_version,'expectedVersion',p_expected_version,'acknowledgePlanningOnly',true);
 for binding in select value from jsonb_array_elements(sequence->'shots')loop select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='shot_contract:'||(binding->>'shotId')and x.kind='shot_contract'and x.version=(binding->>'version')::integer;if a.id is null then raise exception 'storyboard_artifact_missing';end if;insert into public.director_approvals(project_id,artifact_id,actor_id,decision,storyboard_evidence)values(p.id,a.id,p_actor_id,'approved',e);counted=counted+1;end loop;
 end if;
 select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='storyboard_sequence'and x.kind='storyboard_sequence'and x.version=p_sequence_version;if a.id is null then raise exception 'storyboard_artifact_missing';end if;
 insert into public.director_approvals(project_id,artifact_id,actor_id,decision,storyboard_evidence)values(p.id,a.id,p_actor_id,p_decision,e)returning*into approval;
 insert into public.director_audit_events(project_id,actor_id,event_type,details)values(p.id,p_actor_id,'storyboard_handoff_approval',jsonb_build_object('sequenceVersion',p_sequence_version,'decision',p_decision,'approvedContractCount',counted,'planningOnlyAcknowledged',p_ack_planning_only));
 return jsonb_build_object('id',approval.id,'projectId',p.id,'artifactId','storyboard_sequence','version',p_sequence_version,'decision',p_decision,'actorId',p_actor_id,'createdAt',approval.created_at,'approvedContractCount',counted,'planningOnlyAcknowledged',p_decision='approved');
end $$;

create function public.director_save_storyboard_handoff(p_actor_id uuid,p_project_id uuid,p_expected_version integer,p_expected_approval_id uuid,p_document jsonb,p_artifacts jsonb)
returns void language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;latest_approval_id uuid;old_flat jsonb;new_flat jsonb;old_contract jsonb;new_contract jsonb;managed text[]:=array['title','description','duration','framing','camera','sceneId','dialogue','continuity','constraints'];strip text[]:=managed||array['version','status'];changed boolean;expected_status jsonb;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id for update;p.brief=p.brief||'{}'::jsonb;if p.id is null or p_actor_id is null or p.owner_id is distinct from p_actor_id then raise exception 'not_project_owner';end if;
 if p_expected_version is null or(p.brief->>'version')::integer is distinct from p_expected_version or jsonb_typeof(p_document)is distinct from'object'or(p_document->>'version')::integer is distinct from p_expected_version+1 or jsonb_typeof(p_artifacts)is distinct from'array'then raise exception 'storyboard_save_version_invalid';end if;
 select a.id into latest_approval_id from public.director_approvals a where a.project_id=p.id order by a.ordinal desc limit 1;if latest_approval_id is distinct from p_expected_approval_id then raise exception 'storyboard_approval_changed';end if;
 if not public.director_storyboard_prerequisites_approved(p.id)then raise exception 'storyboard_source_approval_required';end if;
 if jsonb_typeof(p_document->'storyboardHandoff')is distinct from'object'or p_document-'storyboardHandoff'-'shots'-'version'is distinct from p.brief-'storyboardHandoff'-'shots'-'version'or not public.director_storyboard_archive_projection_valid(p_document)then raise exception 'storyboard_save_scope_invalid';end if;
 for old_flat in select value from jsonb_array_elements(coalesce(p.brief->'shots','[]'::jsonb))loop if not exists(select 1 from jsonb_array_elements(p_document->'shots')s where s.value->'id'=old_flat->'id')then raise exception 'storyboard_media_preservation_invalid';end if;end loop;
 for new_flat in select value from jsonb_array_elements(p_document->'shots')loop
 select s.value into old_flat from jsonb_array_elements(coalesce(p.brief->'shots','[]'::jsonb))s where s.value->'id'=new_flat->'id';
 if old_flat is not null then changed=old_flat-strip is distinct from new_flat-strip;
 if changed or jsonb_typeof(old_flat->'version')is distinct from'number'then raise exception 'storyboard_media_preservation_invalid';end if;
 select s.value into old_contract from jsonb_array_elements(coalesce(p.brief->'storyboardHandoff'->'shots','[]'::jsonb))s where s.value->'id'=new_flat->'id';select s.value into new_contract from jsonb_array_elements(p_document->'storyboardHandoff'->'shots')s where s.value->'id'=new_flat->'id';
 changed=(select coalesce(bool_or(old_flat->k is distinct from new_flat->k),false)from unnest(managed)k);changed=changed or old_contract is not null and old_contract->'currentVersion'is distinct from new_contract->'currentVersion';expected_status=case when coalesce(old_flat->>'status','')=''then '"draft"'::jsonb else old_flat->'status'end;
 if new_flat->'version'is distinct from to_jsonb((old_flat->>'version')::integer+case when changed then 1 else 0 end)or changed and new_flat->>'status'is distinct from'draft'or not changed and new_flat->'status'is distinct from expected_status then raise exception 'storyboard_projection_version_invalid';end if;
 else if new_flat->'version'is distinct from'1'::jsonb or new_flat->>'status'is distinct from'draft'or coalesce(new_flat->'clipAssetId','null'::jsonb)is distinct from'null'::jsonb or coalesce(new_flat->'referenceAssetId','null'::jsonb)is distinct from'null'::jsonb or coalesce(new_flat->'productionBindings','[]'::jsonb)is distinct from'[]'::jsonb then raise exception 'storyboard_media_preservation_invalid';end if;
 end if;end loop;
 perform public.director_save_project(p_actor_id,p_project_id,p_expected_version,p_document,p_artifacts);
end $$;

create function public.director_guard_storyboard_managed_projection()returns trigger language plpgsql security invoker set search_path=''as $$
declare previous jsonb;shot jsonb;old_shot jsonb;position integer:=0;managed text[]:=array['title','description','duration','framing','camera','sceneId','dialogue','continuity','constraints'];changed boolean;
begin
 if not(old.brief ? 'storyboardHandoff')or old.brief->'storyboardHandoff'='null'::jsonb or new.brief->'storyboardHandoff'is distinct from old.brief->'storyboardHandoff'then return new;end if;
 if new.brief->'shots'is not distinct from old.brief->'shots'then return new;end if;
 if jsonb_typeof(new.brief->'shots')is distinct from'array'or jsonb_array_length(new.brief->'shots')<>jsonb_array_length(old.brief->'shots')then raise exception 'storyboard_projection_edit_invalid';end if;
 for shot in select value from jsonb_array_elements(new.brief->'shots')loop
 old_shot=old.brief->'shots'->position;position=position+1;if shot->'id'is distinct from old_shot->'id'then raise exception 'storyboard_projection_edit_invalid';end if;
 changed=(select coalesce(bool_or(shot->k is distinct from old_shot->k),false)from unnest(managed)k);if changed then raise exception 'storyboard_projection_edit_invalid';end if;
 end loop;return new;
end $$;
create trigger storyboard_managed_projection_guard before update of brief on public.director_projects for each row execute function public.director_guard_storyboard_managed_projection();

create function public.director_storyboard_media_ready(p_project_id uuid,p_artifact_id uuid)
returns boolean language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;a public.director_artifacts;record jsonb;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id;p.brief=p.brief||'{}'::jsonb;if p.id is null then return false;end if;select x.*into a from public.director_artifacts x where x.project_id=p.id and x.id=p_artifact_id;
 if a.kind in('shot_contract','storyboard_sequence')or left(a.logical_key,14)='shot_contract:'or a.logical_key='storyboard_sequence'then return false;end if;
 if not(p.brief ? 'storyboardHandoff')or p.brief->'storyboardHandoff'='null'::jsonb then return true;end if;
 if a.id is null or not public.director_current_storyboard_handoff_approved(p.id)then return false;end if;
 if a.kind='shot'then select s.value into record from jsonb_array_elements(p.brief->'storyboardHandoff'->'shots')s where s.value->>'id'=a.logical_key;return coalesce(record is not null and public.director_storyboard_contract_current(p.brief,a.logical_key,(record->>'currentVersion')::integer),false);end if;return true;
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then return false;
end $$;
create function public.director_guard_storyboard_media_job()returns trigger language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;q public.director_proposals;
begin
 if TG_OP='UPDATE'then if not(old.status='reserved'and new.status='submitted')then return new;end if;end if;
 select x.*into p from public.director_projects x where x.id=new.project_id for update;p.brief=p.brief||'{}'::jsonb;select x.*into q from public.director_proposals x where x.id=new.proposal_id and x.project_id=p.id;
 if p.id is null or q.id is null or not public.director_storyboard_media_ready(p.id,q.artifact_id)then raise exception 'creative_dependencies_not_approved';end if;return new;
end $$;
create trigger director_storyboard_media_insert_guard before insert on public.director_jobs for each row execute function public.director_guard_storyboard_media_job();
create trigger director_storyboard_media_dispatch_guard before update of status on public.director_jobs for each row execute function public.director_guard_storyboard_media_job();
do $$
declare definition text;persist_anchor text:='if a.id is null or a.content_hash is distinct from p_quote->>''artifactContentHash''';authorize_anchor text:='if a.id is null or not public.director_artifact_is_current(p.id,a.id)';
begin
 definition=pg_get_functiondef('public.director_persist_quote(uuid,uuid,integer,uuid,text,jsonb,jsonb)'::regprocedure);if(length(definition)-length(replace(definition,persist_anchor,'')))/length(persist_anchor)<>1 then raise exception 'storyboard_quote_baseline_mismatch';end if;
 execute replace(definition,persist_anchor,'if not public.director_storyboard_media_ready(p.id,a.id)then raise exception ''storyboard_media_review_required'';end if; '||persist_anchor);
 definition=pg_get_functiondef('public.director_authorize_quote(uuid,uuid,integer,uuid,text,bigint,bigint,timestamptz)'::regprocedure);if(length(definition)-length(replace(definition,authorize_anchor,'')))/length(authorize_anchor)<>1 then raise exception 'storyboard_authorization_baseline_mismatch';end if;
 execute replace(definition,authorize_anchor,'if not public.director_storyboard_media_ready(p.id,a.id)then raise exception ''storyboard_media_review_required'';end if; '||authorize_anchor);
end $$;

create function public.director_capture_planning_storyboard_handoff()returns trigger language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;
begin
 select x.*into p from public.director_projects x where x.id=new.project_id for update;if p.id is null or new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;new.storyboard_handoff_snapshot=coalesce(p.brief->'storyboardHandoff','null'::jsonb);return new;
end $$;
create function public.director_guard_planning_storyboard_handoff()returns trigger language plpgsql security invoker set search_path=''as $$
declare p public.director_projects;c public.director_planning_consents;
begin
 if TG_OP='UPDATE'then if not(not old.submit_claimed and new.submit_claimed)then return new;end if;end if;
 select x.*into p from public.director_projects x where x.id=new.project_id for update;p.brief=p.brief||'{}'::jsonb;select x.*into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=p.id;
 if p.id is null or c.id is null or new.actor_id is distinct from p.owner_id or c.actor_id is distinct from p.owner_id or c.storyboard_handoff_snapshot is distinct from coalesce(p.brief->'storyboardHandoff','null'::jsonb)then raise exception 'planning_storyboard_scope_changed';end if;
 if new.operation='plan_storyboard'and(c.operation is distinct from'plan_storyboard'or jsonb_typeof(p.brief->'creativeBrief')is distinct from'object'or jsonb_typeof(p.brief->'screenplay')is distinct from'object'or not public.director_storyboard_prerequisites_approved(p.id))then raise exception 'planning_storyboard_prerequisites_required';end if;return new;
end $$;
create trigger capture_storyboard_handoff before insert on public.director_planning_consents for each row execute function public.director_capture_planning_storyboard_handoff();
create trigger current_storyboard_handoff_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_planning_storyboard_handoff();
create trigger current_storyboard_handoff_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_planning_storyboard_handoff();
alter table public.director_planning_reservations drop constraint director_planning_reservations_operation_check;
alter table public.director_planning_reservations add constraint director_planning_reservations_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments','plan_storyboard'));
alter table public.director_planning_consents drop constraint director_planning_consents_operation_check;
alter table public.director_planning_consents add constraint director_planning_consents_operation_check check(operation in('initial_plan','revise_plan','interpret_brief','write_script','revise_script','plan_departments','revise_departments','plan_storyboard'));
do $$
declare definition text;operations text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'',''plan_departments'',''revise_departments'')';expanded text:='not in(''initial_plan'',''revise_plan'',''interpret_brief'',''write_script'',''revise_script'',''plan_departments'',''revise_departments'',''plan_storyboard'')';version_test text:='case when p_body->>''operation''=''revise_departments'' then ''director-planning-v5'' when p_body->>''operation''=''plan_departments'' then ''director-planning-v4'' else ''director-planning-v3'' end';
begin
 definition=pg_get_functiondef('public.director_planning_command(uuid,uuid,integer,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);if(length(definition)-length(replace(definition,operations,'')))/length(operations)<>2 or(length(definition)-length(replace(definition,version_test,'')))/length(version_test)<>1 then raise exception 'storyboard_planning_command_baseline_mismatch';end if;
 definition=replace(definition,operations,expanded);definition=replace(definition,version_test,'case when p_body->>''operation''=''plan_storyboard'' then ''director-planning-v6'' when p_body->>''operation''=''revise_departments'' then ''director-planning-v5'' when p_body->>''operation''=''plan_departments'' then ''director-planning-v4'' else ''director-planning-v3'' end');execute definition;
 definition=pg_get_functiondef('public.director_registry_review_ready(text,jsonb,jsonb)'::regprocedure);if(length(definition)-length(replace(definition,operations,'')))/length(operations)<>1 then raise exception 'storyboard_registry_review_baseline_mismatch';end if;execute replace(definition,operations,expanded);
end $$;
revoke all on function public.director_artifact_is_current(uuid,uuid),public.director_storyboard_legacy_artifact_is_current(uuid,uuid),public.director_storyboard_prerequisites_approved(uuid),public.director_storyboard_source_current(jsonb,integer),public.director_storyboard_contract_document_valid(jsonb,jsonb),public.director_storyboard_projection_matches(jsonb,text,jsonb),public.director_storyboard_archive_projection_valid(jsonb),public.director_storyboard_contract_current(jsonb,text,integer),public.director_storyboard_sequence_current(jsonb,integer),public.director_storyboard_handoff_complete(jsonb),public.director_current_storyboard_handoff_approved(uuid),public.director_guard_storyboard_handoff_approval(),public.director_approve_storyboard_handoff(uuid,uuid,integer,jsonb,integer,boolean,text),public.director_save_storyboard_handoff(uuid,uuid,integer,uuid,jsonb,jsonb),public.director_guard_storyboard_managed_projection(),public.director_storyboard_media_ready(uuid,uuid),public.director_guard_storyboard_media_job(),public.director_capture_planning_storyboard_handoff(),public.director_guard_planning_storyboard_handoff()from public,anon,authenticated;
grant execute on function public.director_artifact_is_current(uuid,uuid),public.director_storyboard_legacy_artifact_is_current(uuid,uuid),public.director_storyboard_prerequisites_approved(uuid),public.director_storyboard_source_current(jsonb,integer),public.director_storyboard_contract_document_valid(jsonb,jsonb),public.director_storyboard_projection_matches(jsonb,text,jsonb),public.director_storyboard_archive_projection_valid(jsonb),public.director_storyboard_contract_current(jsonb,text,integer),public.director_storyboard_sequence_current(jsonb,integer),public.director_storyboard_handoff_complete(jsonb),public.director_current_storyboard_handoff_approved(uuid),public.director_guard_storyboard_handoff_approval(),public.director_approve_storyboard_handoff(uuid,uuid,integer,jsonb,integer,boolean,text),public.director_save_storyboard_handoff(uuid,uuid,integer,uuid,jsonb,jsonb),public.director_guard_storyboard_managed_projection(),public.director_storyboard_media_ready(uuid,uuid),public.director_guard_storyboard_media_job(),public.director_capture_planning_storyboard_handoff(),public.director_guard_planning_storyboard_handoff()to service_role;
comment on column public.director_approvals.storyboard_evidence is'SQL-computed SHA-256 of exact whole handoff JSONB archive, sequence/project versions and explicit planning-only review. The locked RPC compares the full incoming archive; immutable artifacts retain individual reviewed snapshots. Shot contracts and sequence review are not generated storyboard frames, accepted performance/audio/media, spending authority or finished animatic.';
comment on column public.director_planning_consents.storyboard_handoff_snapshot is'Exact handoff archive at allowance creation. Edits hold new reservations/claims; known request recovery/accounting remain available.';
commit;
