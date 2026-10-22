import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(15000);fs.mkdirSync('qa',{recursive:true});
const email=`qa-group-${Date.now()}@example.test`,password='qa-only-long-password-123',base='http://localhost:5173';
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const saved=()=>page.getByText('Salvo no SQLite',{exact:true}).waitFor();
async function state(){return (await (await context.request.get(base+'/api/account/state')).json()).state;}
async function axe(){const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;assert.deepEqual(violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);}
const row=name=>page.locator('.brand-management-row').filter({has:page.getByRole('textbox',{name:`Nome da marca ${name}`,exact:true})});
try{
 await page.goto(base+'/#auth');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByLabel('Seu nome',{exact:true}).fill('Pessoa QA');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(password);await page.getByRole('button',{name:'Continuar',exact:true}).click();
 assert.equal((await context.request.get(base+'/api/auth/session').then(r=>r.json())).user,null);
 await page.getByRole('radio',{name:/Um grupo de marcas/}).check();await page.getByLabel('Nome do grupo / organização',{exact:true}).fill('Grupo Horizonte QA');
 await page.getByLabel('Marca 1',{exact:true}).fill('Marca Saúde');await page.getByLabel('Marca 2',{exact:true}).fill('Marca Educação');await page.getByRole('button',{name:'Adicionar outra marca',exact:true}).click();await page.getByLabel('Marca 3',{exact:true}).fill('Marca Tecnologia');
 await page.getByRole('button',{name:'Voltar',exact:true}).click();assert.equal(await page.getByLabel('E-mail',{exact:true}).inputValue(),email);await page.getByRole('button',{name:'Continuar',exact:true}).click();assert.equal(await page.getByLabel('Marca 3',{exact:true}).inputValue(),'Marca Tecnologia');
 for(const [label,width] of [['desktop',1440],['mobile',390]]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await axe();await page.screenshot({path:`qa/group-signup-${label}.png`,fullPage:true});}
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Criar minha conta',exact:true}).click();await page.waitForURL('**/#app/grupo');await page.getByRole('button',{name:'Pular tour',exact:true}).click();await saved();
 let data=await state();assert.equal(data.organizationName,'Grupo Horizonte QA');assert.equal(data.organizationType,'group');assert.equal(data.workspaces.length,3);assert.equal(data.sources.length+data.pieces.length,0);assert.equal(await page.locator('.group-brand-card').count(),3);
 const first=data.workspaces[0].id,second=data.workspaces[1].id;
 await page.getByRole('combobox',{name:'Escopo: grupo ou marca',exact:true}).selectOption(first);await page.goto(base+'/#app/pesquisar');await page.getByRole('button',{name:'Adicionar ao acervo',exact:true}).click();
 await page.getByLabel('Título',{exact:true}).fill('Pesquisa exclusiva da marca Saúde');await page.getByLabel('Origem / autoria',{exact:true}).fill('Equipe de pesquisa');await page.getByLabel('Conteúdo',{exact:true}).fill('A marca Saúde desenvolve informação educativa para profissionais de pesquisa. Sua comunicação precisa explicar conceitos com clareza e preservar o contexto das fontes. Este repertório pertence apenas à marca Saúde e não foi compartilhado com as demais marcas.');await page.getByRole('button',{name:'Guardar referência',exact:true}).click();await saved();
 data=await state();await page.goto(base+'/#app/escrever');await page.getByLabel('O que vamos comunicar?',{exact:true}).fill('Clareza na comunicação da marca Saúde');await page.getByLabel('Referência do acervo',{exact:true}).selectOption(data.sources[0].id);await page.getByLabel('Prazo',{exact:true}).fill('2030-01-01');await page.getByRole('button',{name:'Preparar 1 versão local',exact:true}).click();await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.getByRole('button',{name:'Fechar',exact:true}).click();await saved();
 await page.getByRole('combobox',{name:'Escopo: grupo ou marca',exact:true}).selectOption(second);await page.goto(base+'/#app/pesquisar');assert.equal(await page.locator('.source-row').count(),0);
 await page.goto(base+'/#app/grupo');assert.equal(await page.locator('.group-brand-card').count(),3);const card=page.locator('.group-brand-card').filter({has:page.getByRole('heading',{name:'Marca Saúde',exact:true})});assert.equal(await card.locator('dd').first().innerText(),'1');await axe();await page.screenshot({path:'qa/group-overview-desktop.png',fullPage:true});
 await page.goto(base+'/#app/organizacao');await page.getByLabel('Nome da organização',{exact:true}).fill('Grupo Horizonte Evolui');await page.getByRole('button',{name:'Salvar organização',exact:true}).click();await saved();assert.equal((await state()).workspaces[0].name,'Marca Saúde');
 await row('Marca Saúde').getByRole('textbox').fill('Marca Saúde Nova');await row('Marca Saúde').getByRole('button',{name:'Salvar nome',exact:true}).click();await saved();assert.equal((await state()).organizationName,'Grupo Horizonte Evolui');
 await page.getByLabel('Nome da nova marca',{exact:true}).fill('Marca Cultura');await page.getByRole('button',{name:'Adicionar marca',exact:true}).click();await saved();assert.equal((await state()).workspaces.length,4);
 await page.getByRole('combobox',{name:'Escopo: grupo ou marca',exact:true}).selectOption(first);await row('Marca Saúde Nova').getByRole('button',{name:'Arquivar',exact:true}).click();await saved();assert.notEqual(await page.getByRole('combobox',{name:'Escopo: grupo ou marca',exact:true}).inputValue(),first);assert.equal((await context.request.get(base+'/api/collected?workspace='+first)).status(),403);assert.equal((await state()).pieces.length,1);
 await row('Marca Saúde Nova').getByRole('button',{name:'Restaurar',exact:true}).click();await saved();assert.equal((await context.request.get(base+'/api/collected?workspace='+first)).status(),200);
 for(const [label,width] of [['desktop',1440],['mobile',390]]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await axe();await page.screenshot({path:`qa/group-management-${label}.png`,fullPage:true});}
 await page.reload();await saved();data=await state();assert.equal(data.workspaces.length,4);assert.equal(data.pieces.length,1);assert.equal(data.sources.length,1);assert.equal(data.organizationName,'Grupo Horizonte Evolui');assert.equal(data.workspaces[0].name,'Marca Saúde Nova');
 assert.deepEqual(errors,[]);console.log('PASS: two-step group signup, atomic setup, independent brands, real draft aggregated in group view, organization/brand rename, add/archive/restore, API boundaries, persistence, responsive layout and accessibility');
}catch(error){
 await page.screenshot({path:'qa/group-flow-failure.png',fullPage:true});
 console.log('Layout diagnostics',await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))));throw error;
}finally{
 await context.close();await browser.close();const db=new DatabaseSync('.runtime/skyvidya.sqlite');
 try{const user=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(user){db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('DELETE FROM account_state_backups WHERE user_id=?').run(user.id);db.prepare('DELETE FROM account_state WHERE user_id=?').run(user.id);db.prepare('DELETE FROM users WHERE id=?').run(user.id);}}finally{db.close();}
}
