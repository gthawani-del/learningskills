// Retry only an explicit pre-operation 401. Network failures and unknown paid outcomes are never replayed.
export function createAPIClient({fetcher=fetch}={}){
 let refreshing;
 async function request(path,options={},retried=false){
 const response=await fetcher(path,{...options,headers:{'Content-Type':'application/json',...options.headers},body:options.body===undefined?undefined:JSON.stringify(options.body)});
 if(response.status===401&&!retried&&!path.startsWith('/api/auth/')){
 if(!refreshing)refreshing=request('/api/auth/refresh',{method:'POST',body:{}}).finally(()=>{refreshing=null;});
 await refreshing;return request(path,options,true);
 }
 let data;try{data=await response.json();}catch{throw new Error('The server did not return a usable response. Your draft is still here.');}
 if(!response.ok)throw Object.assign(new Error(data.error?.message||data.error||data.message||`Request failed (${response.status}).`),{status:response.status});return data;
 }
 return request;
}
