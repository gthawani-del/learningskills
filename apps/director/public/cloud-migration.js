// A repeat of the same snapshot resolves to the same server-owned import. Device records are never deleted.
const bytesToBase64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
async function digest(base64){const data=new TextEncoder().encode(JSON.stringify(base64));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),n=>n.toString(16).padStart(2,'0')).join('');}
export async function migrateDeviceDraft({api,project,assets,onProgress=()=>{}}){
 const manifest=[];
 for(const asset of assets){if(!asset.blob)throw Error(`The file ${asset.name} is unavailable on this device. The draft has not been removed.`);const bytes=new Uint8Array(await asset.blob.arrayBuffer());manifest.push({id:asset.id,name:asset.name,mime:asset.mime,role:asset.role,scope:asset.scope,shotId:asset.shotId||null,size:bytes.length,checksum:await digest(bytesToBase64(bytes))});}
 onProgress('Saving draft and direction notes…');
 const started=await api('/api/imports',{method:'POST',body:{sourceId:project.id,project,assets:manifest}});const cloud=started.project;
 if(cloud.importState?.status==='ready')return cloud;
 const known=(await api(`/api/projects/${cloud.id}/assets`)).assets||[];
 for(let i=0;i<assets.length;i++){
 const asset=assets[i],metadata=manifest[i];if(known.some(a=>a.sourceAssetId===asset.id&&a.checksum===metadata.checksum))continue;
 onProgress(`Saving reference ${i+1} of ${assets.length}: ${asset.name}`);
 const base64=bytesToBase64(new Uint8Array(await asset.blob.arrayBuffer()));
 await api(`/api/projects/${cloud.id}/import-assets/${asset.id}`,{method:'POST',body:{...metadata,base64}});
 }
 onProgress('Checking references and finishing the cloud copy…');
 return (await api(`/api/projects/${cloud.id}/import-complete`,{method:'POST',body:{}})).project;
}
