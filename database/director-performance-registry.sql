-- PREPARED ONLY. Extends supported adapter identities; grants no model activation,
-- pricing, execution or creative-quality evidence. Apply only after review.
begin;
do $$
declare definition text;
begin
 select pg_get_functiondef('public.director_registry_review_ready(text,jsonb,jsonb)'::regprocedure) into definition;
 if position('bytedance/omnihuman/v2' in definition)=0 then
  if position('not in(''minimax/h3-max/reference-to-video'',' in definition)=0 or position('when''fal-ai/elevenlabs/forced-alignment''then item#>>''{}''=''alignment''else false end,false)' in definition)=0 then raise exception 'registry_performance_baseline_mismatch';end if;
  definition=replace(definition,'not in(''minimax/h3-max/reference-to-video'',','not in(''bytedance/omnihuman/v2'',''minimax/h3-max/reference-to-video'',');
  definition=replace(definition,'when''fal-ai/elevenlabs/forced-alignment''then item#>>''{}''=''alignment''else false end,false)','when''fal-ai/elevenlabs/forced-alignment''then item#>>''{}''=''alignment''when''bytedance/omnihuman/v2''then item#>>''{}''=''singing_performance''else false end,false)');
  execute definition;
 end if;
end $$;
commit;
