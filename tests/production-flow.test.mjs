import {speeches,acceptedReviews} from './editorial-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, createPiece, transition } from '../src/workflow.mjs';
import { contextPacket, productionVariants, rankedTopics, mergeCollection, runCouncil, sourceFingerprint } from '../src/operations.mjs';
import { productionSettings, timelineFor, scriptTiming } from '../src/production.mjs';
import { generateSquad, analyseRadar } from '../server/ai.mjs';
import { textModel } from '../server/text-model.mjs';

test('one version is the default, two and three are explicit, invalid counts and durations fail', () => {
  const state = initialState();
  const brief = {title:'Parceria e crescimento',format:'LinkedIn',source:'rolim31'};
  assert.equal(productionVariants(contextPacket(state, brief)).length,1);
  for (const versionCount of [2,3]) assert.equal(productionVariants(contextPacket(state,{...brief,versionCount})).length,versionCount);
  for (const versionCount of [0,4,1.5]) assert.throws(() => productionSettings({...brief,versionCount}));
  for (const durationSeconds of [9,3601,10.5]) assert.throws(() => productionSettings({...brief,format:'Roteiro de vídeo',durationSeconds}));
  assert.equal(productionSettings({format:'Podcast completo'}).durationSeconds,3600);
});

test('strategic solutions rank first without inflating their heuristic scores; inaccessible and risky material stays blocked', () => {
  const state = initialState();
  state.sources.push({id:'own',workspace:'bbmd',title:'Solução própria',origin:'Site oficial',text:'Uma base informativa da própria solução com evidências e exemplos verificáveis.',citable:true,date:new Date().toISOString(),editorialRole:'product'});
  state.radarItems = [{id:'hot',workspace:'bbmd',sourceId:'rolim31',title:'Sinal em alta',breakdown:{relevance:10,brandFit:10,novelty:10,risk:0}}];
  const topics = rankedTopics(state);
  assert.equal(topics[0].sourceId,'own');
  assert.equal(topics[0].strategic,true);
  assert.ok(topics[0].score < 10);
  assert.equal(topics[0].breakdown.novelty,5);
  const merged = mergeCollection(state,{sources:[{...state.sources.at(-1),editorialRole:undefined}]});
  assert.equal(merged.sources[0].editorialRole,'product');
  state.sources.at(-1).validUntil='2020-01-01';
  assert.ok(!rankedTopics(state).some(t=>t.sourceId==='own' && !t.blocked));
  state.radarItems.push({id:'risk',workspace:'bbmd',sourceId:'own',title:'Risco',breakdown:{relevance:10,brandFit:10,novelty:10,risk:9}});
  assert.equal(rankedTopics(state).find(t=>t.id==='risk').blocked,true);
});

test('10s, 30s and 1h have real timelines; long local scaffolds cannot pass as complete spoken scripts', () => {
  const state = initialState();
  for (const durationSeconds of [10,30,90,300,3600]) {
    const timeline=timelineFor(durationSeconds);
    assert.equal(timeline.reduce((s,c)=>s+c.duration,0),durationSeconds);
    assert.equal(timeline.at(-1).start+timeline.at(-1).duration,durationSeconds);
    const packet=contextPacket(state,{title:'Parceria',format:'Roteiro de vídeo',source:'rolim31',durationSeconds});
    const result=productionVariants(packet)[0];
    assert.equal(result.scenes.reduce((s,c)=>s+c.duration,0),durationSeconds);
    if(durationSeconds>180) assert.equal(scriptTiming(result.body,packet.brief).passed,false);
  }
  const packet=contextPacket(state,{title:'Discussão',format:'Podcast completo',source:'rolim31',scriptMode:'outline'});
  assert.equal(scriptTiming(productionVariants(packet)[0].body,packet.brief).passed,true);
});

test('provider honors selected count and duration; a nominal 1h script with only a few spoken words comes back flagged, not passed', async () => {
  for (const versionCount of [1,2,3]) {
    const packet={brand:{name:'Skyvidya'},voice:{positioning:'Inteligência geoespacial para gestão de riscos.'},brief:{title:'Tema',format:'Roteiro de vídeo',durationSeconds:30,versionCount},sources:[{id:'s',text:'Fonte completa'}]};
    const writer=async (_system,data) => data.versions ? acceptedReviews(data.versions) : data.selectedTopics
      ? {scripts:Array.from({length:versionCount},(_,i)=>({topicId:'brief-video',title:'Tema',strategy:`Estratégia ${i}`,hook:'Uma pergunta?',technique:'Explicar',trigger:'Interesse',cta:'Saiba mais',body:'Fundamentação',sourceIds:['s'],warnings:[],scenes:speeches.map(speech=>({duration:10,speech,visual:'Apresentador'}))}))}
      : {reason:'Conferir a fonte',score:4,blockers:[]};
    const result=await generateSquad(packet,writer);
    assert.equal(result.versions.length,versionCount);
    assert.equal(result.versions[0].durationSeconds,30);
    assert.equal(scriptTiming(result.versions[0].body,packet.brief).passed,true);
    const long=await generateSquad({...packet,brief:{...packet.brief,durationSeconds:3600}},writer);
    assert.match(long.versions[0].warnings.join(' '),/3600s/);
    assert.equal(scriptTiming(long.versions[0].body,{...packet.brief,durationSeconds:3600}).passed,false);
  }
});

