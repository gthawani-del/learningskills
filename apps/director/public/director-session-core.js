const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DIRECTOR_SESSION_KIND='director_session_v1';
export const DIRECTOR_SESSION_MAX_BYTES=65536;
export const DIRECTOR_MESSAGE_MAX_CHARS=4000;
const modes=new Set(['plan_for_me','create_with_me']);
function bounded(session){if(new TextEncoder().encode(JSON.stringify(session)).length>DIRECTOR_SESSION_MAX_BYTES)fail(409,'This conversation reached its saved size limit. Your earlier messages are unchanged.');return session;}
export function directorSession(project){
 if(!project.directorSession)return {kind:DIRECTOR_SESSION_KIND,mode:'plan_for_me',messages:[],commands:[]};
 const s=project.directorSession;
 if(!plain(s)||s.kind!==DIRECTOR_SESSION_KIND||!modes.has(s.mode)||!Array.isArray(s.messages)||!Array.isArray(s.commands))fail(409,'The saved Director conversation needs recovery.');
 return structuredClone(bounded(s));
}
// Imported transcripts preserve wording, never server identity, tool receipts or authority.
export function importedDirectorSession(value){
 if(!plain(value)||value.kind!==DIRECTOR_SESSION_KIND||!modes.has(value.mode)||!Array.isArray(value.messages)||value.messages.length>500)fail(400,'Invalid imported Director conversation.');
 const messages=value.messages.map(m=>{
  if(!plain(m)||!['user','assistant','imported'].includes(m.role)||typeof m.text!=='string'||!m.text.trim()||m.text.length>DIRECTOR_MESSAGE_MAX_CHARS)fail(400,'Invalid imported conversation message.');
  return {id:globalThis.crypto.randomUUID(),role:'imported',text:m.text,createdAt:'imported'};
 });
 return bounded({kind:DIRECTOR_SESSION_KIND,mode:value.mode,messages,commands:[]});
}
export function applyDirectorSessionCommand(project,command){
 if(!plain(command)||!uuid.test(command.requestId||'')||!Number.isSafeInteger(command.expectedVersion)||command.expectedVersion<1)fail(400,'Supply a request identity and saved project version.');
 const allowed=command.action==='set_mode'?['requestId','expectedVersion','action','mode']:command.action==='append_user_message'?['requestId','expectedVersion','action','text']:[];
 if(!allowed.length||Object.keys(command).some(key=>!allowed.includes(key)))fail(400,'Unsupported Director conversation command.');
 if(command.action==='set_mode'&&!modes.has(command.mode))fail(400,'Choose a supported Director participation style.');
 if(command.action==='append_user_message'&&(typeof command.text!=='string'||!command.text.trim()||command.text.length>DIRECTOR_MESSAGE_MAX_CHARS))fail(400,'Enter a message of 1–4000 characters.');
 const session=directorSession(project),saved=session.commands.find(c=>c.requestId===command.requestId);
 if(saved){
  const matches=saved.action===command.action&&saved.expectedVersion===command.expectedVersion&&(saved.action==='set_mode'?saved.mode===command.mode:session.messages.find(m=>m.id===saved.messageId)?.text===command.text);
  if(!matches)fail(409,'This request identity belongs to another conversation command.');
  return structuredClone(project);
 }
 if(project.version!==command.expectedVersion)fail(409,'This project changed. Refresh before saving; your message has not been submitted again.');
 const receipt={requestId:command.requestId,expectedVersion:command.expectedVersion,action:command.action};
 if(command.action==='set_mode'){session.mode=command.mode;receipt.mode=command.mode;}
 else{const message={id:globalThis.crypto.randomUUID(),role:'user',text:command.text,createdAt:new Date().toISOString()};session.messages.push(message);receipt.messageId=message.id;}
 session.commands.push(receipt);bounded(session);
 return {...structuredClone(project),version:project.version+1,directorSession:session};
}
