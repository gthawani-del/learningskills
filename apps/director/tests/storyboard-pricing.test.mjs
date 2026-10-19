import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateTariff} from '../tariffs.mjs';
import {assertStoryboardFramePricing} from '../storyboard-pricing.mjs';
const price={verified:true,configurationVerified:true,configuration:{num_images:1},version:'synthetic-frame-v1',currency:'USD',sourceUrl:'https://example.test/synthetic-pricing',expiresAt:'2099-01-01T00:00:00.000Z',tariff:{schemaVersion:1,version:'synthetic-frame-v1',components:[{id:'output',unit:'image',rate:{numeratorMicroUsd:67500,denominatorUnits:1},rounding:'ceil'},{id:'extra_inputs',unit:'input_image',includedUnits:1,rate:{numeratorMicroUsd:4500,denominatorUnits:1},rounding:'ceil'}]}};
const input=n=>({num_images:1,image_urls:Array.from({length:n},(_,i)=>'https://fixture.supabase.co/image-'+i)});
test('storyboard estimates price the exact input count with the first reference included',()=>{
 for(const n of [1,2,3,10]){assertStoryboardFramePricing(price,input(n));const quote=calculateTariff({price,input:input(n)});assert.equal(quote.totalMicroUsd,67500+(n-1)*4500);assert.equal(quote.components[1].quantityNumerator,String(n));assert.equal(quote.components[1].costMicroUsd,(n-1)*4500);}
});
test('a flat old one-image tariff or incomplete input component cannot underprice storyboard references',()=>{
 for(const components of [[price.tariff.components[0]],[price.tariff.components[1]],price.tariff.components.map(c=>c.unit==='input_image'?{...c,includedUnits:2}:c),[...price.tariff.components,{id:'hidden',unit:'request',rate:{numeratorMicroUsd:1,denominatorUnits:1},rounding:'ceil'}]])assert.throws(()=>assertStoryboardFramePricing({...price,tariff:{...price.tariff,components}},input(3)),e=>e.status===409);
});
test('input-image tariff quantities reject empty, private-protocol, duplicate or excess lists and hidden output variants',()=>{
 for(const value of [{num_images:1,image_urls:[]},{num_images:1,image_urls:['http://example.test/a']},{num_images:1,image_urls:['https://example.test/a','https://example.test/a']},input(11),{...input(1),num_images:2}])assert.throws(()=>{assertStoryboardFramePricing(price,value);calculateTariff({price,input:value});},e=>e.status===409);
});
