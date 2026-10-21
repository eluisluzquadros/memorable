import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeGenerate, nativePoll, nativeCapabilities } from '../server/native-media.mjs';
const reply = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
test('OpenAI image request returns only real inline media and uses fixed origin', async () => {
  const result = await nativeGenerate({ provider: 'openai', kind: 'image', prompt: 'Capa editorial', aspectRatio: '1:1' }, 'secret', { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/generations'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer secret'); assert.equal(JSON.parse(options.body).model, 'gpt-image-2');
    return reply({ data: [{ b64_json: 'aGVsbG8=' }] });
  } });
  assert.equal(result.status, 'completed'); assert.equal(result.assets[0].mimeType, 'image/png');
});
test('Gemini images use Interactions image blocks and requested ratio', async () => {
  const result = await nativeGenerate({ provider: 'gemini', kind: 'image', prompt: 'Uma capa', aspectRatio: '9:16' }, 'secret', { fetchImpl: async (url, options) => {
    assert.match(url, /\/interactions$/); assert.equal(JSON.parse(options.body).response_format.aspect_ratio, '9:16');
    return reply({ steps: [{ type: 'model_output', content: [{ type: 'image', mime_type: 'image/png', data: 'aGVsbG8=' }] }] });
  } }); assert.equal(result.assets.length, 1);
});
test('Sora uses multipart, exposes sunset notice and refuses generation after sunset', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => { calls++; assert.ok(options.body instanceof FormData); assert.equal(options.body.get('seconds'), '8'); return reply({ id: 'video_abc', status: 'queued' }); };
  const input = { provider: 'openai', kind: 'video', prompt: 'Paisagem', seconds: 8 };
  const result = await nativeGenerate(input, 'secret', { fetchImpl, now: '2026-09-15' });
  assert.equal(result.status, 'pending'); assert.match(result.note, /24\/09\/2026/);
  await assert.rejects(nativeGenerate(input, 'secret', { fetchImpl, now: '2026-09-24' }), /descontinuada/); assert.equal(calls, 1);
  assert.equal(nativeCapabilities.openai.videoSunset, '2026-09-24');
});
test('Veo creates operation and polls authenticated binary content', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push(url); assert.equal(options.headers['x-goog-api-key'], 'secret'); assert.equal(options.redirect, 'error');
    if (url.endsWith(':predictLongRunning')) { assert.equal(JSON.parse(options.body).parameters.durationSeconds, 6); return reply({ name: 'models/veo-3.1-generate-preview/operations/abc' }); }
    if (url.includes('/operations/')) return reply({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://generativelanguage.googleapis.com/v1beta/files/video:download?alt=media' } }] } } });
    return new Response('video', { headers: { 'Content-Type': 'video/mp4' } });
  };
  const job = await nativeGenerate({ provider: 'gemini', kind: 'video', prompt: 'Paisagem', seconds: 6 }, 'secret', { fetchImpl });
  const done = await nativePoll(job, 'secret', { fetchImpl }); assert.equal(done.status, 'completed'); assert.equal(done.assets[0].data, Buffer.from('video').toString('base64')); assert.equal(requests.length, 3);
});
test('native downloads never send a credential to an upstream-supplied foreign URL', async () => {
  let calls = 0;
  await assert.rejects(nativePoll({ provider: 'gemini', kind: 'video', remoteId: 'models/veo/operations/a' }, 'secret', { fetchImpl: async () => { calls++; return reply({ done: true, response: { generateVideoResponse: { generatedSamples: [{ video: { uri: 'https://attacker.example/a' } }] } } }); } }), /Origem/);
  assert.equal(calls, 1);
});
test('malformed model and remote IDs rejected before network and errors omit provider secrets', async () => {
  const never = async () => { throw Error('Network must not run'); };
  await assert.rejects(nativeGenerate({ provider: 'gemini', kind: 'image', model: '../secrets', prompt: 'a' }, 'secret', { fetchImpl: never }), /modelo inválido/);
  await assert.rejects(nativePoll({ provider: 'openai', kind: 'video', remoteId: '../secrets' }, 'secret', { fetchImpl: never }), /inválido/);
  await assert.rejects(nativeGenerate({ provider: 'openai', kind: 'image', prompt: 'a' }, 'secret', { fetchImpl: async () => new Response('secret', { status: 401 }) }), error => !error.message.includes('secret') && error.message.includes('401'));
});
test('empty image output and blocked video never report successful generation', async () => {
  await assert.rejects(nativeGenerate({ provider: 'gemini', kind: 'image', prompt: 'a' }, 'secret', { fetchImpl: async () => reply({ steps: [] }) }), /não retornou/);
  const result = await nativePoll({ provider: 'gemini', kind: 'video', remoteId: 'models/veo/operations/a' }, 'secret', { fetchImpl: async () => reply({ done: true, response: {} }) }); assert.equal(result.status, 'failed');
});
test('Higgsfield API submits with Key auth and idempotency, polls and downloads without the credential', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, auth: options.headers?.Authorization });
    if (url.endsWith('/higgsfield-ai/soul/standard')) {
      assert.equal(options.headers['Idempotency-Key'], 'idem-12345');
      assert.deepEqual(JSON.parse(options.body), { prompt: 'Capa', aspect_ratio: '9:16', resolution: '2K', num_images: 1 });
      return reply({ status: 'queued', request_id: 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff' });
    }
    if (url.includes('/requests/')) return reply({ status: 'completed', images: [{ url: 'https://cdn.example.com/a.png' }] });
    return new Response('png', { headers: { 'Content-Type': 'image/png' } });
  };
  const job = await nativeGenerate({ provider: 'higgsfield-api', kind: 'image', prompt: 'Capa', aspectRatio: '9:16', idempotencyKey: 'idem-12345' }, 'keyid:secretvalue', { fetchImpl });
  assert.equal(job.status, 'pending');
  const done = await nativePoll(job, 'keyid:secretvalue', { fetchImpl });
  assert.equal(done.status, 'completed'); assert.equal(done.assets[0].mimeType, 'image/png');
  assert.equal(calls[0].auth, 'Key keyid:secretvalue'); assert.equal(calls[1].auth, 'Key keyid:secretvalue'); assert.equal(calls[2].auth, undefined);
  await assert.rejects(nativeGenerate({ provider: 'higgsfield-api', kind: 'image', prompt: 'Capa' }, 'semdoispontos', { fetchImpl }), /ID:SECRET/);
  await assert.rejects(nativeGenerate({ provider: 'higgsfield-api', kind: 'video', prompt: 'Cena', seconds: 8 }, 'keyid:secretvalue', { fetchImpl }), /5 ou 10/);
});
