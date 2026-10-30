import React,{useContext,useState} from 'react';
import {Building2,Layers,Plus,ArrowRight,Archive,RotateCcw} from 'lucide-react';
import {AppContext} from './context';
import {workspaceList,addBrand,renameBrand,archiveBrand,renameOrganization,setBrandAliases} from './account-state.mjs';
import './organization.css';
import {Contributors} from './Contributors';
import {GroupDNA} from './GroupDNA';
import {Subtabs,Subpanel,useSubtab} from './Subtabs';
import {useAiSpend,usd,sinceLabel} from './AiBudget';
import {useCurrency} from './CurrencyControls';
const reviewCount=pieces=>pieces.filter(p=>p.status==='Em revisão').length;

function BrandRow({brand,state,setState,notify,onOpen}){
  const {changeWorkspace}=useContext(AppContext);
  const [name,setName]=useState(brand.name);
  const [aliases,setAliases]=useState((brand.aliases||[]).join(', '));
  function change(action){try{const next=action(state);if(next.workspace!==state.workspace)changeWorkspace(next.workspace);setState(next);notify('Marca atualizada. O conteúdo foi preservado.');}catch(error){notify(error.message,true);}}
  return <article className={`brand-management-row ${brand.archived?'archived':''}`}>
    <span className="workspace-avatar" style={{background:brand.color}}>{brand.initials}</span>
    <form onSubmit={e=>{e.preventDefault();change(s=>renameBrand(s,brand.id,name));}}><label>Nome da marca<input aria-label={`Nome da marca ${brand.name}`} value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={80}/></label><button className="button secondary" disabled={state.role!=='Administrador'}>Salvar nome</button></form>
    <form className="brand-alias-form" onSubmit={e=>{e.preventDefault();change(s=>setBrandAliases(s,brand.id,aliases));}}><label>Outros nomes<input aria-label={`Outros nomes da marca ${brand.name}`} value={aliases} onChange={e=>setAliases(e.target.value)} placeholder="Ex.: Esfera, @esfera.legal" maxLength={300}/></label><small className="field-help">Como a marca também é escrita ou falada, separado por vírgula. A revisão automática aceita qualquer um como menção à marca.</small><button className="button secondary" disabled={state.role!=='Administrador'}>Salvar nomes</button></form>
    <div><small>{state.pieces.filter(p=>p.workspace===brand.id).length} conteúdos · {brand.archived?'Arquivada':'Ativa'}</small>{!brand.archived&&<button className="text-button" onClick={onOpen}>Abrir marca →</button>}</div>
    <button className="button secondary" disabled={state.role!=='Administrador'||(!brand.archived&&workspaceList(state).length===1)} onClick={()=>change(s=>archiveBrand(s,brand.id,!brand.archived))}>{brand.archived?<RotateCcw size={15}/>:<Archive size={15}/>} {brand.archived?'Restaurar':'Arquivar'}</button>
  </article>;
}
export function OrganizationSettings(){
  const {state,setState,account,notify,goto,changeWorkspace}=useContext(AppContext);
  const [name,setName]=useState(state.organizationName || 'Grupo BBMD'),[newBrand,setNewBrand]=useState('');
  const brands=workspaceList(state,{includeArchived:true}),admin=state.role==='Administrador';
  const apply=(action,message)=>{try{setState(action(state));notify(message);return true;}catch(error){notify(error.message,true);return false;}};
  const grouped=workspaceList(state).length>1;
  const ids=['marcas',...(grouped?['grupo']:[]),'colaboradores'];
  const [tab,setTab]=useSubtab('organizacao',ids);
  const tabs=<Subtabs label="Seções da organização" value={tab} onChange={setTab} items={[['marcas','Marcas'],...(grouped?[['grupo','DNA do grupo']]:[]),['colaboradores','Colaboradores']]}/>;
  const heading=<div className="page-heading"><div><h1>Uma organização. Suas marcas.</h1><p>As marcas do grupo, as regras que valem para todas e quem pode sugerir ideias.</p></div><button className="button secondary" onClick={()=>goto('grupo')}>Visão integrada <ArrowRight size={16}/></button></div>;
  if(!account)return <div className="organization-page">{heading}{tabs}
    {tab==='marcas'&&<Subpanel id="marcas"><section className="r-panel"><h2>Grupo BBMD de demonstração</h2><p>Esta demonstração usa o Grupo BBMD e suas marcas. No cadastro você pode começar com uma marca ou criar seu próprio grupo.</p><a className="button primary" href="#auth">Criar minha organização <ArrowRight size={16}/></a></section></Subpanel>}
    {tab==='grupo'&&<Subpanel id="grupo"><GroupDNA/></Subpanel>}
    {tab==='colaboradores'&&<Subpanel id="colaboradores"><section className="r-panel"><h2>Colaboradores que sugerem ideias</h2><p>Convidar colaboradores exige uma conta: cada um recebe um acesso próprio e restrito.</p></section></Subpanel>}
  </div>;
  return <div className="organization-page">{heading}{tabs}
    {tab==='grupo'&&<Subpanel id="grupo"><GroupDNA/></Subpanel>}
    {tab==='colaboradores'&&<Subpanel id="colaboradores"><Contributors/></Subpanel>}
    {tab==='marcas'&&<Subpanel id="marcas"><section className="organization-explainer"><div><Building2 size={24}/><h2>Organização é quem reúne.</h2><p>O nome do negócio ou grupo representa a operação. Sua conta administra esta organização; adicionar uma marca não cria outro login nem convida pessoas.</p></div><div><Layers size={24}/><h2>Cada marca tem voz própria.</h2><p>Cada marca tem identidade, público, fontes, conteúdos, orçamento e agenda. Apenas fontes marcadas para a biblioteca compartilhada entram no repertório das demais.</p></div></section>
    <section className="r-panel"><h2>Nome da organização</h2><p>Este nome identifica o grupo. Alterá-lo não renomeia as marcas.</p><form className="org-form" onSubmit={e=>{e.preventDefault();apply(s=>renameOrganization(s,name),'Nome da organização atualizado.');}}><label>Nome da organização<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={!admin}/></label><button className="button secondary" disabled={!admin}>Salvar organização</button></form></section>
    <section className="r-panel"><h2>{workspaceList(state).length} {workspaceList(state).length===1?'marca ativa':'marcas ativas'}</h2><p>Comece pequeno e amplie depois. Ao adicionar outra marca, sua organização passa a operar como um grupo.</p><form className="org-form" onSubmit={e=>{e.preventDefault();if(apply(s=>addBrand(s,newBrand),'Marca criada com contexto e acervo vazios. A visão do grupo já está disponível.'))setNewBrand('');}}><label>Nome da nova marca<input value={newBrand} onChange={e=>setNewBrand(e.target.value)} required minLength={2} maxLength={80} placeholder="Ex.: Minha segunda marca" disabled={!admin}/></label><button className="button primary" disabled={!admin}><Plus size={16}/> Adicionar marca</button></form>
      <div className="brand-management-list">{brands.map(brand=><BrandRow key={brand.id+'-'+brand.name} brand={brand} state={state} setState={setState} notify={notify} onOpen={()=>{changeWorkspace(brand.id);goto('painel');}}/>)}</div>
      <p className="field-help">Arquivar retira a marca da seleção e da visão ativa do grupo. Seus conteúdos e configurações permanecem guardados e podem ser restaurados. Mantenha pelo menos uma marca ativa.</p>
    </section></Subpanel>}</div>;
}
export function GroupOverview(){
  const {state,account,goto,changeWorkspace}=useContext(AppContext);
  const brands=workspaceList(state),ids=new Set(brands.map(w=>w.id)),pieces=state.pieces.filter(p=>ids.has(p.workspace));
  // Real AI spend of the whole account in the budget period; calls made before per-brand tracking (or without a brand) count only in the total.
  useCurrency();
  const spend=useAiSpend(state.aiBudget?.amount),unassigned=spend?.byWorkspace?.['']||0;
  const spendHelp=spend?`desde ${sinceLabel(spend.since)} · real${unassigned>=0.005?` · ${usd(unassigned)} sem marca`:''}`:account?'carregando…':'disponível com conta';
  return <div className="organization-page"><div className="page-heading"><div><h1>{state.organizationName || 'Grupo BBMD'}</h1><p>Acompanhe todas as marcas. Abra uma delas para pesquisar, criar e revisar no contexto certo.</p></div><button className="button secondary" onClick={()=>goto('organizacao')}>Gerenciar marcas <ArrowRight size={16}/></button></div>
    <div className="group-metrics">{[[brands.length,'Marcas ativas','cada uma com contexto próprio'],[pieces.length,'Conteúdos','em todas as marcas ativas'],[reviewCount(pieces),'Em revisão','aguardando decisão humana'],[pieces.filter(p=>p.status==='Agendado').length,'Na agenda','agendamentos locais'],[spend?usd(spend.total):'—','Gasto com IA',spendHelp]].map(([value,label,help])=><div key={label}><span>{label}</span><b>{value}</b><small>{help}</small></div>)}</div>
    <div className="group-brand-grid">{brands.map(brand=>{const own=pieces.filter(p=>p.workspace===brand.id);return <article className="group-brand-card" key={brand.id}><header><span className="workspace-avatar" style={{background:brand.color}}>{brand.initials}</span><h2>{brand.name}</h2></header><p>{state.voices[brand.id]?.audience || 'Defina o público desta marca no Segundo cérebro.'}</p><dl><div><dt>Conteúdos</dt><dd>{own.length}</dd></div><div><dt>Em revisão</dt><dd>{reviewCount(own)}</dd></div><div><dt>Fontes próprias</dt><dd>{state.sources.filter(s=>s.workspace===brand.id).length}</dd></div>{spend&&<div><dt>Gasto com IA</dt><dd>{usd(spend.byWorkspace?.[brand.id])}</dd></div>}</dl><div className="card-actions"><button className="button secondary" onClick={()=>{changeWorkspace(brand.id);goto('painel');}}>Abrir marca <ArrowRight size={16}/></button>{reviewCount(own)>0&&<button className="text-button" onClick={()=>{changeWorkspace(brand.id);goto('aprovar');}}>Conferir revisão →</button>}</div></article>;})}</div>
    <section className="r-panel gd-link"><div><h2>DNA do grupo</h2><p>As regras que valem para todas as marcas e a revisão de coerência entre elas.</p></div><button className="button secondary" onClick={()=>goto('organizacao/grupo')}>Abrir DNA do grupo <ArrowRight size={16}/></button></section><p className="field-help">Esta visão consolida o andamento. A geração e a aprovação continuam vinculadas à marca escolhida. {account?'Marcas arquivadas ficam fora dos totais ativos.':'Os dados deste grupo pertencem à demonstração BBMD.'}</p></div>;
}
