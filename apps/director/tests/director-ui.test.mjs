import test from 'node:test';
import assert from 'node:assert/strict';
import {directorPanelHTML} from '../public/director-ui.js';
test('Director panel keeps one existing composer, exposes both modes and escapes imported text',()=>{
 const p={format:'music_video',directorSession:{kind:'director_session_v1',mode:'create_with_me',commands:[],messages:[{role:'imported',text:'<img src=x onerror=alert(1)>',id:'a',createdAt:'imported'}]}};
 const html=directorPanelHTML(p);assert.ok(html.includes('Plan it for me'));assert.ok(html.includes('Create it with me'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<textarea'));assert.ok(!html.includes('onerror=alert(1)>'));assert.ok(html.includes('Imported history'));
});
test('Director advice is labeled as a proposal and its next action is reviewable',()=>{
 const html=directorPanelHTML({directorSession:{kind:'director_session_v1',mode:'plan_for_me',commands:[],messages:[{role:'assistant',text:'Review the references.',id:'a',planningCallId:'call',sourceDigest:'source',limitations:['No media inspected.'],action:{kind:'review_references',actionId:'action',destination:'cast'}}]}});
 assert.ok(html.includes('class="director-history" open'));assert.ok(html.includes('Director proposal'));assert.ok(html.includes('No media inspected.'));assert.ok(html.includes('data-director-action'));assert.ok(html.includes('Review references'));assert.ok(!html.includes('quality passed'));
});
test('routing preferences are optional structured controls inside existing planning review',async()=>{
 const {routingPreferencesHTML}=await import('../public/routing-preferences-ui.js');const html=routingPreferencesHTML({goalOptions:['narrativeCoherence','<unsafe>'],current:null},'director_turn');assert.ok(html.includes('Keep reviewed registry defaults'));assert.ok(html.includes('Save and approve preferences'));assert.ok(html.includes('&lt;unsafe&gt;'));assert.ok(!html.includes('<textarea'));
});

test('media review exposes explicit verdicts without generation or extra prompt boxes',async()=>{const {productionOutcomeHTML}=await import('../public/production-outcomes-ui.js');const html=productionOutcomeHTML({id:'media',version:1,checksum:'known',mime:'video/mp4'});assert.ok(html.includes('Keep this media'));assert.ok(html.includes('Needs correction'));assert.ok(!html.includes('<textarea'));assert.ok(!html.includes('Generate'));assert.equal(productionOutcomeHTML(null),'');});
