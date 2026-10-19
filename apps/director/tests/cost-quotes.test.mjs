import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject, hash} from '../domain.mjs';
import {createCostQuote} from '../cost-quotes.mjs';
const now = '2026-10-18T12:00:00.000Z';
function fixture(unit='second') {
 const project = newProject({title:'Quote'},'owner');
 const model = {id:'M17',provider:'fal',capabilities:{tasks:['image_edit']},endpoint:'bytedance/seedream/v5/pro/edit',version:'route-v1',active:true,execution_tested:true,quality_validated:true,schema_evidence:{verified:true,version:'schema-v1',sourceUrl:'https://example.test/schema',endpoint:'bytedance/seedream/v5/pro/edit',modelVersion:'route-v1',inputSchemaHash:'a'.repeat(64),expiresAt:'2026-10-18T12:10:00.000Z'},price_version:'price-v1',price_evidence:{verified:true,configurationVerified:true,configuration:{},version:'price-v1',currency:'USD',unit,unitMicroUsd:125,rounding:'ceil',expiresAt:'2026-10-18T12:10:00.000Z',sourceUrl:'https://example.test/pricing'}};
 return {task:'image_edit',requirements:{},project,artifactId:'story',artifactVersion:1,model,input:{duration:1.2},now};
}
test('second quotes round up and bind artifact, payload, route and evidence without permission',()=>{
 const args=fixture();const q=createCostQuote(args);
 assert.equal(q.units,2);assert.equal(q.totalMicroUsd,250);assert.equal(q.payloadHash,hash(args.input));assert.equal(q.artifactContentHash,hash(args.project.story));assert.equal(q.modelVersion,'route-v1');assert.equal(q.schemaVersion,'schema-v1');assert.equal(q.expiresAt,'2026-10-18T12:05:00.000Z');assert.equal(q.generationAuthorized,false);assert.equal(q.estimateOnly,true);assert.deepEqual(createCostQuote(args),q);
 assert.notEqual(createCostQuote({...args,input:{duration:1.3}}).id,q.id);
});
test('Unicode code points, image counts, requests and minimum units are explicit',()=>{
 const a=fixture('character');a.input={text:'A😀e\u0301'};assert.equal(createCostQuote(a).units,4);
 a.model.price_evidence.minimumUnits=5;assert.equal(createCostQuote(a).units,5);
 const b=fixture('image');b.input={num_images:3};assert.equal(createCostQuote(b).totalMicroUsd,375);
 const c=fixture('request');c.input={prompt:'Ready'};assert.equal(createCostQuote(c).units,1);
 for(const unit of ['second','image','character'])assert.throws(()=>createCostQuote({...fixture(unit),input:{}}));
 assert.throws(()=>createCostQuote({...b,input:{num_images:1.5}}));
});
test('safe unit and multiplication limits reject overflow, nonfinite and negative inputs',()=>{
 for(const duration of [0,-1,NaN,Infinity,1_000_001])assert.throws(()=>createCostQuote({...fixture(),input:{duration}}));
 const a=fixture();a.model.price_evidence.unitMicroUsd=Number.MAX_SAFE_INTEGER;assert.throws(()=>createCostQuote(a));
 a.model.price_evidence.unitMicroUsd=0;assert.throws(()=>createCostQuote(a));
});
test('price expiry bounds quote and invalid, expired or mismatched evidence fails closed',()=>{
 const a=fixture();a.model.price_evidence.expiresAt='2026-10-18T12:01:00Z';assert.equal(createCostQuote(a).expiresAt,'2026-10-18T12:01:00.000Z');
 for(const value of ['bad','2026-02-30T12:00:00Z','2026-10-18T12:00:00.000Z','2026-10-18']){a.model.price_evidence.expiresAt=value;assert.throws(()=>createCostQuote(a));}
 const b=fixture();b.model.price_version='other';assert.throws(()=>createCostQuote(b));
 b.model.price_version='price-v1';b.model.schema_evidence.sourceUrl='http://example.test';assert.throws(()=>createCostQuote(b));
 for(const flag of ['active','execution_tested','quality_validated']){const c=fixture();c.model[flag]=false;assert.throws(()=>createCostQuote(c));}
});
test('current artifact and ordinary JSON payload are required; client authority is rejected',()=>{
 const a=fixture();assert.throws(()=>createCostQuote({...a,artifactVersion:2}),{status:409});assert.throws(()=>createCostQuote({...a,artifactId:'unknown'}),{status:409});
 for(const key of ['price','budget','authorization','generationAuthorized','unitMicroUsd'])assert.throws(()=>createCostQuote({...a,input:{duration:1,nested:{[key]:1}}}),{status:400});
 assert.throws(()=>createCostQuote({...a,input:{duration:1,unknown:undefined}}));
 assert.throws(()=>createCostQuote({...a,ttlMs:0}));assert.throws(()=>createCostQuote({...a,ttlMs:3_600_001}));
});
test('production records quote only current snapshots and canonical payload keys hash identically',()=>{
 const a=fixture('request');a.project.production.records=[{id:'voice-id',type:'voice',name:'Voice',currentVersion:2,versions:[{version:1,name:'Old',content:{description:'Old direction'},references:[],dependencies:[]},{version:2,name:'Voice',content:{description:'Current direction'},references:[],dependencies:[]}]}];
 a.artifactId='record:voice-id';a.artifactVersion=2;a.input={text:'Hello',style:'Calm'};
 const q=createCostQuote(a);assert.equal(q.artifactVersion,2);assert.equal(q.payloadHash,createCostQuote({...a,input:{style:'Calm',text:'Hello'}}).payloadHash);
 assert.throws(()=>createCostQuote({...a,artifactVersion:1}),{status:409});
 for(const key of ['verified','version','sourceUrl']){const b=fixture();delete b.model.schema_evidence[key];assert.throws(()=>createCostQuote(b));}
 const b=fixture();delete b.model.version;assert.throws(()=>createCostQuote(b));
});
test('direct calls enforce task and all requirements before estimating',()=>{
 const a=fixture();assert.throws(()=>createCostQuote({...a,task:'text_to_video'}),{status:409});
 assert.throws(()=>createCostQuote({...a,requirements:undefined}),{status:400});
 assert.throws(()=>createCostQuote({...a,requirements:{resolution:'1080p'}}),{status:409});
 a.model.capabilities.resolutions=['1080p'];const q=createCostQuote({...a,requirements:{resolution:'1080p'}});assert.equal(q.task,'image_edit');assert.deepEqual(q.requirements,{resolution:'1080p'});
});
test('schema attestation binds endpoint, route version, hash and expiry',()=>{
 for(const [key,value] of [['endpoint','other/endpoint'],['modelVersion','other'],['inputSchemaHash','bad'],['expiresAt','2026-10-18T12:00:00Z'],['expiresAt','2026-02-30T12:00:00Z']]){const a=fixture();a.model.schema_evidence[key]=value;assert.throws(()=>createCostQuote(a),{status:409});}
 const a=fixture();a.model.schema_evidence.expiresAt='2026-10-18T12:00:30Z';assert.equal(createCostQuote(a).expiresAt,'2026-10-18T12:00:30.000Z');
});
test('price configuration requires explicit scalar attestation and exact payload matches',()=>{
 const a=fixture();a.input={duration:2,resolution:'1080p',enhance:false};a.model.price_evidence.configuration={resolution:'1080p',enhance:false};
 const q=createCostQuote(a);assert.deepEqual(q.priceConfiguration,{resolution:'1080p',enhance:false});
 assert.throws(()=>createCostQuote({...a,input:{duration:2,resolution:'720p',enhance:false}}),{status:409});
 assert.throws(()=>createCostQuote({...a,input:{duration:2,resolution:'1080p',enhance:'false'}}),{status:409});
 assert.throws(()=>createCostQuote({...a,input:{duration:2,resolution:'1080p'}}),{status:409});
 a.model.price_evidence.configurationVerified=false;assert.throws(()=>createCostQuote(a),{status:409});
 a.model.price_evidence.configurationVerified=true;a.model.price_evidence.configuration={resolution:{height:1080}};assert.throws(()=>createCostQuote(a),{status:409});
 delete a.model.price_evidence.configuration;assert.throws(()=>createCostQuote(a),{status:409});
});
test('verified composite tariff binds exact rational megapixels and immutable components',()=>{
 const a=fixture();a.input={num_images:2,image_size:{width:1500,height:1000}};
 a.model.price_evidence.tariff={schemaVersion:1,version:'price-v1',components:[{id:'output',unit:'megapixel',rate:{numeratorMicroUsd:101,denominatorUnits:2},rounding:'ceil'},{id:'request',unit:'request',rate:{numeratorMicroUsd:7,denominatorUnits:1},rounding:'ceil'}]};
 const q=createCostQuote(a);assert.equal(q.unit,'composite');assert.equal(q.totalMicroUsd,159);assert.equal(q.components.length,2);assert.equal(q.components[0].quantityNumerator,'3000000');assert.equal(q.components[0].quantityDenominator,'1000000');assert.equal(q.priceEvidence.tariff.schemaVersion,1);
 a.model.price_evidence.tariff.components[0].rate.numeratorMicroUsd=999;assert.equal(q.priceEvidence.tariff.components[0].rate.numeratorMicroUsd,101);
});
test('thousand-character tariffs keep rational usage and token or malformed tariffs remain held',()=>{
 const a=fixture();a.input={text:'A😀'};a.model.price_evidence.tariff={schemaVersion:1,version:'price-v1',components:[{id:'text',unit:'thousand_character',characterCounting:'unicode_codepoint',rate:{numeratorMicroUsd:1001,denominatorUnits:1},rounding:'ceil'}]};
 assert.equal(createCostQuote(a).totalMicroUsd,3);
 a.model.price_evidence.tariff.components[0].unit='output_token';assert.throws(()=>createCostQuote(a),{status:409});
 a.model.price_evidence.tariff={schemaVersion:999,version:'price-v1',components:[]};assert.throws(()=>createCostQuote(a),{status:409});
 a.model.price_evidence.tariff=null;assert.throws(()=>createCostQuote(a),{status:409});
 const b=fixture();assert.throws(()=>createCostQuote({...b,input:{duration:1,usageEvidence:{verified:true}}}),{status:400});
});
test('quotes require and hash an exact positive project version',()=>{
 const a=fixture();const q=createCostQuote(a);assert.equal(q.projectVersion,1);
 a.project.version=2;assert.notEqual(createCostQuote(a).id,q.id);
 for(const version of [undefined,0,-1,1.5]){a.project.version=version;assert.throws(()=>createCostQuote(a),{status:400});}
});
