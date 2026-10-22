import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}); const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/#app/campanhas');
 await page.getByRole('button',{name:'Nova campanha'}).click();
 for(const [label,value] of [['Nome da campanha','Clareza na decisão'],['Público da campanha','Gestores'],['Problema nas palavras do público','Não entendo as etapas'],['Hipótese a testar','Um exemplo ajuda a decidir'],['Critério de sucesso e período','Avaliar dúvidas ao fim de 30 dias']]) await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Salvar campanha'}).click();
 await page.getByRole('button',{name:'Criar conteúdo da campanha'}).click();
 await page.getByLabel('Referência do acervo').selectOption({index:1});await page.getByLabel('Prazo',{exact:true}).fill('2026-12-20');
 await page.getByRole('button',{name:'Preparar 1 versão local'}).click();await page.getByRole('button',{name:'Salvar rascunho'}).click();
 await page.getByRole('button',{name:'Criar desdobramento deste conteúdo'}).click();
 await page.getByRole('button',{name:'Preparar 1 versão local'}).click();await page.getByRole('button',{name:'Salvar rascunho'}).click();
 await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.goto('http://localhost:5173/#app/campanhas');await page.reload();
 assert.equal(await page.locator('.campaign-pieces > div').count(),2);
 await page.getByRole('button',{name:'Abrir conteúdo',exact:true}).first().click();await page.getByRole('heading',{name:'Contexto e desdobramentos'}).waitFor();await page.getByRole('button',{name:'Fechar',exact:true}).click();
 for(const [name,width] of [['desktop',1440],['mobile',390]]) { await page.setViewportSize({width,height:1000}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)); const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);await page.screenshot({path:`qa/campaign-${name}.png`,fullPage:true}); }
 assert.deepEqual(errors,[]);console.log('PASS: campaign → writer → parent → derivative; preserved relationships, persistence, responsive layout and accessibility.');
}finally{await browser.close();}
