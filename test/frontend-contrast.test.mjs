import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const calculator = fileURLToPath(new URL('../methods/cyc-design/frontend-design/scripts/contrast.mjs', import.meta.url));
const run = (...colors) => spawnSync(process.execPath, [calculator, ...colors], { encoding: 'utf8', windowsHide: true });

test('ratios just below WCAG thresholds never round into a pass', () => {
  const normal = run('#777773', '#ffffff');
  assert.equal(normal.status, 0);
  assert.match(normal.stdout, /FAIL  normal text: 4\.496:1/);
  assert.match(normal.stdout, /pass  large text/);
  assert.match(run('#959595', '#ffffff').stdout, /FAIL  large text or required non-text cue: 2\.995:1/);
  assert.match(run('#767676', '#ffffff').stdout, /pass  normal text/);
});

test('palette check distinguishes normal and display text on the brand surface', () => {
  const result = run('#f6efe4', '#fff9ef', '#2a1f16', '#6d5d50', '#3b2419', '#c9772b', '#995d25', '#e4d6c3');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /pass  accent display on brand: 4\.239:1/);
  assert.match(result.stdout, /FAIL  normal accent text on brand: 4\.239:1/);
  assert.match(result.stdout, /FAIL  accent display on canvas/);
});

test('unsupported or incomplete colors produce no accessibility verdict', () => {
  for (const args of [['#112233'], ['#11223380', '#ffffff'], ['transparent', '#ffffff']]) {
    const result = run(...args);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /opaque #RRGGBB/);
  }
});
