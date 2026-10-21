import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5173/#app/configuracoes');
  await page.getByRole('button', { name: 'Pular tour', exact: true }).click();
  assert(await page.getByLabel('Site da marca').isDisabled());
  await page.getByLabel('Papel na demonstração').selectOption('Administrador');
  await page.getByLabel('Documentação da marca').fill('Tom de voz: claro e humano\nPúblico: gestores\nEstética: editorial, espaços generosos\nPaleta: #214cff; #172027\nfont-family: Sora, sans-serif;');
  await page.getByRole('button', { name: 'Extrair proposta de DNA' }).click();
  await page.getByText('PROPOSTA · AGUARDA SUA VALIDAÇÃO').waitFor();
  assert.equal(await page.getByLabel('Voz identificada').inputValue(), 'claro e humano');
  await page.getByLabel('Cor principal', { exact: true }).fill('#214cff');
  await page.getByLabel('Fonte dos títulos').fill('Sora');
  await page.getByRole('button', { name: 'Validar e aplicar DNA' }).click();
  await page.reload();
  assert.equal(await page.getByLabel('Cor principal', { exact: true }).inputValue(), '#214cff');
  assert.equal(await page.getByLabel('Tom de voz', { exact: true }).inputValue(), 'claro e humano');
  for (const [name,width] of [['desktop',1440],['mobile',390]]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const report = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(report.violations.map(v => ({id:v.id,nodes:v.nodes.map(n=>n.target)})), []);
    await page.screenshot({ path: `qa/dna-${name}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: DNA extraction, explicit validation, persistence, voice application, responsive layout and accessibility.');
} finally { await browser.close(); }
