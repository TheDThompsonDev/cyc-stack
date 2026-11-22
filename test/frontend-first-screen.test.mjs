import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';

const methodDir = fileURLToPath(new URL('../methods/cyc-design/frontend-design/', import.meta.url));
const script = join(methodDir, 'scripts', 'first-screen.mjs');
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', windowsHide: true });

// What the probe returned on 2026-11-21, at 1440x900 and 390x844.
const view = (width, height, actions, pictures, largestPictureShare, records, largestSet, destinations, controls, screens, overflow = 0) =>
  ({ probe: 1, width, height, actions, pictures, largestPictureShare, records, largestSet, destinations, controls, screens, overflow, families: ['sans'] });
const measured = {
  // "Build a website for a neighborhood bicycle repair shop", built without the method.
  bikeControl: { desktop: view(1440, 900, 7, 1, 0.27, 6, 3, 0, 4, 2.3), phone: view(390, 844, 4, 1, 0.25, 3, 3, 0, 4, 3.3) },
  // The same brief built with the method as it stood that morning.
  bikeEarlierMethod: { desktop: view(1440, 900, 7, 1, 0.35, 11, 5, 0, 5, 2.1), phone: view(390, 844, 3, 1, 0.26, 8, 5, 0, 5, 2.6) },
  // "Build a website for a local barbershop", built without the method: one long page, large photograph.
  barberControl: { desktop: view(1440, 900, 9, 3, 0.26, 40, 6, 0, 21, 8.3), phone: view(390, 844, 7, 3, 0.4, 40, 6, 0, 21, 14.1) },
  // The same brief built with the method that counted only things to act on. The owner
  // judged it worse than the control: six working pages and one small photograph.
  barberActionsOnly: { desktop: view(1440, 900, 36, 1, 0.09, 19, 5, 5, 14, 3.6), phone: view(390, 844, 26, 0, 0, 19, 5, 5, 14, 6.8) },
  // Four of the studied sites, by the model each stands for.
  gathering: { desktop: view(1440, 900, 19, 1, 0.29, 22, 16, 7, 5, 6), phone: view(390, 844, 7, 1, 0.3, 22, 16, 7, 5, 9.4) },
  finder: { desktop: view(1440, 900, 43, 22, 0.02, 54, 23, 212, 18, 4.9), phone: view(390, 844, 28, 9, 0.08, 44, 23, 169, 13, 4) },
  workingSurface: { desktop: view(1440, 900, 88, 19, 0.21, 5, 5, 291, 6, 1, 12), phone: view(390, 844, 16, 6, 0.07, 5, 5, 104, 1, 3.5) },
  proofLedService: { desktop: view(1440, 900, 15, 1, 0.86, 48, 5, 20, 38, 8), phone: view(390, 844, 7, 0, 0, 22, 4, 20, 38, 6.9) },
};

function judged(result, ...flags) {
  const dir = mkdtempSync(join(tmpdir(), 'cyc-first-screen-'));
  try {
    const file = join(dir, 'result.json');
    writeFileSync(file, typeof result === 'string' ? result : JSON.stringify(result));
    return run(...flags, file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function methodFiles(dir = methodDir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? methodFiles(path) : [path];
  });
}

test('the two generated bicycle-shop pages are judged brochures', () => {
  for (const name of ['bikeControl', 'bikeEarlierMethod']) {
    const result = judged(measured[name]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /FAIL  desktop: 7 things to act on in the first screen \(floor 12\)/);
    assert.match(result.stdout, /FAIL  desktop: 0 other pages or views linked \(floor 3\)/);
    assert.match(result.stdout, /FAIL  desktop: 2\.[13] screens of content \(floor 3\)/);
    assert.match(result.stdout, /FAIL  phone: [34] things to act on in the first screen \(floor 6\)/);
    assert.match(result.stdout, /By the measure of the studied sites this is a brochure/);
    // Each has one photograph covering over a quarter of the screen, so neither is bare.
    assert.match(result.stdout, /pass  desktop: 1 picture in the first screen, the largest covering (27|35)%/);
    assert.doesNotMatch(result.stdout, /this first screen is bare/);
  }
});

test('the barbershop with six working pages and one small photograph is judged bare', () => {
  const bare = judged(measured.barberActionsOnly);
  assert.equal(bare.status, 0);
  assert.match(bare.stdout, /pass  desktop: 36 things to act on in the first screen \(floor 12\)/);
  assert.match(bare.stdout, /FAIL  desktop: 1 picture in the first screen, the largest covering 9% \(floor 4 pictures, or one covering 25%\)/);
  assert.match(bare.stdout, /note  phone: 0 pictures in the first screen/);
  assert.equal(bare.stdout.match(/^FAIL/gm).length, 1);
  assert.match(bare.stdout, /1 below the floor\. By the measure of the studied sites this first screen is bare/);
  assert.doesNotMatch(bare.stdout, /this is a brochure/);

  // The page built without the method has the photograph and lacks the substance.
  const control = judged(measured.barberControl);
  assert.match(control.stdout, /pass  desktop: 3 pictures in the first screen, the largest covering 26%/);
  assert.match(control.stdout, /FAIL  desktop: 9 things to act on in the first screen \(floor 12\)/);
  assert.match(control.stdout, /FAIL  desktop: 0 other pages or views linked \(floor 3\)/);
  assert.match(control.stdout, /this is a brochure/);
});

test('measured studied sites clear the floor, with many pictures or with one large one', () => {
  for (const name of ['gathering', 'finder', 'workingSurface', 'proofLedService']) {
    const result = judged(measured[name]);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /FAIL/, name);
    assert.match(result.stdout, /At or above the floor\. The floor only catches a brochure or a bare first screen/);
  }
  assert.match(judged(measured.finder).stdout, /pass  desktop: 22 pictures in the first screen, the largest covering 2%/);
  assert.match(judged(measured.gathering).stdout, /pass  desktop: 1 picture in the first screen, the largest covering 29%/);
  // One studied site opens its phone page on text and a button; the phone count is reported, not judged.
  assert.match(judged(measured.proofLedService).stdout, /note  phone: 0 pictures in the first screen/);
  const surface = judged(measured.workingSurface).stdout;
  assert.match(surface, /pass  desktop: working surface: 88 actions in view, so 1 screens of height is not judged/);
  assert.match(surface, /pass  desktop: no sideways scroll/);
  assert.match(surface, /note  desktop: 5 alike items in sets of three or more/);
});

test('a first screen just under a floor fails and one at the floor passes', () => {
  const at = judged(view(1440, 900, 12, 4, 0, 12, 6, 3, 1, 3)).stdout;
  assert.doesNotMatch(at, /FAIL/);
  assert.match(judged(view(1440, 900, 11, 4, 0, 12, 6, 3, 1, 3)).stdout, /FAIL  page: 11 things to act on/);
  assert.match(judged(view(1440, 900, 12, 4, 0, 12, 6, 2, 1, 3)).stdout, /FAIL  page: 2 other pages or views linked/);
  assert.match(judged(view(1440, 900, 12, 4, 0, 12, 6, 3, 1, 2.9)).stdout, /FAIL  page: 2\.9 screens of content/);
  // Pictures: four of any size, or one covering a quarter of the screen.
  assert.match(judged(view(1440, 900, 12, 3, 0.24, 12, 6, 3, 1, 3)).stdout, /FAIL  page: 3 pictures in the first screen, the largest covering 24%/);
  assert.match(judged(view(1440, 900, 12, 1, 0.25, 12, 6, 3, 1, 3)).stdout, /pass  page: 1 picture in the first screen, the largest covering 25%/);
  assert.match(judged(view(1440, 900, 12, 0, 0, 12, 6, 3, 1, 3)).stdout, /FAIL  page: 0 pictures in the first screen \(floor 4 pictures, or one covering 25%\)/);
  // Twice the floor of actions makes a working surface on either view.
  assert.match(judged(view(390, 844, 28, 2, 0.1, 15, 15, 29, 11, 1.4)).stdout, /pass  page: working surface: 28 actions in view, so 1\.4 screens of height is not judged/);
  assert.match(judged(view(390, 844, 12, 2, 0.1, 15, 15, 29, 11, 1.4)).stdout, /pass  page: working surface/);
  assert.match(judged(view(390, 844, 11, 2, 0.1, 15, 15, 29, 11, 1.4)).stdout, /FAIL  page: 1\.4 screens of content/);
  assert.match(judged(view(1440, 900, 23, 4, 0, 15, 15, 29, 11, 2.6)).stdout, /FAIL  page: 2\.6 screens of content/);
  assert.match(judged(view(1440, 900, 24, 4, 0, 15, 15, 29, 11, 2.6)).stdout, /pass  page: working surface/);
  assert.match(judged(view(390, 844, 6, 1, 0.3, 12, 6, 3, 1, 3, 4)).stdout, /FAIL  page: 4 px of sideways scroll/);
  // A phone view on its own is never failed on pictures.
  assert.doesNotMatch(judged(view(390, 844, 6, 0, 0, 12, 6, 3, 1, 3)).stdout, /FAIL/);
});

test('a one-page brief is not judged on other pages but is still judged on its first screen', () => {
  const result = judged(measured.bikeControl, '--one-page');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /note  desktop: 0 other pages linked; not judged for a one-page brief/);
  assert.doesNotMatch(result.stdout, /FAIL  desktop: 0 other pages/);
  assert.match(result.stdout, /FAIL  desktop: 7 things to act on/);
});

