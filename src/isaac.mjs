import { rankedTopics, sourceValid } from './operations.mjs';

export const ISAAC_BASE = [
  ['podcast', 'Transcrições do Bastidores', 1],
  ['good', 'Roteiros aprovados', 10],
  ['bad', 'Roteiros reprovados', 10],
  ['isaac', 'Críticas reais do Isaac', 1],
  ['partner2', 'Críticas do sócio 2', 1],
  ['partner3', 'Críticas do sócio 3', 1],
  ['partner4', 'Críticas do sócio 4', 1],
  ['reference', 'Concorrentes e referências', 10],
  ['ethics', 'Regras editoriais e OAB revisadas pela equipe', 1],
];
export function isaacTopics(state) { return rankedTopics(state).filter(t => !t.blocked).slice(0, 20); }
export function isaacBase(state, assignments = {}) {
  const sources = state.sources.filter(s => (s.workspace === state.workspace || s.shared) && sourceValid(s));
  return ISAAC_BASE.map(([id, label, target]) => ({ id, label, target, sources: sources.filter(s => assignments[s.id] === id) }));
}
export function structuredScripts(topics) {
  if (!topics.length || topics.length > 5) throw new Error('Selecione entre uma e cinco pautas.');
  return topics.flatMap(topic => ['Pergunta concreta', 'Contraste fundamentado', 'Situação do cotidiano'].map((strategy, i) => ({
    id: crypto.randomUUID(), topicId: topic.id, title: topic.title, strategy,
    hook: '', technique: ['Pergunta → explicação → exemplo', 'Expectativa → evidência → orientação', 'Situação → dúvida → esclarecimento'][i],
    trigger: ['Curiosidade sem promessa', 'Relevância prática', 'Identificação sem expor clientes'][i], cta: '', body: '',
    scenes: [{ duration: 3, speech: '', visual: 'Abertura: olhar para a câmera.' }, { duration: 42, speech: '', visual: 'Explicação e exemplo fundamentado na fonte.' }, { duration: 15, speech: '', visual: 'Fechamento e convite informativo.' }],
    sourceIds: [topic.sourceId], warnings: ['Estrutura manual: preencha as falas com base nas fontes. Não reproduz a voz do Isaac.'], mode: 'manual',
  })));
}
export function scriptText(script) {
  return [script.hook, script.body, ...script.scenes.map((s, i) => `CENA ${i + 1} · ${s.duration}s\n${s.speech}\nIMAGEM: ${s.visual}`), script.cta].filter(Boolean).join('\n\n');
}
export function isaacReview(script, base) {
  const text = [script.body, ...script.scenes.map(s => s.speech)].join(' ').trim();
  return [
    ['isaac', 'Clareza e naturalidade', text.split(/\s+/).length >= 30, 'Desenvolva a explicação com um exemplo verificável.'],
    ['partner2', 'Precisão e evidência', script.sourceIds?.length > 0, 'Vincule uma fonte válida e confira cada afirmação.'],
    ['partner3', 'Ritmo e direção', script.scenes.every(s => Number(s.duration) > 0 && s.speech.trim()), 'Preencha as falas e a duração de todas as cenas.'],
    ['partner4', 'Intenção e fechamento', Boolean(script.hook.trim() && script.cta.trim()), 'Defina o gancho e um CTA informativo.'],
  ].map(([key, name, passed, reason]) => ({ name, passed, reason: passed ? 'Estrutura preenchida; conteúdo ainda exige revisão humana.' : reason, calibrated: false, historicalSources: base.find(b => b.id === key)?.sources.map(s => s.id) || [] }));
}
