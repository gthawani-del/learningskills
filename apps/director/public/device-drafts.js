import {sceneChanged,briefChanged} from './revision-impact.js';
// Explicit browser-only drafts. These records never grant cloud access or authorize spending.
let database;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('director-device-drafts',1);r.onupgradeneeded=()=>{r.result.createObjectStore('projects',{keyPath:'id'});r.result.createObjectStore('assets',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Device storage is unavailable.'));});}
async function read(store,id){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store).objectStore(store).get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function all(store){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveDevice(project,expected){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('projects','readwrite'),store=tx.objectStore('projects'),get=store.get(project.id);let conflict=false;
 get.onsuccess=()=>{if(expected!==undefined&&get.result?.version!==expected){conflict=true;tx.abort();return;}store.put(project);};tx.oncomplete=()=>resolve(structuredClone(project));tx.onabort=tx.onerror=()=>reject(Error(conflict?'This draft changed in another tab. Reopen it before saving.':'Could not save on this device. Your current input is unchanged.'));});}
export async function createDevice({premise,format}){const project={id:'device-'+crypto.randomUUID(),isLocal:true,title:premise.slice(0,65)||'Untitled film',premise,format,briefExplicitFields:['premise','format'],stage:'brief',duration:60,language:'English',direction:'',version:1,story:{treatment:'',scenes:[],version:1},shots:[],approvals:[],notes:[],createdAt:new Date().toISOString()};return saveDevice(project);}
export const listDevice=()=>all('projects');
export const getDevice=id=>read('projects',id);
export function draftRevision(previous,fields){const next=structuredClone(previous);for(const k of ['title','premise','duration','language','direction','stage','story','shots','approvals','notes'])if(fields[k]!==undefined)next[k]=fields[k];
 const explicit=new Set(previous.briefExplicitFields||[]);for(const key of ['premise','direction','language','duration','format'])if(fields[key]!==undefined&&fields[key]!==previous[key])explicit.add(key);next.briefExplicitFields=[...explicit].sort();
 if(fields.story){const clean=s=>({treatment:s.treatment,scenes:s.scenes});next.story.version=previous.story.version+(JSON.stringify(clean(fields.story))===JSON.stringify(clean(previous.story))?0:1);}
 if(fields.shots)next.shots=fields.shots.map(s=>{const old=previous.shots.find(x=>x.id===s.id);const clean=x=>{const {version,status,...value}=x;return value;};return {...s,version:old?old.version+(JSON.stringify(clean(old))===JSON.stringify(clean(s))&&!sceneChanged(previous,next,old.sceneId,s.sceneId)?0:1):1,status:'draft'};});
 if(fields.shots===undefined&&fields.story!==undefined)next.shots=next.shots.map(s=>sceneChanged(previous,next,s.sceneId)?{...s,version:s.version+1,status:'draft'}:s);
 if(briefChanged(previous,next)&&next.story.version===previous.story.version)next.story={...next.story,version:previous.story.version+1};
 next.version=previous.version+1;return next;}
export async function patchDevice(previous,fields){return saveDevice(draftRevision(previous,fields),previous.version);}
export async function addDeviceAsset(project,file,metadata){const d=await db();const asset={id:crypto.randomUUID(),projectId:project.id,name:file.name,mime:file.type||(file.name.endsWith('.md')?'text/markdown':'application/octet-stream'),size:file.size,version:1,...metadata,blob:file};return new Promise((resolve,reject)=>{const tx=d.transaction('assets','readwrite');tx.objectStore('assets').put(asset);tx.oncomplete=()=>resolve(asset);tx.onabort=tx.onerror=()=>reject(Error('Could not store this file on your device.'));});}
export async function deviceAssets(projectId){return (await all('assets')).filter(a=>a.projectId===projectId);}
