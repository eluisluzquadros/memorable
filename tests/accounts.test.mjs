import test from 'node:test';import assert from 'node:assert/strict';
import {createAccounts,sessionCookie} from '../server/accounts.mjs';
test('accounts hash passwords, authenticate sessions, isolate state and reject conflicts',()=>{
 const store=createAccounts(':memory:');try {
 const input={name:'QA User',email:'qa@example.test',password:'test-only-password-123'};
 const first=store.authenticate(input,true,'local-a');const req={headers:{cookie:sessionCookie(first.token)}};
 assert.equal(store.lookup(req).email,input.email);assert(!('password_hash' in first.user));
 assert.throws(()=>store.authenticate({...input,password:'invalid-password-123'},false,'local-a'),/incorretos/);
 const login=store.authenticate(input,false,'local-a');assert.equal(login.user.id,first.user.id);
 const second=store.authenticate({...input,email:'other@example.test'},true,'local-b');
 const fresh=store.read(first.user);assert.equal(fresh.state.pieces.length,0);assert.equal(fresh.state.sources.length,0);assert.equal(fresh.state.workspaces.length,1);
 const state={...fresh.state,pieces:[{id:'private'}]};assert.equal(store.save(first.user,{state,revision:fresh.revision}).revision,2);
 assert.deepEqual(store.read(first.user).state,state);assert.equal(store.read(second.user).state.pieces.length,0);
 assert.throws(()=>store.save(first.user,{state,revision:0}),/outra aba/);
 store.revoke(req);assert.equal(store.lookup(req),null);assert.equal(store.lookup({headers:{cookie:'skyvidya_session=forged'}}),null);
 }finally{store.close();}
});
