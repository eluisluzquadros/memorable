import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(15000);
const stamp=Date.now(),password='qa-only-long-password-123',emails=[`qa-isolation-a-${stamp}@example.test`,`qa-isolation-b-${stamp}@example.test`];
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base='http://localhost:5173';
async function state(){const r=await context.request.get(base+'/api/account/state');assert.equal(r.status(),200);return (await r.json()).state;}
async function saved(){await page.getByText('Salvo no SQLite',{exact:true}).waitFor();}
async function skipTour(){const skip=page.getByRole('button',{name:'Pular tour',exact:true});await skip.waitFor();await page.getByLabel('Não mostrar automaticamente novamente').check();await skip.click();}
async function register(name,email){await page.goto(base+'/#auth');await page.getByRole('button',{name:'Criar conta',exact:true}).click();await page.getByLabel('Seu nome',{exact:true}).fill(name);await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByLabel('Nome do negócio / marca',{exact:true}).fill('Negócio QA');await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();await page.waitForURL('**/#app/painel');await skipTour();await saved();}
async function logout(){await page.getByRole('button',{name:'Sair da conta',exact:true}).first().click();await page.getByRole('heading',{name:'Bom ter você de volta.',exact:true}).waitFor();assert.equal((await context.request.get(base+'/api/account/state')).status(),401);}
try{
 await page.goto(base+'/#app/pesquisar');await skipTour();
 const demo=await page.evaluate(()=>JSON.parse(localStorage.getItem('esteira-demo-v1')));
 await register('Skyvidya QA',emails[0]);
 const accountA=await state();assert.equal(accountA.pieces.length,0);assert.equal(accountA.sources.length,0);assert.equal(accountA.workspaces.length,1);
 assert.equal(await page.getByLabel('Espaço de trabalho',{exact:true}).locator('option').count(),1);
 assert.ok(!(await page.locator('.sidebar').innerText()).includes('BBMD'));
 assert.equal((await context.request.get(base+'/api/collected?workspace='+accountA.workspace)).status(),200);
 assert.equal((await context.request.get(base+'/api/collected?workspace=bbmd')).status(),403);
 await page.goto(base+'/#app/pesquisar');await page.getByRole('button',{name:'Adicionar ao acervo',exact:true}).click();
 await page.getByLabel('Título',{exact:true}).fill('Fonte privada Skyvidya QA');
 await page.getByLabel('Origem / autoria',{exact:true}).fill('Minha equipe');
 await page.getByLabel('Conteúdo',{exact:true}).fill('Conteúdo próprio de pesquisa para a marca Skyvidya QA. A plataforma deve preservar esta referência exclusivamente na conta que a criou e não compartilhar com a demonstração ou com outra conta.');
 await page.getByRole('button',{name:'Guardar referência',exact:true}).click();await saved();
 await page.goto(base+'/#app/configuracoes');
 assert.equal(await page.getByLabel('Tom de voz',{exact:true}).isEnabled(),true);
 assert.equal(await page.getByRole('button',{name:'Reiniciar demonstração',exact:true}).count(),0);
 await page.goto(base+'/#app/organizacao');await page.getByLabel('Nome da organização',{exact:true}).fill('Skyvidya Studio');await page.getByRole('button',{name:'Salvar organização',exact:true}).click();await saved();
 await page.reload();await saved();assert.equal((await state()).organizationName,'Skyvidya Studio');assert.equal((await state()).sources.length,1);
 await page.screenshot({path:'qa/account-skyvidya-desktop.png'});
 await page.goto(base+'/#auth');await page.getByRole('heading',{name:'Sua conta está conectada.',exact:true}).waitFor();
 await page.getByRole('button',{name:'Sair e usar outra conta',exact:true}).click();await page.getByRole('heading',{name:'Bom ter você de volta.',exact:true}).waitFor();
 await register('Outra empresa QA',emails[1]);const accountB=await state();assert.equal(accountB.sources.length,0);assert.equal(accountB.pieces.length,0);assert.notEqual(accountB.workspace,accountA.workspace);
 assert.equal((await context.request.get(base+'/api/collected?workspace='+accountA.workspace)).status(),403);
 assert.equal((await context.request.post(base+'/api/schedule',{data:{workspace:accountA.workspace,sources:[],config:{}}})).status(),403);
 assert.equal((await context.request.get(base+'/api/account/backup')).status(),200);assert.equal((await (await context.request.get(base+'/api/account/backup')).json()).backup,null);
 await page.goto(base+'/');await page.getByRole('button',{name:'Sair da conta',exact:true}).click();await page.getByRole('heading',{name:'Bom ter você de volta.',exact:true}).waitFor();
 await page.getByLabel('E-mail',{exact:true}).fill(emails[0]);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Entrar no meu espaço',exact:true}).click();await page.waitForURL('**/#app/painel');await saved();
 assert.equal((await state()).sources[0].title,'Fonte privada Skyvidya QA');
 await page.goto(base+'/#app/configuracoes');
 await page.route('**/api/account/state',route=>route.request().method()==='PUT'?route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Conflito de teste: alterações ainda não salvas.'})}):route.continue());
 await page.getByLabel('Teto do espaço (R$)',{exact:true}).fill('456');await page.getByRole('button',{name:'Salvar orçamento',exact:true}).click();
 await logout();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar alterações não salvas',exact:true}).click();const download=await downloadPromise;
 const recovered=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(recovered.state.budgets[accountA.workspace],456);assert.equal(recovered.state.sources[0].title,'Fonte privada Skyvidya QA');
 await page.unroute('**/api/account/state');
 await page.goto(base+'/#app/pesquisar');
 assert.ok((await page.locator('.organization-label').innerText()).includes('BBMD'));
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('esteira-demo-v1')));assert.deepEqual(after.sources,demo.sources);assert.deepEqual(after.pieces,demo.pieces);
 assert.deepEqual(errors,[]);
 console.log('PASS: independent empty accounts, own workspace and content, rename, reload/login persistence, auth while signed in, landing logout, 409 recovery logout, collector access boundaries and preserved demo');
}finally{
 await context.close();await browser.close();
 const db=new DatabaseSync('.runtime/skyvidya.sqlite');
 try{for(const email of emails){const user=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(user){db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('DELETE FROM account_state_backups WHERE user_id=?').run(user.id);db.prepare('DELETE FROM account_state WHERE user_id=?').run(user.id);db.prepare('DELETE FROM users WHERE id=?').run(user.id);}}}finally{db.close();}
}
