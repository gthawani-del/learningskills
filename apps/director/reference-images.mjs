import {inflateSync} from 'node:zlib';
import {fail} from './domain.mjs';

export const REFERENCE_IMAGE_MAX_BYTES=10*1024*1024;
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}

// Decode the bounded PNG pixel stream before accepting a provider URL as media.
// This verifies encoding/dimensions, not photographic quality or identity.
export function inspectReferencePNG(bytes,{width:expectedWidth=1024,height:expectedHeight=1024}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<45||bytes.length>REFERENCE_IMAGE_MAX_BYTES||!bytes.subarray(0,8).equals(signature))fail(415,'The saved provider output must be a valid PNG image up to 10 MB.');
 let offset=8,header=null,ended=false,palette=false,seenData=false,endedData=false;const chunks=[];
 while(offset<bytes.length){
  if(offset+12>bytes.length)fail(415,'The provider image is incomplete. Import the same completed request again.');
  const length=bytes.readUInt32BE(offset),end=offset+12+length;
  if(length>REFERENCE_IMAGE_MAX_BYTES||end>bytes.length)fail(415,'The provider image contains an invalid PNG chunk.');
  const name=bytes.toString('ascii',offset+4,offset+8),data=bytes.subarray(offset+8,offset+8+length);
  if(!/^[A-Za-z]{4}$/.test(name)||crc32(bytes.subarray(offset+4,offset+8+length))!==bytes.readUInt32BE(offset+8+length))fail(415,'The provider image failed its PNG integrity check.');
  if(!header&&name!=='IHDR')fail(415,'The provider image has no PNG header.');
  if(name==='IHDR'){
   if(header||length!==13)fail(415,'The provider image has an invalid PNG header.');
   const width=data.readUInt32BE(0),height=data.readUInt32BE(4),bits=data[8],colour=data[9];
   const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
   if(width!==expectedWidth||height!==expectedHeight||!depths[colour]?.includes(bits)||data[10]!==0||data[11]!==0||data[12]!==0)fail(415,'The image dimensions or encoding do not match the reviewed reference route.');
   header={width,height,bits,colour};
  }else if(name==='PLTE'){
   if(palette||seenData||!length||length%3||length>768)fail(415,'The provider image has an invalid PNG palette.');palette=true;
  }else if(name==='IDAT'){
   if(endedData)fail(415,'The provider image has an invalid PNG data sequence.');seenData=true;chunks.push(data);
  }else if(name==='IEND'){
   if(length||!seenData||end!==bytes.length)fail(415,'The provider image has an invalid PNG ending.');ended=true;
  }else{
   if(seenData)endedData=true;
   if(name[0]===name[0].toUpperCase())fail(415,'The provider image uses an unsupported critical PNG chunk.');
  }
  offset=end;
 }
 if(!ended||!header||header.colour===3&&!palette)fail(415,'The provider image is incomplete.');
 const channels={0:1,2:3,3:1,4:2,6:4}[header.colour],rowBytes=Math.ceil(header.width*channels*header.bits/8),expected=header.height*(rowBytes+1);
 let pixels;try{pixels=inflateSync(Buffer.concat(chunks),{maxOutputLength:expected});}catch{fail(415,'The provider image pixel data could not be decoded.');}
 if(pixels.length!==expected)fail(415,'The provider image pixel count is invalid.');
 for(let i=0;i<header.height;i++)if(pixels[i*(rowBytes+1)]>4)fail(415,'The provider image contains an invalid PNG filter.');
 return{mime:'image/png',width:header.width,height:header.height,size:bytes.length};
}

export function referenceOutputURL(value){
 let url;try{url=new URL(value);}catch{fail(502,'The completed request has no supported image download.');}
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port&&url.port!=='443'||!/^(?:[a-z0-9-]+\.)*fal\.media$/i.test(url.hostname))fail(502,'The image result is outside the reviewed fal media host.');
 return url.href;
}

export async function downloadReferencePNG(value,{fetcher=fetch,width=1024,height=1024}={}){
 const url=referenceOutputURL(value),response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)fail(502,'The completed image is not available for import yet. Retry this import without generating again.');
 const declared=response.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>REFERENCE_IMAGE_MAX_BYTES))fail(413,'The generated image exceeds the 10 MB private reference limit.');
 const reader=response.body?.getReader();if(!reader)fail(502,'The completed image download has no readable content.');
 const chunks=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>REFERENCE_IMAGE_MAX_BYTES){await reader.cancel();fail(413,'The generated image exceeds the 10 MB private reference limit.');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
 const bytes=Buffer.concat(chunks),metadata=inspectReferencePNG(bytes,{width,height});return{bytes,...metadata};
}
