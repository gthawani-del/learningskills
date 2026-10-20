-- PREPARED ONLY. Requires screenplay, department planning and department revisions.
-- Binds the shared song_intelligence_v1 edit record into existing source signatures
-- and planning consent/dispatch fences. No model activation, spending or new service.
begin;

create function public.director_song_source_binding(p_document jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare records jsonb;record jsonb;snapshot jsonb;master jsonb;binding jsonb;current_version integer;n integer;matches integer:=0;k text;
begin
 if p_document->>'format' is distinct from 'music_video' then return null;end if;
 records=p_document->'production'->'records';if records is null or records='null'::jsonb then return null;end if;
 if jsonb_typeof(records) is distinct from 'array' then raise exception using errcode='22023',message='song_intelligence_binding_invalid';end if;
 for record in select value from jsonb_array_elements(records) loop
  if record->>'type' is distinct from 'edit' then continue;end if;
  if jsonb_typeof(record->'versions') is distinct from 'array' or jsonb_typeof(record->'currentVersion') is distinct from 'number' or (record->>'currentVersion')::numeric not between 1 and 100 or (record->>'currentVersion')::numeric<>trunc((record->>'currentVersion')::numeric) then raise exception using errcode='22023',message='song_intelligence_binding_invalid';end if;
  current_version=(record->>'currentVersion')::integer;
  select count(*),min(v.value::text)::jsonb into n,snapshot from jsonb_array_elements(record->'versions') v where v.value->'version'=to_jsonb(current_version);
  if n<>1 then raise exception using errcode='22023',message='song_intelligence_binding_invalid';end if;
  if snapshot->'content'->>'kind' is distinct from 'song_intelligence_v1' then continue;end if;
  matches=matches+1;
  if matches>1 or jsonb_typeof(record->'id') is distinct from 'string' or record->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception using errcode='22023',message='song_intelligence_binding_invalid';end if;
  master=snapshot->'content'->'master';
  if jsonb_typeof(master) is distinct from 'object' or not(master ?& array['assetId','assetVersion','checksum','durationMs','timingBasis']) then raise exception using errcode='22023',message='song_intelligence_binding_invalid';end if;
  for k in select jsonb_object_keys(master) loop if k not in('assetId','assetVersion','checksum','durationMs','timingBasis') then raise exception using errcode='22023',message='song_intelligence_binding_invalid';end if;end loop;
  if jsonb_typeof(master->'assetId') is distinct from 'string' or length(btrim(master->>'assetId')) not between 1 and 100 or jsonb_typeof(master->'assetVersion') is distinct from 'number' or (master->>'assetVersion')::numeric not between 1 and 100000 or (master->>'assetVersion')::numeric<>trunc((master->>'assetVersion')::numeric) or jsonb_typeof(master->'checksum') is distinct from 'string' or master->>'checksum' !~ '^[a-f0-9]{64}$' or jsonb_typeof(master->'durationMs') is distinct from 'number' or (master->>'durationMs')::numeric not between 1000 and 3600000 or (master->>'durationMs')::numeric<>trunc((master->>'durationMs')::numeric) or master->>'timingBasis' is distinct from 'user_reviewed' then raise exception using errcode='22023',message='song_intelligence_binding_invalid';end if;
  binding=jsonb_build_object('recordId',record->'id','version',to_jsonb(current_version),'master',master);
 end loop;
 return binding;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception using errcode='22023',message='song_intelligence_binding_invalid';
end $$;

-- The dependency increment retained director_department_source_current beneath
-- its recursive wrapper. Change only source reconstruction; preserve that wrapper,
-- old signatures without music, all artifact checks and existing error handling.
do $$
declare signature text;definition text;anchor text;replacement text;
begin
 foreach signature in array array['public.director_screenplay_snapshot_current(jsonb,integer)','public.director_department_source_current(jsonb,text,integer)','public.director_department_revision_source_current(jsonb,integer)'] loop
  definition=pg_get_functiondef(signature::regprocedure);
  anchor=case when signature like '%director_screenplay_snapshot_current%' then 'return (snapshot->>''inputSignature'')::jsonb=expected;' else 'return (source->>''inputSignature'')::jsonb=expected;' end;
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'song_source_currentness_baseline_mismatch';end if;
  replacement='expected=expected||jsonb_strip_nulls(jsonb_build_object(''music'',public.director_song_source_binding(p_document))); '||anchor;
  execute replace(definition,anchor,replacement);
 end loop;
end $$;

alter table public.director_planning_consents add column song_intelligence_snapshot jsonb not null default 'null'::jsonb;
comment on column public.director_planning_consents.song_intelligence_snapshot is 'Exact optional song edit-record/master binding captured at consent creation. Old grants remain null and cannot authorize newly added/changed song evidence. Recovery and settlement are not freshness-gated.';

create function public.director_capture_planning_song() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;
begin
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 if p.id is null or new.actor_id is distinct from p.owner_id then raise exception 'not_project_owner';end if;
 new.song_intelligence_snapshot=coalesce(public.director_song_source_binding(p.brief),'null'::jsonb);return new;
end $$;
create function public.director_guard_planning_song() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;c public.director_planning_consents;
begin
 if TG_OP='UPDATE' then if not(not old.submit_claimed and new.submit_claimed) then return new;end if;end if;
 select x.* into p from public.director_projects x where x.id=new.project_id for update;
 select x.* into c from public.director_planning_consents x where x.id=new.consent_id and x.project_id=p.id;
 if p.id is null or c.id is null or new.actor_id is distinct from p.owner_id or c.actor_id is distinct from p.owner_id or c.song_intelligence_snapshot is distinct from coalesce(public.director_song_source_binding(p.brief),'null'::jsonb) then raise exception 'planning_song_scope_changed';end if;
 return new;
end $$;
create function public.director_guard_song_consent_snapshot() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.song_intelligence_snapshot is distinct from old.song_intelligence_snapshot then raise exception 'planning_song_snapshot_immutable';end if;return new;
end $$;
create trigger capture_song_intelligence before insert on public.director_planning_consents for each row execute function public.director_capture_planning_song();
create trigger immutable_song_intelligence before update of song_intelligence_snapshot on public.director_planning_consents for each row execute function public.director_guard_song_consent_snapshot();
create trigger current_song_before_reservation before insert on public.director_planning_reservations for each row execute function public.director_guard_planning_song();
create trigger current_song_before_claim before update of submit_claimed on public.director_planning_reservations for each row execute function public.director_guard_planning_song();

revoke all on function public.director_song_source_binding(jsonb),public.director_capture_planning_song(),public.director_guard_planning_song(),public.director_guard_song_consent_snapshot(),public.director_screenplay_snapshot_current(jsonb,integer),public.director_department_source_current(jsonb,text,integer),public.director_department_revision_source_current(jsonb,integer) from public,anon,authenticated;
grant execute on function public.director_song_source_binding(jsonb),public.director_capture_planning_song(),public.director_guard_planning_song(),public.director_guard_song_consent_snapshot(),public.director_screenplay_snapshot_current(jsonb,integer),public.director_department_source_current(jsonb,text,integer),public.director_department_revision_source_current(jsonb,integer) to service_role;

commit;