test('source to approved agenda is persistent domain state; edits cancel approval and schedule', () => {
  let state=initialState();
  const brief={title:'Como funciona uma parceria?',format:'LinkedIn',source:'rolim31',owner:'Editor',deadline:'2027-01-02'};
  const packet=contextPacket(state,brief), delivery=productionVariants(packet)[0];
  state=createPiece(state,{...brief,body:'Na BBMD Advogados, clareza começa pela dúvida de quem está do outro lado. Antes de explicar um termo técnico, pergunte o que a pessoa já entendeu e qual decisão precisa tomar. O episódio de referência destaca o papel da conexão nas conversas. Para a marca, o aprendizado editorial é ouvir, explicar e conferir o entendimento, sem prometer resultados. Que pergunta poderia tornar seu próximo atendimento mais claro?',sourceIds:[brief.source],brief:packet.brief,delivery});
  const id=state.pieces[0].id;
  state.pieces[0]=runCouncil(state,state.pieces[0]).piece;
  state=transition(state,id,'review');
  state=transition({...state,role:'Aprovador'},id,'approve');
  state=transition(state,id,'schedule',{date:'2027-01-02T10:00:00Z',channel:'LinkedIn'});
  assert.equal(JSON.parse(JSON.stringify(state)).pieces[0].status,'Agendado');
  state=transition({...state,role:'Editor'},id,'edit',{body:'Texto atualizado a partir da mesma evidência, precisa de nova revisão.',sourceIds:[brief.source]});
  assert.equal(state.pieces[0].scheduledAt,null);
  assert.equal(state.pieces[0].approvedRevision,null);
});

test('account text adapters use fixed origins, server credentials, JSON parsing and sanitized failures', async () => {
  for(const provider of ['openai','gemini']) {
    const writer=textModel(provider,'secret-key','test-model',async(url,options)=>{
      assert.match(url,provider==='openai'?/^https:\/\/api\.openai\.com\/v1\/responses$/:/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/test-model:generateContent$/);
      const body=JSON.parse(options.body);
      assert.equal(body.key,undefined);
      return {ok:true,json:async()=>provider==='openai'?{output:[{content:[{type:'output_text',text:'{"body":"Texto real"}'}]}]}:{candidates:[{content:{parts:[{text:'{"body":"Texto real"}'}]}}]}};
    });
    assert.equal((await writer('Escreva',{title:'Tema'})).body,'Texto real');
    const rejected=textModel(provider,'secret-key','test-model',async()=>({ok:false,status:401}));
    await assert.rejects(()=>rejected('Escreva',{}),error=>!error.message.includes('secret-key')&&/401/.test(error.message));
  }
  assert.throws(()=>textModel('other','secret','model'));
  assert.throws(()=>textModel('openai','secret','https://foreign.test'));
});

test('semantic radar proposes sourced angles, does not invent freshness, and rejects foreign source IDs', async () => {
  const source={id:'s',title:'Solução',text:'Uma fonte real sobre uma solução permanente.',editorialRole:'product'};
  const topic={sourceId:'s',title:'Como funciona?',reason:'A fonte explica a operação para parceiros.',audience:'Parceiros',thesis:'Operação integrada',angle:'Explicar',cta:'Conheça o modelo',breakdown:{relevance:9,brandFit:9,novelty:10,risk:0}};
  const result=await analyseRadar({sources:[source]},async()=>({topics:[structuredClone(topic)]}));
  assert.equal(result.topics[0].breakdown.novelty,5);
  await assert.rejects(()=>analyseRadar({sources:[source]},async()=>({topics:[{...topic,sourceId:'foreign'}]})));
  let state=initialState();state.sources.push({...source,workspace:'bbmd',origin:'Oficial',citable:true,date:new Date().toISOString()});
  state.radarItems.push({...topic,id:'semantic',workspace:'bbmd',sourceFingerprint:sourceFingerprint([state.sources.at(-1)]),mode:'provider'});
  assert.ok(rankedTopics(state).some(t=>t.id==='semantic'));
  state.sources.at(-1).text='Uma fonte revisada com novas condições e limites.';
  assert.ok(!rankedTopics(state).some(t=>t.id==='semantic'));
});

test('collection refresh preserves human edits, source relationship and curated inspiration', () => {
  const state=initialState();const source={id:'web-test',workspace:'bbmd',title:'Original',origin:'Site',text:'Texto coletado',citable:true,shared:false};
  state.sources.push({...source,title:'Revisado',text:'Texto revisado',transcript:'Texto revisado',manualOverride:true,editorialRole:'product',whySaved:'Uma oferta central',pattern:'Pergunta e exemplo'});
  const refreshed=mergeCollection(state,{sources:[source]}).sources[0];
  assert.equal(refreshed.text,'Texto revisado');assert.equal(refreshed.title,'Revisado');assert.equal(refreshed.editorialRole,'product');assert.equal(refreshed.whySaved,'Uma oferta central');
});
