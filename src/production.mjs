export const VIDEO_FORMATS = ['Roteiro de vídeo', 'Reels', 'Corte de podcast', 'Podcast completo', 'Anúncio UGC', 'Vídeo de produto', 'Comercial', 'Vídeo faceless YouTube'];
export const DEFAULT_DURATION = { 'Podcast completo': 3600, Reels: 30, 'Anúncio UGC': 15, 'Vídeo de produto': 15, Comercial: 30, 'Vídeo faceless YouTube': 300 };
export const DURATION_OPTIONS = [5, 10, 15, 30, 60, 90, 180, 300, 600, 1200, 1800, 3600];
export const durationsFor = format => DURATION_OPTIONS.filter(n=>format==='Podcast completo'?n>=300:format==='Reels'?n>=10&&n<=180:format==='Corte de podcast'?n>=10&&n<=600:format==='Anúncio UGC'?n>=10&&n<=60:format==='Vídeo de produto'?n<=15:format==='Comercial'?n>=15&&n<=30:format==='Vídeo faceless YouTube'?n>=180&&n<=1200:n>=10);
export function durationLabel(seconds) {
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}
export function productionSettings(brief = {}) {
  const versionCount = Number(brief.versionCount ?? 1);
  if (!Number.isInteger(versionCount) || versionCount < 1 || versionCount > 3)
    throw new Error('Escolha uma, duas ou três versões.');
  const video = VIDEO_FORMATS.includes(brief.format);
  const durationSeconds = video ? Number(brief.durationSeconds ?? DEFAULT_DURATION[brief.format] ?? 60) : null;
  if (brief.format === 'Podcast completo' && durationSeconds < 300) throw new Error('Um episódio de podcast precisa de pelo menos 5 minutos. Para 10s ou 30s, escolha Corte de podcast.');
  if (brief.format === 'Reels' && durationSeconds > 180) throw new Error('Para mais de 3 minutos, escolha Roteiro de vídeo.');
  if (video && (!Number.isInteger(durationSeconds) || !durationsFor(brief.format).includes(durationSeconds)))
    throw new Error(`Escolha uma duração válida para ${brief.format}: ${durationsFor(brief.format).map(durationLabel).join(', ')}.`);
  const scriptMode = brief.scriptMode === 'outline' ? 'outline' : 'spoken';
  return { versionCount, video, durationSeconds, scriptMode,
    durationCategory: !video ? null : brief.format === 'Podcast completo' ? 'Podcast / episódio' : durationSeconds <= 90 ? 'Vídeo curto' : durationSeconds <= 600 ? 'Vídeo explicativo' : 'Conteúdo longo',
    targetWords: video ? Math.round(durationSeconds * 2.2) : null };
}
export function timelineFor(seconds) {
  if(seconds<=15)return [{duration:seconds,start:0,label:'Mensagem única'}];
  if(seconds<=30)return [{duration:Math.round(seconds*.65),start:0,label:'Ideia e contexto'},{duration:seconds-Math.round(seconds*.65),start:Math.round(seconds*.65),label:'Próximo passo'}];
  const count = seconds <= 180 ? 3 : seconds <= 600 ? 5 : seconds <= 1800 ? 8 : 12;
  const first = Math.min(5, Math.max(2, Math.round(seconds * .1)));
  const last = Math.max(2, Math.round(seconds * .1));
  const middle = seconds - first - last;
  const base = Math.floor(middle / (count - 2));
  let cursor = 0;
  return Array.from({length:count}, (_, i) => {
    const duration = i === 0 ? first : i === count - 1 ? last : base + (i === count - 2 ? middle % (count - 2) : 0);
    const start = cursor;
    cursor += duration;
    return { duration, start, label: i === 0 ? 'Abertura' : i === count - 1 ? 'Fechamento' : `Bloco ${i}` };
  });
}
export function scriptBody(script) {
  return script.scenes.map((scene, i) => `CENA ${i + 1} · ${scene.duration}s\nFala: ${scene.speech}\nDireção: ${scene.visual}`).join('\n\n');
}
export function videoProductionPlan(script, packet) {
  const dna=packet.brandDNA || {};
  const stylePrefix=`Identidade da marca: ${[dna.primary,dna.secondary,dna.headingFont,dna.aesthetic].filter(Boolean).join('; ') || packet.voice?.tone || 'validar referências de marca'}. Mesma luz, paleta, cenário e enquadramento-base entre cenas.`;
  const assetPlan=[{id:'brand-reference',kind:'Marca',description:'Logo, paleta e tipografia validados',reference:'DNA da marca; confirmar materiais visuais antes da geração.'},{id:'presenter-reference',kind:'Apresentador',description:'Pessoa autorizada ou personagem criado para esta produção',reference:'Selecionar e testar uma referência consistente; não inventar depoimentos.'},{id:'location-reference',kind:'Cenário',description:'Ambiente ou composição editorial recorrente',reference:'Selecionar uma referência de cenário e manter posição dos elementos.'}];
  return {stylePrefix,assetPlan,shotList:script.scenes.map((s,i)=>({id:`shot-${i+1}`,duration:s.duration,assetIds:assetPlan.map(a=>a.id),prompt:`${stylePrefix} Cena ${i+1}: ${s.visual}`,audio:s.speech,continuity:i?'Conferir figurino, cenário, luz e posição em relação à cena anterior.':'Fixar as referências visuais para as próximas cenas.'})),testPlan:'Teste um trecho curto com os ativos escolhidos antes de gerar todas as cenas. Confira identidade, legibilidade e movimento. Altere uma variável por rodada, registre a escolha e só então avance para o lote. Nenhum ativo foi gerado por este planejamento.'};
}
export function spokenWords(script) {
  return (script.scenes || []).map(s => s.speech || '').join(' ').trim().split(/\s+/).filter(Boolean).length;
}
export function scriptTiming(body, brief) {
  const settings = productionSettings(brief);
  if (!settings.video) return null;
  const plannedSeconds = [...body.matchAll(/CENA\s+\d+\s*·\s*(\d+(?:\.\d+)?)s/gi)].reduce((sum,m) => sum + Number(m[1]), 0);
  const speeches = [...body.matchAll(/(?:^|\n)Fala:\s*([\s\S]*?)(?=\nDireção:|$)/gi)].map(m => m[1]).join(' ');
  const wordCount = speeches.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.round(wordCount / 2.2);
  const incomplete = /\[Desenvolver /i.test(speeches);
  const timingMismatch = !plannedSeconds || Math.abs(plannedSeconds - settings.durationSeconds) > Math.max(2, settings.durationSeconds*.1);
  const speechMismatch = settings.scriptMode === 'spoken' && (incomplete || wordCount < settings.durationSeconds*1.3 || wordCount > settings.durationSeconds*3);
  return {...settings, plannedSeconds, wordCount, estimatedSeconds, incomplete, passed:!timingMismatch && !speechMismatch};
}
