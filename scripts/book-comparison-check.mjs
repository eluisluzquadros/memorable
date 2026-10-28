import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=process.argv[2]||'C:/Users/eluzq/workspace/ai-powered-content/artefatos/everton/pontoroxico/edicao_v7';
const manifest=JSON.parse(await fs.readFile(path.join(root,'comparativo_v6_v7_controle.json'),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(12000);const errors=[],network=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
try{
  for(const source of Object.values(manifest.sources))assert.equal(hash(await fs.readFile(path.join(root,source.file))),source.sha256);
  await page.goto(pathToFileURL(path.join(root,manifest.output.file)).href);
  await page.getByRole('heading',{name:'Ponto Tóxico — o que mudou da v6 para a v7',exact:true}).waitFor();
  assert.equal(await page.getByRole('tab',{name:'Análise comparativa',exact:true}).getAttribute('aria-selected'),'true');
  const html=await fs.readFile(path.join(root,manifest.output.file),'utf8');
  assert.doesNotMatch(html,/os v[ée]io morreram|logo no meu turno/i);
  await page.getByRole('tab',{name:'Blueprint e ficha',exact:true}).click();
  assert.match(await page.locator('#blueprint-v6').innerText(),/Ficha do Autor \(Gêmeo digital\)/);
  assert.match(await page.locator('#blueprint-v7').innerText(),/Observador da Compasso/);
  await page.getByRole('tab',{name:'Manifesto / Prólogo',exact:true}).click();
  assert.equal(await page.getByRole('heading',{name:'A raiz cultural do ponto - João Grilo e a capoeira',exact:true}).isVisible(),true);
  assert.equal(await page.getByRole('link',{name:'[1] Canal de João Grilo · ouvir a cantiga',exact:true}).getAttribute('href'),'https://www.youtube.com/watch?v=7wOrqc4zHb4');
  assert.match(await page.getByRole('link',{name:'PDF curto para reunião',exact:true}).getAttribute('href'),/^output\/pdf\/Ponto_Toxico_Caderno_Curto_Reuniao_v6_v7(?:_Atualizado)?\.pdf$/);
  assert.equal(await page.locator('[data-opening]:visible').count(),3);
  assert.match(await page.locator('#opening-v7').innerText(),/O barulho da catraca/);
  await page.getByLabel('Manifesto da v6',{exact:true}).selectOption('2');
  assert.equal(await page.locator('[data-opening]:visible').count(),1);
  assert.equal(await page.locator('[data-opening="2"]').isVisible(),true);
  assert.equal(await page.locator('#opening-v7').isVisible(),true);
  await page.getByLabel('Manifesto da v6',{exact:true}).selectOption('all');
  await page.getByRole('tab',{name:'V6 integral',exact:true}).click();
  assert.equal(await page.locator('#text-v6 > h1').filter({hasText:/^CAPÍTULO \d+$/}).count(),20);
  assert.equal(await page.locator('#text-v6 h2').filter({hasText:'MANIFESTO DE ENTRADA'}).count(),3);
  assert.ok((await page.locator('#text-v6').innerText()).length>240000);
  await page.getByRole('searchbox').fill('queijo');await page.waitForFunction(()=>document.querySelectorAll('#panel-v6 mark').length>0);
  await page.getByRole('button',{name:'Próxima ocorrência',exact:true}).click();assert.equal(await page.locator('mark.current-match').count(),1);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('tab',{name:'Lado a lado',exact:true}).click();
  for(let number=1;number<=13;number++){
    await page.getByLabel('Capítulo',{exact:true}).selectOption(String(number));
    assert.equal(await page.locator('#paired-v6 .occurrence').count(),manifest.v6OccurrencesByChapter[number]);
    assert.ok((await page.locator('#paired-v7').innerText()).includes('Capítulo '+number+' —'));
  }
  await page.getByLabel('Capítulo',{exact:true}).selectOption('8');assert.equal(await page.getByLabel('Ocorrência da v6').locator('option').count(),4);
  await page.getByLabel('Ocorrência da v6').selectOption('2');assert.equal(await page.locator('#paired-v6 .occurrence').count(),1);assert.match(await page.locator('#paired-v6 .occurrence').innerText(),/2 DE 3/);
  await page.getByLabel('Capítulo',{exact:true}).selectOption('5');
  assert.match(await page.locator('#paired-v6').innerText(),/Workshop da Felicidade Forçada/);assert.match(await page.locator('#paired-v7').innerText(),/Escuta que transforma/);
  const ids=await page.locator('[id]').evaluateAll(elements=>elements.map(e=>e.id));assert.equal(new Set(ids).size,ids.length);
  for(const [label,width] of [['desktop',1440],['mobile',390]]){
    await page.setViewportSize({width,height:1000});
    for(const [view,name] of [['analysis','Análise comparativa'],['blueprint','Blueprint e ficha'],['openings','Manifesto / Prólogo'],['v6','V6 integral'],['v7','V7 condensada'],['paired','Lado a lado']]){
      await page.getByRole('tab',{name,exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),view+' overflow');
      const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(report.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[],view+' '+label);
      await page.screenshot({path:`qa/book-comparison-${view}-${label}.png`});
    }
  }
  await page.getByRole('tab',{name:'Análise comparativa',exact:true}).click();await page.getByRole('tab',{name:'Análise comparativa',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Blueprint e ficha',exact:true}).getAttribute('aria-selected'),'true');
  await page.getByRole('tab',{name:'V6 integral',exact:true}).click();
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.masthead').isVisible(),false);assert.equal(await page.locator('#text-v6').isVisible(),true);await page.emulateMedia({media:'screen'});
  assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
  assert.equal(await fs.readFile(path.join(root,'pontotoxico_v7_leitura.html'),'utf8'),await fs.readFile(path.join(root,manifest.output.file),'utf8'));
  await fs.writeFile(path.join(root,'validacao_comparativo.json'),JSON.stringify({date:'2026-10-28',sourceHashesVerified:true,noUnpublishedProjectReferences:true,blueprintBothEditions:true,openingOccurrences6:3,openingOccurrences7:1,openingVariantFilter:true,fullV6ChapterOccurrences:20,chapterPairsChecked:13,allV6OccurrencesSelectable:true,search:true,keyboard:true,offline:true,desktopAndMobile:true,axeViolations:0,originalReaderUpdated:true},null,2)+'\n');
  console.log('PASS: original hashes, full v6, both manifests, all 13 chapter pairs, occurrence selection, search, unique IDs, keyboard, print, offline, desktop/mobile and Axe.');
}catch(error){console.error(error);await page.screenshot({path:'qa/book-comparison-failure.png',fullPage:false});throw error;}finally{await context.close();await browser.close();}
