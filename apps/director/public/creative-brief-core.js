export const CREATIVE_BRIEF_FIELDS = ['purpose','audience','audienceResponse','platform','aspectRatio','visualStyle','tone','setting','cast','voice','product','constraints','budget','format','duration','language'];
const statuses = ['explicit','inferred','unknown'];
const sources = ['user','project','default','rule','model'];
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype,null].includes(Object.getPrototypeOf(x));
const canonical = x => Array.isArray(x) ? '['+x.map(canonical).join(',')+']' : plain(x) ? '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}' : JSON.stringify(x);
const clone = x => structuredClone(x);
function fail(status,message) { throw Object.assign(new Error(message),{status}); }
function keys(value,allowed) { if (!plain(value) || Object.keys(value).some(k=>!allowed.includes(k))) fail(400,'Unsupported creative brief fields.'); }
function sourceInput(project) { return {premise:project.premise??'',direction:project.direction??'',language:project.language??'',duration:project.duration??null,format:project.format??''}; }
export function briefInputSignature(project) { return canonical(sourceInput(project)); }
function validSignature(signature) {
 if(typeof signature!=='string'||signature.length>30000)fail(400,'Invalid creative brief input signature.');
 let data;try{data=JSON.parse(signature);}catch{fail(400,'Invalid creative brief input signature.');}
 keys(data,['premise','direction','language','duration','format']);
 if(Object.keys(data).length!==5||!['premise','direction','language','format'].every(k=>typeof data[k]==='string'&&data[k].length<=12000)||!(data.duration===null||Number.isFinite(data.duration)&&data.duration>0&&data.duration<=3600)||canonical(data)!==signature)fail(400,'Invalid creative brief source fields.');
 return data;
}
function valueFor(key,value) {
 if(value===null)return null;
 if(key==='duration'&&(typeof value==='number'||typeof value==='string'&&value.trim())&&Number.isFinite(Number(value))&&Number(value)>0&&Number(value)<=3600)return Number(value);
 if(typeof value==='string'&&value.trim()&&value.length<=2000)return value.trim();
 if(Array.isArray(value)&&value.length>0&&value.length<=30&&value.every(x=>typeof x==='string'&&x.trim()&&x.length<=300))return value.map(x=>x.trim());
 fail(400,'Brief values must be bounded text, text lists or a valid duration.');
}
function entry(key,value) {
 keys(value,['value','status','source','evidence']);
 if(!Object.hasOwn(value,'value')||!statuses.includes(value.status)||!sources.includes(value.source)||!Array.isArray(value.evidence)||value.evidence.length>4||!value.evidence.every(x=>typeof x==='string'&&x.trim()&&x.length<=300))fail(400,'Brief entries need a valid status, provenance and bounded evidence.');
 const normalized=valueFor(key,value.value);
 if((value.status==='unknown')!==(normalized===null)||value.status!=='unknown'&&!value.evidence.length&&!['model','rule'].includes(value.source)||value.status==='explicit'&&!['user','project'].includes(value.source))fail(400,'Brief provenance does not support this value or status.');
 return {value:normalized,status:value.status,source:value.source,evidence:clone(value.evidence)};
}
function completeFields(fields) {
 keys(fields,CREATIVE_BRIEF_FIELDS);
 if(CREATIVE_BRIEF_FIELDS.some(k=>!Object.hasOwn(fields,k)))fail(400,'The creative brief is missing required fields.');
 return Object.fromEntries(CREATIVE_BRIEF_FIELDS.map(k=>[k,entry(k,fields[k])]));
}
const handoffs = [
 ['Producing',['purpose','budget','constraints'],'Review scope, schedule, cost limits and permissions before production.'],
 ['Story & direction',['purpose','audience','audienceResponse','tone'],'Develop a treatment and performance direction from the reviewed brief.'],
 ['Casting',['cast'],'Choose cast and collect identity references; availability and consent remain unverified.'],
 ['Look & costume',['visualStyle','cast'],'Create look, wardrobe and makeup references for each intended character.'],
 ['Art & locations',['setting','visualStyle'],'Plan locations, sets and props; source references remain unverified.'],
 ['Camera & lighting',['aspectRatio','visualStyle','tone'],'Translate the reviewed look into framing, movement and motivated lighting.'],
 ['Voice & performance',['voice','language'],'Define voice and performance direction; no voice rights or audio quality is assumed.'],
 ['Sound & music',['tone','audienceResponse'],'Plan dialogue, ambience, effects and music with separate rights checks.'],
 ['Continuity & assistant direction',['cast','setting','constraints'],'Track scene order, appearance, screen direction and protected choices.'],
 ['Storyboard',['format','aspectRatio','duration'],'Create a shot breakdown and review readable storyboard specifications.'],
 ['Animatic',['duration','tone'],'Review storyboard timing and provisional sound before production.'],
 ['VFX & animation',['visualStyle','constraints'],'Identify effects, animation and compositing needs for review.'],
 ['Editing & finishing',['duration','platform','aspectRatio'],'Plan the cut, color, mix, captions and delivery specifications.'],
 ['Rights & delivery',['cast','voice','product','platform'],'Verify source rights, performer consent and delivery needs separately.']
];
function departmentPlan(fields) { return handoffs.map(([department,requiredFields,task])=>({department,requiredFields:[...requiredFields],task,status:requiredFields.every(k=>fields[k].status!=='unknown')?'ready_for_planning':'needs_input'})); }
function questions(fields) {
 const prompts={purpose:'What should this film achieve?',audience:'Who is this film for?',audienceResponse:'What should viewers feel or do?',platform:'Where will this film be shown?',constraints:'What must be preserved or avoided?',cast:'Who needs to appear?',visualStyle:'What visual style should guide the film?',voice:'What voice or performance is intended?'};
 return Object.entries(prompts).filter(([key])=>fields[key].status==='unknown').slice(0,3).map(([field,question])=>({field,question}));
}
function snapshot(version,inputSignature,fields,source,createdAt) {return {version,inputSignature,fields,departmentPlan:departmentPlan(fields),questions:questions(fields),source,createdAt};}
function dateFor(project) {const value=project.updatedAt||project.createdAt;return typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))?value:null;}
export function normalizeBriefArchive(archive,project) {
 if(archive===undefined||archive===null)return null;
 keys(archive,['currentVersion','versions']);
 if(!Number.isSafeInteger(archive.currentVersion)||archive.currentVersion<1||!Array.isArray(archive.versions)||!archive.versions.length||archive.versions.length>50||archive.currentVersion!==archive.versions.length)fail(400,'Invalid creative brief version archive.');
 const versions=archive.versions.map((item,index)=>{
  keys(item,['version','inputSignature','fields','departmentPlan','questions','source','createdAt']);
  if(item.version!==index+1||!['rule','user','model'].includes(item.source)||!(item.createdAt===null||typeof item.createdAt==='string'&&item.createdAt.length<=40&&Number.isFinite(Date.parse(item.createdAt))))fail(400,'Invalid creative brief snapshot provenance.');
  validSignature(item.inputSignature);const fields=completeFields(item.fields),normalized=snapshot(item.version,item.inputSignature,fields,item.source,item.createdAt);
  if(canonical(item.questions)!==canonical(normalized.questions)||canonical(item.departmentPlan)!==canonical(normalized.departmentPlan)||canonical(item).length>64000)fail(400,'Invalid creative brief questions or department handoff.');
  return normalized;
 });
 return {currentVersion:archive.currentVersion,versions};
}
export function currentBrief(project) {const archive=project?.creativeBrief;if(!archive)return null;return clone(archive.versions?.find(v=>v.version===archive.currentVersion)||null);}
function approvedBaseline(project,approvals) {const versions=project.creativeBrief?.versions||[];return versions.slice().reverse().find(v=>(approvals||[]).filter(a=>a.artifactId==='brief'&&a.version===v.version).at(-1)?.decision==='approved')||null;}
export function interpretBrief(project,approvals=[]) {
 const fields=Object.fromEntries(CREATIVE_BRIEF_FIELDS.map(k=>[k,{value:null,status:'unknown',source:'rule',evidence:[]}]));
 for(const key of ['format','duration','language'])if(project[key]!==undefined&&project[key]!==null&&project[key]!==''){
  const explicit=Array.isArray(project.briefExplicitFields)&&project.briefExplicitFields.includes(key);
  fields[key]={value:valueFor(key,project[key]),status:explicit?'explicit':'inferred',source:'project',evidence:[explicit?'Project setting explicitly supplied by the user.':'Existing project setting; user intent has not been confirmed.']};
 }
 const baseline=approvedBaseline(project,approvals);
 if(baseline)for(const key of CREATIVE_BRIEF_FIELDS)if(baseline.fields[key].status!=='unknown'){
  const projectSetting=['format','duration','language'].includes(key);
  if(!projectSetting)fields[key]=clone(baseline.fields[key]);
 }
 const existing=currentBrief(project);
 if(existing)for(const key of CREATIVE_BRIEF_FIELDS)if(existing.fields[key].source==='user'){
  const changedProjectSetting=['format','duration','language'].includes(key)&&canonical(existing.fields[key].value)!==canonical(project[key]);
  if(!changedProjectSetting)fields[key]=clone(existing.fields[key]);
 }
 return snapshot((project.creativeBrief?.currentVersion||0)+1,briefInputSignature(project),fields,'rule',dateFor(project));
}
// A reviewable starting point assembled from supplied text and project settings.
// This helper neither interprets hidden intent nor calls a language model.
export function suggestBrief(project,approvals=[]) {
 const proposed=interpretBrief(project,approvals),existing=currentBrief(project),baseline=approvedBaseline(project,approvals);
 const fresh=existing?.inputSignature===briefInputSignature(project);
 if(fresh)for(const key of CREATIVE_BRIEF_FIELDS)if(existing.fields[key].source==='model'&&!['format','duration','language'].includes(key)&&(!baseline||baseline.fields[key].status==='unknown'))proposed.fields[key]=clone(existing.fields[key]);
 const canSuggest=key=>proposed.fields[key].status==='unknown'&&proposed.fields[key].source==='rule';
 const premise=typeof project.premise==='string'?project.premise.trim():'';
 if(premise&&canSuggest('purpose')){
  const labels={advertisement:'Develop an advertisement around the supplied idea',music_video:'Develop a music-video concept around the supplied idea',short_film:'Develop a short film around the supplied idea'};
  const prefix=(labels[project.format]||'Develop a film around the supplied idea')+': ';
  const room=2000-prefix.length;
  const excerpt=premise.length>room?premise.slice(0,room-1)+'…':premise;
  proposed.fields.purpose={value:prefix+excerpt,status:'inferred',source:'rule',evidence:['Reversible planning suggestion based on the selected format and supplied premise; not an interpretation of unstated intent.']};
 }
 const direction=typeof project.direction==='string'?project.direction.trim():'';
 if(direction&&canSuggest('visualStyle'))proposed.fields.visualStyle={value:direction.length>2000?direction.slice(0,1999)+'…':direction,status:'inferred',source:'rule',evidence:['Supplied direction offered as a starting look suggestion; it may include instructions beyond visual style.']};
 return snapshot(proposed.version,proposed.inputSignature,completeFields(proposed.fields),'rule',proposed.createdAt);
}
export function applyBriefCommand(project,command,approvals=[]) {
 keys(command,['expectedVersion','action','changes','proposal']);
 if(!Number.isSafeInteger(project.version)||project.version<1||command.expectedVersion!==project.version)fail(409,'The project changed. Reopen it before updating the brief.');
 if(!['interpret','suggest','update','apply_proposal'].includes(command.action))fail(400,'Unknown creative brief action.');
 const archive=normalizeBriefArchive(project.creativeBrief,project);
 const working=clone(project);
 let proposed=command.action==='suggest'?suggestBrief(working,approvals):interpretBrief(working,approvals);
 if(['interpret','suggest'].includes(command.action)&&(command.changes!==undefined||command.proposal!==undefined)||command.action==='update'&&command.proposal!==undefined||command.action==='apply_proposal'&&command.changes!==undefined)fail(400,'This brief action contains unrelated fields.');
 if(command.action==='interpret'&&currentBrief(project)?.inputSignature===briefInputSignature(project))return clone(project);
 if(command.action==='update'){
  keys(command.changes,CREATIVE_BRIEF_FIELDS);if(!Object.keys(command.changes).length)fail(400,'Choose at least one brief field to update.');
  // Retain neighboring creative choices while refreshing authoritative project settings.
  if(archive){const previous=currentBrief(project);for(const key of CREATIVE_BRIEF_FIELDS)if(!['format','duration','language'].includes(key))proposed.fields[key]=clone(previous.fields[key]);}
  for(const [key,value]of Object.entries(command.changes)){const normalized=valueFor(key,value);
   if(['format','duration','language'].includes(key)){
    if(normalized===null||key==='format'&&!['short_film','music_video','advertisement'].includes(normalized)||key==='language'&&typeof normalized!=='string'||key==='duration'&&typeof normalized!=='number')fail(400,'Project format, duration and language need valid explicit settings.');
    working[key]=normalized;working.briefExplicitFields=[...new Set([...(working.briefExplicitFields||[]),key])];
   }
   proposed.fields[key]={value:normalized,status:normalized===null?'unknown':'explicit',source:'user',evidence:normalized===null?[]:['Entered directly in the creative brief editor.']};}
  proposed.source='user';
 }else if(command.action==='apply_proposal'){
  keys(command.proposal,['inputSignature','fields']);
  if(command.proposal.inputSignature!==briefInputSignature(project))fail(409,'The interpretation proposal is based on an earlier brief.');
  keys(command.proposal.fields,CREATIVE_BRIEF_FIELDS);if(!Object.keys(command.proposal.fields).length)fail(400,'The proposal has no brief fields.');
  const baseline=approvedBaseline(project,approvals);
  for(const [key,value]of Object.entries(command.proposal.fields)){
   const item=entry(key,value);
   if(item.source!=='model'||item.status==='explicit')fail(400,'Model proposals must identify unverified model inferences.');
   if(baseline?.fields[key].status!=='unknown'&&baseline?.fields[key])continue;
   if(proposed.fields[key].source==='user')continue;
   // Project configuration remains authoritative; proposals cannot rewrite it.
   if(['format','duration','language'].includes(key)&&proposed.fields[key].status!=='unknown')continue;
   proposed.fields[key]=item;
  }
  proposed.source='model';
 }
 proposed=snapshot(proposed.version,briefInputSignature(working),completeFields(proposed.fields),proposed.source,proposed.createdAt);
 const previous=currentBrief(project);
 if(previous&&previous.inputSignature===proposed.inputSignature&&canonical(previous.fields)===canonical(proposed.fields))return clone(project);
 if((archive?.versions.length||0)>=50)fail(400,'Creative brief version limit reached.');
 proposed.createdAt=new Date().toISOString();
 const next=working;
 if((previous||next.story?.treatment?.trim()||next.story?.scenes?.length)&&next.story&&Number.isSafeInteger(next.story.version))next.story={...next.story,version:next.story.version+1};
 next.creativeBrief={currentVersion:proposed.version,versions:[...(archive?.versions||[]),proposed]};next.version=project.version+1;return next;
}
export function briefArtifact(project) {const brief=currentBrief(project);return brief?{logical_key:'brief',kind:'brief',version:brief.version,content:brief}:null;}
export function briefPlanningContext(project,approvals=[]) {
 const brief=currentBrief(project),stale=!!brief&&brief.inputSignature!==briefInputSignature(project);
 const approved=!!brief&&!stale&&(approvals||[]).filter(a=>a.artifactId==='brief'&&a.version===brief.version).at(-1)?.decision==='approved';
 return {brief,status:!brief?'missing':stale?'stale':approved?'approved':'needs_review',stale,approved,questions:brief?.questions||[],departmentPlan:brief?.departmentPlan||[]};
}
export function assertBriefApproval(project,body) {
 if(body?.artifactId!=='brief')return null;
 const brief=currentBrief(project);if(!brief)fail(404,'Creative brief not found.');
 if(body.version!==brief.version||brief.inputSignature!==briefInputSignature(project))fail(409,'Refresh the current brief before approving it.');
 if(body.decision!=='approved')return brief;
 if(typeof project.premise!=='string'||!project.premise.trim())fail(400,'Describe the film idea before approving its brief.');
 if(Object.values(brief.fields).some(f=>f.status!=='explicit')&&body.acknowledgeAssumptions!==true)fail(400,'Acknowledge the visible assumptions and unknowns before approving this brief.');
 return brief;
}
