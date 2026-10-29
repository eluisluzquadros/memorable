import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccounts} from '../server/accounts.mjs';
import {createAccountState,organizationSetup,organizationType,workspaceList,addBrand,renameBrand,renameOrganization,archiveBrand} from '../src/account-state.mjs';
import {hydrateOperations} from '../src/operations.mjs';
const user={id:'group-owner',name:'Pessoa responsável'};
const setup={type:'group',name:'Grupo Horizonte',brands:[{name:'Horizonte Saúde'},{name:'Horizonte Educação'}]};
test('organization setup validates type, brand count and distinct normalized names',()=>{
 assert.equal(organizationSetup(setup).brands.length,2);
 assert.throws(()=>organizationSetup({...setup,brands:[{name:'Apenas uma'}]}),/2 a 20/);
 assert.throws(()=>organizationSetup({...setup,brands:[{name:'Café'},{name:' cafe '}]}),/diferente/);
 assert.throws(()=>organizationSetup({...setup,type:'single'}),/uma marca/);
 assert.throws(()=>organizationSetup({...setup,name:''}),/organização/);
});
test('a group starts with independent brand contexts and no seeded content',()=>{
 const state=createAccountState(user,setup);const [a,b]=state.workspaces;
 assert.equal(state.organizationName,'Grupo Horizonte');assert.equal(organizationType(state),'group');assert.notEqual(a.id,b.id);
 assert.equal(state.pieces.length+state.sources.length,0);assert.notEqual(state.voices[a.id],state.voices[b.id]);
 state.voices[a.id].audience='Pacientes';assert.equal(state.voices[b.id].audience,'');
 assert.ok(!JSON.stringify(state).includes('BBMD'));
});
test('adding a brand upgrades a single organization without copying another brand identity or content',()=>{
 const original=createAccountState(user);original.voices[original.workspace].audience='Contexto exclusivo';original.sources.push({id:'own',workspace:original.workspace,text:'Fonte exclusiva'});
 const next=addBrand(original,'Nova marca');const brand=next.workspaces[1];
 assert.equal(organizationType(next),'group');assert.equal(next.organizationName,original.organizationName);assert.equal(next.sources.length,1);assert.equal(next.voices[brand.id].audience,'');assert.equal(next.budgets[brand.id],300);
 assert.throws(()=>addBrand({...next,role:'Editor'},'Terceira marca'),/Administrador/);
 assert.throws(()=>addBrand(next,'nova MARCA'),/Já existe/);
});
test('renaming organization and brand are independent and retain stable IDs',()=>{
 const original=createAccountState(user,setup),id=original.workspaces[0].id;
 const next=renameOrganization(renameBrand(original,id,'Marca renovada'),'Grupo Novo');
 assert.equal(next.workspaces[0].id,id);assert.equal(next.workspaces[0].name,'Marca renovada');assert.equal(next.workspaces[1].name,original.workspaces[1].name);assert.equal(next.organizationName,'Grupo Novo');
});
test('archive is reversible, preserves content and identity, pauses radar, and never leaves zero active brands',()=>{
 const state=createAccountState(user,setup),id=state.workspace;
 state.pieces.push({id:'keep',workspace:id,body:'Preservado'});state.voices[id].audience='Público preservado';state.brandDNA={[id]:{primary:'#123456'}};
 const archived=archiveBrand(state,id);assert.equal(workspaceList(archived).length,1);assert.notEqual(archived.workspace,id);assert.equal(archived.radar[id].enabled,false);
 const hydrated=hydrateOperations(archived,workspaceList(archived,{includeArchived:true}));const restored=archiveBrand(hydrated,id,false);
 assert.equal(restored.voices[id].audience,'Público preservado');assert.equal(restored.brandDNA[id].primary,'#123456');assert.equal(restored.pieces[0].body,'Preservado');assert.equal(workspaceList(restored).length,2);
 assert.throws(()=>archiveBrand(archived,archived.workspace),/pelo menos uma/);
});
test('registration atomically initializes the group and rejects invalid organization before creating an account',async()=>{
 const store=createAccounts(':memory:');const input={name:user.name,email:'group@example.test',password:'valid-test-password-123'};
 try{
  await assert.rejects(store.authenticate({...input,organization:{...setup,brands:[]}},true,'local'),/2 a 20/);
  const result=await store.authenticate({...input,organization:setup},true,'local');const data=await store.read(result.user);
  assert.equal(data.revision,1);assert.equal(data.state.workspaces.length,2);assert.equal(data.state.organizationName,setup.name);
  assert.ok(await store.workspaceActive(result.user.id,data.state.workspace));
 }finally{await store.close();}
});
