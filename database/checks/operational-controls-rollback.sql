-- Synthetic fixtures; all mutations MUST remain inside the rollback transaction.
begin;
set local role service_role;
do $proof$
declare base_revision bigint; actor uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); r jsonb; replay jsonb; mid text; old_model jsonb; new_model jsonb; commands_before bigint;
begin
 select revision into base_revision from public.director_operational_controls where id=1;
 select count(*) into commands_before from public.director_admin_commands;
 r:=public.director_admin_command(actor,'operator',rid,base_revision,'pause_generation','Synthetic rollback verification',null,null);
 if (r->'control'->>'revision')::bigint<>base_revision+1 or (r->'control'->>'generation_paused')::boolean is distinct from true then raise exception 'proof_pause_failed'; end if;
 replay:=public.director_admin_command(actor,'operator',rid,base_revision,'pause_generation','Synthetic rollback verification',null,null);
 if replay->>'replayed'<>'true' or (select count(*) from public.director_admin_commands)<>commands_before+1 then raise exception 'proof_replay_failed'; end if;
 begin
 perform public.director_admin_command(actor,'operator',rid,base_revision,'pause_generation','Different synthetic rollback reason',null,null);
 raise exception 'proof_conflict_not_rejected';
 exception when others then if sqlerrm<>'operational_idempotency_conflict' then raise; end if; end;
 begin
 perform public.director_admin_command(actor,'owner',gen_random_uuid(),base_revision,'pause_generation','Synthetic stale revision proof',null,null);
 raise exception 'proof_stale_not_rejected';
 exception when others then if sqlerrm<>'operational_revision_conflict' then raise; end if; end;
 select id,to_jsonb(m) into mid,old_model from public.director_models m order by id limit 1;
 if mid is null then raise exception 'proof_requires_candidate'; end if;
 begin
 perform public.director_admin_command(actor,'operator',gen_random_uuid(),base_revision+1,'update_model_notes','Synthetic role restriction proof',mid,'Synthetic note');
 raise exception 'proof_role_not_rejected';
 exception when others then if sqlerrm<>'operational_command_forbidden' then raise; end if; end;
 r:=public.director_admin_command(actor,'owner',gen_random_uuid(),base_revision+1,'update_model_notes','Synthetic notes rollback proof',mid,'Synthetic note');
 select to_jsonb(m) into new_model from public.director_models m where id=mid;
 if new_model->'capabilities'->>'admin_notes'<>'Synthetic note' or (new_model-'capabilities'-'updated_at')<>(old_model-'capabilities'-'updated_at') or ((new_model->'capabilities')-'admin_notes')<>((old_model->'capabilities')-'admin_notes') then raise exception 'proof_notes_scope_failed'; end if;
 r:=public.director_admin_command(actor,'operator',gen_random_uuid(),base_revision+2,'disable_model','Synthetic disable rollback proof',mid,null);
 if (select active from public.director_models where id=mid) is distinct from false then raise exception 'proof_disable_failed'; end if;
 begin
 perform public.director_admin_command(actor,'owner',gen_random_uuid(),base_revision+3,'resume_generation','Synthetic forbidden action proof',null,null);
 raise exception 'proof_resume_not_rejected';
 exception when others then if sqlerrm<>'operational_command_invalid' then raise; end if; end;
 begin
 insert into public.director_jobs(project_id,work_unit_id,proposal_id,authorization_id,idempotency_key,payload_hash,reserved_micro_usd) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'synthetic-rollback-proof','synthetic',1);
 raise exception 'proof_paused_insert_not_rejected';
 exception when others then if sqlerrm<>'generation_operationally_paused' then raise; end if; end;
 begin
 update public.director_admin_commands set command='pause_generation' where request_id=rid;
 raise exception 'proof_audit_mutation_not_rejected';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.director_admin_commands)<>commands_before+3 then raise exception 'proof_audit_count_failed'; end if;
end $proof$;
rollback;
select 'PASS: pause, replay, conflicts, role limits, notes scope, disable, resume rejection, paused insert and audit mutation checks; all fixture changes rolled back' status;
