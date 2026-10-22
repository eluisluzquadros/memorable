import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = await chromium.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true });
try {
  const page = await browser.newPage({ viewport:{width:1440,height:1000} });
  const errors=[]; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/#app/guardar');
  const old = page.getByText('Example Domain',{exact:true});
  if (await old.count()) { await old.first().click(); const existing=page.getByRole('dialog',{name:'Referência do acervo'}); await existing.getByText('Editar referência, validade e gestão',{exact:true}).click(); await existing.getByRole('button',{name:'Excluir referência'}).click(); await existing.getByRole('button',{name:'Excluir definitivamente'}).click(); }
  await page.getByRole('button',{name:'Adicionar ao acervo'}).click();
  const modal=page.getByRole('dialog',{name:'Adicionar ao acervo'});
  await modal.getByLabel('Link da fonte (opcional)').fill('https://example.com/');
  await modal.getByRole('button',{name:'Extrair conteúdo'}).click();
  await page.getByText('Extração concluída',{exact:true}).waitFor();
  assert.ok(await modal.getByLabel('Conteúdo',{exact:true}).inputValue());
  await modal.getByRole('button',{name:/Guardar referência/}).click();
  await page.getByText('Example Domain',{exact:true}).click();
  const detail=page.getByRole('dialog',{name:'Referência do acervo'});
  await detail.getByText('LEITURA AUTOMÁTICA',{exact:true}).waitFor();
  await detail.getByText('Editar referência, validade e gestão',{exact:true}).click();
  await detail.getByRole('button',{name:'Excluir referência'}).click();
  await detail.getByRole('button',{name:'Excluir definitivamente'}).click();
  fs.mkdirSync('qa',{recursive:true}); await page.screenshot({path:'qa/source-ingestion.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: URL extraction populates source text, summary and keywords before saving.');
} finally { await browser.close(); }
