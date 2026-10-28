import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // The guided tour opens on a first visit; these checks start past it.
  await page.addInitScript(() => { try { sessionStorage.setItem('memorable-tour-dismissed:demo', 'true'); } catch {} });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5173/#app/guardar');
  await page.getByRole('button', { name: 'Adicionar ao acervo' }).click();
  await page.getByRole('dialog', { name: 'Adicionar ao acervo' }).getByLabel('Título').fill('Referência CRUD temporária');
  await page.getByRole('dialog', { name: 'Adicionar ao acervo' }).getByLabel('Origem / autoria').fill('Teste local');
  await page.getByRole('dialog', { name: 'Adicionar ao acervo' }).getByLabel('Conteúdo').fill('Texto útil e verificável para validar a edição e remoção desta referência.');
  await page.getByRole('button', { name: /Guardar referência/ }).click();
  await page.getByText('Referência CRUD temporária', { exact: true }).click();
  await page.getByText('Editar referência, validade e gestão', { exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Referência do acervo' });
  await detail.getByLabel('Título').fill('Referência CRUD revisada');
  await detail.getByRole('button', { name: /Salvar referência/ }).click();
  await assert.deepEqual(await detail.getByRole('heading', { name: 'Referência CRUD revisada' }).count(), 1);
  await detail.getByRole('button', { name: 'Excluir do acervo' }).click();
  await detail.getByRole('button', { name: 'Excluir definitivamente' }).click();
  await assert.equal(await page.getByText('Referência CRUD revisada', { exact: true }).count(), 0);
  await page.screenshot({ path: 'qa/source-crud.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: source create, read, update and delete work in the app.');
} finally {
  await browser.close();
}
