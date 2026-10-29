import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccounts} from '../server/accounts.mjs';
import {initialState,createPiece} from '../src/workflow.mjs';
import {createAccountState,isUntouchedDemo,prepareAccountState,workspaceList} from '../src/account-state.mjs';
import {accountWriter} from '../src/account-persistence.mjs';
const user={id:'new-account',name:'Skyvidya'};
test('new accounts start empty with their own workspace and can create content there',()=>{
 const state=createAccountState(user);
 assert.equal(state.workspace,'workspace-new-account');assert.equal(state.role,'Administrador');
 assert.equal(workspaceList(state)[0].name,'Skyvidya');
 assert.equal(state.pieces.length+state.sources.length+state.events.length,0);
 assert.ok(!JSON.stringify(state).includes('BBMD'));assert.ok(!JSON.stringify(state).includes('rolim'));
 state.sources.push({id:'own',workspace:state.workspace,title:'Fonte própria',text:'Conteúdo próprio da Skyvidya com informação suficiente para produção.',citable:true});
 const next=createPiece(state,{title:'Meu primeiro conteúdo',body:'Texto da minha marca.',sourceIds:['own'],deadline:'2030-01-01',format:'LinkedIn'});
 assert.equal(next.pieces[0].workspace,state.workspace);
});
test('migration clears only untouched fixtures and preserves customized legacy content',()=>{
 const seed=initialState();assert.ok(isUntouchedDemo(seed));
 assert.equal(prepareAccountState(user,seed).sources.length,0);
 const edited=structuredClone(seed);edited.sources[0].text='Texto próprio alterado pelo usuário.';
 assert.equal(isUntouchedDemo(edited),false);
 assert.equal(prepareAccountState(user,edited).sources[0].text,edited.sources[0].text);
 const active=structuredClone(seed);active.events.push({id:'change'});assert.equal(isUntouchedDemo(active),false);
 const extended={...seed,customNotes:'Trabalho próprio fora dos campos conhecidos.'};assert.equal(isUntouchedDemo(extended),false);
});
test('server migration archives exact previous state and isolates backups',async()=>{
 const store=createAccounts(':memory:');
 try{
  const a=(await store.authenticate({name:'Skyvidya',email:'legacy@example.test',password:'test-only-long-pass'},true,'a')).user;
  const b=(await store.authenticate({name:'Outra marca',email:'new@example.test',password:'test-only-long-pass'},true,'b')).user;
  const seed=initialState();const previous=(await store.read(a)).revision;await store.save(a,{state:seed,revision:previous});
  const migrated=await store.read(a);assert.equal(migrated.state.sources.length,0);assert.equal(migrated.state.workspaces[0].name,'Skyvidya');
  assert.deepEqual((await store.backup(a)).state,seed);assert.equal(await store.backup(b),null);
  assert.equal((await store.read(a)).revision,migrated.revision);
  await assert.rejects(store.save(a,{state:seed,revision:previous+1}),/outra aba/);
 }finally{await store.close();}
});
test('saving retries after failure and retains a recovery snapshot; stopped writers never save again',async()=>{
 let fail=true,calls=0;const requests=[];
 const writer=accountWriter(4,()=>{},'a',async(_url,options)=>{calls++;requests.push(JSON.parse(options.body));if(fail)throw new Error('Falha transitória');return {revision:5};});
 const state={sources:[],pieces:[{id:'my-work'}]};writer.enqueue(state);
 await assert.rejects(writer.flush(),/transitória/);assert.equal(writer.isPending(),true);assert.deepEqual(writer.snapshot(),state);
 fail=false;await writer.flush();assert.equal(writer.isPending(),false);assert.equal(calls,2);assert.equal(requests[1].revision,4);
 writer.stop();writer.enqueue({pieces:[]});await writer.flush();assert.equal(calls,2);
});
