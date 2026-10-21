import fs from 'node:fs';
let s=fs.readFileSync('src/main.jsx','utf8');
s=s.replace("import './review.css';\nimport \"./styles.css\";","import \"./styles.css\";\nimport './review.css';\nimport { SourceMetadata, PublicationControls, Results } from './Continuity';");
s=s.replace('["agentes", "Time de agentes", Users],','["agentes", "Time de agentes", Users],\n  ["resultados", "Resultados", Coins],');
s=s.replace(') : route === "agentes" ? (',') : route === "resultados" ? (\n                <Results />\n              ) : route === "agentes" ? (');
s=s.replace('            <div className="source-feedback">','            <SourceMetadata key={activeSource.id} source={activeSource} />\n            <div className="source-feedback">');
s=s.replace('        {!editing && <PieceCouncil piece={piece} />}','        {!editing && <PieceCouncil piece={piece} />}\n        {!editing && <PublicationControls piece={piece} />}');
s=s.replace('              <dd>{workspace.voice}</dd>','              <dd>{state.voices[state.workspace].tone}</dd>').replace('              <dd>{workspace.audience}</dd>','              <dd>{state.voices[state.workspace].audience}</dd>');
s=s.replace('                Sem IA, autenticação ou publicação externas conectadas. Custos e\n                papéis são demonstrativos.','                IA opcional e coleta web dependem do serviço local. Publicação nas redes e autenticação multiusuário ainda não estão conectadas.');
s=s.replace('import { hydrateOperations, runLocalRadar }','import { hydrateOperations, runLocalRadar, assertEditor, assertAdmin, sourceValid }');
s=s.replace('          e.preventDefault();\n          if (!form.title.trim()',`          e.preventDefault();
          try { assertEditor(state); } catch (e) { setError(e.message); return; }
          if (state.sources.some(x => (x.workspace === state.workspace || x.shared) && x.text.trim() === form.text.trim())) { setError('Este conteúdo já existe no acervo. Abra a referência existente.'); return; }
          if (!form.title.trim()`);
s=s.replace('disabled={!activeSource.citable}','disabled={!sourceValid(activeSource)}');
s=s.replace('              if (!Number.isFinite(Number(budget))',`              try { assertAdmin(state); } catch (e) { notify(e.message, true); return; }
              if (!Number.isFinite(Number(budget))`);
s=s.replace('                    setState((s) => ({\n                      ...s,\n                      sources:',`                    try { assertEditor(state); } catch(e) { notify(e.message, true); return; }
                    if (activeSource.workspace !== state.workspace) { notify('Abra o espaço de origem para avaliar este material.', true); return; }
                    setState((s) => ({\n                      ...s,\n                      sources:`);
fs.writeFileSync('src/main.jsx',s);
let adv=fs.readFileSync('src/Advanced.jsx','utf8');
adv="import { ProviderTools } from './ProviderTools';\n"+adv;
adv=adv.replace('<p className="field-help">Estruturas locais, sem geração por IA externa.',`<ProviderTools packet={packet} variant={draft} onGenerated={items=>{setGenerated(items);setSelected(0);setAudit(null);}} onCouncil={result=>{setGenerated(g=>g.map((v,i)=>i===selected?result.variant:v));setAudit(result.audit);}}/><p className="field-help">O botão Explorar prepara estruturas locais, sem geração por IA externa.`);
adv=adv.replace('mode:\'local\',steps:',"mode:delivery.mode||'local',steps:");
adv=adv.replace('if(!brief.deadline)throw new Error(\'Defina um prazo antes de produzir.\');',"if(!brief.deadline)throw new Error('Defina um prazo antes de produzir.');if(state.pieces.filter(p=>p.workspace===state.workspace).reduce((s,p)=>s+p.cost,0)+.18>state.budgets[state.workspace])throw new Error('Teto estimado atingido neste espaço.');");
adv=adv.replace('category: \'Acervo próprio\'','category: \'Acervo próprio\'');
fs.writeFileSync('src/Advanced.jsx',adv);
let ops=fs.readFileSync('src/operations.mjs','utf8').replace("category: 'Acervo próprio', date: s.date", "category: s.category || 'Acervo próprio', date: s.date").replace("mode:'local',steps:AGENTS", "mode:delivery.mode||'local',steps:AGENTS").replace("a.id==='publisher'?'Aguardando aprovação':'Preparado localmente'", "a.id==='publisher'?'Aguardando aprovação':delivery.mode==='provider'?'Produzido pelo provedor':'Preparado localmente'");fs.writeFileSync('src/operations.mjs',ops);
fs.writeFileSync('.gitignore',fs.readFileSync('.gitignore','utf8').replace(' .runtime','.runtime'));
let landing=fs.readFileSync('src/Landing.jsx','utf8');
landing=landing.replace('Boas ideias.','Sua marca pensa.').replace('Novos capítulos.','O conteúdo avança.').replace('Transforme o conhecimento da sua equipe em conteúdo. Da primeira\n              referência à aprovação, em um só fluxo.','Reúna o conhecimento da equipe, descubra pautas e crie conteúdo com a voz de cada marca. Do acervo à revisão humana, sem perder o contexto.');
landing=landing.replace('Sua criatividade. Um processo à altura.','Acervo conectado. Time de agentes. Decisão humana.');
fs.writeFileSync('src/Landing.jsx',landing);
