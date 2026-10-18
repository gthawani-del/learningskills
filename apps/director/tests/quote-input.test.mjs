import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteRequirements } from '../quote-input.mjs';
import { reviewedFalInputSchema } from '../providers.mjs';
import { hash } from '../domain.mjs';
function model(endpoint = 'elevenlabs/tts/eleven-v4', languageCodes) {
  return { endpoint, capabilities: { ...(languageCodes ? { languageCodes } : {}) }, schema_evidence: { inputSchemaHash: hash(reviewedFalInputSchema(endpoint)) } };
}
const speech = { text: 'Welcome home.', voice: 'Rachel', stability: 0.5, similarity_boost: 0.75, language_code: 'en', output_format: 'mp3_44100_128', apply_text_normalization: 'off', timestamps: true };
function quote(requirements, input = speech, candidate = model()) { return quoteRequirements({ task: 'speech_synthesis', requirements, input, model: candidate }); }
function status(code) { return error => error.status === code; }
test('actual speech language contradicting the requested language is rejected', () => {
  assert.throws(() => quote({ language: 'hi' }), status(400));
  assert.throws(() => quote({ language: 'English' }), status(400));
  assert.throws(() => quote({ language: 'en' }, { ...speech, language_code: null }), status(400));
  const { language_code, ...withoutLanguage } = speech;
  assert.throws(() => quote({ language: 'en' }, withoutLanguage), status(400));
});
test('literal code and explicit trusted aliases bind the payload language', () => {
  assert.equal(quote({ language: 'en' }).language, 'en');
  const candidate = model(undefined, { English: 'en', Hindi: 'hi' });
  assert.equal(quote({ language: 'English' }, speech, candidate).language, 'English');
  assert.equal(quote({ language: 'en' }, speech, candidate).language, 'English');
  assert.equal(quote({}, speech, candidate).language, 'English');
  assert.equal(quote({}).language, 'en');
  assert.throws(() => quote({ language: 'Hindi' }, speech, candidate), status(400));
});
test('ambiguous trusted language aliases cannot silently choose a route capability', () => {
  assert.throws(() => quote({}, speech, model(undefined, { English: 'en', EnglishOther: 'en' })), status(409));
});
test('identity requirement needs an actual image reference without asserting identity or consent', () => {
  assert.throws(() => quote({ identityReferences: true }), status(400));
  const endpoint = 'bytedance/seedream/v5/pro/edit';
  const result = quoteRequirements({ task: 'image_edit', requirements: { identityReferences: true }, model: model(endpoint), input: { prompt: 'Preserve this reference person.', image_urls: ['https://assets.example/portrait.png'] } });
  assert.equal(result.identityReferences, true);
  assert.deepEqual(result.inputModes, ['image', 'text']);
  assert.equal(result.consentVerified, undefined);
});
test('lip sync flags cannot authorize any current adapter as verified lip sync', () => {
  assert.throws(() => quote({ lipSync: true }), status(409));
  const endpoint = 'minimax/h3-max/reference-to-video';
  assert.throws(() => quoteRequirements({ task: 'reference_video', requirements: { lipSync: true }, model: model(endpoint), input: { prompt: 'A speaker.', prompt_expansion_mode: 'disabled' } }), status(409));
});
test('existing payload derived dimensions and input modes remain binding', () => {
  const endpoint = 'bytedance/seedream/v5/pro/edit';
  const input = { prompt: 'A portrait.', image_urls: ['https://assets.example/portrait.png'], image_size: { width: 1024, height: 1024 } };
  const result = quoteRequirements({ task: 'image_edit', model: model(endpoint), input, requirements: { aspectRatio: '1:1', resolution: '1024x1024' } });
  assert.equal(result.aspectRatio, '1:1'); assert.equal(result.resolution, '1024x1024');
  assert.throws(() => quoteRequirements({ task: 'image_edit', model: model(endpoint), input, requirements: { aspectRatio: '16:9' } }), status(400));
});
