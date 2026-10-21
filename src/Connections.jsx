import React, { useEffect, useRef, useState } from 'react';
import './connections.css';

const providers = [
  { id: 'higgsfield', name: 'Higgsfield (MCP)', detail: 'Imagens e vídeos pelas ferramentas disponíveis na sua conta MCP.' },
  { id: 'higgsfield-api', name: 'Higgsfield (API)', detail: 'Chave da Higgsfield Cloud no formato ID:SECRET. O serviço gera imagens Soul e vídeos Kling/Hailuo sem expor a chave no navegador.' },
  { id: 'blotato', name: 'Blotato', detail: 'Ferramentas de distribuição e conteúdo da sua conta MCP.' },
  { id: 'anthropic', name: 'Claude (Anthropic)', detail: 'Recomendado para a escrita: pautas, redação, roteiros e conselho editorial dos agentes.' },
  { id: 'openai', name: 'OpenAI', detail: 'Escrita de conteúdo e roteiros pelos agentes, transcrição de fontes e geração de imagens.' },
  { id: 'gemini', name: 'Gemini', detail: 'Escrita de conteúdo e roteiros pelos agentes, imagens e vídeos com Veo.' },
  { id: 'meta', name: 'Meta / Instagram', detail: 'Importa as legendas de uma conta profissional conectada à API oficial do Instagram.' },
];
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 401) throw new Error('Entre na sua conta para configurar conexões, extrair fontes e gerar mídia. A demonstração não utiliza credenciais.');
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Não foi possível concluir a operação (HTTP ${response.status}).`);
  return result;
}
const post = (path, body = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });
function safeUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; } }
function Feedback({ error, message }) { return <>{error && <p className="cx-error" role="alert">{error} {error.startsWith('Entre na sua conta') && <a href="#auth">Entrar / criar conta</a>}</p>}{message && <p className="cx-message" role="status">{message}</p>}</>; }

export function Connections() {
  const [connections, setConnections] = useState([]), [error, setError] = useState('');
  async function refresh() { try { const result = await api('/api/integrations'); setConnections(result.connections || []); setError(''); } catch (e) { setError(e.message); } }
  useEffect(() => { refresh(); }, []);
  return <section className="r-panel cx-panel"><small className="cx-eyebrow">CONEXÕES DE PRODUÇÃO</small><h2>Do roteiro à imagem. Da imagem ao vídeo.</h2><p>Conecte suas contas para executar ferramentas reais. Cada geração ou ação utiliza o plano e os créditos do provedor escolhido.</p><Feedback error={error} /><div className="cx-provider-grid">{providers.map(provider => <ConnectionCard key={provider.id} provider={provider} connection={connections.find(c => c.provider === provider.id)} onChanged={refresh} />)}</div><p className="field-help">As chaves são enviadas ao serviço da plataforma. Elas não aparecem nos roteiros, no acervo nem nos resultados das ferramentas.</p></section>;
}
export default Connections;

function ConnectionCard({ provider, connection, onChanged }) {
  const [key, setKey] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState(''), [authUrl, setAuthUrl] = useState('');
  async function execute(action) {
    setBusy(action); setError(''); setMessage('');
    try {
      if (action === 'save') { await api(`/api/integrations/${provider.id}`, { method: 'PUT', body: JSON.stringify({ key }) }); setKey(''); setMessage('Credencial salva. Teste a conexão para conferir o acesso.'); await onChanged(); }
      else if (action === 'test') { const result = await post(`/api/integrations/${provider.id}/test`); setMessage(`Conexão verificada.${Array.isArray(result.tools) ? ` ${result.tools.length} ferramentas disponíveis.` : ''}`); }
      else { const result = await post('/api/integrations/higgsfield/authorize'); const url = safeUrl(result.url); if (!url) throw new Error('O provedor não retornou um endereço de autorização válido.'); setAuthUrl(url); window.open(url, '_blank', 'noopener,noreferrer'); setMessage('Conclua a autorização na janela do Higgsfield e depois atualize a conexão.'); }
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  return <article className="cx-card"><div className="cx-card-title"><h3>{provider.name}</h3><span className={`cx-status ${connection?.configured ? 'is-ready' : ''}`}>{connection?.configured ? 'Configurada' : 'Não configurada'}</span></div><p>{provider.detail}</p>{provider.id === 'higgsfield' && <><button type="button" className="button secondary" disabled={!!busy} onClick={() => execute('authorize')}>{busy === 'authorize' ? 'Abrindo autorização…' : 'Conectar com Higgsfield'}</button>{authUrl && <p><a href={authUrl} target="_blank" rel="noopener noreferrer">Continuar autorização ↗</a> · <button className="cx-text-button" onClick={onChanged}>Atualizar conexão</button></p>}</>}<form onSubmit={e => { e.preventDefault(); execute('save'); }}><label>{provider.id === 'higgsfield' ? 'Token manual (alternativa)' : provider.id === 'meta' ? 'Token de acesso da Meta' : 'Chave de API'}<input type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder={connection?.configured ? 'Informe outra chave para substituir' : provider.id === 'meta' ? 'Token de uma conta profissional do Instagram' : provider.id === 'higgsfield-api' ? 'ID:SECRET da Higgsfield Cloud' : 'Cole a credencial do provedor'} disabled={!!busy} /></label><div className="cx-actions"><button className="button primary" disabled={!!busy || !key.trim()}>{busy === 'save' ? 'Salvando…' : 'Salvar credencial'}</button><button type="button" className="button secondary" disabled={!!busy || !connection?.configured} onClick={() => execute('test')}>{busy === 'test' ? 'Verificando…' : 'Testar conexão'}</button></div></form><Feedback error={error} message={message} /></article>;
}

export function MediaStudio({ initialPrompt = '', prompt: suppliedPrompt, onAsset }) {
  const [mode, setMode] = useState('mcp'), [provider, setProvider] = useState('higgsfield'), [kind, setKind] = useState('image');
  const [prompt, setPrompt] = useState(suppliedPrompt || initialPrompt), [model, setModel] = useState('gpt-image-2');
  const [tools, setTools] = useState([]), [toolName, setToolName] = useState(''), [args, setArgs] = useState('{}');
  const [jobs, setJobs] = useState([]), [result, setResult] = useState(null), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const requestKey = useRef(null);
  useEffect(() => { api('/api/integrations').then(data => setJobs(data.jobs || [])).catch(e => setError(e.message)); }, []);
  const tool = tools.find(item => item.name === toolName);
  const resetRequest = () => { requestKey.current = null; setResult(null); setMessage(''); };
  function changeProvider(value) { setProvider(value); setTools([]); setToolName(''); setArgs('{}'); resetRequest(); if (['higgsfield-api', 'openai', 'gemini'].includes(value)) setModel(defaultModel(value, kind)); }
  function changeMode(value) { setMode(value); changeProvider(value === 'mcp' ? 'higgsfield' : 'higgsfield-api'); }
  function selectTool(name) { setToolName(name); const selected = tools.find(item => item.name === name); setArgs(JSON.stringify(Object.fromEntries((selected?.inputSchema?.required || []).map(field => [field, selected.inputSchema.properties?.[field]?.type === 'number' ? 0 : selected.inputSchema.properties?.[field]?.type === 'boolean' ? false : selected.inputSchema.properties?.[field]?.type === 'array' ? [] : selected.inputSchema.properties?.[field]?.type === 'object' ? {} : ''])), null, 2)); resetRequest(); }
  async function execute(action, job) {
    setBusy(action === 'poll' ? `poll:${job.id}` : action); setError(''); setMessage('');
    try {
      if (action === 'tools') { const data = await api(`/api/integrations/${provider}/tools`); setTools(data.tools || []); setToolName(''); setMessage(`${data.tools?.length || 0} ferramentas retornadas pelo provedor. Escolha uma para configurar.`); }
      else if (action === 'mcp') {
        let parsed; try { parsed = JSON.parse(args); } catch { throw new Error('Revise os argumentos: o JSON não está válido.'); }
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Os argumentos precisam ser um objeto JSON.');
        const missing = (tool?.inputSchema?.required || []).filter(field => !(field in parsed) || parsed[field] === '');
        if (missing.length) throw new Error(`Preencha os campos obrigatórios: ${missing.join(', ')}.`);
        requestKey.current ||= crypto.randomUUID();
        const data = await post(`/api/integrations/${provider}/call`, { name: toolName, arguments: parsed, idempotencyKey: requestKey.current });
        setResult(data); setMessage('Resposta recebida. Confira o resultado e o estado da operação abaixo.');
      } else if (action === 'generate') {
        requestKey.current ||= crypto.randomUUID();
        const data = await post('/api/media/generate', { provider, kind, prompt, model, idempotencyKey: requestKey.current });
        const generated = data.job || data; setJobs(old => [generated, ...old.filter(item => item.id !== generated.id)]); setMessage('Solicitação recebida. O estado abaixo informa se a mídia está pronta ou ainda em processamento.');
      } else {
        const data = await post('/api/media/poll', { id: job.id }); const updated = data.job || data;
        setJobs(old => old.map(item => item.id === job.id ? { ...item, ...updated } : item)); setMessage('Estado da geração atualizado.');
      }
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  return <section className="r-panel cx-panel cx-studio"><small className="cx-eyebrow">ESTÚDIO DE MÍDIA</small><h2>Produza os visuais do seu roteiro.</h2><p>Use uma ferramenta MCP do Higgsfield ou Blotato, ou gere uma imagem ou vídeo com uma API nativa. Confira o prompt e os parâmetros antes de executar: a ação pode consumir créditos ou publicar conteúdo, conforme a ferramenta escolhida.</p><div className="cx-mode" role="group" aria-label="Modo de produção de mídia"><button className={mode === 'mcp' ? 'active' : ''} aria-pressed={mode === 'mcp'} disabled={!!busy} onClick={() => changeMode('mcp')}>Ferramentas MCP</button><button className={mode === 'native' ? 'active' : ''} aria-pressed={mode === 'native'} disabled={!!busy} onClick={() => changeMode('native')}>Geração nativa</button></div><fieldset disabled={!!busy}><div className="cx-fields"><label>Provedor de mídia<select value={provider} onChange={e => changeProvider(e.target.value)}>{providers.filter(p => mode === 'mcp' ? ['higgsfield', 'blotato'].includes(p.id) : ['higgsfield-api', 'openai', 'gemini'].includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{mode === 'native' && <><label>Tipo de mídia<select value={kind} onChange={e => { setKind(e.target.value); setModel(defaultModel(provider, e.target.value)); resetRequest(); }}><option value="image">Imagem</option><option value="video">Vídeo</option></select></label><label>Modelo<input value={model} onChange={e => { setModel(e.target.value); resetRequest(); }} spellCheck={false} /></label></>}</div>{mode === 'mcp' ? <><button className="button secondary" type="button" onClick={() => execute('tools')}>{busy === 'tools' ? 'Consultando ferramentas…' : 'Carregar ferramentas da conta'}</button>{tools.length > 0 && <div className="cx-tool-form"><label>Ferramenta MCP<select value={toolName} onChange={e => selectTool(e.target.value)}><option value="">Selecione uma ferramenta</option>{tools.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>{tool && <><p>{tool.description}</p><p className="field-help">Campos obrigatórios: {tool.inputSchema?.required?.join(', ') || 'nenhum informado pelo provedor'}.</p><details><summary>Ver esquema de argumentos</summary><pre>{JSON.stringify(tool.inputSchema || {}, null, 2)}</pre></details><label>Argumentos da ferramenta (JSON)<textarea rows={9} spellCheck={false} value={args} onChange={e => { setArgs(e.target.value); resetRequest(); }} /></label><button type="button" className="button primary" onClick={() => execute('mcp')}>{busy === 'mcp' ? 'Executando ferramenta…' : `Executar ${toolName}`}</button></>}</div>}</> : <><label>Prompt de produção<textarea rows={6} value={prompt} maxLength={32000} onChange={e => { setPrompt(e.target.value); resetRequest(); }} placeholder="Descreva a cena, composição, movimento, formato e identidade visual desejados." /></label>{provider === 'openai' && kind === 'video' && <p className="cx-notice">A API Sora será encerrada em 24/09/2026. Para novos fluxos de vídeo, use Higgsfield ou Gemini.</p>}<button type="button" className="button primary" disabled={!prompt.trim() || !model.trim()} onClick={() => execute('generate')}>{busy === 'generate' ? 'Enviando geração…' : `Gerar ${kind === 'image' ? 'imagem' : 'vídeo'}`}</button></>}</fieldset><Feedback error={error} message={message} />{requestKey.current && !busy && <button type="button" className="cx-text-button" onClick={() => { requestKey.current = null; setMessage('Pronto para uma nova execução, que poderá consumir novos créditos.'); }}>Preparar uma nova execução</button>}{result && <SafeResult value={result} />}<div className="cx-jobs">{jobs.map((job, index) => <article className="cx-job" key={job.id || index}><div className="cx-card-title"><h3>{job.kind === 'video' ? 'Vídeo' : 'Imagem'} · {job.provider}</h3><span className="cx-status">{({ pending: 'Processando', queued: 'Na fila', completed: 'Concluído', failed: 'Falhou' })[job.status] || job.status}</span></div>{job.prompt && <p>{job.prompt}</p>}{job.error && <p className="cx-error">{job.error}</p>}{job.status !== 'completed' && job.status !== 'failed' && job.id && <button className="button secondary" disabled={!!busy} onClick={() => execute('poll', job)}>{busy === `poll:${job.id}` ? 'Consultando…' : 'Atualizar geração'}</button>}{job.status === 'completed' && (job.assets || []).map((item, i) => <Asset key={i} item={item} kind={job.kind} onAsset={onAsset} />)}</article>)}</div></section>;
}
function defaultModel(provider, kind) { if (provider === 'higgsfield-api') return kind === 'image' ? 'soul-standard' : 'kling-2.5-turbo-pro'; return provider === 'openai' ? kind === 'image' ? 'gpt-image-2' : 'sora-2' : kind === 'image' ? 'gemini-3.1-flash-image' : 'veo-3.1-generate-preview'; }
function Asset({ item, kind, onAsset }) {
  const inline = item.data && /^(image\/(png|jpeg|webp)|video\/mp4)$/.test(item.mimeType || '') && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(item.data) ? `data:${item.mimeType};base64,${item.data}` : null;
  const url = inline || safeUrl(item.url);
  if (!url) return <p>Mídia sem endereço de visualização válido.</p>;
  return <div className="cx-asset">{kind === 'video' || item.mimeType?.startsWith('video/') ? <video src={url} controls preload="metadata" /> : <img src={url} alt="Imagem gerada pelo provedor de IA" loading="lazy" />}<div className="cx-actions"><a href={url} target="_blank" rel="noopener noreferrer" download={inline ? `memorable.${kind === 'video' ? 'mp4' : 'png'}` : undefined}>Abrir / baixar mídia ↗</a>{onAsset && <button className="button secondary" onClick={() => onAsset(item)}>Usar no conteúdo</button>}</div></div>;
}
function SafeResult({ value }) {
  const urls = new Set();
  const scan = data => { if (typeof data === 'string') { for (const candidate of data.match(/https:\/\/[^\s<>"\\]+/g) || []) { const url = safeUrl(candidate); if (url) urls.add(url); } } else if (data && typeof data === 'object') Object.values(data).forEach(scan); };
  scan(value);
  return <section className="cx-result"><h3>Resposta da ferramenta</h3>{[...urls].slice(0, 20).map(url => <p key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url} ↗</a></p>)}<details open={!urls.size}><summary>Ver retorno completo</summary><pre>{JSON.stringify(value, null, 2)}</pre></details></section>;
}
