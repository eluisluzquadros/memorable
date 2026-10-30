import React, {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Eye,EyeOff,LockKeyhole,ArrowLeft,ArrowRight,Plus,X,Building2,Layers} from 'lucide-react';
import {Brand} from './Landing';
import {organizationSetup} from './account-state.mjs';
import './organization.css';

function Password({value,onChange,register}){
  const [show,setShow]=useState(false);
  return <label>Senha<div className="auth-password"><input aria-label="Senha" type={show?'text':'password'} autoComplete={register?'new-password':'current-password'} required minLength={12} maxLength={128} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" className="icon-button" onClick={()=>setShow(!show)} aria-label={show?'Ocultar senha':'Mostrar senha'}>{show?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>;
}
export function RegistrationForm({onAuthenticated,request}){
  const [step,setStep]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [credentials,setCredentials]=useState({name:'',email:'',password:''});
  const [setup,setSetup]=useState({type:'single',name:'',brands:[{name:''},{name:''}]});
  const title=useRef(null);
  useEffect(()=>{title.current?.focus();},[step]);
  async function submit(e){
    e.preventDefault();setError('');
    if(step===1){setStep(2);return;}
    setBusy(true);
    try{
      const organization=organizationSetup({...setup,brands:setup.type==='single'?[{name:setup.name}]:setup.brands});
      const result=await request('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credentials,organization})});
      await onAuthenticated(result.user);
    }catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <><div className="signup-progress" aria-label="Progresso do cadastro"><span className="active">1 · Sua conta</span><i/><span className={step===2?'active':''}>2 · Organização e marcas</span></div>
    <h3 ref={title} tabIndex={-1} className="signup-step-title">{step===1?'Primeiro, seus dados de acesso.':'Como sua operação está organizada?'}</h3>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {step===1?<><label>Seu nome<input autoComplete="name" required minLength={2} maxLength={80} value={credentials.name} onChange={e=>setCredentials({...credentials,name:e.target.value})}/></label><label>E-mail<input type="email" autoComplete="email" required maxLength={254} value={credentials.email} onChange={e=>setCredentials({...credentials,email:e.target.value})}/></label><Password register value={credentials.password} onChange={password=>setCredentials({...credentials,password})}/><p className="field-help">Use pelo menos 12 caracteres. Na próxima etapa, escolha uma marca ou um grupo.</p></>:
      <><fieldset className="signup-structure"><legend>Você vai produzir conteúdo para</legend><div className="structure-options">{[['single','Uma marca','Um negócio, com seu próprio contexto.',Building2],['group','Um grupo de marcas','Várias marcas, com uma visão integrada.',Layers]].map(([type,label,text,Icon])=><label key={type} className={setup.type===type?'selected':''}><input type="radio" name="organization-type" value={type} checked={setup.type===type} onChange={()=>setSetup({...setup,type})}/><span><Icon size={19}/><b>{label}</b><small>{text}</small></span></label>)}</div></fieldset>
      <label>{setup.type==='group'?'Nome do grupo / organização':'Nome do negócio / marca'}<input required minLength={2} maxLength={80} autoComplete="organization" value={setup.name} onChange={e=>setSetup({...setup,name:e.target.value})} placeholder={setup.type==='group'?'Ex.: Grupo Horizonte':'Ex.: Minha empresa'}/></label>
      {setup.type==='group'&&<div className="signup-brands"><p>Quais marcas fazem parte do grupo?</p>{setup.brands.map((brand,i)=><div className="signup-brand-row" key={i}><label>Marca {i+1}<input required minLength={2} maxLength={80} value={brand.name} onChange={e=>setSetup({...setup,brands:setup.brands.map((b,j)=>i===j?{name:e.target.value}:b)})} placeholder={`Nome da marca ${i+1}`}/></label><button type="button" className="icon-button" disabled={setup.brands.length<=2} aria-label={`Remover marca ${i+1}`} onClick={()=>setSetup({...setup,brands:setup.brands.filter((_,j)=>i!==j)})}><X size={17}/></button></div>)}<button type="button" className="text-button" disabled={setup.brands.length>=20} onClick={()=>setSetup({...setup,brands:[...setup.brands,{name:''}]})}><Plus size={16}/> Adicionar outra marca</button></div>}
      <div className="organization-preview"><small className="label">Sua estrutura na Memorável</small><b><Building2 size={17}/>{setup.name || (setup.type==='group'?'Sua organização':'Seu negócio')}</b><ul>{(setup.type==='single'?[{name:setup.name}]:setup.brands).map((b,i)=><li key={i}><span/>{b.name || `Marca ${i+1}`}</li>)}</ul><p>{setup.type==='group'?'O grupo reúne a operação. Cada marca mantém seu DNA, suas fontes, seus conteúdos e sua agenda. A visão do grupo acompanha todas juntas.':'Seu negócio começa com um espaço de marca. Você pode adicionar outras marcas e formar um grupo depois.'}</p></div>
      <p className="field-help">Uma organização pertence à sua conta. Criar marcas não cria novos logins nem convida outras pessoas.</p></>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="signup-actions">{step===2&&<button type="button" className="button secondary" onClick={()=>{setStep(1);setError('');}}><ArrowLeft size={16}/> Voltar</button>}<button className="button primary auth-submit">{busy?'Criando sua organização…':step===1?'Continuar':'Criar minha conta'}{step===1?<ArrowRight size={17}/>:<ArrowUpRight size={17}/>}</button></div>
    </fieldset></form></>;
}
export default function AuthPage({onAuthenticated,user,onLogout,leaving,request}){
  const [register,setRegister]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [form,setForm]=useState({email:'',password:''});
  return <main className="auth-page"><section className="auth-story"><Brand/><figure className="auth-billboard" aria-hidden="true"><img src="/motion/billboard.webp" alt="" fetchpriority="high"/></figure><div className="auth-story-copy"><h1>Viralize sua Marca com IA</h1><p>Da pesquisa à publicação, em um só fluxo.</p><p className="auth-signature">Memorável! O jeito certo de deixar sua marca no mundo.</p></div></section>
    <section className="auth-entry"><a href="#" className="text-button"><ArrowLeft size={16}/> Voltar à apresentação</a><div className="auth-form-wrap"><span className="auth-lock"><LockKeyhole size={24}/></span>
      {user?<><h2>Sua conta está conectada.</h2><p>Você entrou como <strong>{user.name}</strong>. Continue na operação ou organize suas marcas.</p><a className="button primary auth-submit" href="#app/painel">Continuar no meu espaço <ArrowUpRight size={18}/></a><a className="button secondary auth-submit" href="#app/organizacao">Organização e marcas</a><button className="button secondary auth-submit" disabled={leaving} onClick={onLogout}>{leaving?'Encerrando sessão…':'Sair e usar outra conta'}</button></>:
      <><h2>{register?'Seu espaço começa aqui.':'Bom ter você de volta.'}</h2><p>{register?'Crie seu acesso e defina como suas marcas se conectam.':'Entre para continuar de onde suas ideias pararam.'}</p>
        {register?<RegistrationForm onAuthenticated={onAuthenticated} request={request}/>:<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const result=await request('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});await onAuthenticated(result.user);}catch(error){setError(error.message);}finally{setBusy(false);}}}><fieldset disabled={busy}><label>E-mail<input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><Password value={form.password} onChange={password=>setForm({...form,password})}/><p className="field-help">Use pelo menos 12 caracteres. Ainda não há recuperação de senha por e-mail: guarde a sua.</p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary auth-submit">{busy?'Abrindo seu espaço…':'Entrar no meu espaço'}<ArrowUpRight size={18}/></button></fieldset></form>}
        <p className="auth-switch">{register?'Já tem uma conta?':'Primeira vez por aqui?'} <button className="text-button" onClick={()=>{setRegister(!register);setError('');}}>{register?'Entrar':'Criar conta'}</button></p></>}
      <p className="auth-local">Seus dados ficam na sua conta Memorável, separados dos de outras contas.</p>
    </div></section></main>;
}
