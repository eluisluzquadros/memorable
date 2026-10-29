import test from 'node:test';import assert from 'node:assert/strict';
import {createAccounts,sessionCookie} from '../server/accounts.mjs';
test('accounts hash passwords, authenticate sessions, isolate state and reject conflicts',async()=>{
 const store=createAccounts(':memory:');try {
 const input={name:'QA User',email:'qa@example.test',password:'test-only-password-123'};
 const first=await store.authenticate(input,true,'local-a');const req={headers:{cookie:sessionCookie(first.token)}};
 assert.equal((await store.lookup(req)).email,input.email);assert(!('password_hash' in first.user));
 await assert.rejects(store.authenticate({...input,password:'invalid-password-123'},false,'local-a'),/incorretos/);
 const login=await store.authenticate(input,false,'local-a');assert.equal(login.user.id,first.user.id);
 const second=await store.authenticate({...input,email:'other@example.test'},true,'local-b');
 const fresh=await store.read(first.user);assert.equal(fresh.state.pieces.length,0);assert.equal(fresh.state.sources.length,0);assert.equal(fresh.state.workspaces.length,1);
 const state={...fresh.state,pieces:[{id:'private'}]};assert.equal((await store.save(first.user,{state,revision:fresh.revision})).revision,2);
 assert.deepEqual((await store.read(first.user)).state,state);assert.equal((await store.read(second.user)).state.pieces.length,0);
 await assert.rejects(store.save(first.user,{state,revision:0}),/outra aba/);
 await store.revoke(req);assert.equal(await store.lookup(req),null);assert.equal(await store.lookup({headers:{cookie:'skyvidya_session=forged'}}),null);
 }finally{await store.close();}
});
test('two saves from the same revision: exactly one wins, the other gets a conflict',async()=>{
 const store=createAccounts(':memory:');try {
 const {user}=await store.authenticate({name:'QA User',email:'race@example.test',password:'test-only-password-123'},true,'local');
 const {state,revision}=await store.read(user);
 const results=await Promise.allSettled([store.save(user,{state:{...state,pieces:[{id:'a'}]},revision}),store.save(user,{state:{...state,pieces:[{id:'b'}]},revision})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(results.find(r=>r.status==='rejected').reason.message,/outra aba/);
 }finally{await store.close();}
});
