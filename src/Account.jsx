import React, { useEffect, useRef, useState } from 'react';
import AuthPage from './AuthPage';
import { Brand } from './Landing';
import { accountWriter as makeAccountWriter } from './account-persistence.mjs';
import { isClassicHash } from './routes.mjs';
import ContributePage from './Contribute';
async function api(url, options) { const response=await fetch(url,options);let data;try{data=await response.json();}catch{throw new Error('Serviço local indisponível. Execute npm run dev:full.');}if(!response.ok)throw new Error(data.error || 'Não foi possível concluir.');return data; }
export const accountWriter = (revision,report,userId) => makeAccountWriter(revision,report,userId,api);
export function AccountRoot({ Component }) {
 const [route,setRoute]=useState(location.hash),[session,setSession]=useState(null),[checking,setChecking]=useState(true),[status,setStatus]=useState('Salvo');
 const [notice,setNotice]=useState(''),[recovery,setRecovery]=useState(null),[leaving,setLeaving]=useState(false);
 const leavingRef=useRef(false),sessionRef=useRef(null);sessionRef.current=session;
 async function load(user){const data=await api('/api/account/state');setSession({user,data,writer:accountWriter(data.revision,setStatus,user.id)});setNotice('');setRecovery(null);try{const saved=JSON.parse(localStorage.getItem(`memorable-recovery:${user.id}`));if(saved?.userId===user.id)setRecovery(saved);}catch{}return data;}
 useEffect(()=>{let active=true;api('/api/auth/session').then(async data=>{if(active&&data.user)await load(data.user);}).catch(e=>{if(active)setNotice(e.message);}).finally(()=>{if(active)setChecking(false);});const change=()=>setRoute(location.hash);window.addEventListener('hashchange',change);return()=>{active=false;window.removeEventListener('hashchange',change);sessionRef.current?.writer.stop();};},[]);
 async function login(user){const data=await load(user);location.hash=data.state.organizationType==='group'?'app/grupo':'app/painel';}
 async function logout(){
  if(!session||leavingRef.current)return;leavingRef.current=true;setLeaving(true);let saveError,recoveryStored=true;
  try{await session.writer.flush();}catch(e){saveError=e;const copy={userId:session.user.id,name:session.user.name,state:session.writer.snapshot(),savedAt:new Date().toISOString()};setRecovery(copy);try{localStorage.setItem(`memorable-recovery:${session.user.id}`,JSON.stringify(copy));}catch{recoveryStored=false;}}
  try{await api('/api/auth/logout',{method:'POST'});session.writer.stop();setSession(null);setNotice(saveError?`Sessão encerrada. Algumas alterações não chegaram ao serviço; exporte a cópia de recuperação abaixo.${recoveryStored?'':' O navegador não conseguiu guardar a cópia: exporte antes de recarregar ou fechar esta página.'}`:'');location.hash='auth';setRoute('#auth');}catch(e){setNotice(`Não foi possível encerrar a sessão: ${e.message}`);setStatus(e.message);}finally{leavingRef.current=false;setLeaving(false);}
 }
 function exportRecovery(){const url=URL.createObjectURL(new Blob([JSON.stringify(recovery,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='memorable-recuperacao.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}
 useEffect(()=>{const protect=e=>{if(session?.writer.isPending()){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[session]);
 if(route.startsWith('#sugerir'))return <ContributePage/>;
 if(checking)return <main className="account-loading"><Brand/><p role="status">Preparando seu espaço…</p></main>;
 const alerts=<>{notice&&<aside className="account-notice" role="alert">{notice}{session&&<button onClick={logout} disabled={leaving}>Tentar sair novamente</button>}</aside>}{recovery&&<aside className="account-notice">Cópia de recuperação de {recovery.name}.<button onClick={exportRecovery}>Exportar alterações não salvas</button></aside>}</>;
 if(route.startsWith('#auth'))return <>{alerts}<AuthPage onAuthenticated={login} user={session?.user} onLogout={logout} leaving={leaving} request={api}/></>;
 return <>{alerts}{session&&isClassicHash(route)&&<div className="account-sessionbar"><span>Conectado como <b>{session.user.name}</b></span><a href="#app/painel">Meu espaço</a><a href="#auth">Conta</a><button onClick={logout} disabled={leaving}>Sair da conta</button></div>}<Component key={session?.user.id || 'demo'} account={session?.user} initialData={session?.data.state} persist={session?.writer.enqueue} syncStatus={status} onLogout={logout}/></>;
}
