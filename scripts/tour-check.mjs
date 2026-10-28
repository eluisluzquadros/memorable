import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
fs.mkdirSync('qa',{recursive:true});
const errors=[];
async function open(storage, width=1440) {
  const context=await browser.newContext({storageState:storage,viewport:{width,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5173/#app/pesquisar',{waitUntil:'networkidle'});
  return {context,page};
}
try {
  let {context,page}=await open();
  const welcome=page.getByRole('dialog',{name:'Sua primeira ideia, de ponta a ponta.'});
  await welcome.waitFor();
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('esteira-demo-v1')));
  await page.getByRole('button',{name:'Pular tour',exact:true}).click();
  await page.reload();assert.equal(await page.locator('.guided-tour').count(),0);
  let storage=await context.storageState();await context.close();
  ({context,page}=await open(storage));
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('Não mostrar automaticamente novamente').check();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  storage=await context.storageState();await context.close();
  ({context,page}=await open(storage));
  assert.equal(await page.locator('.guided-tour').count(),0);
  await page.getByRole('button',{name:'Recolher menu lateral',exact:true}).click();
  await page.getByRole('button',{name:'Tour guiado',exact:true}).click();
  await page.getByRole('button',{name:'Começar tour',exact:true}).click();
  await page.waitForURL('**/#app/cerebro/dna');
  await page.getByRole('button',{name:'Próximo',exact:true}).click();await page.waitForURL('**/#app/pesquisar');
  await page.getByRole('button',{name:'Voltar',exact:true}).click();await page.waitForURL('**/#app/cerebro/dna');
  await page.getByRole('button',{name:'Próximo',exact:true}).click();
  for(const route of ['vigiar','escrever','aprovar','publicar','cerebro']) {
    await page.getByRole('button',{name:'Próximo',exact:true}).click();await page.waitForURL(`**/#app/${route}`);
    assert.equal(await page.getByRole('dialog').count(),1);
  }
  for(const [label,width] of [['desktop',1440],['mobile',390]]) {
    await page.setViewportSize({width,height:1000});
    const violations=(await new AxeBuilder({page}).include('.guided-tour').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations;
    assert.deepEqual(violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    assert.ok(await page.locator('.guided-tour').evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth&&el.scrollWidth<=el.clientWidth));
    await page.screenshot({path:`qa/tour-${label}.png`,fullPage:true});
  }
  await page.getByRole('button',{name:'Concluir tour',exact:true}).click();await page.waitForURL('**/#app/pesquisar');
  await page.reload();assert.equal(await page.locator('.guided-tour').count(),0);
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('esteira-demo-v1')));
  assert.deepEqual(after.pieces,original.pieces);assert.deepEqual(after.sources,original.sources);
  assert.equal(after.onboarding.tour.status,'completed');
  storage=await context.storageState();await context.close();
  ({context,page}=await open(storage));
  await page.goto('http://localhost:5173/#app/cerebro/dna');
  await page.getByRole('combobox',{name:'Papel na demonstração'}).selectOption('Administrador');
  await page.getByLabel('Tom de voz',{exact:true}).fill('Tom em edição ainda não salvo');
  await page.getByRole('button',{name:'Tour guiado',exact:true}).click();
  await page.getByRole('button',{name:'Começar tour',exact:true}).click();
  await page.getByRole('button',{name:'Próximo',exact:true}).click();await page.waitForURL('**/#app/pesquisar');
  await page.getByRole('button',{name:'Pular tour',exact:true}).click();await page.waitForURL('**/#app/cerebro/dna');
  assert.equal(await page.getByLabel('Tom de voz',{exact:true}).inputValue(),'Tom em edição ainda não salvo');
  await context.close();
  ({context,page}=await open(storage,390));
  assert.equal(await page.locator('.guided-tour').count(),0);
  await page.getByRole('button',{name:'Tour guiado',exact:true}).click();await page.getByRole('button',{name:'Começar tour',exact:true}).click();
  for(let i=0;i<8;i++)await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(()=>Boolean(document.activeElement.closest('.guided-tour'))));
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  console.log('PASS: first visit, session skip, permanent preference, replay, real routes, completion, preserved content, keyboard, mobile and accessibility');
  await context.close();
} finally { await browser.close(); }
