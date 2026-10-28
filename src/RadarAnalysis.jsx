import React, { useEffect, useRef, useState, useContext } from 'react';
import { AppContext } from './context';
import { sourceValid, sourceFingerprint, assertEditor } from './operations.mjs';
import { defaultTextModel, textProviderLabel } from './text-providers.mjs';
export function RadarAnalysis() {
  const {state,setState,notify} = useContext(AppContext);
  const [providers,setProviders]=useState([]), [provider,setProvider]=useState(''), [model,setModel]=useState(defaultTextModel('anthropic')), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const sources=state.sources.filter(s=>(s.workspace===state.workspace||s.shared)&&sourceValid(s)&&!s.id.endsWith('-voice')).slice(0,20);
  const snapshot=JSON.stringify({workspace:state.workspace,role:state.role,voice:state.voices[state.workspace],sources:sources.map(s=>[s.id,sourceFingerprint([s]),s.editorialRole])});
  const current=useRef(snapshot);current.current=snapshot;
  const abort=useRef(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;fetch('/api/text/status').then(r=>r.json()).then(d=>{if(alive.current){setProviders(d.providers||[]);setProvider(d.providers?.[0]||'');setModel(defaultTextModel(d.providers?.[0]));}}).catch(()=>{});return()=>{alive.current=false;abort.current?.abort();};},[]);
  async function analyse(){
    try {
      assertEditor(state);setError('');setBusy(true);
      const requested=current.current;abort.current=new AbortController();
      const packet={voice:state.voices[state.workspace],brandDNA:state.brandDNA?.[state.workspace],sources:sources.map(s=>({id:s.id,title:s.title,text:s.text.slice(0,16000),summary:s.summary,editorialRole:s.editorialRole||'reference',publishedAt:s.publishedAt||null}))};
      const response=await fetch('/api/radar/analyse',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.current.signal,body:JSON.stringify({packet,provider,model})});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível analisar as fontes.');
      if(!alive.current)return;if(requested!==current.current)throw new Error('O contexto mudou durante a análise. Execute novamente com as fontes atuais.');
      const sourceIds=new Set(sources.map(s=>s.id));
      setState(s=>({...s,radarItems:[...data.topics.map(t=>({...t,id:crypto.randomUUID(),workspace:state.workspace,category:'Análise editorial',date:new Date().toISOString(),mode:'provider',model:data.model,sourceFingerprint:sourceFingerprint(sources.filter(source=>source.id===t.sourceId))})),...s.radarItems.filter(t=>t.workspace!==state.workspace||!sourceIds.has(t.sourceId))]}));
      notify(`${data.topics.length} ideias com justificativa e contexto produzidas pela IA.`);
    }catch(e){if(alive.current)setError(e.name==='AbortError'?'Análise cancelada.':e.message);}finally{if(alive.current)setBusy(false);}
  }
  return <details className="r-panel radar-analysis"><summary>Transformar referências em ideias com IA</summary><p>A análise lê o significado da oferta, o público e as evidências e propõe ângulos de conteúdo. A prioridade estratégica da equipe é preservada. Nenhuma nota promete alcance ou viralidade.</p>{providers.length ? <><div className="field-pair"><label>Provedor para análise<select disabled={busy} value={provider} onChange={e=>{setProvider(e.target.value);setModel(defaultTextModel(e.target.value));}}>{providers.map(id=><option key={id} value={id}>{textProviderLabel(id)}</option>)}</select></label>{provider!=='server'&&<label>Modelo para análise<input disabled={busy} value={model} onChange={e=>setModel(e.target.value)}/></label>}</div><button className="button primary" disabled={busy||!sources.length||!['Editor','Administrador'].includes(state.role)} onClick={analyse}>{busy?'Analisando significado e oportunidades…':`Analisar ${sources.length} referências e sugerir ideias`}</button><small>Usa a conta e os créditos do provedor selecionado.</small></>:<p><a href="#app/configuracoes/conexoes">Conecte Claude, OpenAI ou Gemini em Configurações</a> para analisar com IA. O acervo e a priorização manual já estão disponíveis.</p>}{error&&<p className="form-error" role="alert">{error}</p>}</details>;
}
