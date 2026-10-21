// Schemas verified against official OpenAI Images/Videos and Gemini image/Veo docs.
const OPENAI = 'https://api.openai.com/v1';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const HIGGSFIELD = 'https://api.higgsfield.ai';
// Higgsfield platform API (docs.higgsfield.ai): async requests, "Authorization: Key ID:SECRET".
const HIGGSFIELD_MODELS = {
  image: { 'soul-standard': '/higgsfield-ai/soul/standard' },
  video: { 'kling-2.5-turbo-pro': '/kling-video/v2.5-turbo/pro/text-to-video', 'hailuo-2.3': '/minimax/hailuo-2.3/standard/text-to-video' },
};
export const nativeCapabilities = {
  openai: { image: 'gpt-image-2', video: 'sora-2', videoSunset: '2026-09-24', note: 'A API Sora será encerrada em 24/09/2026. Prefira Higgsfield ou Gemini para novos fluxos de vídeo.' },
  gemini: { image: 'gemini-3.1-flash-image', video: 'veo-3.1-generate-preview' },
  'higgsfield-api': { image: 'soul-standard', video: 'kling-2.5-turbo-pro' },
};
function check(provider, kind, key) {
  if (!nativeCapabilities[provider] || !['image', 'video'].includes(kind)) throw new Error('Provedor ou tipo de mídia inválido.');
  if (!key || typeof key !== 'string' || /[\r\n]/.test(key)) throw new Error('Configure a chave deste provedor no servidor.');
}
function modelId(value) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(value)) throw new Error('Identificador de modelo inválido.');
  return value;
}
async function request(url, provider, key, options, fetchImpl) {
  const origin = new URL(url).origin;
  if (origin !== new URL(provider === 'openai' ? OPENAI : GEMINI).origin) throw new Error('Origem de mídia não autorizada.');
  const response = await fetchImpl(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(180000), headers: { ...(options?.headers || {}), ...(provider === 'openai' ? { Authorization: `Bearer ${key}` } : { 'x-goog-api-key': key }) } });
  // Never forward upstream text: it can echo credentials or untrusted prompt material.
  if (!response.ok) throw new Error(`${provider}: requisição recusada (HTTP ${response.status}). Verifique chave, acesso ao modelo e saldo.`);
  return response;
}
async function json(url, provider, key, body, fetchImpl) {
  return (await request(url, provider, key, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}, fetchImpl)).json();
}
function asset(data, mimeType) {
  if (typeof data !== 'string' || !data.length || !/^[A-Za-z0-9+/\r\n]*={0,2}$/.test(data) || !/^image\/(png|jpeg|webp)$|^video\/mp4$/.test(mimeType)) throw new Error('O provedor retornou mídia inválida.');
  if (data.length > 140 * 1024 * 1024) throw new Error('Arquivo excede o limite de mídia.');
  return { data, mimeType };
}
async function download(url, provider, key, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.username || parsed.password || parsed.hash) throw new Error('URL de mídia inválida.');
  const response = await request(url, provider, key, {}, fetchImpl);
  if (Number(response.headers.get('content-length')) > 100 * 1024 * 1024) throw new Error('Arquivo excede o limite de mídia.');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > 100 * 1024 * 1024) throw new Error('Arquivo excede o limite de mídia.'); chunks.push(chunk); }
  const mime = (response.headers.get('content-type') || '').split(';')[0];
  return asset(Buffer.concat(chunks).toString('base64'), mime);
}
function imageParts(result) {
  const found = [];
  // Interactions REST contains nested steps/content; convenience output_image is SDK-only.
  function walk(value) { if (!value || typeof value !== 'object') return; if (value.type === 'image' && value.data && value.mime_type) found.push(asset(value.data, value.mime_type)); else for (const child of Object.values(value)) { if (Array.isArray(child)) child.forEach(walk); else if (child && typeof child === 'object') walk(child); } }
  walk(result);
  return found;
}
const higgsfieldHeaders = (key) => {
  if (!/^[^:\s]{4,200}:[^:\s]{4,400}$/.test(key)) throw new Error('A chave da API Higgsfield deve estar no formato ID:SECRET.');
  return { Authorization: `Key ${key}` };
};
async function higgsfieldJson(path, key, body, fetchImpl, idempotencyKey) {
  const response = await fetchImpl(HIGGSFIELD + path, { method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(60000), headers: { ...higgsfieldHeaders(key), ...(body ? { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`Higgsfield API: requisição recusada (HTTP ${response.status}). Verifique chave, créditos e acesso ao modelo.`);
  return response.json();
}
// Result URLs point at a CDN chosen by the upstream; they are fetched without any credential.
async function publicDownload(url, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('URL de mídia inválida.');
  const response = await fetchImpl(parsed.href, { redirect: 'follow', signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Não foi possível baixar a mídia gerada (HTTP ${response.status}).`);
  if (Number(response.headers.get('content-length')) > 100 * 1024 * 1024) throw new Error('Arquivo excede o limite de mídia.');
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 100 * 1024 * 1024) throw new Error('Arquivo excede o limite de mídia.');
  const mime = (response.headers.get('content-type') || '').split(';')[0];
  return asset(data.toString('base64'), mime === 'image/jpg' ? 'image/jpeg' : mime);
}
async function higgsfieldGenerate({ kind, prompt, model, aspectRatio, seconds, idempotencyKey }, key, fetchImpl) {
  const path = HIGGSFIELD_MODELS[kind][model];
  if (!path) throw new Error(`Modelos disponíveis: ${Object.keys(HIGGSFIELD_MODELS[kind]).join(', ')}.`);
  if (kind === 'video' && ![5, 10].includes(Number(seconds ?? 5))) throw new Error('Os vídeos da API Higgsfield aceitam 5 ou 10 segundos.');
  const body = kind === 'image' ? { prompt, aspect_ratio: aspectRatio, resolution: '2K', num_images: 1 } : { prompt, duration: Number(seconds ?? 5) };
  const response = await higgsfieldJson(path, key, body, fetchImpl, idempotencyKey || crypto.randomUUID());
  if (!/^[0-9a-f-]{36}$/i.test(response.request_id || '')) throw new Error('A API Higgsfield não retornou o identificador da solicitação.');
  return { provider: 'higgsfield-api', kind, model, assets: [], status: 'pending', remoteId: response.request_id };
}
async function higgsfieldPoll(job, key, fetchImpl) {
  if (!/^[0-9a-f-]{36}$/i.test(job.remoteId || '')) throw new Error('Identificador de solicitação inválido.');
  const base = { provider: job.provider, kind: job.kind, model: job.model, remoteId: job.remoteId, assets: [] };
  const result = await higgsfieldJson(`/requests/${job.remoteId}/status`, key, null, fetchImpl);
  if (['failed', 'nsfw', 'canceled'].includes(result.status)) return { ...base, status: 'failed', error: result.status === 'nsfw' ? 'A moderação do provedor recusou o pedido.' : 'O provedor não conseguiu gerar esta mídia.' };
  if (result.status !== 'completed') return { ...base, status: 'pending' };
  const urls = job.kind === 'image' ? (result.images || []).map(i => i.url) : [result.video?.url];
  if (!urls.filter(Boolean).length) return { ...base, status: 'failed', error: 'O provedor não retornou o arquivo gerado.' };
  return { ...base, status: 'completed', assets: [await publicDownload(urls[0], fetchImpl)] };
}
export async function nativeGenerate({ provider, kind, prompt, model, aspectRatio = '16:9', seconds }, key, { fetchImpl = fetch, now = new Date() } = {}) {
  check(provider, kind, key);
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 32000) throw new Error('Informe um prompt de até 32 mil caracteres.');
  if (!['16:9', '9:16', '1:1'].includes(aspectRatio) || (kind === 'video' && aspectRatio === '1:1')) throw new Error('Proporção não suportada para esta mídia.');
  model = modelId(model || nativeCapabilities[provider][kind]);
  if (provider === 'higgsfield-api') return higgsfieldGenerate({ kind, prompt, model, aspectRatio, seconds, idempotencyKey: arguments[0].idempotencyKey }, key, fetchImpl);
  const base = { provider, kind, model, assets: [] };
  if (provider === 'openai' && kind === 'image') {
    const response = await json(`${OPENAI}/images/generations`, provider, key, { model, prompt, n: 1, size: aspectRatio === '1:1' ? '1024x1024' : aspectRatio === '16:9' ? '1536x1024' : '1024x1536' }, fetchImpl);
    const assets = (response.data || []).filter(x => x.b64_json).map(x => asset(x.b64_json, 'image/png'));
    if (!assets.length) throw new Error('O provedor não retornou uma imagem.');
    return { ...base, status: 'completed', assets };
  }
  if (provider === 'gemini' && kind === 'image') {
    const response = await json(`${GEMINI}/interactions`, provider, key, { model, input: [{ type: 'text', text: prompt }], response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: aspectRatio } }, fetchImpl);
    const assets = imageParts(response);
    if (!assets.length) throw new Error('O provedor não retornou uma imagem. Confira se o prompt foi bloqueado.');
    return { ...base, status: 'completed', assets };
  }
  if (provider === 'openai') {
    if (new Date(now) >= new Date('2026-09-24T00:00:00Z')) throw new Error('A API Sora foi descontinuada. Selecione Higgsfield ou Gemini.');
    if (!['sora-2', 'sora-2-pro'].includes(model) || ![4, 8, 12].includes(Number(seconds ?? 4))) throw new Error('Sora aceita modelos sora-2/sora-2-pro e duração de 4, 8 ou 12 segundos.');
    const body = new FormData();
    for (const [name, value] of Object.entries({ model, prompt, seconds: String(seconds ?? 4), size: aspectRatio === '9:16' ? '720x1280' : '1280x720' })) body.set(name, value);
    const response = await (await request(`${OPENAI}/videos`, provider, key, { method: 'POST', body }, fetchImpl)).json();
    if (!/^video_[a-zA-Z0-9_-]+$/.test(response.id || '')) throw new Error('O provedor não retornou o identificador do vídeo.');
    return { ...base, status: response.status === 'failed' ? 'failed' : 'pending', remoteId: response.id, note: nativeCapabilities.openai.note };
  }
  if (![4, 6, 8].includes(Number(seconds ?? 8))) throw new Error('Veo aceita duração de 4, 6 ou 8 segundos.');
  const response = await json(`${GEMINI}/models/${model}:predictLongRunning`, provider, key, { instances: [{ prompt }], parameters: { aspectRatio, durationSeconds: Number(seconds ?? 8), sampleCount: 1 } }, fetchImpl);
  if (!/^models\/[a-zA-Z0-9._-]+\/operations\/[a-zA-Z0-9_-]+$/.test(response.name || '')) throw new Error('O provedor não retornou a operação de vídeo.');
  return { ...base, status: 'pending', remoteId: response.name };
}
export async function nativePoll(job, key, { fetchImpl = fetch } = {}) {
  const { provider, kind, remoteId } = job;
  check(provider, kind, key);
  if (provider === 'higgsfield-api') return higgsfieldPoll(job, key, fetchImpl);
  if (kind !== 'video') throw new Error('Somente vídeos possuem processamento assíncrono.');
  const base = { provider, kind, model: job.model, remoteId, assets: [] };
  if (provider === 'openai') {
    if (!/^video_[a-zA-Z0-9_-]+$/.test(remoteId || '')) throw new Error('Identificador de vídeo inválido.');
    const result = await json(`${OPENAI}/videos/${remoteId}`, provider, key, null, fetchImpl);
    if (result.status === 'failed') return { ...base, status: 'failed', error: 'O provedor não conseguiu gerar este vídeo.' };
    if (result.status !== 'completed') return { ...base, status: 'pending' };
    return { ...base, status: 'completed', assets: [await download(`${OPENAI}/videos/${remoteId}/content`, provider, key, fetchImpl)] };
  }
  if (!/^models\/[a-zA-Z0-9._-]+\/operations\/[a-zA-Z0-9_-]+$/.test(remoteId || '')) throw new Error('Identificador de operação inválido.');
  const result = await json(`${GEMINI}/${remoteId}`, provider, key, null, fetchImpl);
  if (result.error) return { ...base, status: 'failed', error: 'O provedor não conseguiu gerar este vídeo.' };
  if (!result.done) return { ...base, status: 'pending' };
  const samples = result.response?.generateVideoResponse?.generatedSamples || [];
  if (!samples.length) return { ...base, status: 'failed', error: 'Nenhum vídeo retornado. O provedor pode ter bloqueado o prompt.' };
  const assets = [];
  for (const sample of samples.slice(0, 1)) assets.push(await download(sample.video.uri, provider, key, fetchImpl));
  return { ...base, status: 'completed', assets };
}