test('anything that is not a probe result gets no verdict', () => {
  const desktop = measured.bikeControl.desktop;
  const incomplete = { ...desktop };
  delete incomplete.destinations;
  const noPictures = { ...desktop };
  delete noPictures.pictures;
  for (const input of ['not json', '[]', '{}', 'null', incomplete, noPictures, { ...desktop, actions: -1 },
    { ...desktop, largestPictureShare: '0.27' }, { ...desktop, screens: '2.3' }, { ...desktop, probe: 2 }, { desktop: {} }]) {
    const result = judged(input);
    assert.equal(result.status, 2, JSON.stringify(input));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /No verdict/);
  }
  for (const args of [[], ['--unknown'], ['a.json', 'b.json'], ['--probe', 'extra']]) {
    const result = run(...args);
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.stdout, '');
  }
  const missing = run(join(tmpdir(), 'cyc-first-screen-missing.json'));
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /No verdict/);
});

test('the printed probe is one self-contained expression', () => {
  const result = run('--probe');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^\(function probe\(\) \{/);
  assert.match(result.stdout.trimEnd(), /\}\)\(\)$/);
  assert.doesNotMatch(result.stdout, /\bFLOOR\b|\bimport\b|\brequire\(/);
  // Compiles as a script body without running it.
  assert.doesNotThrow(() => new Function(result.stdout));
  // Measured from the layout viewport: under phone emulation window.innerWidth grew
  // from 390 to 663 with an overflowing page and the overflow read as 0.
  assert.match(result.stdout, /const vw = root\.clientWidth \|\| window\.innerWidth;/);
  assert.match(result.stdout, /overflow: Math\.max\(0, root\.scrollWidth - vw\)/);
  // It returns access measurements, and after focusing each control to read its focused
  // look it removes its style, returns focus and returns the scroll position.
  assert.match(result.stdout, /^    access,$/m);
  assert.match(result.stdout, /^    look,$/m);
  assert.match(result.stdout, /el\.focus\(\{ preventScroll: true \}\);/);
  assert.match(result.stdout, /still\.remove\(\);\s+window\.scrollTo\(scroll\[0\], scroll\[1\]\);/);
  // An indicator may be drawn on a wrapper, a label or a child, so the control is compared
  // with all of them; a pinned bar is never beside what scrolls under it.
  assert.match(result.stdout, /const around = \[el, \.\.\.\(el\.labels \? el\.labels : \[\]\), \.\.\.\[\.\.\.el\.querySelectorAll\('\*'\)\]\.slice\(0, 12\)\];/);
  assert.match(result.stdout, /level < 5; up = up\.parentElement/);
  assert.match(result.stdout, /other\.pin !== target\.pin/);
});

test('the floors written in the method are the floors the judge enforces', async () => {
  const { FLOOR } = await import(new URL('../methods/cyc-design/frontend-design/scripts/first-screen.mjs', import.meta.url));
  const skill = readFileSync(join(methodDir, 'SKILL.md'), 'utf8');
  const row = (label, unit = '') => {
    const found = skill.match(new RegExp(`^\\| ${label} \\| ([\\d.]+)${unit} \\|$`, 'm'));
    assert.ok(found, `no floor row: ${label}`);
    return Number(found[1]);
  };
  assert.equal(row('Things to act on in the first desktop screen'), FLOOR.actions);
  assert.equal(row('Things to act on in the first phone screen'), FLOOR.phoneActions);
  assert.equal(row('Other pages or views linked from the home page'), FLOOR.destinations);
  assert.equal(row('Height of the home page, in screens'), FLOOR.screens);
  assert.equal(row('Pictures in the first desktop screen'), FLOOR.pictures);
  assert.equal(row('Or one picture covering this share of it', '%'), FLOOR.pictureShare * 100);
  // Access floors are WCAG 2.2 AA. The probe runs in the page and cannot read FLOOR, so it
  // carries its own copy; the two must agree with each other and with the method.
  assert.equal(row('Tap target, px each way, unless nothing else is within reach'), FLOOR.targetSize);
  assert.equal(row('Text contrast against its background, to 1'), FLOOR.contrast);
  assert.equal(row('Contrast for text from 24 px, to 1'), FLOOR.largeContrast);
  assert.deepEqual([FLOOR.targetSize, FLOOR.contrast, FLOOR.largeContrast, FLOOR.comfortTarget], [24, 4.5, 3, 44]);
  const { probe } = await import(new URL('../methods/cyc-design/frontend-design/scripts/first-screen.mjs', import.meta.url));
  assert.ok(probe.toString().includes(`const limits = { target: ${FLOOR.targetSize}, contrast: ${FLOOR.contrast}, largeContrast: ${FLOOR.largeContrast}, comfort: ${FLOOR.comfortTarget} };`),
    'the probe measures against different numbers from the floor');
  assert.match(skill, new RegExp(`first screen with twice the floor of things to act on \\(${FLOOR.actions * FLOOR.surfaceFactor} on a desktop, ${FLOOR.phoneActions * FLOOR.surfaceFactor} on a phone\\) is a working surface`));
});

test('no file in the method names a studied site', () => {
  // The owner asked for a skill that presents the practices without the names. The named
  // study is kept for maintainers in docs/maintainers, which is not packaged.
  const names = /Airbnb|Capital ?One|Spotify|Notion|Undersold|American Eagle|Dallas Software|\bDSD\b|\bTarget\b(?! size)|Atlassian|Rep & Plate|\bAHS\b|Cereal VF|Optimist\b|Die Grotesk/;
  const files = methodFiles().filter((path) => /\.(md|mjs)$/.test(path));
  assert.ok(files.length >= 12, 'the method files were not found');
  for (const path of files) {
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, index) => {
      assert.doesNotMatch(line, names, `${relative(methodDir, path)}:${index + 1} names a studied site`);
    });
  }
});

