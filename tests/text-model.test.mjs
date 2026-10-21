import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeModel, parseJsonObject, textModel } from '../server/text-model.mjs';

const fakeClient = (message, seen = []) => ({ beta:{ messages:{ stream:(params) => { seen.push(params); return { finalMessage:async () => message }; } } } });
const reply = (text, stop_reason = 'end_turn') => ({ stop_reason, content:[{ type:'thinking', thinking:'' }, { type:'text', text }] });

test('Claude adapter streams with fallbacks, effort and the JSON contract', async () => {
  const seen = [];
  const model = claudeModel('key', 'claude-opus-5-5', fakeClient(reply('```json\n{"body":"Texto"}\n```'), seen));
  assert.deepEqual(await model('Atue como redator.', { brief:{ title:'Pauta' } }), { body:'Texto' });
  assert.equal(model.modelName, 'claude-opus-5-5');
  assert.equal(seen[0].model, 'claude-opus-5-5');
  assert.equal(seen[0].fallbacks, 'default');
  assert.deepEqual(seen[0].betas, ['server-side-fallback-2026-07-01']);
  assert.match(seen[0].system, /^Atue como redator\..*JSON válido.*não confiáveis/);
  assert.equal(JSON.parse(seen[0].messages[0].content).brief.title, 'Pauta');
});

test('Claude adapter never applies refusals, truncated or non-object output', async () => {
  await assert.rejects(claudeModel('k', 'claude-opus-5-5', fakeClient(reply('', 'refusal')))('s', {}), /recusou/);
  await assert.rejects(claudeModel('k', 'claude-opus-5-5', fakeClient(reply('{"body":', 'max_tokens')))('s', {}), /tamanho máximo/);
  await assert.rejects(claudeModel('k', 'claude-opus-5-5', fakeClient(reply('[1,2]')))('s', {}), /JSON completo/);
});

test('provider validation accepts anthropic and rejects unsafe model names', () => {
  assert.equal(textModel('anthropic', 'key', 'claude-opus-5-5').modelName, 'claude-opus-5-5');
  assert.throws(() => textModel('anthropic', 'key', 'claude opus; rm'), /identificador válido/);
  assert.throws(() => textModel('mistral', 'key', 'x1'), /Conecte Claude/);
  assert.throws(() => parseJsonObject('texto livre'));
});
