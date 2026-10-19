import {currentBrief,briefPlanningContext,CREATIVE_BRIEF_FIELDS} from './creative-brief-core.js';
import {currentScreenplay,screenplayContext,normalizeScreenplayDocument} from './screenplay-core.js';
import {DEPARTMENT_GUIDANCE_VERSION,departmentGuidance,departmentGuidanceCatalog,departmentPromptGuidance} from './department-guidance.js';

export const DEPARTMENT_IDS=Object.freeze(['producing','direction','script_breakdown','casting','look','locations','camera','lighting','voice','sound','music','continuity','storyboard','animatic','vfx','editorial','rights']);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':plain(x)?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const clone=x=>structuredClone(x),idPattern=/^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
function fail(status,message){throw Object.assign(new Error(message),{status});}
function keys(value,allowed,required=allowed){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(value,k)))fail(400,'Unsupported or missing department planning fields.');}
function text(value,max,label,empty=false){if(typeof value!=='string'||value.length>max||!empty&&!value.trim())fail(400,label+' must be bounded text.');return value;}
function list(value,max,label){if(!Array.isArray(value)||value.length>max)fail(400,'Invalid '+label+' list.');return value;}
function identifier(value){if(typeof value!=='string'||!idPattern.test(value))fail(400,'Department IDs must be stable bounded identifiers.');return value;}
function departmentId(value){if(!DEPARTMENT_IDS.includes(value))fail(400,'Unknown filmmaking department.');return value;}
function date(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail(400,'Invalid department planning timestamp.');return value;}
function refs(value,allowed,max,label){const values=list(value,max,label).map(identifier);if(new Set(values).size!==values.length||values.some(id=>!allowed.has(id)))fail(400,'Department references must name unique scenes or characters in their bound screenplay.');return values;}
function boundArchive(value){if(new TextEncoder().encode(canonical(value)).length>3000000)fail(400,'Department planning archive exceeds its 3 MB limit. Export a copy before starting a new project.');return value;}
const emptyArchive=()=>({sources:[],departments:[]});
const archiveOf=p=>p.departmentPlanning||emptyArchive();
function sourceSettings(project){return {premise:project.premise??'',direction:project.direction??'',language:project.language??'',duration:project.duration??null,format:project.format??''};}

export function normalizeDepartmentDocument(value,sourceDocument,options={}){
 keys(value,['applicability','rationale','summary','requirements','choices','handoffs','checks']);
 if(!['required','conditional','not_applicable'].includes(value.applicability))fail(400,'Department applicability must be explicit.');
 const source=normalizeScreenplayDocument(sourceDocument),sceneIds=new Set(source.scenes.map(s=>s.id)),characterIds=new Set(source.characters.map(c=>c.id));
 const requirements=list(value.requirements,120,'department requirements').map(r=>{keys(r,['id','label','direction','sceneIds','characterIds']);return {id:identifier(r.id),label:text(r.label,200,'Requirement label'),direction:text(r.direction,4000,'Requirement direction'),sceneIds:refs(r.sceneIds,sceneIds,100,'scene references'),characterIds:refs(r.characterIds,characterIds,30,'character references')};});
 const choices=list(value.choices,100,'department choices').map(c=>{keys(c,['id','label','value','status','sceneIds','characterIds']);if(!['proposed','needs_decision','user_selected'].includes(c.status)||options.allowUserSelected===false&&c.status==='user_selected')fail(400,'Generated department choices cannot claim user selection.');return {id:identifier(c.id),label:text(c.label,200,'Choice label'),value:text(c.value,2000,'Choice value',c.status==='needs_decision'),status:c.status,sceneIds:refs(c.sceneIds,sceneIds,100,'scene references'),characterIds:refs(c.characterIds,characterIds,30,'character references')};});
 if(new Set(requirements.map(r=>r.id)).size!==requirements.length||new Set(choices.map(c=>c.id)).size!==choices.length)fail(400,'Department requirements and choices need unique stable IDs.');
 const handoffs=list(value.handoffs,30,'department handoffs').map(h=>{keys(h,['toDepartmentId','deliverable']);return {toDepartmentId:departmentId(h.toDepartmentId),deliverable:text(h.deliverable,2000,'Department handoff')};});
 const checks=list(value.checks,30,'department checks').map(x=>text(x,1000,'Department check'));
 if(value.applicability==='required'&&(!requirements.length||!checks.length))fail(400,'A required department needs a requirement and a review check.');
 const result={applicability:value.applicability,rationale:text(value.rationale,2000,'Applicability rationale'),summary:text(value.summary,4000,'Department summary'),requirements,choices,handoffs,checks};
 if(canonical(result).length>100000)fail(400,'Department document exceeds its bounded size.');return result;
}

