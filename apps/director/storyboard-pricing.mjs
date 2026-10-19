import {fail} from './domain.mjs';
import {validateTariff} from './tariffs.mjs';

// Registry evidence supplies the reviewed rates. An old one-image flat tariff
// cannot silently underprice a new multi-reference frame.
export function assertStoryboardFramePricing(price,input){
 if(input?.num_images!==1||!Array.isArray(input.image_urls)||!input.image_urls.length||input.image_urls.length>10||new Set(input.image_urls).size!==input.image_urls.length)fail(409,'A storyboard quote requires one output and an exact unique input-image list.');
 const tariff=validateTariff(price?.tariff),components=tariff.components;
 const base=components.filter(c=>['image','request'].includes(c.unit)),references=components.filter(c=>c.unit==='input_image');
 if(components.length!==2||base.length!==1||references.length!==1||(base[0].includedUnits??0)!==0||(base[0].minimumUnits??0)>1||references[0].includedUnits!==1||(references[0].minimumUnits??0)!==0)fail(409,'Storyboard pricing needs reviewed base-output and additional-input-image components, with the first input included.');
 return tariff;
}
