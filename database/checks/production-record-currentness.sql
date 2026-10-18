-- Read-only guard fixtures. Every returned passed value must be true.
with fixtures(name,doc,key,version,expected) as (values
('legacy story','{"story":{"version":2}}'::jsonb,'story',2,true),
('legacy shot','{"shots":[{"id":"s","version":1}]}'::jsonb,'s',1,true),
('missing record','{}'::jsonb,'record:a',1,false),
('current record','{"production":{"records":[{"id":"a","currentVersion":1,"versions":[{"version":1}]}]}}'::jsonb,'record:a',1,true),
('missing currentVersion','{"production":{"records":[{"id":"a","versions":[{"version":1}]}]}}'::jsonb,'record:a',1,false),
('null currentVersion','{"production":{"records":[{"id":"a","currentVersion":null,"versions":[{"version":1}]}]}}'::jsonb,'record:a',1,false),
('stale version','{"production":{"records":[{"id":"a","currentVersion":2,"versions":[{"version":1},{"version":2}]}]}}'::jsonb,'record:a',1,false),
('stale transitive dependency','{"production":{"records":[{"id":"a","currentVersion":1,"versions":[{"version":1,"dependencies":[{"recordId":"b","version":1}]}]},{"id":"b","currentVersion":2,"versions":[{"version":1},{"version":2}]}]}}'::jsonb,'record:a',1,false),
('cycle','{"production":{"records":[{"id":"a","currentVersion":1,"versions":[{"version":1,"dependencies":[{"recordId":"a","version":1}]}]}]}}'::jsonb,'record:a',1,false),
('bound shot','{"shots":[{"id":"s","version":1,"productionBindings":[{"recordId":"a","version":1}]}],"production":{"records":[{"id":"a","currentVersion":1,"versions":[{"version":1}]}]}}'::jsonb,'s',1,true),
('stale binding','{"shots":[{"id":"s","version":1,"productionBindings":[{"recordId":"a","version":1}]}],"production":{"records":[{"id":"a","currentVersion":2,"versions":[{"version":1},{"version":2}]}]}}'::jsonb,'s',1,false),
('malformed array','{"production":{"records":{}}}'::jsonb,'record:a',1,false)
) select name,expected,public.director_document_artifact_is_current(doc,key,version) actual,public.director_document_artifact_is_current(doc,key,version)=expected passed from fixtures;
