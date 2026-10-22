import React, { useContext, useState } from 'react';
import { AppContext } from './context';
import { assertEditor, contextPacket, sourceValid } from './operations.mjs';
import { createPiece } from './workflow.mjs';
import { ISAAC_BASE, isaacBase, isaacTopics, structuredScripts, scriptText, isaacReview } from './isaac.mjs';
import './isaac.css';

export function IsaacStudio() {
  const { state, setState, notify, goto, setSelectedPiece } = useContext(AppContext);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const run = (state.isaacRuns || []).find(r => r.workspace === state.workspace && !r.archived) || { id: crypto.randomUUID(), workspace: state.workspace, assignments: {}, selected: [], scripts: [], deadline: '', events: [] };
  const sources = state.sources.filter(s => (s.workspace === state.workspace || s.shared) && sourceValid(s));
  const base = isaacBase(state, run.assignments);
  const topics = isaacTopics(state);
  const selectedTopics = topics.filter(t => run.selected.includes(t.id));
  const script = run.scripts[active];
  const canEdit = ['Editor', 'Administrador'].includes(state.role);
  function update(patch, event) {
    assertEditor(state);
    setState(prev => {
      const current = (prev.isaacRuns || []).find(r => r.id === run.id) || run;
      return { ...prev, isaacRuns: [{ ...current, ...patch, events: event ? [{ at: new Date().toISOString(), text: event, role: prev.role }, ...current.events] : current.events }, ...(prev.isaacRuns || []).filter(r => r.id !== run.id)] };
    });
  }
  function edit(patch) { update({ scripts: run.scripts.map((s, i) => i === active ? { ...s, ...patch, review: null, savedId: null } : s) }); }
  async function generate(ai) {
    setError('');
    try {
      assertEditor(state);
      if (!selectedTopics.length || selectedTopics.length > 5) throw new Error('Escolha entre uma e cinco pautas disponíveis.');
      if (!run.deadline) throw new Error('Defina o prazo do lote.');
      let scripts, committee;
      if (ai) {
        setBusy(true);
        const ids = [...new Set([...selectedTopics.map(t => t.sourceId), ...Object.keys(run.assignments).filter(id => run.assignments[id])])];
        const packet = { ...contextPacket(state, { title: 'Pauta-Isaac v0', format: 'Reels', sourceIds: ids }), calibration: base.map(b => ({ id: b.id, label: b.label, sourceIds: b.sources.map(s => s.id) })) };
        const response = await fetch('/api/isaac/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packet, selectedTopics }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível gerar os roteiros.');
        if (!Array.isArray(data.scripts) || data.scripts.length !== selectedTopics.length * 3) throw new Error('O provedor não retornou três versões por pauta.');
        scripts = data.scripts.map(s => ({ ...s, id: crypto.randomUUID(), mode: 'provider', scenes: s.scenes || [], hook: s.hook || '', body: s.body || '', cta: s.cta || '' })); committee = data.committee;
      } else scripts = structuredScripts(selectedTopics);
      update({ scripts, committee: committee || [], requestedAt: new Date().toISOString() }, ai ? 'Lote gerado pelo provedor de IA.' : 'Estruturas manuais preparadas.'); setActive(0);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function save() {
    try {
      assertEditor(state);
      const checks = isaacReview(script, base);
      if (checks.some(c => !c.passed)) throw new Error('Conclua gancho, falas, duração, fonte e CTA antes de salvar.');
      const next = createPiece(state, { title: `${script.title} · ${script.strategy}`, body: scriptText(script), sourceIds: script.sourceIds, format: 'Reels', owner: 'Lucas', deadline: run.deadline, topicId: script.topicId, delivery: { ...script, av: script.scenes, intendedApprover: 'Beto', isaacRunId: run.id }, brief: { title: script.title, objective: 'Roteiro de vídeo para Isaac', intendedApprover: 'Beto' } });
      const piece = next.pieces[0];
      setState({ ...next, isaacRuns: [{ ...run, scripts: run.scripts.map((s, i) => i === active ? { ...s, savedId: piece.id } : s), events: [{ at: new Date().toISOString(), text: `Rascunho salvo para Lucas; aprovação prevista por Beto.`, pieceId: piece.id, role: state.role }, ...run.events] }, ...(state.isaacRuns || []).filter(r => r.id !== run.id)] });
      setSelectedPiece(piece.id); notify('Roteiro salvo. Execute a conferência editorial e envie para Beto em Aprovar.');
    } catch (e) { setError(e.message); }
  }
  return <div className="isaac-studio">
    <header className="isaac-intro"><span className="eyebrow">PRIMEIRA ENTREGA · PAUTA-ISAAC v0</span><h1>Da pauta ao roteiro que Isaac pode gravar.</h1><p>Selecione os assuntos, compare três abordagens e entregue a Lucas um roteiro com falas, tempo e direção. Beto faz a aprovação humana.</p><ol><li>Base real</li><li>Escolha de pautas</li><li>Três roteiros</li><li>Revisão de Lucas</li><li>Aprovação de Beto</li></ol></header>
    <details className="isaac-panel"><summary>1. Preparar a base · {base.filter(b => b.sources.length >= b.target).length}/{base.length} grupos completos</summary><p>O piloto pede 20 roteiros bons e ruins ao todo e dez referências. A divisão inicial de dez bons e dez ruins é uma orientação de organização. Críticas reais de cada sócio são necessárias para calibrar o comitê; não presumimos suas opiniões.</p><div className="isaac-base">{base.map(b => <div key={b.id}><strong>{b.sources.length}/{b.target}</strong><span>{b.label}</span></div>)}</div><p>Classifique o material existente. Para incluir uma transcrição ou crítica, primeiro adicione em Guardar.</p><button className="button secondary" onClick={() => goto('guardar')}>Abrir acervo</button>{sources.map(s => <label className="isaac-source" key={s.id}>{s.title}<select aria-label={`Uso de ${s.title}`} disabled={!canEdit || busy} value={run.assignments[s.id] || ''} onChange={e => update({ assignments: { ...run.assignments, [s.id]: e.target.value } }, 'Classificação da base atualizada.')}><option value="">Material de apoio</option>{ISAAC_BASE.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>)}</details>
    <section className="isaac-panel"><h2>2. Escolha até cinco pautas</h2><p>Até 20 sugestões do Radar, com fontes e justificativas. {topics.length < 20 ? `Há ${topics.length} disponíveis; amplie as fontes em Vigiar para completar o lote.` : ''} O ranking atual combina recência e aderência à marca; não representa uma medição de viralidade.</p><div className="isaac-topics">{topics.map((t, i) => <label key={t.id}><input type="checkbox" disabled={!canEdit || busy || (!run.selected.includes(t.id) && run.selected.length >= 5)} checked={run.selected.includes(t.id)} onChange={e => update({ selected: e.target.checked ? [...run.selected, t.id] : run.selected.filter(id => id !== t.id) }, 'Seleção humana de pauta atualizada.')} /><span><strong>{i + 1}. {t.title}</strong><small>{t.score}/10 · {t.reason}</small><small>Fonte: {sources.find(s => s.id === t.sourceId)?.title}</small></span></label>)}</div><label className="isaac-field">Prazo do lote<input type="date" disabled={!canEdit || busy} value={run.deadline} onChange={e => update({ deadline: e.target.value })} /></label><div className="isaac-actions"><button className="button" disabled={!canEdit || busy} onClick={() => generate(true)}>{busy ? 'Gerando roteiros…' : 'Gerar 3 roteiros por pauta com IA'}</button><button className="button secondary" disabled={!canEdit || busy} onClick={() => generate(false)}>Preparar estruturas para escrita manual</button></div><p className="isaac-note">A geração com IA usa o provedor configurado no servidor. Preparar estruturas não gera falas nem imita o Isaac. Um novo lote substitui as versões deste estúdio; rascunhos já salvos são preservados.</p></section>
    {error && <p role="alert" className="isaac-error">{error}</p>}
    {script && <section className="isaac-panel"><h2>3. Roteiros e direção de Lucas</h2><label className="isaac-field">Versão em edição<select value={active} onChange={e => setActive(Number(e.target.value))}>{run.scripts.map((s, i) => <option key={s.id} value={i}>{s.title} · {s.strategy}</option>)}</select></label><p>{script.mode === 'manual' ? 'Estrutura manual' : 'Produzido com IA'} · Responsável: Lucas · Aprovador previsto: Beto</p>{(script.warnings || []).map((w, i) => <p className="isaac-note" key={i}>{w}</p>)}<div className="isaac-fields">{[['hook', 'Gancho (0–3s)'], ['technique', 'Técnica narrativa'], ['trigger', 'Gatilho e justificativa'], ['cta', 'CTA informativo']].map(([key, label]) => <label key={key}>{label}<textarea disabled={!canEdit || busy} value={script[key] || ''} onChange={e => edit({ [key]: e.target.value })} /></label>)}</div><label className="isaac-field">Notas do roteiro / fundamentação<textarea disabled={!canEdit || busy} value={script.body} onChange={e => edit({ body: e.target.value })} /></label>{script.scenes.map((scene, i) => <fieldset className="isaac-scene" key={i}><legend>Cena {i + 1}</legend>{[['duration', 'Duração em segundos'], ['speech', 'Fala'], ['visual', 'Imagem e direção']].map(([key, label]) => <label key={key}>{label}{key === 'duration' ? <input type="number" min="1" max="600" disabled={!canEdit || busy} value={scene.duration} onChange={e => edit({ scenes: script.scenes.map((s, n) => n === i ? { ...s, duration: Number(e.target.value) } : s) })} /> : <textarea disabled={!canEdit || busy} value={scene[key]} onChange={e => edit({ scenes: script.scenes.map((s, n) => n === i ? { ...s, [key]: e.target.value } : s) })} />}</label>)}</fieldset>)}<p>Tempo planejado: {script.scenes.reduce((n, s) => n + Number(s.duration || 0), 0)} segundos. Confira o ritmo em uma leitura real.</p><h2>4. Quatro perspectivas antes da aprovação</h2><p>Checagem estrutural local, ainda não calibrada para representar os quatro sócios. Críticas históricas classificadas acompanham a geração com IA; a decisão continua humana.</p><div className="isaac-base">{isaacReview(script, base).map(c => <div key={c.name}><strong>{c.name}</strong><span>{c.reason}</span><small>{c.historicalSources.length} fonte(s) de críticas disponíveis</small></div>)}</div>{run.committee?.length > 0 && <details><summary>Parecer do provedor para o lote original</summary><p>Estas observações não são recalculadas ao editar. Execute a conferência do conteúdo salvo antes de aprovar.</p>{run.committee.map((c, i) => <p key={i}><strong>{c.name}</strong> — {c.reason}</p>)}</details>}<button className="button" disabled={!canEdit || busy || Boolean(script.savedId)} onClick={save}>{script.savedId ? 'Versão salva no fluxo' : 'Salvar roteiro para revisão e aprovação'}</button></section>}
    <section className="isaac-panel"><h2>5. Rastreabilidade do piloto</h2><p>Metas de validação: dez roteiros aprovados por semana, ciclo inferior a oito horas e menos de 20% de reprovação na gravação. São metas do piloto, não resultados comprovados.</p><p>A rotina semanal é configurada em Vigiar. Este estúdio preserva escolhas, versões e vínculos com os conteúdos; aprovação e publicação aparecem no Kanban.</p><button className="button secondary" onClick={() => goto('kanban')}>Acompanhar no Kanban</button><details><summary>Histórico deste lote · {run.events.length} eventos</summary>{run.events.map((e, i) => <p key={i}>{new Date(e.at).toLocaleString('pt-BR')} · {e.role} · {e.text}</p>)}</details></section>
  </div>;
}
