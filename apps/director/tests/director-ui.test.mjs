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
