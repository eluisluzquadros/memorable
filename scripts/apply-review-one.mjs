import fs from 'node:fs';
let s=fs.readFileSync('src/main.jsx','utf8');
s=s.replace('import "./styles.css";',`import { AppContext } from './context';
import { Radar, Writer, Kanban, Squad, VoiceSettings, PieceCouncil, MemoryRules } from './Advanced';
import { hydrateOperations, runLocalRadar } from './operations.mjs';
import './review.css';
import "./styles.css";`);
s=s.replace('const AppContext = React.createContext(null);','');
s=s.replace('["aprovar", "Aprovar", CheckCheck],','["kanban", "Kanban", Layers],\n  ["aprovar", "Aprovar", CheckCheck],');
s=s.replace('["caderno", "Caderno de decisões", BookOpen],','["caderno", "Caderno de decisões", BookOpen],\n  ["agentes", "Time de agentes", Users],');
s=s.replace('? {\n            ...base,','? hydrateOperations({\n            ...base,');
s=s.replace('          }\n        : base;','          }, workspaces)\n        : base;');
s=s.replace('  const [toast, setToast] = useState(null);',`  useEffect(() => {
    const timer = setInterval(() => setState(current => {
      if (current.role === 'Observador') return current;
      let next = current;
      for (const [id, config] of Object.entries(current.radar)) {
        if (config.enabled && config.nextRun && new Date(config.nextRun) <= new Date()) {
          const targets = config.scope === 'all' ? workspaces.map(w=>w.id) : [id];
          for (const target of targets) next = runLocalRadar(next, target, true);
        }
      }
      return next;
    }), 30000);
    return () => clearInterval(timer);
  }, []);
  const [toast, setToast] = useState(null);`);
s=s.replace('const selectTopic = (title, source) => {\n    setBrief((b) => ({ ...b, title, source }));','const selectTopic = (title, source, extra = {}) => {\n    setBrief((b) => ({ ...b, title, source, ...extra }));');
s=s.replace('<Vigiar />','<Radar />').replace('<Escrever />','<Writer />');
s=s.replace(') : route === "aprovar" ? (',') : route === "kanban" ? (\n                <Kanban />\n              ) : route === "agentes" ? (\n                <Squad />\n              ) : route === "aprovar" ? (');
s=s.replace('        pieceTable,\n      }}','        pieceTable,\n        doAction,\n      }}');
s=s.replace('<option>Administrador</option>','<option>Administrador</option>\n                    <option>Observador</option>');
// Replaced pages live in dedicated components; Git retains their previous implementation.
const start=s.indexOf('function Vigiar()');const end=s.indexOf('function Aprovar()',start);s=s.slice(0,start)+s.slice(end);
s=s.replace('<div className="settings-layout">','<VoiceSettings />\n      <div className="settings-layout">');
s=s.replace('      <div className="notebook-intro">','      <MemoryRules />\n      <div className="notebook-intro">');
s=s.replace('        {issues.length > 0 && !editing && (','        {!editing && <PieceCouncil piece={piece} />}\n        {issues.length > 0 && !editing && (');
s=s.replace('                    notify("Edição salva. A peça precisa de uma nova revisão.");','                    setEditing(false);\n                    setChecked(false);\n                    notify("Edição salva. A peça precisa de uma nova revisão.");');
s=s.replace('        source: accessibleSources(state, id)[0]?.id || "",','        source: accessibleSources(state, id)[0]?.id || "",\n        origin: "manual", topicId: undefined, thesis: "", angle: "", cta: "", audience: state.voices[id]?.audience || "",');
s=s.replace('    Aprovar:', '    Aprovar:');
s=s.replace('    Rascunho: "draft",','    Rascunho: "draft",\n    "Em conferência": "review",\n    "Publicado": "approved",\n    "Pedido": "draft",\n    "Pauta escolhida": "draft",');
s=s.replaceAll('SUA ESTEIRA','SUA OPERAÇÃO').replaceAll('esteira.','skyvidya.').replaceAll('a Esteira','a Skyvidya').replaceAll('esteira-','skyvidya-');
fs.writeFileSync('src/main.jsx',s);
let landing=fs.readFileSync('src/Landing.jsx','utf8').replaceAll('Esteira','Skyvidya').replaceAll('esteira','skyvidya').replaceAll('ESTEIRA','SKYVIDYA');
landing=landing.replace('INTELIGÊNCIA PARA O CONTEÚDO','AI-POWERED MARKETING');
fs.writeFileSync('src/Landing.jsx',landing);
let index=fs.readFileSync('index.html','utf8').replaceAll('Esteira','Skyvidya');fs.writeFileSync('index.html',index);
