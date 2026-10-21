import fs from 'node:fs';
let s=fs.readFileSync('src/main.jsx','utf8');
s=s.replace('setBrief((b) => ({ ...b, title, source, ...extra }));','setBrief((b) => ({ ...b, title, source, thesis:"", angle:"", cta:"", topicId:undefined, origin:"manual", ...extra }));');
s=s.replace('setSourceFilter("Todos");','setSourceFilter("Todos");');
s=s.replace('const [sourceFilter, setSourceFilter] = useState("Todos");','const [sourceFilter, setSourceFilter] = useState("Todos");');
// Prevent notification text from claiming every action submits a review.
s=s.replace(': "Peça enviada para revisão.",',': action === "review" ? "Peça enviada para revisão." : "Alteração registrada.",');
fs.writeFileSync('src/main.jsx',s);
let a=fs.readFileSync('src/Advanced.jsx','utf8');
a=a.replace('executionRecord }','executionRecord, mergeCollection }');
a=a.replace("const topics=rankedTopics(state);const config=state.radar[state.workspace];",`const topics=rankedTopics(state);const config=state.radar[state.workspace];
 useEffect(()=>{let alive=true;const receive=()=>fetch('/api/collected?workspace='+state.workspace).then(r=>r.json()).then(data=>{if(alive&&Array.isArray(data.sources)&&Array.isArray(data.runs))setState(s=>mergeCollection(s,data));}).catch(()=>{});receive();const timer=setInterval(receive,30000);return()=>{alive=false;clearInterval(timer);};},[state.workspace]);`);
// Source of truth for monitored collections is the service's stable run ID.
const start=a.indexOf('setState(s=>({...s,sources:[...data.sources');
const end=a.indexOf(';notify(`${data.sources.length}',start);
if(start<0||end<0)throw new Error('Collector merge anchor missing');
a=a.slice(0,start)+"setState(s=>mergeCollection(s,{sources:data.sources,runs:data.run?[data.run]:[]}))"+a.slice(end);
a=a.replace("mode:'local',steps:","mode:delivery.mode||'local',steps:");
fs.writeFileSync('src/Advanced.jsx',a);
let runtime=fs.readFileSync('server/runtime.mjs','utf8').replace('persist();return result;}finally','persist();return {...result,run};}finally');fs.writeFileSync('server/runtime.mjs',runtime);
let ops=fs.readFileSync('src/operations.mjs','utf8');
ops=ops.replace("export function sourceFingerprint(sources) { return sources.map(s=>JSON.stringify([s.id,s.text,s.origin,s.validUntil,s.citable,s.shared])).sort().join('|'); }",`export function sourceFingerprint(sources) { const raw=sources.map(s=>JSON.stringify([s.id,s.text,s.origin,s.validUntil,s.citable,s.shared])).sort().join('|'); let hash=2166136261;for(let i=0;i<raw.length;i++)hash=Math.imul(hash^raw.charCodeAt(i),16777619);return raw.length+':'+(hash>>>0).toString(16); }`);
ops=ops.replace('!piece.council.passed || !audit.passed','!piece.council.passed || piece.council.score < state.agentConfig.threshold || !audit.passed');
fs.writeFileSync('src/operations.mjs',ops);
let css=fs.readFileSync('src/review.css','utf8');css+='\n.r-provider{border-top:1px solid #dfe5ef;padding-top:18px;margin-top:20px}.r-provider summary{font-size:14px;font-weight:600;cursor:pointer}.r-provider p{font-size:13px;line-height:1.6;color:#53647d}.r-metric-inputs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.hero-copy h1{font-size:clamp(44px,5vw,76px)}@media(max-width:700px){.r-metric-inputs{grid-template-columns:1fr}.hero-copy h1{font-size:46px;letter-spacing:-2px}}\n';fs.writeFileSync('src/review.css',css);
for(const file of ['scripts/visual-check.mjs','scripts/final-inspection.mjs']){let text=fs.readFileSync(file,'utf8');text=text.replace('"aprovar",','"kanban",\n    "agentes",\n    "resultados",\n    "aprovar",');fs.writeFileSync(file,text);}
