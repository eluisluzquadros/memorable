import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173/#app/escrever');
 for(const name of ['Pautas do Radar · disparo rápido','Recomendados pelo time','Briefing manual']) {await page.getByRole('tab',{name,exact:true}).click();if(name!=='Briefing manual')await page.locator('.r-pick-list button').first().click();await page.locator('select').filter({has:page.locator('option', {hasText:'Roteiro de vídeo'})}).selectOption('Roteiro de vídeo');assert.equal(await page.locator('select').filter({has:page.locator('option', {hasText:'Roteiro de vídeo'})}).inputValue(),'Roteiro de vídeo');}
 assert.equal(await page.getByRole('button',{name:'Gerar três roteiros com IA'}).count(),1);
 assert.equal(await page.getByText('Roteiros do Isaac',{exact:true}).count(),0);
 fs.mkdirSync('qa',{recursive:true});await page.screenshot({path:'qa/writing-video-unified.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto('http://localhost:5173/#app/configuracoes');
 assert.ok(await page.getByText('Higgsfield',{exact:true}).count());
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: vídeo integrado às três entradas, CTA IA, layout mobile e conexões sem erros React.');
} finally {await browser.close();}
