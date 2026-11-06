import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runBrowserAudit } from '../scripts/browser-audit.mjs';
import { runRecipe, listRecipes } from '../scripts/project-tools.mjs';
const repo = fileURLToPath(new URL('..', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'cyc-browser-'));
  t.after(() => { assert.equal(dirname(root), resolve(tmpdir())); assert(root.startsWith(join(resolve(tmpdir()), 'cyc-browser-'))); rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
  for (const [name, content] of [['layout.html', 'preview'], ['style.css', 'body{margin:0}'], ['build.json', '{"css":"existing"}']]) writeFileSync(join(root, name), content);
  return root;
}
const plan = { prerequisiteFiles: ['layout.html', 'style.css', 'build.json'], viewports: [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844 }], journeys: [{ id: 'welcome-return-focus', state: 'preview', actions: ['open', 'close'], outcomes: ['return-focus', 'no-overflow'] }, { id: 'keyboard-return-focus', state: 'preview', actions: ['keyboard-open', 'keyboard-close'], outcomes: ['return-focus'] }] };
test('browser prerequisites/capability are precise limits and interruption cannot become success', async t => {
  const root = fixture(t);
  const missing = await runBrowserAudit(root, { ...plan, prerequisiteFiles: ['missing-css-config'] });
  assert.equal(missing.status, 'limited'); assert.deepEqual(missing.missing, ['missing-css-config']);
  assert.equal((await runBrowserAudit(root, plan)).status, 'limited');
  const signal = new AbortController(); signal.abort();
  let opened = 0;
  const result = await runBrowserAudit(root, plan, { signal: signal.signal, driver: { open: async () => opened++, act: async () => {}, observe: async () => ({ passed: true, evidence: 'actual adapter observation' }), close: async () => {} }, scanner: async () => ({ violations: [] }) });
  assert.equal(result.status, 'interrupted'); assert.equal(result.ok, false); assert.equal(opened, 0); assert.equal(result.applicationPrerequisitesUnchanged, true);
});
test('registered browser recipe retains a precise limited receipt and rejects malformed plans before execution', async t => {
  const root = fixture(t); mkdirSync(join(root, 'docs/context'), { recursive: true });
  const recipe = { id: 'browser-check', kind: 'verification', covers: ['layout.html'], description: 'Named browser journey', command: 'node', args: [], expected: 'Named outcomes and separate scan', effects: 'External harness only', prerequisites: ['Existing preview and CSS inspected'], references: ['layout.html'], browser: plan };
  const registry = join(root, 'docs/context/recipes.json'); writeFileSync(registry, JSON.stringify({ schemaVersion: 1, recipes: [recipe] }));
  const result = await runRecipe(root, recipe.id); assert.equal(result.ok, false); assert.equal(result.status, 'limited');
  assert(result.receiptPath); assert.equal(listRecipes(root, { all: true }).recipes[0].receipt.status, 'limited');
  recipe.browser = { ...plan, journeys: [{ id: 'missing-outcome', state: 'preview', actions: [], outcomes: [] }] };
  writeFileSync(registry, JSON.stringify({ schemaVersion: 1, recipes: [recipe] }));
  assert.throws(() => listRecipes(root, { all: true }), /Browser journey/);
});
test('external real-browser scanner and named desktop/phone focus journeys detect seeded defects and repair without instrumentation edits', { timeout: 60000 }, async t => {
  const modules = join(repo, '.cyc/runtime/quality-efficiency/browser-harness/node_modules');
  const executablePath = process.env.CYC_AUDIT_BROWSER ?? ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  if (!existsSync(join(modules, 'playwright/index.mjs')) || !executablePath) { t.skip('External browser harness prerequisites unavailable: install the isolated Playwright/axe harness and supply CYC_AUDIT_BROWSER; no app/config rewrite attempted.'); return; }
  const { chromium } = await import(pathToFileURL(join(modules, 'playwright/index.mjs')));
  const { default: AxeBuilder } = await import(pathToFileURL(join(modules, '@axe-core/playwright/dist/index.mjs')));
  const root = fixture(t);
  const html = repaired => `<!doctype html><html lang="en"><head><title>Focus fixture</title><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"></head><body><main><h1>Welcome fixture</h1><button id="open" ${repaired ? 'aria-label="Open welcome"' : ''}><span aria-hidden="true">+</span></button><button id="other">Other</button><dialog id="welcome" aria-labelledby="heading"><h2 id="heading">Welcome</h2><button id="close">Close</button></dialog></main><script>const d=document.querySelector('dialog');document.querySelector('#open').onclick=()=>d.showModal();document.querySelector('#close').onclick=()=>d.close();d.onclose=()=>{document.querySelector('#${repaired ? 'open' : 'other'}').focus();document.body.dataset.closed='yes';};</script></body></html>`;
  const server = createServer((request, response) => { response.setHeader('Content-Type', request.url === '/style.css' ? 'text/css' : 'text/html'); response.end(readFileSync(join(root, request.url === '/style.css' ? 'style.css' : 'layout.html'))); });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => server.close(done)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath, headless: true }); t.after(() => browser.close());
  const purposes = [];
  const driver = {
    async open({ viewport, purpose }) { purposes.push(purpose); const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } }); const page = await context.newPage(); await page.goto(url); return { context, page }; },
    async act({ page }, action) {
      if (action === 'open') await page.locator('#open').click();
      if (action === 'close') await page.locator('#close').click();
      if (action === 'keyboard-open') { await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); }
      if (action === 'keyboard-close') await page.keyboard.press('Escape');
      if (action.endsWith('close')) await page.waitForFunction(() => document.body.dataset.closed === 'yes');
    },
    async observe({ page }, outcome) { const passed = await page.evaluate(name => name === 'return-focus' ? document.activeElement.id === 'open' : document.documentElement.scrollWidth <= innerWidth, outcome); return { passed, evidence: `Browser evaluated ${outcome}: ${passed}` }; },
    async close({ context }) { await context.close(); }
  };
  const scanner = async ({ page }) => ({ violations: (await new AxeBuilder({ page }).withRules(['button-name']).analyze()).violations });
  writeFileSync(join(root, 'layout.html'), html(false)); const brokenBytes = readFileSync(join(root, 'layout.html'));
  const broken = await runBrowserAudit(root, plan, { driver, scanner });
  assert.equal(broken.ok, false); assert.equal(broken.applicationPrerequisitesUnchanged, true); assert.deepEqual(readFileSync(join(root, 'layout.html')), brokenBytes);
  for (const name of ['desktop', 'phone']) { assert(broken.scans.find(s => s.viewport === name).violations.some(v => v.id === 'button-name')); assert(broken.observations.some(o => o.viewport === name && o.outcome === 'return-focus' && !o.passed)); }
  writeFileSync(join(root, 'layout.html'), html(true)); const fixedBytes = readFileSync(join(root, 'layout.html'));
  const repaired = await runBrowserAudit(root, plan, { driver, scanner });
  assert.equal(repaired.ok, true, JSON.stringify(repaired)); assert.equal(repaired.observations.length, 6); assert.deepEqual(readFileSync(join(root, 'layout.html')), fixedBytes);
  assert(purposes.includes('external-accessibility-scan')); assert.equal(purposes.filter(p => p === 'external-accessibility-scan').length, 4);
});
