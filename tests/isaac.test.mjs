import {speeches,acceptedReviews} from './editorial-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { structuredScripts, isaacReview, scriptText, isaacBase } from '../src/isaac.mjs';
import { generateVideoScripts, generateSquad } from '../server/ai.mjs';

test('Isaac: três estruturas por pauta sem fabricar falas ou atribuições', () => {
  const scripts = structuredScripts([{ id: 't1', title: 'Tema fundamentado', sourceId: 's1' }]);
  assert.equal(scripts.length, 3);
  assert.equal(new Set(scripts.map(s => s.strategy)).size, 3);
  for (const s of scripts) {
    assert.deepEqual(s.sourceIds, ['s1']);
    assert.equal(s.body, '');
    assert.equal(s.mode, 'manual');
    assert.ok(isaacReview(s, []).some(c => !c.passed));
  }
  assert.throws(() => structuredScripts([]));
  assert.throws(() => structuredScripts(Array(6).fill({})));
});
test('Isaac: perspectiva local não alega calibração e preserva críticas', () => {
  const s = structuredScripts([{ id: 't', title: 'Tema', sourceId: 's' }])[0];
  s.hook = 'Uma pergunta'; s.cta = 'Qual sua dúvida?';
  s.scenes.forEach(scene => { scene.speech = 'Uma explicação com contexto verificável e exemplo concreto respeitando a fonte.'; });
  const review = isaacReview(s, [{ id: 'isaac', sources: [{ id: 'critica' }] }]);
  assert.ok(review.every(c => c.passed && !c.calibrated));
  assert.deepEqual(review[0].historicalSources, ['critica']);
  assert.match(scriptText(s), /CENA 1 · 3s/);
});
test('Isaac: classificação da base não vaza material de outro espaço', () => {
  const state = { workspace: 'a', sources: [{ id: 's', workspace: 'b', citable: true, text: 'Crítica privada' }] };
  assert.ok(isaacBase(state, { s: 'isaac' }).every(b => b.sources.length === 0));
});
test('Isaac: provedor validado, três versões e quatro pareceres consultivos', async () => {
  const keys = ['SKYVIDYA_AI_URL', 'SKYVIDYA_AI_KEY', 'SKYVIDYA_AI_MODEL'];
  const previous = keys.map(k => process.env[k]);
  const oldFetch = globalThis.fetch;
  let calls = 0;
  try {
    process.env.SKYVIDYA_AI_URL = 'https://example.com/mock'; process.env.SKYVIDYA_AI_KEY = 'test'; process.env.SKYVIDYA_AI_MODEL = 'mock';
    globalThis.fetch = async () => {
      calls++;
      const content = calls === 1 ? { scripts: ['a','b','c'].map(strategy => ({ topicId:'t', title:'Tema', strategy, hook:'Pergunta', technique:'Exemplo', trigger:'Curiosidade', cta:'Pergunte', body:'Contexto', scenes:speeches.map(speech=>({duration:10,speech,visual:'Câmera'})), sourceIds:['s'], warnings:[] })) } : calls === 6 ? acceptedReviews([1,2,3]) : { reason:'Conferir evidências', score:4, blockers:[] };
      return { ok:true, json:async()=>({choices:[{message:{content:JSON.stringify(content)}}]}) };
    };
    const result = await generateVideoScripts({brief:{versionCount:3,durationSeconds:30},sources:[{id:'s',text:'Fonte'}],calibration:[]},[{id:'t',title:'Tema',sourceId:'s'}]);
    assert.equal(result.scripts.length,3); assert.equal(result.committee.length,4); assert.equal(calls,5);
    assert.ok(result.committee.every(c=>c.calibrated===false));
    calls=0; const unified=await generateSquad({brand:{name:'Skyvidya'},voice:{positioning:'Inteligência geoespacial.'},brief:{title:'Tema',format:'Roteiro de vídeo',topicId:'t',versionCount:3,durationSeconds:30},sources:[{id:'s',text:'Fonte'}]}); assert.equal(unified.versions.length,3); assert.match(unified.versions[0].body,/Fala:/); assert.equal(unified.versions[0].mode,'provider');
    await assert.rejects(()=>generateVideoScripts({sources:[{id:'s',text:'Fonte'}]},[{id:'t',title:'Tema',sourceId:'foreign'}]), /fonte/);
  } finally { globalThis.fetch=oldFetch; keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];}); }
});

test('Roteiro: pode citar o conhecimento da marca (DNA aprovado), mas não fontes inventadas', async () => {
  const keys = ['SKYVIDYA_AI_URL', 'SKYVIDYA_AI_KEY', 'SKYVIDYA_AI_MODEL'];
  const previous = keys.map(k => process.env[k]);
  const oldFetch = globalThis.fetch;
  const packet = { brief:{versionCount:1,durationSeconds:30}, sources:[{id:'s',text:'Fonte'}], brandKnowledge:[{id:'dna-x',text:'Site oficial'}], calibration:[] };
  const script = sourceIds => ({ topicId:'t', title:'Tema', strategy:'a', hook:'Pergunta', technique:'Exemplo', trigger:'Curiosidade', cta:'Pergunte', body:'Contexto', scenes:speeches.map(speech=>({duration:10,speech,visual:'Câmera'})), sourceIds, warnings:[] });
  try {
    process.env.SKYVIDYA_AI_URL = 'https://example.com/mock'; process.env.SKYVIDYA_AI_KEY = 'test'; process.env.SKYVIDYA_AI_MODEL = 'mock';
    let ids = ['s', 'dna-x'];
    globalThis.fetch = async (_url, init) => {
      const system = JSON.parse(init.body).messages[0].content;
      const content = /roteirista/.test(system) ? { scripts: [script(ids)] } : { reason:'Conferir evidências', score:4, blockers:[] };
      return { ok:true, json:async()=>({choices:[{message:{content:JSON.stringify(content)}}]}) };
    };
    const result = await generateVideoScripts(packet, [{id:'t',title:'Tema',sourceId:'s'}]);
    assert.deepEqual(result.scripts[0].sourceIds, ['s', 'dna-x']);
    ids = ['s', 'inventada'];
    await assert.rejects(()=>generateVideoScripts(packet, [{id:'t',title:'Tema',sourceId:'s'}]), /fontes não fornecidas/);
  } finally { globalThis.fetch=oldFetch; keys.forEach((k,i)=>{if(previous[i]===undefined)delete process.env[k];else process.env[k]=previous[i];}); }
});
