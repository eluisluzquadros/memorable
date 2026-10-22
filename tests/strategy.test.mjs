import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, createPiece, transition, blockers } from '../src/workflow.mjs';
import { contextPacket } from '../src/operations.mjs';
import { saveCampaign, confirmLineage, invalidateSourceDependents } from '../src/strategy.mjs';
const campaign = { name:'Educação', audience:'Gestores', problem:'Não entendo o processo', hypothesis:'Exemplo concreto esclarece', success:'Conferir respostas ao fim do mês' };
function setup() { let state = initialState(); state.role='Editor'; state=saveCampaign(state,campaign); const source=state.sources.find(s=>s.workspace===state.workspace && s.citable); state=createPiece(state,{title:'Principal',body:'Texto central',format:'Artigo',deadline:'2026-12-20',sourceIds:[source.id],campaignId:state.campaigns[0].id}); const root=state.pieces[0]; state=createPiece(state,{title:'Derivado',body:'Texto adaptado',format:'LinkedIn',deadline:'2026-12-20',sourceIds:[source.id],campaignId:root.campaignId,parentId:root.id}); return {state,root,child:state.pieces[0],source}; }
test('campaign snapshot, parent version and workspace restrictions persist',()=>{
 const {state,root,child}=setup(); assert.equal(child.parentRevision,root.revision); assert.equal(child.campaignSnapshot.hypothesis,campaign.hypothesis);
 const updated=saveCampaign(state,{...state.campaigns[0],hypothesis:'Nova hipótese'}); assert.equal(updated.pieces[0].campaignSnapshot.hypothesis,campaign.hypothesis);
 assert.throws(()=>createPiece({...state,workspace:'ativos'},{title:'x',body:'x',deadline:'2026-12-20',sourceIds:[state.sources.find(s=>s.workspace==='ativos'&&s.citable).id],campaignId:root.campaignId}),/campanha/);
 assert.throws(()=>saveCampaign({...state,role:'Observador'},campaign),/papel/);
});
test('editing parent invalidates descendants and requires explicit lineage check',()=>{
 let {state,root,child}=setup(); state={...state,pieces:state.pieces.map(p=>p.id===child.id?{...p,status:'Agendado',scheduledAt:'2026-12-20',approvedRevision:1}:p)};
 state=transition(state,root.id,'edit',{body:'Novo texto'}); const derived=state.pieces.find(p=>p.id===child.id);
 assert.equal(derived.scheduledAt,null); assert.equal(derived.lineageReview,true); assert(blockers(state,derived).some(s=>s.includes('origem')));
 state=confirmLineage(state,child.id); assert.equal(state.pieces.find(p=>p.id===child.id).parentRevision,2);
 assert.equal(state.pieces.find(p=>p.id===child.id).approvedRevision,null);
});
test('source changes preserve publication proof and flag transitive dependents',()=>{
 const {state,root,child,source}=setup(); const pieces=state.pieces.map(p=>p.id===child.id?{...p,status:'Publicado',liveUrl:'https://example.com/post',sourceIds:[]}:p);
 const updated=invalidateSourceDependents(pieces,new Set([source.id])); const derived=updated.find(p=>p.id===child.id);
 assert.equal(derived.status,'Publicado'); assert.equal(derived.liveUrl,'https://example.com/post'); assert.equal(derived.lineageReview,true); assert.equal(updated.find(p=>p.id===root.id).sourceReview,true);
});
test('editorial context includes scoped active lessons, campaign and parent',()=>{
 const {state,root}=setup(); state.rules=[{workspace:state.workspace,text:'Todos',active:true},{workspace:state.workspace,text:'Carrossel',scope:'Carrossel'},{workspace:state.workspace,text:'Retirada',active:false}];
 const packet=contextPacket(state,{format:'LinkedIn',campaignId:root.campaignId,parentId:root.id,sourceIds:root.sourceIds});
 assert.deepEqual(packet.lessons,['Todos']); assert.equal(packet.campaign.name,campaign.name); assert.equal(packet.parent.id,root.id);
});

test("an approved brand DNA becomes first-party brand knowledge for the agents", async () => {
  const { dnaKnowledge } = await import("../src/operations.mjs");
  const base = { workspace: "w1", brandDNA: { w1: { positioning: "Inteligência geoespacial para transformar risco em resiliência.", excerpt: "645+ camadas de dados e 40 anos de histórico climático para crédito e seguro.", sources: ["https://fonts.googleapis.com/css2", "https://marca.exemplo/"] } } };
  assert.deepEqual(dnaKnowledge(base), []);
  const approved = { ...base, brandDNA: { w1: { ...base.brandDNA.w1, approvedAt: "2026-10-18T16:25:49.986Z" } } };
  const [entry] = dnaKnowledge(approved);
  assert.equal(entry.editorialRole, "owned");
  assert.match(entry.title, /https:\/\/marca\.exemplo\//);
  assert.match(entry.text, /645\+ camadas/);
});