test('the method ships patterns by decision, a look to choose and tells for a bare page', () => {
  const read = (name) => readFileSync(join(methodDir, 'references', `${name}.md`), 'utf8');

  const patterns = read('patterns');
  for (const section of ['First screen', 'Navigation and header', 'Records and cards', 'Results and filters', 'Trust and reassurance',
    'Plans and prices', 'Words', 'Phone']) {
    assert.match(patterns, new RegExp(`^## ${section}$`, 'm'), `no patterns section: ${section}`);
  }
  const entries = patterns.match(/^- \*\*[^*]+\.\*\* .+$/gm) ?? [];
  assert.ok(entries.length >= 45, `only ${entries.length} patterns`);
  for (const entry of entries) {
    assert.match(entry, /\.\*\* Use (when|for|on|with|only|directly|beside|wherever|whenever|to) /, `pattern does not say when to use it: ${entry.slice(0, 60)}`);
    assert.match(entry, / Build /, `pattern does not say what to build: ${entry.slice(0, 60)}`);
  }

  // The look is five choices, made from the subject and written in the sheet.
  const skill = readFileSync(join(methodDir, 'SKILL.md'), 'utf8');
  const sheet = read('decision-sheet');
  for (const choice of ['Canvas', 'Type voice', 'Corners', 'Color source', 'Signature move']) {
    assert.match(skill, new RegExp(`^\\| ${choice} \\|`, 'm'), `the method does not offer a choice of ${choice}`);
    assert.match(sheet, new RegExp(`^${choice}: `, 'm'), `the sheet does not record ${choice}`);
  }
  assert.match(sheet, /^Without this method I would have built: /m);

  // A warm canvas and a serif headline are choices again. One of the owner's models uses both.
  const color = read('color');
  assert.match(color, /^## Canvas$/m);
  for (const canvas of ['White', 'Warm tint', 'Dark']) assert.match(color, new RegExp(`^- \\*\\*${canvas}\\.\\*\\* `, 'm'), canvas);
  const type = read('typography');
  assert.match(type, /^## Voices$/m);
  const voices = type.slice(type.indexOf('## Voices')).match(/^### .+$/gm) ?? [];
  assert.ok(voices.length >= 6, `only ${voices.length} type voices`);
  assert.ok(voices.some((voice) => /serif/i.test(voice)), 'no serif voice');
  assert.doesNotMatch(type, /^## One family$/m);

  const tells = read('generic-tells');
  const section = (from, to) => tells.slice(tells.indexOf(from), tells.indexOf(to));
  const brochure = section('## The brochure', '## The bare page');
  const bare = section('## The bare page', '## The unchosen look');
  const unchosen = section('## The unchosen look', '## The older default page');
  for (const number of [23, 24, 25, 26, 27, 28]) assert.match(brochure, new RegExp(`^${number}\\. `, 'm'));
  for (const number of [34, 35, 36, 37, 38, 39]) assert.match(bare, new RegExp(`^${number}\\. `, 'm'));
  for (const number of [29, 30, 31, 32, 33, 40]) assert.match(unchosen, new RegExp(`^${number}\\. `, 'm'));
  // Neither is a tell alone. Only the pairing that builds without the method chose is, tell 40,
  // and a brand that sets both is exempt.
  for (const line of unchosen.split('\n').filter((text) => /cream|serif/i.test(text))) {
    assert.match(line, /^(40\. |A page can avoid)/, `a warm canvas or a serif face alone is listed as a tell: ${line.slice(0, 60)}`);
  }
});

test('the portable field guide retains the practices in all eight source studies', () => {
  const chapters = [
    ['Banking and comparison', 'public-banking'], ['Stay search', 'stay-marketplace'],
    ['Writing and intake', 'career-writing'], ['Community and events', 'developer-community'],
    ['Workspace and templates', 'workspace-product'], ['Catalog and pickup', 'retail-storefront'],
    ['Apparel and fit', 'apparel-storefront'], ['Subscription and player', 'music-service'],
  ];
  const guide = readFileSync(join(methodDir, 'references', 'field-guide.md'), 'utf8').replace(/\r\n/g, '\n');
  const entries = (section) => [...section.matchAll(/^- \*\*(.+?)\*\* .+$/gm)].map(match => match[1]).sort();
  for (const [heading, file] of chapters) {
    const section = guide.split(`\n## ${heading}\n`)[1]?.split('\n## ')[0];
    assert.ok(section, `missing portable chapter for ${file}`);
    const source = readFileSync(new URL(`../docs/maintainers/${file}-ui-practices.md`, import.meta.url), 'utf8');
    assert.deepEqual(entries(section), entries(source), `coverage differs for ${file}`);
  }
});

const fieldGuide = () => readFileSync(join(methodDir, 'references', 'field-guide.md'), 'utf8').replace(/\r\n/g, '\n');
const guideChapters = ['Banking and comparison', 'Stay search', 'Writing and intake', 'Community and events',
  'Workspace and templates', 'Catalog and pickup', 'Apparel and fit', 'Subscription and player'];

test('a field guide entry shows the practice in its title', () => {
  // The guide was first cut to each study bullet's opening sentence, which is often the
  // setup: "Give search its own row on a phone" kept only where the field sits on a desktop.
  const guide = fieldGuide();
  let checked = 0;
  const desktopOnly = [];
  const firstPerson = [];
  const bold = [];
  for (const heading of guideChapters) {
    const section = guide.split(`\n## ${heading}\n`)[1].split('\n## ')[0];
    for (const [, title, body] of section.matchAll(/^- \*\*(.+?)\*\* (.+)$/gm)) {
      if (/\bI\b/.test(body)) firstPerson.push(`${heading}: ${title}`);
      // Bold inside an observation was used by some chapters only, and costs release bytes.
      if (body.includes('**')) bold.push(`${heading}: ${title}`);
      if (!/phone|narrow screen|mobile|one column/i.test(title)) continue;
      checked += 1;
      if (!/phone|390|narrow|mobile/i.test(body)) desktopOnly.push(`${heading}: ${title}`);
    }
  }
  assert.ok(checked >= 12, `only ${checked} entries about the phone were found`);
  assert.deepEqual(desktopOnly, [], 'an entry about the phone does not describe the phone layout');
  assert.deepEqual(firstPerson, [], 'an entry speaks in the first person');
  assert.deepEqual(bold, [], 'an entry has bold inside its observation');
});

test('the field guide leads with the practices recorded on several sites', () => {
  const guide = fieldGuide();
  const start = guide.indexOf('\n## Seen on several sites\n');
  assert.ok(start > 0, 'no list of practices seen on several sites');
  assert.ok(start < guide.indexOf(`\n## ${guideChapters[0]}\n`), 'the list comes after the chapters');
  const section = guide.slice(start + 1).split('\n## ')[0];
  assert.match(section, /^## Seen on several sites\n/);
  const entries = [...section.matchAll(/^- \*\*(.+?)\*\* (.+)$/gm)];
  assert.ok(entries.length >= 12, `only ${entries.length} practices listed`);
  const firstWords = guideChapters.map((heading) => heading.split(' ')[0]);
  let previous = 8;
  for (const [, title, body] of entries) {
    const all = /^All 8\./.exec(body);
    const some = /^(\d) of 8: ([^.]+)\./.exec(body);
    assert.ok(all || some, `"${title}" gives no count: ${body.slice(0, 40)}`);
    const count = all ? 8 : Number(some[1]);
    assert.ok(count >= 3, `"${title}" was recorded on fewer than three sites`);
    assert.ok(count <= previous, `"${title}" is out of order: ${count} after ${previous}`);
    previous = count;
    if (all) continue;
    const named = some[2].split(', ');
    assert.equal(named.length, count, `"${title}" says ${count} and names ${named.length}`);
    assert.equal(new Set(named).size, named.length, `"${title}" names a chapter twice`);
    for (const name of named) assert.ok(firstWords.includes(name), `"${title}" names an unknown chapter: ${name}`);
  }
  assert.match(guide.slice(0, start), /Seen on several sites/, 'the opening does not send the reader to the list');
});

test('the site models record what was measured and the method links resolve', () => {
  const standards = readFileSync(join(methodDir, 'references', 'reference-standards.md'), 'utf8');
  const table = standards.slice(standards.indexOf('| Model | Actions, desktop'), standards.indexOf('The generated pages'));
  for (const [model, actions, pictures] of [['Finder', 43, 22], ['Store', 25, 8], ['Campaign', 29, 4], ['Front door', 23, 4],
    ['Product showcase', 14, 6], ['Working surface', 88, 19], ['Proof-led service', 15, 1], ['Gathering', 19, 1]]) {
    assert.match(table, new RegExp(`^\\| ${model} \\| ${actions} \\|.*\\| ${pictures} \\|`, 'm'), model);
    assert.match(standards, new RegExp(`^## ${model}$`, 'm'), `no model section for ${model}`);
  }
  for (const file of ['SKILL.md', ...['color', 'craft-rules', 'decision-sheet', 'experience-review', 'generic-tells', 'layout-archetypes',
    'field-guide', 'patterns', 'reference-standards', 'typography', 'ux-foundations', 'visual-material'].map((name) => `references/${name}.md`)]) {
    const text = readFileSync(join(methodDir, file), 'utf8');
    for (const [, target, anchor] of text.matchAll(/\]\((?!https?:)([^)#\s]*)(?:#([^)\s]*))?\)/g)) {
      const path = target ? resolve(dirname(join(methodDir, file)), target) : join(methodDir, file);
      assert.ok(existsSync(path), `${file} links to missing ${target}`);
      if (!anchor || !path.endsWith('.md')) continue;
      const slugs = (readFileSync(path, 'utf8').match(/^#+ .+$/gm) ?? [])
        .map((heading) => heading.replace(/^#+ /, '').toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-'));
      assert.ok(slugs.includes(anchor), `${file} links to missing heading #${anchor} in ${target || file}`);
    }
  }
});

// Access. What the probe returned in headless Edge on 2026-11-21 for the home pages of
// the three sites built with the method, and for a page with one planted defect of each kind.
const clean = { lang: 'en', title: true, images: 5, imagesNoAlt: 0, picturesEmptyAlt: 0, fields: 3, fieldsUnlabelled: 0, named: 47, unnamed: 0,
  targets: 61, smallTargets: 0, underComfort: 0, focusable: 50, focusUnmarked: 0, focusUnread: 0, texts: 184, lowContrast: 0, textOnPictures: 0, examples: {} };
const withAccess = (result, access) => ({ ...result, access: { ...clean, ...access } });
const built = {
  cards: {
    desktop: withAccess(view(1440, 900, 22, 8, 0.68, 11, 4, 5, 3, 3.9), { picturesEmptyAlt: 4, textOnPictures: 34 }),
    phone: withAccess(view(390, 844, 11, 1, 0.46, 11, 4, 5, 3, 5.9), { picturesEmptyAlt: 4, named: 44, targets: 42, focusable: 47, texts: 193, textOnPictures: 21 }),
  },
  dealership: {
    desktop: withAccess(view(1440, 900, 30, 10, 0.03, 24, 6, 5, 33, 4), { images: 19, fields: 13, named: 66, targets: 75, underComfort: 19, focusable: 79, texts: 246, textOnPictures: 14 }),
    phone: withAccess(view(390, 844, 16, 2, 0.13, 24, 6, 5, 33, 6.5), { images: 19, fields: 13, named: 65, targets: 46, underComfort: 4, focusable: 78, texts: 240, textOnPictures: 16 }),
  },
  barbershop: {
    desktop: withAccess(view(1440, 900, 21, 6, 0.31, 26, 12, 4, 3, 3.8), { images: 20, picturesEmptyAlt: 5, named: 40, targets: 40, underComfort: 3, focusable: 43, texts: 138, textOnPictures: 26 }),
    phone: withAccess(view(390, 844, 14, 1, 0.25, 26, 12, 4, 3, 5.2), { images: 20, picturesEmptyAlt: 5, named: 40, targets: 28, underComfort: 3, focusable: 43, texts: 144, textOnPictures: 17 }),
  },
};
// The planted page: no lang, an image with no alt, a field with only a placeholder, an icon
// button with nothing to announce, three 16 px rows packed together, a button whose outline
// is removed and not replaced, and grey text at 2.8:1 and 3:1. On the same page a ring drawn
// on a wrapper, a ring drawn on a label, a shadow that fades in, 16 px rows with room, rows
// under a pinned bar, a link in a sentence and large text at 3.4:1 are all fine. The headline
// on the photograph and the two rows the pinned bar covers are counted as not measured.
const planted = (width, height, screens, rowWidth) => ({
  ...view(width, height, 4, 0, 0, 3, 3, 4, 4, screens),
  access: { lang: '', title: true, images: 4, imagesNoAlt: 1, picturesEmptyAlt: 1, fields: 4, fieldsUnlabelled: 1, named: 14, unnamed: 1, targets: 16,
    smallTargets: 3, underComfort: 2, focusable: 18, focusUnmarked: 1, focusUnread: 0, texts: 20, lowContrast: 2, textOnPictures: 3,
    examples: { imagesNoAlt: ['img “a.svg”'], picturesEmptyAlt: ['img “a.svg”'], fieldsUnlabelled: ['input “Email address”'], unnamed: ['button.icon'],
      smallTargets: [`a “Tight one” ${rowWidth}×16`, `a “Tight two” ${rowWidth}×16`, `a “Tight three” ${rowWidth}×16`], focusUnmarked: ['button.dead “Dead focus”'],
      lowContrast: ['p.faint “Faint grey words on white.” 2.8:1, needs 4.5:1', 'div.panel “Dim words on navy.” 3:1, needs 4.5:1'] } },
});

test('the three sites built with the method have no access failure a script can count', () => {
  for (const name of ['cards', 'dealership', 'barbershop']) {
    const result = judged(built[name]);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /FAIL/, name);
    assert.match(result.stdout, /At or above the floor\. .* The access lines are what a script can count: use the journey by keyboard too\./);
    assert.doesNotMatch(result.stdout, /Access was not measured/);
  }
  const cards = judged(built.cards).stdout;
  assert.match(cards, /pass  desktop: present: language \(en\), title, alt on 5 images, a label on 3 fields, a name on 47 links and buttons/);
  assert.match(cards, /pass  desktop: 61 tap targets, none under 24 px with another target within reach/);
  assert.match(cards, /pass  desktop: 50 controls change when focused/);
  assert.match(cards, /pass  phone: 193 pieces of text meet contrast \(4\.5:1, or 3:1 from 24 px\)/);
  // What it could not judge is said, not passed: the headline on the opening photograph,
  // and photographs a screen reader will skip.
  assert.match(cards, /note  desktop: 34 pieces of text sit on a picture, a gradient or a see-through surface, not measured; check the render/);
  assert.match(cards, /note  desktop: 4 pictures have an empty alt and a screen reader skips them: right for decoration, wrong for a picture of the item/);
  assert.match(judged(built.dealership).stdout, /note  desktop: 19 buttons and fields are under 44 px tall; main buttons are 44 px or more/);
  // Other pages are held to the access lines alone.
  const only = judged(built.barbershop, '--access');
  assert.equal(only.status, 0);
  assert.doesNotMatch(only.stdout, /things to act on|pictures in the first screen|screens of content/);
  assert.match(only.stdout, /pass  phone: 28 tap targets, none under 24 px/);
  assert.match(only.stdout, /No access failure a script can count\. Use the page by keyboard too\./);
});

test('a page with one planted defect of each kind fails on every one, with the element named', () => {
  const result = judged({ desktop: planted(1440, 900, 2.4, 900), phone: planted(390, 844, 2.6, 342) }, '--access');
  assert.equal(result.status, 0);
  const lines = [
    'no page language: set lang on the html element so a screen reader pronounces the words',
    'no alt attribute on 1 of 4 images: img “a.svg”',
    'no label on 1 of 4 fields; a placeholder is not one: input “Email address”',
    'no name to announce on 1 of 14 links and buttons: button.icon',
    '3 of 16 tap targets under 24 px with another target within reach: a “Tight one” 342×16; a “Tight two” 342×16; a “Tight three” 342×16',
    'no visible change on focus for 1 of 18 controls: button.dead “Dead focus”',
    '2 of 20 pieces of text below contrast (4.5:1, or 3:1 from 24 px): p.faint “Faint grey words on white.” 2.8:1, needs 4.5:1; div.panel “Dim words on navy.” 3:1, needs 4.5:1',
  ];
  for (const line of lines) assert.ok(result.stdout.includes(`FAIL  phone: ${line}`), line);
  assert.ok(result.stdout.includes('FAIL  desktop: 3 of 16 tap targets under 24 px with another target within reach: a “Tight one” 900×16'));
  assert.equal(result.stdout.match(/^FAIL/gm).length, 14);
  assert.match(result.stdout, /pass  phone: present: title$/m);
  assert.match(result.stdout, /note  phone: 3 pieces of text sit on a picture, a gradient or a see-through surface, not measured/);
  assert.match(result.stdout, /note  phone: 1 picture has an empty alt and a screen reader skips it/);
  assert.match(result.stdout, /14 below the floor\. By WCAG 2\.2 AA this page shuts some visitors out: repair every access FAIL\. Then measure again\./);
  assert.doesNotMatch(result.stdout, /studied sites/);
  // Judged whole, the same page is also a brochure with a bare first screen, and says all three.
  const whole = judged({ desktop: planted(1440, 900, 2.4, 900), phone: planted(390, 844, 2.6, 342) }).stdout;
  assert.match(whole, /By the measure of the studied sites this is a brochure: .*, and this first screen is bare: .*\. By WCAG 2\.2 AA this page shuts some visitors out/);
});

test('each access count fails by itself, and nothing else does', () => {
  const page = view(1440, 900, 22, 8, 0.68, 11, 4, 5, 3, 3.9);
  const failing = [
    [{ lang: '' }, /FAIL  page: no page language/],
    [{ title: false }, /FAIL  page: no page title/],
    [{ imagesNoAlt: 1 }, /FAIL  page: no alt attribute on 1 of 5 images/],
    [{ fieldsUnlabelled: 2 }, /FAIL  page: no label on 2 of 3 fields/],
    [{ unnamed: 1 }, /FAIL  page: no name to announce on 1 of 47 links and buttons/],
    [{ smallTargets: 1 }, /FAIL  page: 1 of 61 tap targets under 24 px/],
    [{ focusUnmarked: 1 }, /FAIL  page: no visible change on focus for 1 of 50 controls/],
    [{ lowContrast: 1 }, /FAIL  page: 1 of 184 pieces of text below contrast/],
  ];
  for (const [defect, line] of failing) {
    const result = judged(withAccess(page, defect));
    assert.match(result.stdout, line);
    assert.equal(result.stdout.match(/^FAIL/gm).length, 1, JSON.stringify(defect));
    assert.match(result.stdout, /1 below the floor\. By WCAG 2\.2 AA this page shuts some visitors out/);
    assert.doesNotMatch(result.stdout, /brochure|bare/);
  }
  // Reported, never failed: what the script cannot judge.
  for (const report of [{ textOnPictures: 9 }, { picturesEmptyAlt: 3 }, { underComfort: 7 }, { focusUnread: 4 }]) {
    const result = judged(withAccess(page, report)).stdout;
    assert.doesNotMatch(result, /FAIL/, JSON.stringify(report));
    assert.equal(result.match(/^note  page: .*(not measured|empty alt|under 44 px|by hand)/gm).length, 1);
  }
  // A browser that does not show keyboard focus to a script is not read as a page with focus rings.
  assert.match(judged(withAccess(page, { focusUnread: 4 })).stdout, /pass  page: 46 controls change when focused\n.*\nnote  page: 4 controls did not show keyboard focus to the script in this browser; Tab there by hand/s);
});

test('a result saved by the earlier probe still judges, and says access was not measured', () => {
  const earlier = judged(measured.gathering);
  assert.equal(earlier.status, 0);
  assert.doesNotMatch(earlier.stdout, /FAIL/);
  assert.match(earlier.stdout, /note  desktop: access was not measured: this result is from an earlier probe, so print the probe and measure again/);
  assert.match(earlier.stdout, /At or above the floor\. .* Access was not measured\./);
  assert.match(judged(measured.gathering, '--access').stdout, /\nAccess was not measured\.\n$/);
  // Measurements that are present and malformed get no verdict.
  const desktop = measured.gathering.desktop;
  for (const access of [null, {}, { ...clean, smallTargets: -1 }, { ...clean, lang: undefined }, { ...clean, title: 'yes' }, { ...clean, texts: '209' }]) {
    const result = judged({ ...desktop, access });
    assert.equal(result.status, 2, JSON.stringify(access));
    assert.match(result.stderr, /No verdict/);
  }
  // Windows PowerShell's redirection writes a byte-order mark before the JSON.
  assert.equal(judged(`\uFEFF${JSON.stringify(built.cards)}`).status, 0);
});

test('the method tells the builder what the judge counts for access and what stays by hand', () => {
  const read = (name) => readFileSync(join(methodDir, name), 'utf8');
  const skill = read('SKILL.md');
  assert.match(skill, /\*\*everyone can use the page\.\*\*/);
  const step4 = skill.slice(skill.indexOf('## Step 4.'), skill.indexOf('## Step 5.'));
  for (const counted of ['no language or title', 'no alt attribute', 'a field with no label', 'no name', 'under 24 px', 'looks the same focused', 'below contrast']) {
    assert.ok(step4.includes(counted), `Step 4 does not say the judge counts: ${counted}`);
  }
  assert.match(step4, /Repair an access FAIL at its cause/);
  assert.match(step4, /Hiding a control from a screen reader, or from the probe, to shrink a count is the same failure\./);
  const step5 = skill.slice(skill.indexOf('## Step 5.'), skill.indexOf('## Scope'));
  assert.match(step5, /every other page at both widths and judge each result with `--access`/);

  const craft = read('references/craft-rules.md');
  assert.match(craft, /^- Alt text says what the picture shows that the words beside it do not/m);
  assert.match(craft, /An empty alt is for decoration only/);
  assert.match(craft, /^- Every other target, at every width, is at least 24 px each way, or has no other target within 12 px of its centre\./m);
  assert.match(craft, /removing an outline without replacing it fails the judge/);

  const review = read('references/experience-review.md');
  const pass = review.slice(review.indexOf('## Access and comfort pass'), review.indexOf('## Completion evidence'));
  assert.match(pass, /It cannot tell whether an alt describes the picture, whether the tab order makes sense, whether an error is announced, or whether text stays readable on a video, a slideshow or an animation\./);
  assert.match(read('references/decision-sheet.md'), /^Access: <the judge's access lines for each page; /m);
});

// The page the planted fixture above was measured on. The suite opens no browser by
// default, so this runs only when CYC_TEST_PLAYWRIGHT names a Playwright package
// (and CYC_TEST_BROWSER_CHANNEL a channel such as msedge, when no bundled browser is installed).
const plantedSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#777"/></svg>`;
const plantedPage = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Planted access defects</title>
<style>
  body { margin: 0; font: 16px/1.5 Arial, sans-serif; color: #111; background: #fff; }
  /* The first screen holds only the roomy rows and the pinned bar; everything else starts below it. */
  main { padding: calc(100vh + 40px) 24px 24px; max-width: 900px; }
  .sr { position: absolute; left: -9999px; }
  .sr:focus { left: 8px; top: 8px; background: #fff; }
  /* Defect: looks the same focused. */
  .dead:focus, .dead:focus-visible { outline: none; }
  /* Fine: the ring is on the wrapper. */
  .field { display: inline-block; border: 2px solid #333; padding: 6px; }
  .field select { outline: none; border: 0; font: inherit; height: 32px; }
  .field:focus-within { outline: 3px solid #005fcc; }
  /* Fine: the ring is on the label of a hidden radio. */
  .opt { display: inline-block; border: 2px solid #333; padding: 12px 16px; }
  .opt input { position: absolute; opacity: 0; }
  .opt:has(input:focus-visible) { outline: 3px solid #005fcc; }
  /* Fine: only a transitioned shadow marks focus. */
  .slow { transition: box-shadow 250ms; outline: none; padding: 12px 16px; }
  .slow:focus-visible { box-shadow: 0 0 0 3px #005fcc; }
  .tight a { display: block; font-size: 12px; line-height: 16px; }
  .roomy a { display: block; font-size: 12px; line-height: 16px; margin-bottom: 16px; }
  .faint { color: #999; }
  .faint-large { color: #8a8a8a; font-size: 28px; }
  .panel { background: #1d3557; color: #6b7fa3; padding: 12px; }
  .hero { position: relative; height: 240px; }
  .hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .hero h2 { position: relative; color: #fff; margin: 0; padding: 24px; }
  .hero .card { position: relative; display: inline-block; background: #fff; color: #111; padding: 12px; margin-left: 24px; }
  .icon { width: 44px; height: 44px; }
</style>
</head>
<body>
<a class="sr" href="#main">Skip to main content</a>
<main id="main">
  <h1>Planted defects</h1>

  <!-- images: one without alt (defect), one large with empty alt (note), one named -->
  <img src="a.svg" width="120" height="120">
  <img src="a.svg" width="120" height="120" alt="">
  <img src="a.svg" width="120" height="120" alt="A grey square">

  <!-- fields: placeholder only (defect), labelled (fine) -->
  <p><input type="text" placeholder="Email address" style="height:44px"></p>
  <p><label for="n">Name</label> <input id="n" type="text" style="height:44px"></p>

  <!-- names: icon button with nothing to announce (defect), one with aria-label (fine) -->
  <p>
    <button class="icon"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg></button>
    <button class="icon" aria-label="Save" style="margin-left:24px"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg></button>
  </p>

  <!-- targets: three 16 px rows packed (defect x3), three 16 px rows with room (fine), a link in a sentence (exempt) -->
  <div class="tight"><a href="one.html">Tight one</a><a href="two.html">Tight two</a><a href="three.html">Tight three</a></div>
  <!-- the roomy rows sit under a pinned bottom bar at the top of the page; the bar slides over them and must not count as beside them -->
  <div class="roomy" style="position:absolute; top:calc(100vh - 64px); left:24px; width:200px"><a href="one.html">Roomy one</a><a href="two.html">Roomy two</a><a href="three.html">Roomy three</a></div>
  <nav style="position:fixed; left:0; right:0; bottom:0; height:64px; background:#fff; border-top:1px solid #333"><a href="one.html" style="display:inline-block; height:48px; width:120px">Cars</a><a href="two.html" style="display:inline-block; height:48px; width:120px">Call</a></nav>
  <p style="font-size:12px;line-height:16px">Questions? Write to <a href="mail.html">the shop</a> any day of the week.</p>

  <!-- focus: one dead (defect), wrapper ring, label ring and slow shadow (all fine) -->
  <p><button class="dead" style="height:44px">Dead focus</button></p>
  <p><span class="field"><label for="s">Service</label> <select id="s"><option>Skin fade</option><option>Buzz cut</option></select></span></p>
  <p><label class="opt"><input type="radio" name="slot" value="10"> 10:00 am</label></p>
  <p><button class="slow">Slow shadow</button></p>

  <!-- contrast: faint body text (defect), faint large text 3.4:1 (fine), faint on a dark panel (defect) -->
  <p class="faint">Faint grey words on white.</p>
  <p class="faint-large">Large grey words</p>
  <div class="panel">Dim words on navy.</div>

  <!-- on a picture: headline not measured; the card on the picture is measured -->
  <div class="hero"><img src="a.svg" alt="A grey square as a stand-in photograph"><h2>Headline on the photograph</h2><div class="card">Words on a solid card</div></div>
</main>
</body>
</html>
`;

test('in a real browser the probe finds each planted defect and leaves the page as it found it', {
  skip: process.env.CYC_TEST_PLAYWRIGHT ? false : 'set CYC_TEST_PLAYWRIGHT to a Playwright package to run',
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.CYC_TEST_PLAYWRIGHT);
  const { probe } = await import(new URL('../methods/cyc-design/frontend-design/scripts/first-screen.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'cyc-first-screen-page-'));
  writeFileSync(join(dir, 'defects.html'), plantedPage);
  writeFileSync(join(dir, 'a.svg'), plantedSvg);
  const browser = await chromium.launch({ channel: process.env.CYC_TEST_BROWSER_CHANNEL || undefined, headless: true });
  try {
    for (const [width, height, screens, rowWidth] of [[1440, 900, 2.4, 900], [390, 844, 2.6, 342]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      const page = await context.newPage();
      await page.goto(pathToFileURL(join(dir, 'defects.html')).href, { waitUntil: 'load' });
      const state = () => page.evaluate(() => [window.scrollY, document.activeElement === document.body, document.head.querySelectorAll('style').length]);
      const before = await state();
      const result = await page.evaluate(probe);
      assert.deepEqual(await state(), before, 'the probe left focus, scroll or its style behind');
      const expected = planted(width, height, screens, rowWidth);
      const { photoText, pixelRatio, pageHeight, textCovered, ...counts } = result.access;
      assert.deepEqual(counts, expected.access, `at ${width} wide`);
      assert.equal(textCovered, 0);
      assert.equal(pixelRatio, 1);
      assert.equal(photoText.length, expected.access.textOnPictures);
      assert.ok(photoText.some((text) => /Headline on the photograph/.test(text.tell) && text.need === 3 && text.ink.join() === '255,255,255,1'));
      assert.ok(pageHeight > height);
      assert.equal(result.screens, expected.screens);
      await context.close();
    }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// Text on a photograph, measured from two screenshots: one with every letter painted
// magenta, one with every letter hidden. These build both screenshots in the test.
const encodePng = (width, height, paint) => {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) raw.set(paint(x, y), y * (width * 3 + 1) + 1 + x * 3);
  }
  const chunk = (kind, body) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(kind, 'latin1'), body]);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};
const inRect = (x, y, [left, top, wide, tall]) => x >= left && x < left + wide && y >= top && y < top + tall;
// A page 200 CSS px wide: white on the left half, black on the right, and one grey square
// that only the hidden screenshot shows, as if an image loaded between the two.
const photoTexts = [
  { tell: 'p.on-black', ink: [255, 255, 255, 1], need: 4.5, rects: [[110, 10, 60, 16]] },
  { tell: 'p.on-white', ink: [255, 255, 255, 1], need: 4.5, rects: [[10, 10, 60, 16]] },
  { tell: 'h2.mostly-black', ink: [255, 255, 255, 1], need: 3, rects: [[96, 40, 80, 20]] },
  { tell: 'h2.half', ink: [255, 255, 255, 1], need: 3, rects: [[60, 70, 80, 20]] },
  { tell: 'span.unseen', ink: [255, 255, 255, 1], need: 4.5, rects: [[20, 96, 40, 10]] },
  { tell: 'span.outside', ink: [255, 255, 255, 1], need: 4.5, rects: [[20, 200, 40, 10]] },
  { tell: 'span.changed', ink: [255, 255, 255, 1], need: 4.5, rects: [[150, 94, 40, 20]] },
];
const lettered = photoTexts.filter((text) => !/unseen|outside/.test(text.tell));
const scene = (scale, texts = photoTexts) => {
  const css = (x, y) => [Math.floor(x / scale), Math.floor(y / scale)];
  const back = (x, y) => (x < 100 ? [255, 255, 255] : [0, 0, 0]);
  const hidden = encodePng(200 * scale, 120 * scale, (x, y) => {
    const [cx, cy] = css(x, y);
    return inRect(cx, cy, [150, 94, 40, 20]) && texts.some((text) => text.tell === 'span.changed') ? [128, 128, 128] : back(cx, cy);
  });
  // Letters are vertical strokes two CSS px wide every four, inside each line.
  const marked = encodePng(200 * scale, 120 * scale, (x, y) => {
    const [cx, cy] = css(x, y);
    const letter = lettered.some((text) => texts.includes(text) && text.rects.some((rect) => inRect(cx, cy, rect)) && cx % 4 < 2);
    return letter ? [255, 0, 255] : back(cx, cy);
  });
  return { hidden, marked };
};
const photoResult = (texts = photoTexts, extra = {}) => ({
  ...view(200, 120, 12, 1, 0.5, 3, 3, 3, 1, 3),
  access: { ...clean, textOnPictures: texts.length, photoText: texts, pixelRatio: 1, pageHeight: 120, ...extra },
});
function judgedWithShots(result, shots, ...flags) {
  const dir = mkdtempSync(join(tmpdir(), 'cyc-photo-text-'));
  try {
    const file = join(dir, 'result.json');
    writeFileSync(file, JSON.stringify(result));
    const args = [];
    for (const [name, pair] of Object.entries(shots)) {
      for (const [kind, bytes] of Object.entries(pair)) {
        const path = join(dir, name + '-' + kind + '.png');
        writeFileSync(path, bytes);
        args.push('--' + kind, name === 'page' ? path : name + '=' + path);
      }
    }
    return run(...flags, ...args, file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('text on a photograph is measured behind its letters, and what cannot be measured is said', () => {
  const result = judgedWithShots(photoResult(), { page: scene(1) }, '--access');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('FAIL  page: 2 of 4 pieces of text on a picture below contrast (4.5:1, or 3:1 from 24 px, behind 90% of the letters):'
    + ' p.on-white 1:1, needs 4.5:1; h2.half 1:1, needs 3:1'), result.stdout);
  // White letters over black pass, and so do letters with 5 percent of them over white.
  assert.doesNotMatch(result.stdout, /p\.on-black|h2\.mostly-black/);
  assert.match(result.stdout, /note  page: text on a picture not measured: 1 outside the screenshots, 1 whose letters do not show in them, 1 where the page changed between the two screenshots; check the render/);
  assert.match(result.stdout, /By WCAG 2\.2 AA this page shuts some visitors out/);
  // The same page at a pixel ratio of 2 gets the same verdict.
  const sharp = judgedWithShots({ ...photoResult(), access: { ...photoResult().access, pixelRatio: 2 } }, { page: scene(2) }, '--access');
  assert.ok(sharp.stdout.includes('FAIL  page: 2 of 4 pieces of text on a picture below contrast'), sharp.stdout);
  // Only readable text: a pass line, with the rule.
  const readable = [photoTexts[0], photoTexts[2]];
  const passing = judgedWithShots(photoResult(readable), { page: scene(1, readable) }, '--access');
  assert.match(passing.stdout, /pass  page: 2 pieces of text on a picture meet contrast \(4\.5:1, or 3:1 from 24 px, behind 90% of the letters\)/);
  assert.doesNotMatch(passing.stdout, /FAIL/);
});

test('a page that grew after the probe is measured in its first screen only', () => {
  const texts = [photoTexts[0], { ...photoTexts[1], tell: 'p.further-down', rects: [[10, 300, 60, 16]] }];
  const tall = (marked) => encodePng(200, 400, (x, y) => (marked && ((inRect(x, y, [110, 10, 60, 16]) || inRect(x, y, [10, 300, 60, 16])) && x % 4 < 2)
    ? [255, 0, 255] : [0, 0, 0]));
  const result = judgedWithShots(photoResult(texts, { pageHeight: 300 }), { page: { hidden: tall(false), marked: tall(true) } }, '--access');
  assert.match(result.stdout, /pass  page: 1 piece of text on a picture meets contrast/);
  assert.match(result.stdout, /note  page: text on a picture not measured: 1 below the first screen, where the page moved after the probe; check the render/);
  // A live page may change height between the two shots: the first screen is still measured.
  const shorter = encodePng(200, 380, () => [0, 0, 0]);
  const changed = judgedWithShots(photoResult(texts, { pageHeight: 400 }), { page: { hidden: tall(false), marked: Buffer.concat([shorter]) } }, '--access');
  assert.equal(changed.status, 0, changed.stderr);
  assert.match(changed.stdout, /note  page: text on a picture not measured: .*1 below the first screen, where the page moved after the probe/);
});

test('screenshots that cannot be measured get no verdict, and a result without places for text is said', () => {
  const both = scene(1);
  const refused = [
    [{ page: { hidden: both.hidden } }, /No verdict: the view has a hidden screenshot and no marked one/],
    [{ page: { marked: both.marked, hidden: encodePng(300, 120, () => [0, 0, 0]) } }, /No verdict: the two screenshots differ in size/],
    [{ page: { marked: encodePng(300, 120, () => [0, 0, 0]), hidden: encodePng(300, 120, () => [0, 0, 0]) } }, /No verdict: the screenshots are 300 px wide, and this view is 200 CSS px at a pixel ratio of 1/],
    [{ page: { marked: Buffer.from('not a picture'), hidden: both.hidden } }, /No verdict: .*marked\.png: not a PNG file\./],
    [{ desktop: both }, /No verdict: a screenshot is named desktop, and this result has one view/],
  ];
  const sixteen = Buffer.from(both.hidden);
  sixteen[24] = 16;
  refused.push([{ page: { marked: both.marked, hidden: sixteen } }, /No verdict: .*the PNG must be 8-bit grey or colour and not interlaced/]);
  for (const [shots, message] of refused) {
    const result = judgedWithShots(photoResult(), shots);
    assert.equal(result.status, 2, message.source);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, message);
  }
  // A page that scrolls sideways gives a full-page screenshot as wide as the page.
  const wide = (marked) => encodePng(300, 120, (x, y) => (marked && inRect(x, y, [110, 10, 60, 16]) && x % 4 < 2 ? [255, 0, 255] : [0, 0, 0]));
  const sideways = judgedWithShots({ ...photoResult([photoTexts[0]]), overflow: 100 }, { page: { marked: wide(true), hidden: wide(false) } }, '--access');
  assert.equal(sideways.status, 0, sideways.stderr);
  assert.match(sideways.stdout, /pass  page: 1 piece of text on a picture meets contrast/);
  // With no screenshots, text on a picture is a note that says how to measure it.
  const plain = judged(photoResult()).stdout;
  assert.match(plain, /note  page: 7 pieces of text sit on a picture, a gradient or a see-through surface, not measured; check the render, or measure it with a --marked and a --hidden screenshot/);
  // A result from an earlier probe has no places for text, so its screenshots are not used.
  const earlier = { ...photoResult() };
  delete earlier.access.photoText;
  assert.match(judgedWithShots(earlier, { page: both }).stdout, /note  page: the screenshots were not used: this result has no places for text, so print the probe and measure again/);
  assert.match(judgedWithShots(measured.gathering, { desktop: both }).stdout, /note  desktop: the screenshots were not used/);
  // Places for text that are malformed get no verdict.
  for (const photoText of [[{ tell: 'p', ink: [255, 255, 255], need: 4.5, rects: [[0, 0, 1, 1]] }], [{ tell: 'p', ink: [0, 0, 0, 1], need: 4.5, rects: [] }], 'p']) {
    assert.equal(judged({ ...photoResult(), access: { ...photoResult().access, photoText } }).status, 2, JSON.stringify(photoText));
  }
});

test('the PNG reader decodes a screenshot Edge wrote exactly as an independent decoder does', async () => {
  const { readPng } = await import(new URL('../methods/cyc-design/frontend-design/scripts/photo-text.mjs', import.meta.url));
  // 64 × 32 px from headless Edge: red, a black-to-white gradient and a radial gradient,
  // so its rows use several PNG filters. PIL decoded the same file to the hash below.
  const shot = readPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAF40lEQVR4nMRYaXfbNhDEDYKUZCfp8Yf7c5tYkiUSNzoLykqcvH6o8hry0TINgDJmZ/bAqsb+22W0nqZpHMf753p9O3If/+7h2/V//sWffDmEsg91imWK1aU65GZK06XJ2gT+WWP4lTnPkgfJvRKL5rORFyNerThbeR6kYg9dnPP1c334t/H77I/rf5/zs68Hnw+h7gIBGDsAm+t7ADxzllYAWsxaXE0brXBZDqWZyh4E0FpbP9eHB8Y/XfOHpbyRUHYA0EmwIKE2WW4AqmCF86gIwNIBXCyWiSFVk6Uq7XEG7tdj47/NBQCefX7yde/zPtaVBDAAFamvAHgWLErhFQG4GjHl5rKwUBpwtp9g4H49Nv5xTh8BYAaGcug87FYVAcMKoHNWOYd+IjnATf1gySRBC0rjDwN4gAH23gew+09EwpuQfPfmBHkUqEjfAJCEkuAB7qv4qn6SfpGqMSzAt/06Bth7H4DtP8z5I27wsJCQVhJcLIyXJEvlWNpMFlORnKlZ84sBP2IVWJ9kjbPNfOA5lA++fPTl0wIk9AwSkoxnF7xOAFB4xTLZhC5yyNpF88fV2iJ1wyCMj91zQPt/GbjP/rj+AOWQD2TsHjwcQj7b+XXwV00AosxFAADcVCLaDNlMyu5jep6dqBpfUhjyA5ybb5YHDpEc9zlUcuKQj+P1OMznYbkYv5gYZCrIBfDRJm1WLhmixZOuPiwTQhNmo6pe183ywC5UhP+9Jw8+DzN2/+KuJzef7XI1wauUZYHKVSX9TNEGkVZRicYPy4S0MCMuabGZDyBiTqnBa6H7V+the+z+Zbyehhl/LjrCDbAMDgDzh5CgKLwLlzBF2ax3UV5Txb1ZHkC8R8DBfXIBuodyYPujBQ+X0wASfESsYagsyPwJMb+hvhAmqyHBofXzYoYo7MMAHmCAvfcBZCvciJhBJ28SdA/lXAaiAjxAVBA9sML80aOcY7pKV8ySrI8p6Nx8Hfo3bJYHVA/n0Amsi5gDr4XuoRyiYpg/j5eLDXhjFxxlg6JcMIscvKQAFUVOMquiVd2uFpIU4xmiCsRNt2wILMAD5cD22P3n6RVYOeMTSFA5K6yhlZXuhltSQmCb5YH+0NPp99O3mXXq7U/W7iPrEH44jW2WBxDLEVZMFQgsyFaI9xo5qypbtMtmHx2/olRj+zC4rCEhTMENVF+PxSAgC47TwmZ5ACUayswpSp0p15qkLMJLMlOwUDksjGdYHLs/eIfBIWosQBQCGMRWXcRF8yT4Zj6QFNWYKMaGbvIRxQKyVUjwaSzBLgGDUbBSGH8K4yG6XbJjsgCG1IYXoxZRic3ywNJT6VVzVGmjsjuVKNcKlA+opYXT5pbIED2j2QcHHvaL2wU7RoMRFKd4HTX2ZnkAp5PZtKupqDH3MSdVbrm2CsR7KiUAhuHYJaEc2H7v3ZMfD2EEGFPtcZT9G8RmeQBnKzqdJGGzePbuXjxD5TO0pFKvRlELYUSPycD22P3TMoKK4yDORqIxcTHb1UKvg1xTaa/vcUCb1jrHJb30croSAwRA06AZ34T0Ouijk2dHPZVXKzfLAycrEH/QfeAk+1Y4O/iRKueog8odAI33A42C1wKAKeY4SOz+i5MveLDiZLfrC52conMtDbJe3wsEJdSYz942hqNZrpQGUDwDgOhHSnEc0c+Sp4F2/zIquMHJyc3ywJdB8p5iK7+drSgoRepKDDizFy37G4j0iPexl/4zNeQkGnJfeXByMx+ACfGMUznOtdR40xX7IwDoC+Wmes8HF7VV0BfqXQksuHTfBQnEg1Mvo9wsD3we5c32gnt03VQdNR9ts2tfqH7tC6FkuPWFemPr0kk4dRKOv5IB9t4HvoyKum4wvxLU9DRoLaLj2W6dufrWFyIA1Bv1fRkS39UAgDgPKwa1WR74e1TQN5lfVdoWNUZ7123tjX4FwEqvmvxbc5c8ATcA2J9w4p/3gb93GraHuH2spI301l5Hd5oAsLuECjEgomS9vd5V9I2Q/gEAAP//H5IWqQAAAAZJREFUAwBdBCwl+jmrJAAAAABJRU5ErkJggg==', 'base64'));
  assert.deepEqual([shot.width, shot.height, shot.channels], [64, 32, 3]);
  const rgb = Buffer.alloc(64 * 32 * 3);
  for (let at = 0; at < 64 * 32; at += 1) shot.pixels.copy(rgb, at * 3, at * shot.channels, at * shot.channels + 3);
  assert.equal(createHash('sha256').update(rgb).digest('hex'), 'd40c3a1d7edebba5981c4414ca212be82b1880016ef1b8581b548ed49c2c0a66');
  assert.deepEqual([...shot.pixels.subarray(0, 3)], [255, 0, 0]);
});

test('the mark and hide expressions are self-contained and change no layout', () => {
  for (const flag of ['--mark-text', '--hide-text']) {
    const result = run(flag);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^\(async function (markText|hideText)\(\) \{/);
    assert.doesNotMatch(result.stdout, /\bFLOOR\b|\bimport\b|\brequire\(/);
    assert.doesNotThrow(() => new Function(result.stdout));
    // Colour only: nothing that sizes or places a box.
    assert.doesNotMatch(result.stdout, /(width|height|margin|padding|display|position|font-size|line-height|letter-spacing)\s*:/);
    assert.match(result.stdout, /image\.loading = 'eager'/);
    assert.match(result.stdout, /addEventListener\('load'/);
  }
  assert.match(run('--mark-text').stdout, /color: #ff00ff !important/);
  assert.match(run('--hide-text').stdout, /color: transparent !important/);
});

test('the method tells the builder how to measure text on a photograph and how to fix it', async () => {
  const { FLOOR } = await import(new URL('../methods/cyc-design/frontend-design/scripts/first-screen.mjs', import.meta.url));
  const read = (name) => readFileSync(join(methodDir, name), 'utf8');
  const skill = read('SKILL.md');
  const row = skill.match(/^\| Text on a photograph: share of its letters that must meet contrast \| (\d+)% \|$/m);
  assert.ok(row, 'no floor row for text on a photograph');
  assert.equal(Number(row[1]) / 100, FLOOR.photoCover);
  const step4 = skill.slice(skill.indexOf('## Step 4.'), skill.indexOf('## Step 5.'));
  for (const piece of ['--mark-text', '--hide-text', '--marked desktop=', '--hidden desktop=', 'full-page screenshot']) {
    assert.ok(step4.includes(piece), 'Step 4 does not say: ' + piece);
  }
  const visual = read('references/visual-material.md');
  const opening = visual.slice(visual.indexOf('## The opening photograph'), visual.indexOf('## The density rule'));
  assert.match(opening, /solid panel/);
  assert.match(opening, /scrim/);
  assert.match(opening, /the judge measures/i);
  const review = read('references/experience-review.md');
  assert.match(review, /It cannot tell whether an alt describes the picture, whether the tab order makes sense, whether an error is announced, or whether text stays readable on a video, a slideshow or an animation\./);
});

// The look. Built from one-line briefs without the method, the card shop, the dealership and
// the barbershop sat on a cream --paper canvas (#f5f0e6, #f6f3ee, #f4eee3); the card shop and
// the barbershop set their headlines in Fraunces. The card shop built with the method chose
// ivory #f4efe4 and Instrument Serif while its builder guessed its default was a dark page.
const looked = (canvas, family, extra = {}) => ({
  backgrounds: [[canvas, 0.82], ['#1b1712', 0.1], ['picture', 0.08]], headline: { family, size: 64, text: 'Decks worth keeping' }, ...extra,
});
const lookPage = (look) => ({ ...withAccess(view(1440, 900, 22, 8, 0.68, 11, 4, 5, 3, 3.9), {}), ...(look === undefined ? {} : { look }) });

test('the look builds without the method chose fails, and a different canvas, type voice or a brand clears it', () => {
  for (const [canvas, family, name] of [['#f5f0e6', 'Fraunces, Georgia, serif', 'Fraunces'], ['#f4eee3', '"Fraunces", serif', 'Fraunces'],
    ['#f4efe4', '"Instrument Serif", Georgia, serif', 'Instrument Serif']]) {
    const result = judged(lookPage(looked(canvas, family)));
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes(`FAIL  page: the look builds without this method chose: 82% of the text on a warm tint (${canvas} most)`
      + ` and a serif headline, “Decks worth keeping” in ${name}; change the canvas or the type voice, or judge with --brand when an existing brand sets both`),
    result.stdout);
    assert.equal(result.stdout.match(/^FAIL/gm).length, 1);
    assert.match(result.stdout, /1 below the floor\. This is the look a builder reaches for without the method: change the canvas or the type voice \(Step 3\)\. Then measure again\./);
    assert.doesNotMatch(result.stdout, /brochure|bare|shuts some visitors out/);
    // An existing brand that sets both is recorded, not failed.
    const brand = judged(lookPage(looked(canvas, family)), '--brand').stdout;
    assert.doesNotMatch(brand, /FAIL/);
    assert.match(brand, /note  page: 82% of the text on a warm tint .* and a serif headline, the look builds without this method chose; not judged, because --brand says an existing brand sets them/);
  }
  // The card shop built with the method spread its text over four creams, the largest holding
  // 39 percent; together they outweigh the white card.
  const spread = { backgrounds: [['#ffffff', 0.27], ['#f4efe4', 0.39], ['#fbf8f1', 0.15], ['#ebe4d5', 0.11], ['picture', 0.08]],
    headline: { family: '"Instrument Serif", Georgia, serif', size: 64, text: 'Old decks' } };
  assert.match(judged(lookPage(spread)).stdout, /FAIL  page: the look builds without this method chose: 65% of the text on a warm tint \(#f4efe4 most\)/);
  // The dealership built without the method set its page on cream and its text mostly on white
  // cards and dark bands: that page reads white.
  const cards = { backgrounds: [['#ffffff', 0.46], ['#0e1820', 0.32], ['#f6f3ee', 0.17], ['#c2410c', 0.04]], headline: { family: 'Fraunces, serif', size: 67, text: 'Straight answers.' } };
  assert.match(judged(lookPage(cards)).stdout, /pass  page: 46% of the text on white or a neutral light surface \(#ffffff most\), headline “Straight answers\.” in Fraunces/);
  // Change either one and the page passes: white or dark under a serif, or cream under a sans.
  for (const [canvas, family] of [['#ffffff', 'Fraunces, Georgia, serif'], ['#111318', '"Instrument Serif", serif'], ['#f6f3ee', 'Archivo, system-ui, sans-serif'],
    ['#f9f9f8', 'Fraunces, serif'], ['#f4f4f1', '"Barlow Condensed", sans-serif']]) {
    const result = judged(lookPage(looked(canvas, family))).stdout;
    assert.doesNotMatch(result, /FAIL/, `${canvas} ${family}`);
    assert.match(result, new RegExp(`pass  page: \\d+% of the text on .+ \\(${canvas} most\\), headline “Decks worth keeping” in .+; not the cream canvas with a serif headline that builds without this method chose`));
  }
  // Judged once, on the desktop view.
  const both = judged({ desktop: lookPage(looked('#f5f0e6', 'Fraunces, serif')), phone: { ...lookPage(looked('#f5f0e6', 'Fraunces, serif')), width: 390, height: 844 } }).stdout;
  assert.equal(both.match(/look builds without this method chose/g).length, 1);
  assert.match(both, /FAIL  desktop: the look builds/);
  // A result from the earlier probe, or a first screen with no text, says so and is not failed.
  const earlier = judged(lookPage()).stdout;
  assert.doesNotMatch(earlier, /FAIL/);
  assert.match(earlier, /note  page: the canvas and the headline were not recorded: this result is from an earlier probe, so print the probe and run it again/);
  assert.match(judged(lookPage(looked('#f5f0e6', 'x', { headline: null }))).stdout, /note  page: 82% of the text on a warm tint \(#f5f0e6 most\); no text in the first screen to read as a headline/);
  assert.match(judged(lookPage({ backgrounds: [], headline: null })).stdout, /note  page: no text on the page to read the canvas from/);
  // A look that is present and malformed gets no verdict.
  for (const look of [null, {}, looked('cream', 'Fraunces'), looked('#f5f0e6', 'Fraunces', { backgrounds: [['#f5f0e6', 2]] }),
    looked('#f5f0e6', 'Fraunces', { backgrounds: '#f5f0e6' }), looked('#f5f0e6', 'Fraunces', { backgrounds: Array(9).fill(['#ffffff', 0.1]) }),
    looked('#f5f0e6', 'Fraunces', { headline: { family: 3, size: 64, text: 'x' } }),
    looked('#f5f0e6', 'Fraunces', { headline: { family: 'Fraunces', size: 0, text: 'x' } })]) {
    const result = judged(lookPage(look));
    assert.equal(result.status, 2, JSON.stringify(look));
    assert.match(result.stderr, /No verdict/);
  }
});

test('a serif is told by the family name or the generic family, and a warm tint by its colour', async () => {
  const { serifFamily, warmTint } = await import(new URL('../methods/cyc-design/frontend-design/scripts/first-screen.mjs', import.meta.url));
  for (const family of ['Fraunces, Georgia, serif', '"Instrument Serif", serif', 'Georgia', '"DM Serif Display", serif', 'Newsreader, serif',
    '"Playfair Display"', '"Cormorant Garamond", serif', 'Lora', '"Source Serif 4", serif', 'MadeUpFace, Georgia, serif', 'serif']) {
    assert.equal(serifFamily(family), true, family);
  }
  for (const family of ['"Instrument Sans", sans-serif', 'Archivo, system-ui, sans-serif', '"IBM Plex Sans"', '"Barlow Condensed", sans-serif',
    '"Noto Sans", serif', '"Space Grotesk", sans-serif', 'MadeUpFace', 'sans-serif', '"IBM Plex Mono", monospace', '']) {
    assert.equal(serifFamily(family), false, family);
  }
  // color.md names #fbfaf7 and #f8f5ee as warm tints; the greys beside them are not.
  for (const hex of ['#f5f0e6', '#f6f3ee', '#f4eee3', '#f4efe4', '#f8f5ee', '#fbfaf7', '#fdf6e3']) assert.equal(warmTint(hex), true, hex);
  for (const hex of ['#ffffff', '#f9f9f8', '#f6f5f4', '#f4f4f1', '#f7f7f7', '#f2f4f7', '#111318', '#7c2d12', '#123d30']) assert.equal(warmTint(hex), false, hex);
});

test('the method names the look builds without it chose and has the builder move off it', () => {
  const read = (name) => readFileSync(join(methodDir, name), 'utf8');
  const skill = read('SKILL.md');
  const step3 = skill.slice(skill.indexOf('## Step 3.'), skill.indexOf('## Step 4.'));
  for (const piece of ['three of three', '#f4eee3', 'Fraunces', 'dark page with gold', '--brand']) assert.ok(step3.includes(piece), 'Step 3 does not say: ' + piece);
  assert.match(skill.slice(skill.indexOf('## Step 4.'), skill.indexOf('## Step 5.')), /--brand/);
  const tells = read('references/generic-tells.md');
  const unchosen = tells.slice(tells.indexOf('## The unchosen look'), tells.indexOf('## The older default page'));
  assert.match(unchosen, /^40\. .*warm tint.*serif headline.*brand/m);
  assert.match(tells, /Check: fail for any of 21, 23 to 28, 34, 39, 40, or count >= 3/);
  assert.match(tells, /^\| 40 Unguided look \| /m);
  const sheet = read('references/decision-sheet.md');
  assert.match(sheet, /^Against the unguided look: /m);
  assert.equal(sheet.match(/^Against the unguided look: /gm).length, 2, 'the template and the example each record it');
  assert.match(read('references/color.md'), /Warm tint\.\*\* .*with a serif headline/);
  assert.match(read('references/typography.md'), /### Editorial serif[\s\S]*?warm tint/);
});

// A hero to measure in a real browser: white text on a light photograph fails; the same
// text over a dark scrim, on a solid panel, or rotated on a dark photograph does not.
const photoPage = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Photo text</title><style>'
  + 'body{margin:0;font:16px/1.5 Arial,sans-serif;background:#fff}'
  + '.hero{position:relative;height:320px;overflow:hidden}'
  + '.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}'
  + '.hero h2{position:relative;margin:0;padding:40px;color:#fff;font-size:40px}'
  + '.scrim::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.72)}'
  + '.scrim h2{z-index:1}'
  + '.panel{position:relative;display:inline-block;margin:0 40px;padding:12px;background:#1d3557;color:#fff}'
  + '.tilt{position:relative;display:inline-block;margin:40px;color:#fff;font-size:28px;font-weight:700;transform:rotate(-12deg)}'
  + '</style></head><body>'
  + '<section class="hero"><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23e8e2d0%22/%3E%3C/svg%3E" alt="A pale stand-in photograph"><h2 class="light">White on a pale photograph</h2><div class="panel">Words on a solid panel</div></section>'
  + '<section class="hero scrim"><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23e8e2d0%22/%3E%3C/svg%3E" alt="The same photograph under a scrim"><h2 class="scrimmed">White over a dark scrim</h2></section>'
  + '<section class="hero"><img src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23202a33%22/%3E%3C/svg%3E" alt="A dark stand-in photograph"><span class="tilt">Rotated on a dark photograph</span></section>'
  + '</body></html>';

test('in a real browser, two screenshots find the one headline that cannot be read on its photograph', {
  skip: process.env.CYC_TEST_PLAYWRIGHT ? false : 'set CYC_TEST_PLAYWRIGHT to a Playwright package to run',
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.CYC_TEST_PLAYWRIGHT);
  const { probe, judge } = await import(new URL('../methods/cyc-design/frontend-design/scripts/first-screen.mjs', import.meta.url));
  const { markText, hideText, readPng } = await import(new URL('../methods/cyc-design/frontend-design/scripts/photo-text.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'cyc-photo-page-'));
  writeFileSync(join(dir, 'photo.html'), photoPage);
  const browser = await chromium.launch({ channel: process.env.CYC_TEST_BROWSER_CHANNEL || undefined, headless: true });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700 });
      const page = await context.newPage();
      await page.goto(pathToFileURL(join(dir, 'photo.html')).href, { waitUntil: 'load' });
      const place = () => page.evaluate(() => JSON.stringify([...document.querySelectorAll('h2, .panel, .tilt')].map((el) => el.getBoundingClientRect())));
      const result = await page.evaluate(probe);
      const before = await place();
      await page.evaluate(markText);
      const marked = await page.screenshot({ fullPage: true });
      assert.equal(await place(), before, 'marking the text moved something');
      await page.evaluate(hideText);
      const hidden = await page.screenshot({ fullPage: true });
      assert.equal(await place(), before, 'hiding the text moved something');
      const lines = judge(result, { shots: { page: { marked: readPng(marked), hidden: readPng(hidden) } } })
        .filter((finding) => /on a picture/.test(finding.text));
      assert.equal(lines.length, 1, JSON.stringify(lines));
      assert.match(lines[0].text, /^page: 1 of 3 pieces of text on a picture below contrast .*: h2\.light “White on a pale photograph” 1(\.\d)?:1, needs 3:1$/);
      assert.equal(lines[0].level, 'FAIL');
      await context.close();
    }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// The look in a real browser: most of the text sits on a cream canvas, some on a cream
// gradient (a surface, averaged from its stops), some on a dark gradient, a photograph and a
// white card. The headline is in Fraunces with one word in a larger handwriting face.
const lookPhoto = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23203040%22/%3E%3C/svg%3E';
const lookHtml = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Look</title><style>'
  + 'html{background:#fff}body{margin:0;background:#f5f0e6;color:#1b1712;font:16px/1.5 Arial,sans-serif}'
  + 'h1{font:600 64px/1 Fraunces,Georgia,serif;margin:40px}h1 span{font:72px Kalam,cursive}.card{background:#fff;margin:40px;padding:20px}'
  + '.band{background:linear-gradient(135deg,rgba(255,200,0,.1),transparent 40%),linear-gradient(135deg,#fbfaf6,#f5f0e7);padding:20px}'
  + '.dark{background:linear-gradient(#333,#111);color:#fff;padding:20px}'
  + `.photo{background:url("${lookPhoto}") center/cover;color:#fff;padding:40px}.mark{font-size:120px;position:absolute;top:-400px}`
  + '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);font-size:90px}'
  + '</style></head><body><div class="sr">Card shop home page</div><h1>Decks worth <span>keeping</span></h1>'
  + '<p>' + 'Sealed decks, played decks and collector pieces, graded by hand and priced by the deck. '.repeat(6) + '</p>'
  + '<div class="band">' + 'Grading is done by hand, one deck at a time, under the same lamp. '.repeat(2) + '</div>'
  + '<div class="photo">A caption on a photograph, with a few words more.</div><div class="dark">Words on a dark band.</div>'
  + '<div class="card">A note on a card.</div><div class="mark">Off screen</div></body></html>';

test('in a real browser the probe reads the canvas behind most text and the headline', {
  skip: process.env.CYC_TEST_PLAYWRIGHT ? false : 'set CYC_TEST_PLAYWRIGHT to a Playwright package to run',
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.CYC_TEST_PLAYWRIGHT);
  const { probe, judge } = await import(new URL('../methods/cyc-design/frontend-design/scripts/first-screen.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'cyc-look-page-'));
  writeFileSync(join(dir, 'look.html'), lookHtml);
  const browser = await chromium.launch({ channel: process.env.CYC_TEST_BROWSER_CHANNEL || undefined, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(pathToFileURL(join(dir, 'look.html')).href, { waitUntil: 'load' });
    const { look } = await page.evaluate(probe);
    assert.deepEqual(look.backgrounds.map(([on]) => on), ['#f5f0e6', '#f8f5ef', 'picture', '#222222', '#ffffff']);
    assert.ok(look.backgrounds[0][1] > 0.5 && look.backgrounds[0][1] < 1, JSON.stringify(look.backgrounds));
    assert.deepEqual(look.headline, { family: 'Fraunces, Georgia, serif', size: 64, text: 'Decks worth keeping' });
    const lines = judge({ ...(await page.evaluate(probe)) }).filter((finding) => finding.kind === 'look');
    assert.equal(lines.length, 1);
    assert.equal(lines[0].level, 'FAIL');
    // With the card's white as the page's canvas, the same headline passes.
    await page.evaluate(() => { document.body.style.background = '#fff'; });
    const white = judge(await page.evaluate(probe)).filter((finding) => finding.kind === 'look');
    assert.equal(white[0].level, 'pass');
    assert.match(white[0].text, /% of the text on white or a neutral light surface \(#ffffff most\)/);
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
