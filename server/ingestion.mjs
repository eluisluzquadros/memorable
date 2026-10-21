import { fetchPublic, extractPage } from './collector.mjs';
import { safeUrl } from '../src/operations.mjs';
import {articleText} from './article-text.mjs';

const STOP_WORDS = new Set('a o os as um uma uns umas de da do das dos em no na nos nas para por com sem sobre entre que e ou mas se ao aos à às é são foi foram ser tem têm como mais menos muito muita muitos muitas também ainda já não sim sua seu suas seus este esta estes estas esse essa esses essas aquele aquela aqueles aquelas onde quando quem qual quais porque pelos pelas isso isto aquilo'.split(' '));
const SOCIAL_HOSTS = /(^|\.)(instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|x\.com|twitter\.com)$/i;
const TEXT_EXTENSIONS = new Set(['txt','md','csv','json','html','htm','xml']);
const AUDIO_VIDEO_EXTENSIONS = new Set(['mp3','mp4','mpeg','mpga','m4a','ogg','wav','webm','flac']);

export const sourceKind = raw => {
  const url = new URL(safeUrl(raw));
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname)) return 'youtube';
  if (SOCIAL_HOSTS.test(url.hostname)) return 'social';
  return 'web';
};
export function analyseText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length < 80) throw new Error('A fonte não trouxe texto suficiente para virar referência.');
  // `Intl.Segmenter` preserves names and domains such as "Esfera.Legal". A
  // punctuation-only split treated their internal dot as the end of a sentence.
  const sentences = typeof Intl?.Segmenter === 'function'
    ? [...new Intl.Segmenter('pt-BR', { granularity: 'sentence' }).segment(normalized)].map(({ segment }) => segment)
    : (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized]);
  const summary = sentences.filter(sentence => sentence.trim().length > 25).slice(0, 3).join(' ').trim().slice(0, 750);
  const counts = new Map();
  for (const raw of normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]{4,}/g) || []) {
    if (!STOP_WORDS.has(raw)) counts.set(raw, (counts.get(raw) || 0) + 1);
  }
  const keywords = [...counts].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 8).map(([word]) => word);
  return { text: normalized.slice(0, 100000), transcript: normalized.slice(0, 100000), summary, keywords };
}
function metadata(html, name) {
  const find = property => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${property}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${property}["']`, 'i'))?.[1];
  const title = extractPage(html.match(/<title[^>]*>([^]*?)<\/title>/i)?.[1] || find('og:title') || name || 'Fonte web');
  const description = extractPage(find('description') || find('og:description') || '');
  return { title: title.slice(0,160), description };
}
export function youtubeId(raw) {
  const url = new URL(safeUrl(raw));
  const id = url.hostname.endsWith('youtu.be') ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1];
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('Link do YouTube inválido.');
  return id;
}
async function youtubeTranscript(url, getPublic) {
  const id = youtubeId(url);
  for (const lang of ['pt-BR','pt','en']) {
    try {
      const page = await getPublic(`https://www.youtube.com/api/timedtext?v=${id}&lang=${lang}`);
      const text = extractPage(page.html);
      if (text.length >= 80) return { text, lang };
    } catch { /* Try the next public caption language. */ }
  }
  throw new Error('Este vídeo não possui legenda pública acessível. Conecte um provedor de transcrição ou envie o arquivo de áudio/vídeo.');
}
export async function ingestUrl(input, { getPublic = fetchPublic, instagram } = {}) {
  const url = safeUrl(input?.url || '');
  if (!url) throw new Error('Use uma URL pública com http:// ou https://.');
  const kind = sourceKind(url);
  if (kind === 'social') {
    if (!/instagram\.com$/i.test(new URL(url).hostname) || !instagram)
      throw new Error('Esta conta social exige uma conexão autorizada. Configure o conector social em Configurações ou importe um arquivo exportado da conta.');
    const profile = await instagram(url);
    const analysed = analyseText(profile.text);
    return { ...analysed, title: profile.title, type:'Social', origin:profile.origin, url:profile.url || url, sourceKind:kind, extraction:{ status:'ready', method:'API oficial do Instagram', extractedAt:new Date().toISOString(), importedPosts:profile.posts } };
  }
  if (kind === 'youtube') {
    const result = await youtubeTranscript(url, getPublic);
    const analysed = analyseText(result.text);
    return { ...analysed, title: input.title?.trim() || `Vídeo do YouTube · ${youtubeId(url)}`, type:'Vídeo', origin:'YouTube · legenda pública', url, sourceKind:kind, extraction:{ status:'ready', method:`legenda pública (${result.lang})`, extractedAt:new Date().toISOString() } };
  }
  const page = await getPublic(url);
  const text = await articleText(page.html);
  const info = metadata(page.html, input.title);
  const analysed = analyseText(text);
  return {
    ...analysed,
    // A página pode começar com navegação e CTAs. Quando houver uma descrição
    // editorial declarada pelo autor, ela é a síntese mais fiel para a ficha.
    summary: info.description?.trim() && !/^(por\s|autor|assessoria)/i.test(info.description.trim()) ? info.description.trim() : analysed.summary,
    title: input.title?.trim() || info.title,
    type:'Web', origin: input.origin?.trim() || new URL(url).hostname, url:page.url, sourceKind:kind,
    extraction:{ status:'ready', method:'leitura da página pública', extractedAt:new Date().toISOString(), description:info.description || undefined }
  };
}
function extension(name) { return String(name || '').split('.').pop().toLowerCase(); }
export async function ingestFile(input, { transcribe } = {}) {
  const name = String(input?.name || '').trim();
  const mimeType = String(input?.mimeType || '').toLowerCase();
  if (!name || name.length > 200 || typeof input?.data !== 'string' || !/^[A-Za-z0-9+/\r\n]*={0,2}$/.test(input.data)) throw new Error('Arquivo inválido.');
  const data = Buffer.from(input.data, 'base64');
  if (!data.length || data.length > 25 * 1024 * 1024) throw new Error('Envie um arquivo de até 25 MB.');
  const ext = extension(name);
  let text, type, method;
  if (TEXT_EXTENSIONS.has(ext) || /^text\//.test(mimeType)) { text=data.toString('utf8'); type=ext==='html'||ext==='htm'?'Web':'Documento'; method='texto do arquivo'; }
  else if (ext === 'pdf' || mimeType === 'application/pdf') { const { PDFParse } = await import('pdf-parse'); const parser = new PDFParse({ data }); try { text=(await parser.getText()).text; } finally { await parser.destroy?.(); } type='Documento'; method='texto extraído do PDF'; }
  else if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { const {default:mammoth} = await import('mammoth'); text=(await mammoth.extractRawText({ buffer:data })).value; type='Documento'; method='texto extraído do DOCX'; }
  else if (AUDIO_VIDEO_EXTENSIONS.has(ext) || /^(audio|video)\//.test(mimeType)) { if (!transcribe) throw new Error('Para transcrever áudio ou vídeo, entre na sua conta e conecte a OpenAI em Configurações.'); text=await transcribe({ name, mimeType, data }); type='Vídeo'; method='transcrição automática'; }
  else throw new Error('Formato ainda não suportado. Use PDF, DOCX, TXT, Markdown, CSV, JSON, áudio ou vídeo.');
  const analysed=analyseText(text);
  return { ...analysed, title:name.replace(/\.[^.]+$/, '').slice(0,160), type, origin:'Arquivo enviado', sourceKind:'file', extraction:{ status:'ready', method, extractedAt:new Date().toISOString(), fileName:name, mimeType } };
}
