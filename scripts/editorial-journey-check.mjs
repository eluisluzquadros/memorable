import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {createAccountState,addBrand} from '../src/account-state.mjs';
import {generateSquad} from '../server/ai.mjs';
import {carousel,badCarousel,acceptedReviews} from '../tests/editorial-fixtures.mjs';
let seed=createAccountState({id:'qa-editorial',name:'Skyvidya'});seed=addBrand(seed,'Outra marca');seed.onboarding={tour:{dontShowAgain:true}};seed.voices[seed.workspace].positioning='Inteligência geoespacial, artificial e humana para transformar risco em resiliência.';seed.voices[seed.workspace].audience='Profissionais de crédito rural, seguros e gestão de riscos climáticos.';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(18000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base='http://localhost:5173',url='https://www.irbre.com/dados-climaticos-confiaveis-o-elo-entre-ciencia-e-mercado-segurador-brasileiro/';
const email='qa-editorial-'+Date.now()+'@example.test';
const state=async()=>{await page.getByText('Salvo no SQLite',{exact:true}).waitFor();return(await(await context.request.get(base+'/api/account/state')).json()).state;};
async function qa(name){for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow');const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],name);await page.screenshot({path:`qa/editorial-${name}-${width}.png`});}await page.setViewportSize({width:1440,height:1000});}
try{
  const registered=await context.request.post(base+'/api/auth/register',{data:{name:'Skyvidya QA',email,password:'qa-only-editorial-long-password-123',organization:{type:'single',name:'Skyvidya',brands:[{name:'Skyvidya'}]}}});assert.equal(registered.status(),200);const account=await registered.json();seed=createAccountState(account.user,{type:'single',name:'Skyvidya',brands:[{name:'Skyvidya'}]});seed=addBrand(seed,'Outra marca');seed.onboarding={tour:{dontShowAgain:true}};seed.voices[seed.workspace].positioning='Inteligência geoespacial, artificial e humana para transformar risco em resiliência.';seed.voices[seed.workspace].audience='Profissionais de crédito rural, seguros e gestão de riscos climáticos.';const persisted=await context.request.put(base+'/api/account/state',{data:{state:seed,revision:1,userId:account.user.id}});assert.equal(persisted.status(),200);
  await page.goto(base+'/#app/escrever');await page.getByRole('heading',{name:'Por onde começar?',exact:true}).waitFor();assert.equal(await page.getByLabel('Editar abordagem').count(),0);await qa('ideas');
  await page.goto(base+'/#app/pesquisar');await page.getByRole('button',{name:'Adicionar ao acervo',exact:true}).click();
  let modal=page.getByRole('dialog',{name:'Adicionar ao acervo',exact:true});await modal.locator('.source-url-input input').fill(url);
  const extractedPromise=page.waitForResponse(r=>r.url().endsWith('/api/ingest/url'),{timeout:45000});await modal.getByRole('button',{name:'Extrair agora',exact:true}).click();const extracted=await (await extractedPromise).json();assert.ok(extracted.text?.length>2000);assert.doesNotMatch(extracted.text,/Skip to content|Assessoria de Imprensa|Notícias recomendadas/i);assert.doesNotMatch(extracted.summary,/^Por /);assert.match(extracted.summary,/valida|bases? climáticas?/i);
  await modal.getByText('Extração concluída',{exact:true}).waitFor();await modal.getByRole('button',{name:'Guardar referência',exact:true}).click();
  await page.locator('.source-row').first().click();modal=page.getByRole('dialog',{name:'Referência do acervo',exact:true});
  await modal.getByText('Resumo',{exact:true}).waitFor();assert.equal(await modal.locator('.source-transcript').getAttribute('open'),'');assert.ok((await modal.locator('.source-transcript blockquote').innerText()).length>2000);
  await qa('reference');await modal.getByRole('button',{name:'Criar a partir daqui',exact:true}).click();await page.getByRole('heading',{name:'O que sua marca vai dizer?',exact:true}).waitFor();assert.equal(await page.getByLabel('Editar abordagem').count(),0);assert.equal((await state()).writingQueue.length,1);
  await page.getByLabel('Formato',{exact:true}).selectOption('Podcast completo');const durations=await page.getByLabel('Duração esperada',{exact:true}).locator('option').evaluateAll(opts=>opts.map(o=>Number(o.value)));assert.ok(durations.every(n=>n>=300));
  await page.getByLabel('Formato',{exact:true}).selectOption('Corte de podcast');assert.ok(await page.getByLabel('Duração esperada',{exact:true}).locator('option[value="10"]').count());
  await page.getByLabel('Formato',{exact:true}).selectOption('Carrossel');assert.equal(await page.getByLabel('Quantidade de versões').inputValue(),'1');
  await page.getByLabel('Mensagem da marca').fill('Conectar dados e contexto territorial para apoiar decisões sobre risco climático com a Skyvidya.');
  const hasProvider=((await (await context.request.get(base+'/api/text/status')).json()).providers||[]).length>0;await (hasProvider?page.getByRole('button',{name:/Gerar \d+ (versão|versões) com IA/}):page.getByRole('link',{name:'Conectar IA',exact:true})).waitFor();await qa('setup');
  await page.getByRole('button',{name:'Escrever manualmente',exact:true}).click();await page.getByLabel('Editar abordagem').waitFor();assert.match(await page.getByLabel('Editar abordagem').inputValue(),/\[Escreva/);
  await page.getByRole('button',{name:'Checar texto',exact:true}).click();await page.getByText('Corrigir antes de seguir',{exact:true}).waitFor();assert.ok(!(await page.locator('.r-council').innerText()).includes('/5'));
  await page.getByLabel('Editar abordagem').fill(badCarousel);await page.getByRole('button',{name:'Enviar para revisão',exact:true}).click();await page.getByText('Corrigir antes de seguir',{exact:true}).waitFor();assert.ok(page.url().endsWith('#app/escrever'));assert.equal((await state()).pieces[0].council.passed,false);
  await page.getByLabel('Editar abordagem').fill(carousel);await page.getByRole('button',{name:'Checar texto',exact:true}).click();await page.getByText('Checagem concluída · revisão humana pendente',{exact:true}).waitFor();await qa('edit');
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();assert.equal((await state()).pieces.length,1);
  await page.getByRole('button',{name:'Ir para Mídia',exact:true}).click();await page.getByRole('heading',{name:'Dê forma ao conteúdo.',exact:true}).waitFor();await page.getByText('Síntese de voz ainda não está integrada.',{exact:false}).waitFor();await qa('media');
  await page.goto(base+'/#app/vigiar');assert.equal(await page.getByRole('tab',{name:/Fontes/}).count(),0);assert.equal(await page.getByLabel('Relação da fonte com a marca').count(),0);
  await page.goto(base+'/#app/pesquisar');await page.getByText('Acompanhar atualizações',{exact:true}).click();await page.getByLabel('Referência para acompanhar').selectOption((await state()).sources[0].id);await page.getByRole('button',{name:'Salvar acompanhamento',exact:true}).click();assert.equal((await state()).sources.length,1);assert.equal((await state()).monitors.length,1);
  await page.locator('.source-row').first().click();await page.getByRole('button',{name:'Criar a partir daqui',exact:true}).click();await page.getByRole('button',{name:'Trocar ideia',exact:true}).click();assert.equal(await page.locator('.ws-ideas article').count(),1);
  await page.getByRole('button',{name:'Usar ideia',exact:true}).click();assert.equal((await state()).writingQueue.length,1);

  // Controlled provider transport. No real model output or API spending is claimed.
  await context.route('**/api/text/status',route=>route.fulfill({json:{providers:['server'],authenticated:false}}));
  await page.reload();await page.getByRole('button',{name:'Usar ideia',exact:true}).click();await page.getByLabel('Formato',{exact:true}).selectOption('Carrossel');
  let generatedPacket;
  await context.route('**/api/squad',async route=>{
    generatedPacket=route.request().postDataJSON().packet;
    const mock=async(system,data)=>system.includes('editor crítico')?acceptedReviews(data.versions):system.includes('Content Planner')?{thesis:'Dados e território',outline:['Problema','Validação','Marca']}:system.includes('Copywriter/Ghostwriter')?{title:'Dados globais, risco local',body:carousel,sourceIds:[generatedPacket.sources[0].id],facts:[]}:{visual:'Mapa territorial com paleta da Skyvidya.',av:'Gravação e legendas a produzir.',seo:{title:'Dados globais, risco local'}};
    try{await route.fulfill({json:await generateSquad(generatedPacket,mock)});}catch(e){await route.fulfill({status:400,json:{error:e.message}});}
  });
  const aiButton=page.getByRole('button',{name:'Gerar 1 versão com IA',exact:true});await aiButton.waitFor();assert.equal(await aiButton.isEnabled(),true);await aiButton.click();await page.getByLabel('Editar abordagem').waitFor();assert.equal(generatedPacket.brand.name,'Skyvidya');assert.equal(generatedPacket.brief.versionCount,1);assert.equal(await page.getByLabel('Editar abordagem').inputValue(),carousel);
  await page.getByRole('button',{name:'Enviar para revisão',exact:true}).click();await page.waitForURL('**/#app/aprovar');const last=(await state()).pieces[0];assert.equal(last.title,'Dados globais, risco local');assert.equal(last.status,'Em revisão');assert.equal(last.delivery.editorialReview.humanReviewPending,true);
  assert.deepEqual(errors,[]);await fs.writeFile('qa/editorial-journey-report.json',JSON.stringify({realSource:{title:extracted.title,textCharacters:extracted.text.length,summary:extracted.summary},steps:['Ideas separate from editor','Real IRB import','Full text open','Intentional source handoff','Podcast duration limits','Skeleton blocked','Reported carousel blocked','Manual editing and saving','Media scope visible','One reference reused for monitoring','Provider UI and full orchestration using controlled transport','Human review pending'],modelTransport:'controlled fixture, not a live model call'},null,2));
  console.log('PASS: real IRB ingestion; separate wizard stages; manual/source/suggestion entry; queue deduplication; content rejection; duration limits; media scope; mock-provider orchestration; human-review handoff; mobile/Axe.');
  console.log(JSON.stringify({characters:extracted.text.length,summary:extracted.summary}));
}catch(e){console.error(e);await page.screenshot({path:'qa/editorial-journey-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-6000));throw e;}finally{await context.close();await browser.close();const db=new DatabaseSync('.runtime/skyvidya.sqlite');try{const user=db.prepare('SELECT id FROM users WHERE email=?').get(email);if(user){db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('DELETE FROM account_state_backups WHERE user_id=?').run(user.id);db.prepare('DELETE FROM account_state WHERE user_id=?').run(user.id);db.prepare('DELETE FROM users WHERE id=?').run(user.id);}}finally{db.close();}}




