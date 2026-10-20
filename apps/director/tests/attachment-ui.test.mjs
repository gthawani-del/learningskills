import test from 'node:test';
import assert from 'node:assert/strict';
import {attachmentMime,suggestedAttachmentRole,attachmentFileLimit} from '../public/attachment-ui.js';
test('attachment suggestions use media and project context without fixing language or style',()=>{
 assert.equal(suggestedAttachmentRole('audio/wav',{format:'music_video'}),'master_song');
 assert.equal(suggestedAttachmentRole('audio/mpeg',{format:'documentary'}),'voice_reference');
 assert.equal(suggestedAttachmentRole('video/mp4',{format:'music_video'}),'shot_reference');
 assert.equal(suggestedAttachmentRole('image/png',{requestedRole:'character_identity'}),'character_identity');
 assert.equal(suggestedAttachmentRole('image/png',{requestedRole:'master_song'}),'visual_style');
 assert.equal(suggestedAttachmentRole('image/png',{hasShot:true}),'shot_reference');
 assert.equal(suggestedAttachmentRole('application/pdf',{}),'script');
});
test('large upload allowance is specific to qualified transport and supported media, not the whole-file path',()=>{
 const c={uploadMaxBytes:2*1024*1024,sourceUploadMaxBytes:128*1024*1024,resumableUploads:true};
 assert.equal(attachmentFileLimit('audio/wav',c),128*1024*1024);assert.equal(attachmentFileLimit('image/png',c),2*1024*1024);assert.equal(attachmentFileLimit('audio/wav',{...c,resumableUploads:false}),2*1024*1024);
 assert.equal(attachmentMime({name:'Script.MD',type:''}),'text/markdown');assert.equal(attachmentMime({name:'script.exe',type:''}),'');
});
