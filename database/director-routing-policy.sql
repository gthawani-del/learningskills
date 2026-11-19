-- PREPARED ONLY. Extends existing quote validation; no models or policies enabled.
-- Apply after durable quotes, ordinary production records and registry migrations.
begin;
create function public.director_routing_policy_current(p_project_id uuid,p_quote jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare p public.director_projects;r jsonb;s jsonb;items jsonb;binding jsonb;a public.director_artifacts;decision public.director_approvals;
begin
 select x.*into p from public.director_projects x where x.id=p_project_id;if p.id is null then return false;end if;
 select coalesce(jsonb_agg(x.value),'[]'::jsonb)into items from jsonb_array_elements(coalesce(p.brief->'production'->'records','[]'::jsonb))x
 where x.value->>'type'='edit'and exists(select 1 from jsonb_array_elements(x.value->'versions')v where v.value->'version'=x.value->'currentVersion'and v.value->'content'->>'kind'='director_routing_policy_v1');
 if jsonb_array_length(items)=0 then return not(p_quote?'routingPolicy');end if;
 if jsonb_array_length(items)<>1 then return false;end if;r=items->0;
 select v.value into s from jsonb_array_elements(r->'versions')v where v.value->'version'=r->'currentVersion';binding=p_quote->'routingPolicy';
 if jsonb_typeof(binding)is distinct from'object'or binding->>'kind'is distinct from'director_routing_policy_v1'or binding->>'recordId'is distinct from r->>'id'or binding->'version'is distinct from r->'currentVersion'or coalesce(binding->>'contentHash','')!~'^[a-f0-9]{64}$'or s->'content'->'sourceBriefVersion'is distinct from coalesce(p.brief->'creativeBrief'->'currentVersion','null'::jsonb)then return false;end if;
 select x.*into a from public.director_artifacts x where x.project_id=p.id and x.logical_key='record:'||(r->>'id')and x.version=(r->>'currentVersion')::integer;
 if a.id is null or not public.director_artifact_is_current(p.id,a.id)then return false;end if;
 select x.*into decision from public.director_approvals x where x.project_id=p.id and x.artifact_id=a.id order by x.ordinal desc limit 1;
 if decision.id is null or decision.decision<>'approved'or decision.id::text is distinct from binding->>'approvalId'then return false;end if;
 if binding->'applies'is distinct from to_jsonb(coalesce((s->'content'->'operations')?(p_quote->>'task'),false))then return false;end if;
 if binding->'applies'='true'::jsonb and p_quote->'intent'is distinct from s->'content'->'intent'then return false;end if;
 return true;
exception when others then return false;
end $$;
revoke all on function public.director_routing_policy_current(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.director_routing_policy_current(uuid,jsonb)to service_role;
do $$
declare definition text;
begin
 definition=pg_get_functiondef('public.director_quote_contract_valid(jsonb,jsonb,public.director_models)'::regprocedure);
 if position('director_routing_policy_current' in definition)=0 then
  definition=regexp_replace(definition,'\mbegin\M','begin if not coalesce(public.director_routing_policy_current((p_quote->>''projectId'')::uuid,p_quote),false) then return false;end if;','i');
  if position('director_routing_policy_current' in definition)=0 then raise exception 'routing_policy_quote_baseline_mismatch';end if;execute definition;
 end if;
end $$;
commit;
