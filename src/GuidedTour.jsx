import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';
import { TOUR_STEPS } from './tour.mjs';
import './tour.css';

export function GuidedTour({ preference, onClose, goto }) {
  const [index, setIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(Boolean(preference?.dontShowAgain));
  const dialog = useRef(null), nextButton = useRef(null);
  const close = useRef(onClose);
  const preferenceRef = useRef(dontShowAgain);
  close.current = onClose;
  preferenceRef.current = dontShowAgain;
  const step = TOUR_STEPS[index], last = index === TOUR_STEPS.length - 1;
  useEffect(() => {
    const el = dialog.current, previousFocus = document.activeElement;
    const scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    el.showModal();
    const cancel = e => { e.preventDefault(); close.current('dismissed', preferenceRef.current); };
    el.addEventListener('cancel', cancel);
    return () => {
      el.removeEventListener('cancel', cancel);
      el.close();
      document.documentElement.style.overflow = scroll;
      requestAnimationFrame(() => previousFocus?.isConnected && previousFocus.focus());
    };
  }, []);
  useEffect(() => {
    if (step.route) goto(step.route);
    nextButton.current?.focus();
  }, [index]);
  return <dialog ref={dialog} className={`guided-tour ${index === 0 ? 'tour-welcome' : ''}`} aria-labelledby="tour-title" aria-describedby="tour-description">
    <div className="tour-top"><span><Compass size={17}/> MEMORÁVEL · TOUR GUIADO</span><button className="icon-button" aria-label="Fechar tour" onClick={()=>onClose('dismissed',dontShowAgain)}><X size={20}/></button></div>
    <div className="tour-progress" role="progressbar" aria-label="Progresso do tour" aria-valuemin={1} aria-valuemax={TOUR_STEPS.length} aria-valuenow={index+1}>{TOUR_STEPS.map((s,i)=><span key={s.label} className={i<=index?'visited':''}/>)}</div>
    <p className="tour-position" aria-live="polite">{index+1} de {TOUR_STEPS.length} · {step.label}</p>
    <h2 id="tour-title">{step.title}</h2><p id="tour-description">{step.text}</p>
    <ul className="tour-tips">{step.tips.map(t=><li key={t}><Check size={15}/><span>{t}</span></li>)}</ul>
    <label className="tour-preference"><input type="checkbox" checked={dontShowAgain} onChange={e=>setDontShowAgain(e.target.checked)}/> Não mostrar automaticamente novamente</label>
    <div className="tour-actions"><button className="text-button" onClick={()=>onClose('dismissed',dontShowAgain)}>Pular tour</button><div>{index>0&&<button className="button secondary" onClick={()=>setIndex(i=>i-1)}><ArrowLeft size={16}/> Voltar</button>}<button ref={nextButton} className="button primary" onClick={()=>last?onClose('completed',dontShowAgain):setIndex(i=>i+1)}>{last?'Concluir tour':index===0?'Começar tour':'Próximo'}{last?<Check size={16}/>:<ArrowRight size={16}/>}</button></div></div>
    <small className="tour-replay-hint">Repita quando quiser em Tour guiado, no topo da plataforma.</small>
  </dialog>;
}