export function departmentSourceSignature(project){
 const brief=currentBrief(project),screenplay=currentScreenplay(project);
 return canonical({project:sourceSettings(project),brief:brief?{version:brief.version,fields:brief.fields,inputSignature:brief.inputSignature}:null,screenplay:screenplay?{version:screenplay.version,document:screenplay.document}:null});
}
function validSourceSignature(value){
 text(value,300000,'Department source signature');let parsed;try{parsed=JSON.parse(value);}catch{fail(400,'Invalid department source signature.');}
 keys(parsed,['project','brief','screenplay']);keys(parsed.project,['premise','direction','language','duration','format']);for(const key of ['premise','direction','language','format'])text(parsed.project[key],12000,'Source setting',true);
 if(parsed.project.duration!==null&&(!Number.isFinite(parsed.project.duration)||parsed.project.duration<=0||parsed.project.duration>3600))fail(400,'Invalid department source duration.');
 keys(parsed.brief,['version','fields','inputSignature']);if(!Number.isSafeInteger(parsed.brief.version)||parsed.brief.version<1||parsed.brief.version>50)fail(400,'Invalid department brief source version.');
 text(parsed.brief.inputSignature,30000,'Brief source signature');let briefInput;try{briefInput=JSON.parse(parsed.brief.inputSignature);}catch{fail(400,'Invalid brief source signature.');}if(canonical(briefInput)!==canonical(parsed.project))fail(400,'Department source brief does not match its project settings.');
 keys(parsed.brief.fields,CREATIVE_BRIEF_FIELDS);for(const [key,item] of Object.entries(parsed.brief.fields)){
  keys(item,['value','status','source','evidence']);if(!['explicit','inferred','unknown'].includes(item.status)||!['user','project','default','rule','model'].includes(item.source))fail(400,'Invalid department source brief provenance.');
  const v=item.value;if(v!==null&&!(typeof v==='string'&&v.trim()&&v.length<=2000)&&!(key==='duration'&&Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<=3600)&&!(Array.isArray(v)&&v.length>0&&v.length<=30&&v.every(x=>typeof x==='string'&&x.trim()&&x.length<=300)))fail(400,'Invalid department source brief value.');
  if((item.status==='unknown')!==(v===null))fail(400,'Invalid department source brief status.');list(item.evidence,4,'brief source evidence').forEach(x=>text(x,300,'Brief source evidence'));
 }
 keys(parsed.screenplay,['version','document']);if(!Number.isSafeInteger(parsed.screenplay.version)||parsed.screenplay.version<1||parsed.screenplay.version>50)fail(400,'Invalid department screenplay source version.');normalizeScreenplayDocument(parsed.screenplay.document);
 if(canonical(parsed)!==value)fail(400,'Department source signatures must be canonical.');return parsed;
}
export function normalizeDepartmentPlanningArchive(value,project,options={}){
 if(value===undefined||value===null)return null;keys(value,['sources','departments']);boundArchive(value);
 const sources=list(value.sources,50,'department sources').map((s,index)=>{keys(s,['version','inputSignature','createdAt']);if(s.version!==index+1)fail(400,'Department source versions must be contiguous.');validSourceSignature(s.inputSignature);return {version:index+1,inputSignature:s.inputSignature,createdAt:date(s.createdAt)};});
 const seen=new Set();const departments=list(value.departments,DEPARTMENT_IDS.length,'departments').map(d=>{keys(d,['id','currentVersion','versions']);departmentId(d.id);if(seen.has(d.id))fail(400,'Department archive repeats a department.');seen.add(d.id);
  const versions=list(d.versions,100,'department versions').map((v,index)=>{keys(v,['version','sourceVersion','document','provenance','createdAt']);if(v.version!==index+1||!Number.isSafeInteger(v.sourceVersion)||v.sourceVersion<1||!sources[v.sourceVersion-1])fail(400,'Department snapshots need contiguous versions and an existing source.');keys(v.provenance,['kind','modelCallId']);if(!['rule','user','model'].includes(v.provenance.kind)||v.provenance.kind==='model'&&(typeof v.provenance.modelCallId!=='string'||!v.provenance.modelCallId.trim()||v.provenance.modelCallId.length>120)||v.provenance.kind!=='model'&&v.provenance.modelCallId!==null)fail(400,'Invalid department snapshot provenance.');
   const source=JSON.parse(sources[v.sourceVersion-1].inputSignature);return {version:index+1,sourceVersion:v.sourceVersion,document:normalizeDepartmentDocument(v.document,source.screenplay.document),provenance:clone(v.provenance),createdAt:date(v.createdAt)};
  });if(!versions.length||d.currentVersion!==versions.length)fail(400,'Department current version must match its immutable history.');return {id:d.id,currentVersion:versions.length,versions};
 });
 return boundArchive({sources,departments:DEPARTMENT_IDS.flatMap(id=>departments.filter(d=>d.id===id))});
}
export function currentDepartmentPlan(project,id){return clone(archiveOf(project).departments.find(d=>d.id===id)?.versions.at(-1)||null);}
function lastApproval(approvals,id,version){return (approvals||[]).filter(a=>a.artifactId==='department:'+id&&a.version===version).at(-1)?.decision??null;}
function prerequisites(project,approvals){return {briefApproved:briefPlanningContext(project,approvals).approved,screenplayApproved:screenplayContext(project,approvals).approved};}
export function departmentPlanningInputSignature(project,approvals=[]){return canonical({sourceSignature:departmentSourceSignature(project),departments:DEPARTMENT_IDS.map(id=>{const current=currentDepartmentPlan(project,id);return {id,current,approval:current?lastApproval(approvals,id,current.version):null};})});}
export function departmentPlanningContext(project,approvals=[]){
 const sourceSignature=departmentSourceSignature(project),required=prerequisites(project,approvals),sources=archiveOf(project).sources;
 const departments=DEPARTMENT_IDS.map(id=>{const current=currentDepartmentPlan(project,id),stale=!!current&&sources.find(s=>s.version===current.sourceVersion)?.inputSignature!==sourceSignature,holds=[];if(!required.briefApproved)holds.push('Approve the current creative brief.');if(!required.screenplayApproved)holds.push('Approve the current screenplay and its source review.');if(stale)holds.push('Review this department against the current brief and screenplay; its earlier plan is preserved.');const approvalDecision=current?lastApproval(approvals,id,current.version):null,approved=!!current&&!stale&&required.briefApproved&&required.screenplayApproved&&approvalDecision==='approved';return {id,title:departmentGuidanceCatalog.find(d=>d.id===id)?.title||id,current,status:!current?'missing':stale?'stale':approved?'approved':'needs_review',approved,approvalDecision,stale,holds};});
 return {inputSignature:departmentPlanningInputSignature(project,approvals),sourceSignature,prerequisites:required,departments,guidanceVersion:DEPARTMENT_GUIDANCE_VERSION,guidance:departmentPromptGuidance(DEPARTMENT_IDS),generationAuthorized:false,assetsApproved:false};
}
function requireSources(project,approvals){const required=prerequisites(project,approvals);if(!required.briefApproved||!required.screenplayApproved)fail(409,'Approve the current creative brief and current screenplay before department planning.');return currentScreenplay(project).document;}
function ensureSource(archive,signature,now){const existing=archive.sources.find(s=>s.inputSignature===signature);if(existing)return existing.version;validSourceSignature(signature);if(archive.sources.length>=50)fail(400,'Department source history limit reached.');const version=archive.sources.length+1;archive.sources.push({version,inputSignature:signature,createdAt:now});return version;}
function writeDepartment(archive,id,document,sourceVersion,provenance,now){const existing=archive.departments.find(d=>d.id===id),previous=existing?.versions.at(-1);if(previous&&previous.sourceVersion===sourceVersion&&canonical(previous.document)===canonical(document))return false;const version=(existing?.currentVersion||0)+1;if(version>100)fail(400,'Department version history limit reached.');const snapshot={version,sourceVersion,document:clone(document),provenance,createdAt:now};if(existing){existing.currentVersion=version;existing.versions.push(snapshot);}else archive.departments.push({id,currentVersion:version,versions:[snapshot]});return true;}
function preserveUserChoices(previous,next){for(const choice of previous?.choices||[])if(choice.status==='user_selected'&&!next.choices.some(c=>c.id===choice.id&&canonical(c)===canonical(choice)))fail(400,'A generated proposal cannot replace or remove a recorded user choice.');}
export function applyDepartmentCommand(project,command,approvals=[]){
 keys(command,['expectedVersion','action','departmentId','document','proposal','acknowledgeSourceChange'],['expectedVersion','action']);if(!Number.isSafeInteger(project.version)||command.expectedVersion!==project.version)fail(409,'The project changed. Reopen it before saving department plans.');const fields={prepare:[],refresh:['departmentId','acknowledgeSourceChange'],update:['departmentId','document'],apply_proposal:['proposal']};if(!Object.hasOwn(fields,command.action)||Object.keys(command).some(k=>!['expectedVersion','action',...fields[command.action]].includes(k))||fields[command.action].some(k=>!Object.hasOwn(command,k)))fail(400,'Unsupported department planning command.');
 const sourceDocument=requireSources(project,approvals),next=clone(project),archive=normalizeDepartmentPlanningArchive(project.departmentPlanning,project)||emptyArchive(),now=new Date().toISOString(),sourceSignature=departmentSourceSignature(project);let changed=false,sourceVersion=null;
 const write=(id,document,provenance)=>{if(sourceVersion===null)sourceVersion=ensureSource(archive,sourceSignature,now);changed=writeDepartment(archive,id,document,sourceVersion,provenance,now)||changed;};
 if(command.action==='prepare'){
  const baseline=departmentGuidance(project,approvals);if(!Array.isArray(baseline)||baseline.length!==DEPARTMENT_IDS.length||new Set(baseline.map(d=>d.id)).size!==DEPARTMENT_IDS.length)fail(500,'Department guidance catalog is incomplete.');
  for(const id of DEPARTMENT_IDS)if(!currentDepartmentPlan(project,id)){const generated=baseline.find(d=>d.id===id);if(!generated)fail(500,'Department guidance catalog is incomplete.');write(id,normalizeDepartmentDocument(generated.document,sourceDocument,{allowUserSelected:false}),{kind:'rule',modelCallId:null});}
 }else if(command.action==='refresh'){
  const id=departmentId(command.departmentId);if(command.acknowledgeSourceChange!==true)fail(400,'Acknowledge the source change before replacing this department with a fresh rule baseline.');const previous=currentDepartmentPlan(project,id);if(!previous)fail(404,'Prepare this department before refreshing it.');const baseline=departmentGuidance(project,approvals).find(d=>d.id===id);if(!baseline)fail(500,'Department guidance catalog is incomplete.');const document=normalizeDepartmentDocument(baseline.document,sourceDocument,{allowUserSelected:false});
  for(const choice of previous.document.choices.filter(c=>c.status==='user_selected')){
   try{normalizeDepartmentDocument({...document,choices:[choice]},sourceDocument);}catch(error){if(error.status===400)fail(409,'A recorded user choice references a removed scene or character. Repair that choice explicitly before refreshing this department.');throw error;}
   const index=document.choices.findIndex(c=>c.id===choice.id);if(index<0)document.choices.push(clone(choice));else document.choices[index]=clone(choice);
  }
  write(id,normalizeDepartmentDocument(document,sourceDocument),{kind:'rule',modelCallId:null});
 }else if(command.action==='update'){
  const id=departmentId(command.departmentId);write(id,normalizeDepartmentDocument(command.document,sourceDocument),{kind:'user',modelCallId:null});
 }else{
  keys(command.proposal,['inputSignature','departments','modelCallId']);if(command.proposal.inputSignature!==departmentPlanningInputSignature(project,approvals))fail(409,'Department proposal uses earlier source or review decisions.');text(command.proposal.modelCallId,120,'Saved model call ID');const proposed=list(command.proposal.departments,DEPARTMENT_IDS.length,'proposed departments');if(proposed.length!==DEPARTMENT_IDS.length||new Set(proposed.map(d=>d.id)).size!==DEPARTMENT_IDS.length)fail(400,'A department proposal must cover all filmmaking departments exactly once.');
  for(const item of proposed){keys(item,['id','document']);departmentId(item.id);}
  const reviewed=departmentPlanningContext(project,approvals);for(const id of DEPARTMENT_IDS){const item=proposed.find(d=>d.id===id),document=normalizeDepartmentDocument(item.document,sourceDocument),previous=currentDepartmentPlan(project,id);if(reviewed.departments.find(d=>d.id===id).approved&&canonical(previous.document)!==canonical(document))fail(400,'A generated proposal changed an approved department plan.');preserveUserChoices(previous?.document,document);for(const choice of document.choices)if(choice.status==='user_selected'&&!previous?.document.choices.some(c=>canonical(c)===canonical(choice)))fail(400,'Generated department choices cannot claim user selection.');write(id,document,{kind:'model',modelCallId:command.proposal.modelCallId});}
 }
 if(!changed)return clone(project);archive.departments.sort((a,b)=>DEPARTMENT_IDS.indexOf(a.id)-DEPARTMENT_IDS.indexOf(b.id));next.departmentPlanning=boundArchive(archive);next.version=project.version+1;return next;
}
export function departmentPlanArtifacts(project){return DEPARTMENT_IDS.flatMap(id=>{const current=currentDepartmentPlan(project,id);return current?[{logical_key:'department:'+id,kind:'department_plan',version:current.version,content:{departmentId:id,...current}}]:[];});}
export function assertDepartmentApproval(project,body,approvals=[]){
 if(typeof body?.artifactId!=='string'||!body.artifactId.startsWith('department:'))return null;const id=departmentId(body.artifactId.slice(11)),current=currentDepartmentPlan(project,id);if(!current)fail(404,'Department plan not found.');if(body.version!==current.version)fail(409,'Refresh the current department version before changing its approval.');if(body.decision!=='approved')return current;if(body.expectedVersion!==project.version)fail(409,'The project changed. Review this department again before approval.');requireSources(project,approvals);if(departmentPlanningContext(project,approvals).departments.find(d=>d.id===id).stale)fail(409,'Review the department against the current source before approval.');if(body.ackPlanningOnly!==true)fail(400,'Acknowledge that this approves the plan only; casting, look, voice, rights and generated media need separate evidence.');return current;
}
