import {fail,hash} from './domain.mjs';
import {reviewedFalInputSchema,validateFalInput} from './providers.mjs';
const gcd=(a,b)=>b?gcd(b,a%b):a;
// Adapter validation and payload-derived requirements prevent quoting a different
// configuration than the one matched by the capability router.
export function quoteRequirements({task,requirements={},model,input}){
 const schema=reviewedFalInputSchema(model.endpoint);if(!schema)fail(409,'This endpoint has no reviewed quote adapter.');
 if(model.schema_evidence?.inputSchemaHash!==hash(schema))fail(409,'Registry schema evidence does not match the reviewed adapter.');
 try{validateFalInput(model.endpoint,input);}catch(error){fail(400,error.message);}
 const actual={inputModes:[]};
 if(typeof input.prompt==='string'||typeof input.text==='string')actual.inputModes.push('text');
 if(input.image_url||input.end_image_url||input.middle_image_url||input.image_urls?.length||input.reference_image_urls?.length||input.reference_conditions?.some(r=>r.type==='image'))actual.inputModes.push('image');
 if(input.reference_audio_urls?.length||input.reference_conditions?.some(r=>r.type==='audio'))actual.inputModes.push('audio');
 if(input.reference_video_urls?.length||input.reference_conditions?.some(r=>r.type==='video'))actual.inputModes.push('video');
 actual.modality={image_edit:'image',reference_image:'image',reference_look:'image',reference_video:'video',speech_synthesis:'audio'}[task];
 if(!actual.modality)fail(409,'This task has no reviewed quote adapter.');
 // A capability flag cannot establish synchronized performance for these
 // adapters. A dedicated reviewed lip-sync payload adapter is required first.
 if(requirements.lipSync===true)fail(409,'No reviewed lip-sync quote adapter is available for this endpoint.');
 if(requirements.identityReferences===true&&!actual.inputModes.includes('image'))fail(400,'Identity references require at least one explicit image reference in the payload.');
 const payloadLanguages=[input.language_code,input.language].filter(value=>typeof value==='string'&&value.length>0);
 if(payloadLanguages.length>1&&payloadLanguages.some(value=>value!==payloadLanguages[0]))fail(400,'Payload language fields must agree.');
 const payloadLanguage=payloadLanguages[0];
 const languageCodes=model.capabilities?.languageCodes;
 const mapping=languageCodes&&typeof languageCodes==='object'&&!Array.isArray(languageCodes)?languageCodes:{};
 const canonicalFor=code=>{
  const labels=Object.entries(mapping).filter(([label,value])=>typeof label==='string'&&label.length>0&&typeof value==='string'&&value===code).map(([label])=>label);
  if(labels.length>1)fail(409,'Registry language mapping is ambiguous.');
  return labels[0]||code;
 };
 if('language' in requirements){
  if(typeof requirements.language!=='string'||!requirements.language||!payloadLanguage)fail(400,'Requested language requires an explicit matching payload language.');
  const requestedCode=Object.hasOwn(mapping,requirements.language)?mapping[requirements.language]:requirements.language;
  if(typeof requestedCode!=='string'||requestedCode!==payloadLanguage)fail(400,'Requested language must match the explicit model payload language.');
 }
 if(payloadLanguage)actual.language=canonicalFor(payloadLanguage);
 if(typeof input.duration==='number')actual.durationSeconds=input.duration;
 if(input.resolution)actual.resolution=input.resolution;
 if(input.aspect_ratio)actual.aspectRatio=input.aspect_ratio;
 if(input.image_size&&typeof input.image_size==='object'){
  const {width,height}=input.image_size;if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1)fail(400,'An exact positive image size is required.');
  const divisor=gcd(width,height);actual.aspectRatio=`${width/divisor}:${height/divisor}`;actual.resolution=`${width}x${height}`;
 }
 for(const key of ['modality','durationSeconds','resolution','aspectRatio'])if(key in requirements&&actual[key]!==requirements[key])fail(400,`Requested ${key} must match the explicit model payload.`);
 return {...requirements,...actual,inputModes:[...new Set([...(requirements.inputModes||[]),...actual.inputModes])].sort()};
}
