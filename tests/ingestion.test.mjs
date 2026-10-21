import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseText, ingestFile, ingestUrl, sourceKind, youtubeId } from '../server/ingestion.mjs';

test('ingestion produces a reviewable summary, keywords and full transcript from web text', async () => {
  const result = await ingestUrl({ url:'https://example.com/article' }, { getPublic: async () => ({ url:'https://example.com/article', html:'<html><head><title>Gestão clara</title><meta name="description" content="Uma visão prática para decisões claras."></head><body><main>A clareza no atendimento reduz dúvidas e torna decisões mais fáceis. A equipe deve registrar o contexto antes de propor um caminho. Exemplos concretos tornam a comunicação mais humana e mais útil para pessoas reais.</main></body></html>' }) });
  assert.equal(result.title, 'Gestão clara');
  assert.equal(result.type, 'Web');
  assert.equal(result.summary, 'Uma visão prática para decisões claras.');
  assert.match(result.summary, /decisões claras/i);
  assert.ok(result.keywords.length > 0);
  assert.match(result.transcript, /Exemplos concretos/);
});
test('ingestion classifies social URLs and reads public YouTube captions only', async () => {
  assert.equal(sourceKind('https://www.instagram.com/aesferalegal/'), 'social');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  await assert.rejects(ingestUrl({url:'https://www.instagram.com/aesferalegal/'}), /conexão autorizada/);
  const result = await ingestUrl({ url:'https://youtu.be/dQw4w9WgXcQ' }, { getPublic: async () => ({ html:'<transcript><text>Uma conversa extensa sobre liderança e atendimento claro para pessoas que precisam de orientação prática.</text><text>O episódio reúne exemplos, decisões e cuidados que tornam a comunicação mais humana.</text></transcript>' }) });
  assert.equal(result.type, 'Vídeo');
  assert.equal(result.extraction.method, 'legenda pública (pt-BR)');
  const instagram = await ingestUrl({url:'https://www.instagram.com/aesferalegal/'}, { instagram: async () => ({title:'Instagram @aesferalegal',origin:'Instagram oficial @aesferalegal',url:'https://www.instagram.com/p/abc/',posts:2,text:'Uma legenda completa sobre orientação jurídica com contexto, exemplos e informações que podem ser verificadas pela equipe. Outra legenda acrescenta cuidados práticos e esclarece dúvidas recorrentes.'}) });
  assert.equal(instagram.extraction.method, 'API oficial do Instagram');
  assert.equal(instagram.extraction.importedPosts, 2);
});
test('ingestion reads text files locally and requires a configured transcription callback for media', async () => {
  const result = await ingestFile({name:'guia.md',mimeType:'text/markdown',data:Buffer.from('Uma referência extensa para orientar conteúdo de qualidade, com contexto, exemplos e decisões editoriais relevantes.').toString('base64')});
  assert.equal(result.type, 'Documento');
  assert.match(result.text, /referência extensa/);
  await assert.rejects(ingestFile({name:'audio.mp3',mimeType:'audio/mpeg',data:Buffer.from('fake audio data').toString('base64')}), /conecte a OpenAI/);
  const media = await ingestFile({name:'audio.mp3',mimeType:'audio/mpeg',data:Buffer.from('fake audio data').toString('base64')}, { transcribe: async () => 'Uma transcrição extensa de áudio com contexto, exemplos e decisões que podem ser revisadas pela equipe editorial.' });
  assert.equal(media.extraction.method, 'transcrição automática');
});
test('text analysis rejects empty sources and does not claim a summary from too little text', () => {
  assert.throws(() => analyseText('curto'), /texto suficiente/);
});

test('text analysis keeps a dotted brand name intact when creating its summary', () => {
  const result = analyseText('Esfera.Legal oferece um ecossistema completo para advocacia trabalhista, com capital, tecnologia e operação integrada. A equipe parceira recebe suporte para crescer com previsibilidade.');
  assert.match(result.summary, /Esfera\.Legal oferece um ecossistema completo/);
});

test('article reading removes page chrome and rejects a byline as the source summary',async()=>{
  const result=await ingestUrl({url:'https://example.com/article'},{getPublic:async()=>({url:'https://example.com/article',html:'<html><head><title>Dados e decisões</title><meta name="description" content="Por Uma Autora, analista de riscos climáticos da instituição."></head><body><nav>Skip to content</nav><header>Assessoria de Imprensa Entre em contato</header><article><div class="entry-meta">Publicado em 24/06/2026</div><p>Para aplicações em seguros e gestão de portfólio, a fonte de dados precisa ser validada no território, no tipo de variável e no uso pretendido.</p><p>Satélites, reanálises e modelos são indispensáveis, mas não substituem a necessidade de manter e qualificar a observação em solo.</p><p>Documentar limitações ajuda a compreender a incerteza antes de decidir sobre um risco climático específico.</p></article><aside>Notícias recomendadas</aside></body></html>'})});
  assert.match(result.summary,/fonte de dados precisa ser validada/);assert.doesNotMatch(result.summary,/^Por /);assert.doesNotMatch(result.text,/Skip to content|Assessoria de Imprensa|Notícias recomendadas/);
});
