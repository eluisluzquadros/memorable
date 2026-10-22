import React, { useContext } from 'react';
import { AppContext } from './context';
import { SOURCE_ROLES, assertEditor } from './operations.mjs';
export function SourceRole({ source }) {
  const { state, setState, notify } = useContext(AppContext);
  if (!source) return null;
  return <div className="source-role"><label>Relação da fonte com a marca<select aria-label={`Relação da fonte: ${source.title}`} value={source.editorialRole || 'reference'} disabled={source.workspace !== state.workspace || !['Editor','Administrador'].includes(state.role)} onChange={e => {
    const editorialRole = e.target.value;
    try {
      assertEditor(state);
      if (source.workspace !== state.workspace) throw new Error('Abra a marca de origem para classificar a fonte.');
      setState(s => ({ ...s, sources: s.sources.map(x => x.id === source.id ? {...x, editorialRole} : x), events: [{id:crypto.randomUUID(),workspace:source.workspace,title:source.title,action:'source-priority',author:state.role,at:new Date().toISOString(),event:`Relação editorial: ${SOURCE_ROLES.find(([id]) => id === editorialRole)[1]}.`},...s.events] }));
      notify('Relação editorial salva. O Radar já usa essa prioridade.');
    } catch (error) { notify(error.message, true); }
  }}>{SOURCE_ROLES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><small>Produtos e conteúdos oficiais ficam em primeiro plano. Essa decisão não é uma nota de qualidade nem dispensa a revisão das fontes.</small></div>;
}
