#!/usr/bin/env node
// Measures what a rendered page gives a visitor, and compares it with a floor.
//
//   node first-screen.mjs --probe          print the probe, to evaluate in the page
//   node first-screen.mjs result.json      judge what the probe returned
//   node first-screen.mjs --one-page ...   for a visual single-page brief
//   node first-screen.mjs --access ...     access checks for inner pages or deliberately text-led working views
//   node first-screen.mjs --mark-text      print the expression to run before the marked screenshot
//   node first-screen.mjs --hide-text      print the expression to run before the hidden screenshot
//   node first-screen.mjs --marked desktop=m.png --hidden desktop=h.png ... result.json
//                                          also measure text on photographs, from the two screenshots
//
// The probe runs in any browser: paste the printed expression into the console,
// or pass it to the browser tool at hand (Playwright `page.evaluate`, a DevTools
// protocol `Runtime.evaluate`, an in-app browser's script tool). Run it at a
// desktop width near 1440 and a phone width near 390, scrolled to the top.
// Save either one result, or {"desktop": {...}, "phone": {...}}.
//
// The floor comes from first screens measured on 2026-11-21; see
// references/reference-standards.md. It catches two pages: a brochure, with
// little to do, and a bare first screen, with little to look at. It does not
// measure taste, and a page that clears it can still be weak.
//
// The probe also counts, over the whole page, the access failures a script can
// see: missing language, alt, labels and names, tap targets under 24 px, controls
// that look the same focused, and text below contrast. Those numbers are WCAG 2.2
// AA. To read focus it focuses each control in turn, then puts focus and scroll
// back. Clearing them is not an audit.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { hideText, markText, measurePhotoText, readPng, validPhotoText } from './photo-text.mjs';

export const FLOOR = Object.freeze({
  actions: 12,        // desktop first screen; the eight sites measured 14 to 89 over two visits
  phoneActions: 6,    // phone first screen; the eight sites measured 7 to 30
  destinations: 3,    // other pages or views linked from this one; measured 7 to 293
  screens: 3,         // page height in screens; 4.9 to 8 on pages that do not load as you scroll
  surfaceFactor: 2,   // a first screen with twice the floor is a working surface; its height is not judged
  pictures: 4,        // desktop first screen; the eight sites measured 4 to 30 pictures over two visits...
  pictureShare: 0.25, // ...or a single picture covering 29 to 86 percent of the screen
  // Access. These come from WCAG 2.2 AA, not from the studied sites.
  targetSize: 24,     // px each way for anything a visitor taps, unless nothing else is within reach (2.5.8)
  contrast: 4.5,      // text against its background (1.4.3)
  largeContrast: 3,   // text 24 px and larger, or bold from 18.66 px
  comfortTarget: 44,  // the method's own height for buttons and fields; reported, not judged
  photoCover: 0.9,   // text on a photograph meets contrast against this share of what is behind it; the method's rule
});

// Runs in the page. Self-contained: it may not reference anything outside itself.
export function probe() {
  // The layout viewport. On a phone, window.innerWidth grows to fit content that
  // overflows, which would hide the overflow and misread the phone as a desktop.
  const root = document.documentElement;
  const vw = root.clientWidth || window.innerWidth;
  const vh = root.clientHeight || window.innerHeight;
  const shown = (el) => {
    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
  };
  const inFirstScreen = (el) => {
    const box = el.getBoundingClientRect();
    return shown(el) && box.bottom > 0 && box.top < vh && box.right > 0 && box.left < vw;
  };
  const all = [...document.body.querySelectorAll('*')];
  const first = all.filter(inFirstScreen);

  const actionSelector = 'a[href], button, [role="button"], [role="tab"], input:not([type="hidden"]), select, textarea, summary';
  const actions = first.filter((el) => el.matches(actionSelector)).length;

  const pictures = first
    .filter((el) => el.matches('img, video, picture, canvas, svg') || getComputedStyle(el).backgroundImage.includes('url('))
    .map((el) => el.getBoundingClientRect())
    .filter((box) => box.width >= 80 && box.height >= 80);
  const largest = pictures.reduce((best, box) => Math.max(best, Math.min(box.width, vw) * Math.min(box.height, vh)), 0);

  const families = new Set();
  for (const el of first) {
    const ownText = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    if (ownText) families.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());
  }

  // Records: sets of three or more alike siblings that each carry content, such as
  // listings, products, services with prices, events, table rows. Navigation,
  // footers and the insides of a counted record are left out.
  const carries = (el) => el.querySelector('img, picture, svg, video') || (el.innerText || '').trim().length >= 12;
  const kind = (el) => `${el.tagName}.${[...el.classList].sort().join('.')}`;
  let records = 0;
  let largestSet = 0;
  const walk = (parent) => {
    if (parent.matches('nav, footer, [role="navigation"], [role="contentinfo"], select, svg')) return;
    const sets = new Map();
    for (const child of parent.children) {
      if (!shown(child) || !carries(child)) continue;
      const key = kind(child);
      if (!sets.has(key)) sets.set(key, []);
      sets.get(key).push(child);
    }
    const counted = new Set();
    for (const members of sets.values()) {
      if (members.length < 3) continue;
      records += members.length;
      largestSet = Math.max(largestSet, members.length);
      for (const member of members) counted.add(member);
    }
    for (const child of parent.children) if (!counted.has(child)) walk(child);
  };
  walk(document.body);

  const page = (url) => url.origin + url.pathname.replace(/\/(index\.html?)?$/, '/');
  const here = page(new URL(location.href));
  const destinations = new Set();
  for (const link of document.querySelectorAll('a[href]')) {
    let url;
    try { url = new URL(link.getAttribute('href'), location.href); } catch { continue; }
    if (!/^(https?|file):$/.test(url.protocol) || url.origin !== location.origin) continue;
    if (page(url) !== here) destinations.add(page(url));
  }

  const controls = document.querySelectorAll(
    'input:not([type="hidden"]), select, textarea, [role="tab"], [role="switch"], [role="combobox"], [aria-pressed], [aria-expanded], [aria-selected], details',
  ).length;

  const pinned = all.filter((el) => {
    const position = getComputedStyle(el).position;
    if (position !== 'fixed' && position !== 'sticky') return false;
    const box = el.getBoundingClientRect();
    return shown(el) && box.width >= vw * 0.5 && box.height >= 32 && box.height <= vh * 0.3;
  }).length;

  const pageHeight = Math.max(root.scrollHeight, document.body.scrollHeight);

  // Access, over the whole page: what a script can count. The numbers are WCAG 2.2 AA
  // and must equal the judge's floor; the method's test compares them.
  const access = (() => {
    const limits = { target: 24, contrast: 4.5, largeContrast: 3, comfort: 44 };
    const visible = all.filter(shown);
    const unheard = (el) => Boolean(el.closest('[aria-hidden="true"], [inert]'));
    const decorative = (el) => /^(presentation|none)$/.test(el.getAttribute('role') || '');
    // Kept for a screen reader and clipped out of sight, as a skip link is until focused.
    const clipped = (el) => {
      for (let node = el, level = 0; node && level < 3; node = node.parentElement, level += 1) {
        const style = getComputedStyle(node);
        if ((style.clip !== 'auto' && /absolute|fixed/.test(style.position)) || /inset\((50|100)%/.test(style.clipPath)) return true;
      }
      return false;
    };
    const words = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const labelledBy = (el) => words((el.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map((id) => (id && document.getElementById(id) ? document.getElementById(id).textContent : '')).join(' '));
    const said = (el) => words(el.getAttribute('aria-label')) || labelledBy(el);
    const tell = (el, extra = '') => {
      const text = said(el) || words(el.innerText || el.textContent) || words(el.getAttribute('alt')) || words(el.getAttribute('name'))
        || words(el.getAttribute('placeholder')) || words((el.getAttribute('src') || el.getAttribute('href') || '').split('/').pop());
      const mark = el.id ? `#${el.id}` : el.classList[0] ? `.${el.classList[0]}` : '';
      return `${el.tagName.toLowerCase()}${mark}${text ? ` “${text.slice(0, 28)}”` : ''}${extra}`;
    };
    const examples = {};
    const keep = (key, list, extra = () => '') => {
      if (list.length) examples[key] = list.slice(0, 3).map((item) => tell(item.el || item, extra(item)));
      return list.length;
    };

    const images = [...document.images].filter((el) => shown(el) && !unheard(el) && !decorative(el));
    const noAlt = images.filter((el) => !el.hasAttribute('alt'));
    const emptyAlt = images.filter((el) => {
      const box = el.getBoundingClientRect();
      return el.hasAttribute('alt') && !words(el.alt) && box.width >= 80 && box.height >= 80;
    });

    // A styled radio or checkbox is often invisible itself and drawn by its label.
    const reachable = (el) => shown(el) || Boolean(el.labels && [...el.labels].some(shown));
    const fields = [...document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea',
    )].filter((el) => reachable(el) && !unheard(el));
    const unlabelled = fields.filter((el) => !(el.labels && [...el.labels].some((label) => words(label.textContent)))
      && !said(el) && !words(el.getAttribute('title')));

    const named = visible.filter((el) => el.matches(
      'a[href], button, [role="button"], [role="tab"], [role="link"], summary, input[type="submit"], input[type="button"], input[type="reset"], input[type="image"]',
    ) && !unheard(el));
    const unnamed = named.filter((el) => !(said(el) || words(el.innerText || el.textContent)
      || words([...el.querySelectorAll('img[alt], [aria-label], svg title')]
        .map((node) => node.getAttribute('alt') || node.getAttribute('aria-label') || node.textContent).join(' '))
      || words(el.getAttribute('title')) || words(el.getAttribute('alt'))
      // An input button announces its value, and a bare submit or reset input a default word.
      || (el.matches('input') && (words(el.value) || /^(submit|reset)$/.test(el.type)))));

    // Target size. A target under 24 px passes when a 24 px circle on its centre reaches
    // no other target; a link inside a sentence is exempt.
    const pageWidth = Math.max(root.scrollWidth, vw);
    const inSentence = (el) => {
      if (getComputedStyle(el).display !== 'inline' || !el.parentElement) return false;
      let other = 0;
      for (const node of el.parentElement.childNodes) if (node.nodeType === 3) other += node.textContent.replace(/\s/g, '').length;
      return other >= 3;
    };
    const targets = [];
    for (const el of document.querySelectorAll(actionSelector)) {
      // A mock-up of a product may hold buttons nobody can press.
      if (!reachable(el) || el.disabled || inSentence(el) || clipped(el) || el.closest('[inert]') || getComputedStyle(el).pointerEvents === 'none') continue;
      const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
      const choice = /^(checkbox|radio)$/.test(el.type || '');
      for (const part of [el, ...el.children, ...(choice && el.labels ? el.labels : [])]) {
        const rect = part.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        box.left = Math.min(box.left, rect.left); box.top = Math.min(box.top, rect.top);
        box.right = Math.max(box.right, rect.right); box.bottom = Math.max(box.bottom, rect.bottom);
      }
      const width = box.right - box.left;
      const height = box.bottom - box.top;
      // Hidden until focused (a skip link), or parked off the page (a closed menu).
      if (!(width > 1 && height > 1) || box.right <= 0 || box.left >= pageWidth || box.bottom + window.scrollY <= 0) continue;
      // A pinned bar slides over the page, so it is only ever beside what is pinned with it.
      let pin = el;
      while (pin && !/fixed|sticky/.test(getComputedStyle(pin).position)) pin = pin.parentElement;
      targets.push({ el, box, width, height, pin, x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2,
        small: width < limits.target - 0.5 || height < limits.target - 0.5 });
    }
    const crowded = targets.filter((target) => target.small && targets.some((other) => {
      if (other === target || other.pin !== target.pin || other.el.contains(target.el) || target.el.contains(other.el)) return false;
      if (other.small) return Math.hypot(other.x - target.x, other.y - target.y) < limits.target;
      const dx = Math.max(other.box.left - target.x, 0, target.x - other.box.right);
      const dy = Math.max(other.box.top - target.y, 0, target.y - other.box.bottom);
      return Math.hypot(dx, dy) < limits.target / 2;
    }));
    const underComfort = targets.filter((target) => target.el.matches('button, [role="button"], select, textarea, input')
      && !/^(checkbox|radio)$/.test(target.el.type || '') && target.height < limits.comfort - 0.5).length;

    // Contrast, where the background can be read: a solid colour on the text's own
    // element or an ancestor. Text over a picture or a gradient is counted, not judged.
    // A colour written as oklch(), lab() or color() is returned that way, not as rgb();
    // a one-pixel canvas the probe draws on itself converts it.
    const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (value) => {
      const found = /^rgba?\(([^)]+)\)$/.exec(value || '');
      const parts = found ? found[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat) : [];
      if (parts.length >= 3 && parts.every(Number.isFinite)) return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
      if (!value || !paint) return null;
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = 'rgba(0, 0, 0, 0)';
      paint.fillStyle = value;
      paint.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const luminance = ([r, g, b]) => {
      const channel = (value) => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const painted = (style) => style.backgroundImage !== 'none' || (rgba(style.backgroundColor) || [0, 0, 0, 0])[3] > 0.02;
    const pagePictures = visible
      .filter((el) => el.matches('img, video, picture, canvas, svg') || getComputedStyle(el).backgroundImage.includes('url('))
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter((picture) => picture.box.width >= 80 && picture.box.height >= 80);
    // A positioned block with a fill, such as a highlight laid behind one word, may sit
    // under text that is not inside it. The script cannot tell which is in front.
    for (const el of visible) {
      const style = getComputedStyle(el);
      if (!/absolute|fixed/.test(style.position) || !painted(style)) continue;
      const box = el.getBoundingClientRect();
      if (box.width >= 12 && box.height >= 12) pagePictures.push({ el, box });
    }
    const surfaces = new Map();
    const surface = (el) => {
      if (surfaces.has(el)) return surfaces.get(el);
      const style = getComputedStyle(el);
      let unreadable = style.backgroundImage !== 'none' || Number(style.opacity) < 1;
      for (const which of ['::before', '::after']) {
        const pseudo = getComputedStyle(el, which);
        if (pseudo.content === 'none' || pseudo.content === 'normal' || !/absolute|fixed/.test(pseudo.position)) continue;
        // An underline two pixels tall is not a background; a block behind a word is.
        if (painted(pseudo) && Number(pseudo.opacity) > 0 && parseFloat(pseudo.width) >= 12 && parseFloat(pseudo.height) >= 12) unreadable = true;
      }
      const found = { unreadable, color: rgba(style.backgroundColor) };
      surfaces.set(el, found);
      return found;
    };
    const behind = (el, box) => {
      const over = pagePictures.filter((picture) => !picture.el.contains(el) && !el.contains(picture.el)
        && picture.box.left < box.right && picture.box.right > box.left && picture.box.top < box.bottom && picture.box.bottom > box.top);
      for (let node = el; node; node = node.parentElement) {
        const found = surface(node);
        if (found.unreadable || over.some((picture) => node.contains(picture.el))) return null;
        if (!found.color) return null;
        if (found.color[3] >= 0.99) return found.color;
        if (found.color[3] > 0.02) return null;
      }
      return [255, 255, 255, 1];
    };
    let texts = 0;
    let onPictures = 0;
    let covered = 0;
    const low = [];
    const photoText = [];
    // What of a line can be seen: the part inside every ancestor that clips its overflow.
    const visiblePart = (el, line) => {
      let [left, top, right, bottom] = [line.left, line.top, line.right, line.bottom];
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const clip = node.getBoundingClientRect();
        if (style.overflowX !== 'visible') { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
        if (style.overflowY !== 'visible') { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
      }
      return right - left > 1 && bottom - top > 1 ? [left, top, right - left, bottom - top] : null;
    };
    // Text under something drawn on top of it, such as a card fanned over another, is not
    // seen. Each line's centre is brought to the middle of the screen and hit-tested with
    // pointer events on everywhere, then the scroll is put back at once: every other box
    // here is read at the scroll the probe started from.
    const reach = document.createElement('style');
    reach.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
    const resting = [window.scrollX, window.scrollY];
    const hidden = (el, lines) => {
      let under = 0;
      for (const [left, top, wide, tall] of lines) {
        const [x, y] = [left + wide / 2, top + tall / 2];
        window.scrollTo(Math.max(0, x - vw / 2), Math.max(0, y - vh / 2));
        const hit = document.elementFromPoint(x - window.scrollX, y - window.scrollY);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) under += 1;
      }
      window.scrollTo(resting[0], resting[1]);
      return under * 2 > lines.length;
    };
    const range = document.createRange();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!node.textContent.trim() || !el || !shown(el) || el.closest('script, style, noscript, :disabled, [aria-disabled="true"]')) continue;
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1 || clipped(el)) continue;
      const style = getComputedStyle(el);
      // Text in an SVG drawing is painted with fill, not color, and sits on the drawing.
      const vector = el.closest('svg');
      const ink = vector ? (/^(none|url)/.test(style.fill) ? null : rgba(style.fill)) : rgba(style.color);
      if (ink && vector) ink[3] *= Number.isFinite(parseFloat(style.fillOpacity)) ? parseFloat(style.fillOpacity) : 1;
      // Text drawn in a transparent colour is not seen, so it is not judged.
      if (ink && ink[3] <= 0.02) continue;
      if (!ink) { onPictures += 1; continue; }
      const size = parseFloat(style.fontSize);
      const need = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? limits.largeContrast : limits.contrast;
      const back = vector ? null : behind(el, box);
      if (!back) {
        // One rectangle per line, in page coordinates, for a screenshot to measure.
        const rects = [...range.getClientRects()].map((line) => visiblePart(el, line)).filter(Boolean).slice(0, 4)
          .map(([left, top, wide, tall]) => [left + window.scrollX, top + window.scrollY, wide, tall].map((v) => Math.round(v * 10) / 10));
        if (!rects.length) continue;
        if (covered + onPictures < 200) {
          document.head.appendChild(reach);
          const under = hidden(el, rects);
          reach.remove();
          if (under) { covered += 1; continue; }
        }
        onPictures += 1;
        if (photoText.length < 40) photoText.push({ tell: tell(el), ink, need, rects, node });
        continue;
      }
      const mixed = ink.slice(0, 3).map((value, index) => value * ink[3] + back[index] * (1 - ink[3]));
      const lighter = Math.max(luminance(mixed), luminance(back));
      const darker = Math.min(luminance(mixed), luminance(back));
      const ratio = (lighter + 0.05) / (darker + 0.05);
      texts += 1;
      if (ratio < need) low.push({ el, ratio, need });
    }
    low.sort((a, b) => a.ratio - b.ratio);

    // With tight leading a line's box takes in the letters of the line above or below it,
    // which the marked screenshot paints the same colour. Trim each recorded line where
    // another piece of text overlaps it from above or below.
    if (photoText.length) {
      const others = [];
      const every = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = every.nextNode(); node && others.length < 6000; node = every.nextNode()) {
        if (!node.textContent.trim() || !node.parentElement || !shown(node.parentElement)) continue;
        range.selectNodeContents(node);
        for (const line of range.getClientRects()) {
          if (line.width > 1 && line.height > 1) {
            others.push({ node, left: line.left + window.scrollX, right: line.right + window.scrollX, top: line.top + window.scrollY, bottom: line.bottom + window.scrollY });
          }
        }
      }
      for (const text of photoText) {
        const trimmed = text.rects.map(([left, top, wide, tall]) => {
          let [upper, lower] = [top, top + tall];
          for (const other of others) {
            if (other.node === text.node || other.right <= left || other.left >= left + wide || other.bottom <= upper || other.top >= lower) continue;
            const middle = (other.top + other.bottom) / 2;
            if (middle < top + tall * 0.25) upper = Math.max(upper, other.bottom);
            else if (middle > top + tall * 0.75) lower = Math.min(lower, other.top);
          }
          return lower - upper > 2 ? [left, upper, wide, lower - upper].map((v) => Math.round(v * 10) / 10) : null;
        }).filter(Boolean);
        if (trimmed.length) text.rects = trimmed;
        delete text.node;
      }
    }

    // Focus, last, because it moves focus. Each control is focused from script and
    // compared with itself unfocused, with its labels, what it contains and what wraps it:
    // the indicator may be drawn on any of them. A control that changes nothing at all is unmarked.
    const still = document.createElement('style');
    still.textContent = '*, *::before, *::after { transition: none !important; }';
    document.head.appendChild(still);
    const look = (el) => {
      const around = [el, ...(el.labels ? el.labels : []), ...[...el.querySelectorAll('*')].slice(0, 12)];
      for (let up = el.parentElement, level = 0; up && level < 5; up = up.parentElement, level += 1) around.push(up);
      const seen = [];
      for (const node of around) {
        for (const which of [null, '::before', '::after']) {
          const style = getComputedStyle(node, which);
          seen.push(style.outlineStyle, style.outlineWidth, style.outlineColor, style.outlineOffset, style.boxShadow, style.borderTopColor,
            style.borderBottomColor, style.borderLeftColor, style.borderBottomWidth, style.backgroundColor, style.backgroundImage, style.color,
            style.textDecorationLine, style.textDecorationColor, style.opacity, style.content);
        }
      }
      return seen.join('|');
    };
    const before = document.activeElement;
    const scroll = [window.scrollX, window.scrollY];
    const focusable = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]')]
      .filter((el) => reachable(el) && el.tabIndex >= 0 && !el.disabled).slice(0, 200);
    const unmarked = [];
    let focused = 0;
    let unread = 0;
    for (const el of focusable) {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      const resting = look(el);
      el.focus({ preventScroll: true });
      if (document.activeElement !== el) continue;
      focused += 1;
      if (look(el) !== resting) continue;
      if (el.matches(':focus-visible')) unmarked.push(el); else unread += 1;
    }
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    if (before && before !== document.body && before.focus) before.focus({ preventScroll: true });
    still.remove();
    window.scrollTo(scroll[0], scroll[1]);

    return {
      lang: words(root.getAttribute('lang')),
      title: Boolean(words(document.title)),
      images: images.length,
      imagesNoAlt: keep('imagesNoAlt', noAlt),
      picturesEmptyAlt: keep('picturesEmptyAlt', emptyAlt),
      fields: fields.length,
      fieldsUnlabelled: keep('fieldsUnlabelled', unlabelled),
      named: named.length,
      unnamed: keep('unnamed', unnamed),
      targets: targets.length,
      smallTargets: keep('smallTargets', crowded, (target) => ` ${Math.round(target.width)}×${Math.round(target.height)}`),
      underComfort,
      focusable: focused,
      focusUnmarked: keep('focusUnmarked', unmarked),
      focusUnread: unread,
      texts,
      lowContrast: keep('lowContrast', low, (item) => ` ${Math.floor(item.ratio * 10) / 10}:1, needs ${item.need}:1`),
      textOnPictures: onPictures,
      textCovered: covered,
      photoText,
      pixelRatio: window.devicePixelRatio || 1,
      pageHeight: Math.round(pageHeight),
      examples,
    };
  })();

  // The look, read to compare with the look builds without the method chose (Step 3).
  // What the text sits on: for each piece, the first opaque surface on it or an ancestor,
  // weighted by its letters; the eight most used are kept. A background image is a picture.
  // A gradient is a surface: the solid colour under it, or else its opaque stops averaged;
  // one with no opaque stop is a glow over what is behind. The headline is the typeface
  // with the most letters among the largest text in the first screen, so a short accent
  // phrase set larger than the words around it does not stand for the headline.
  const look = (() => {
    const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const solid = (value) => {
      if (!paint || !value) return null;
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = 'rgba(0, 0, 0, 0)';
      paint.fillStyle = value;
      paint.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
      return a >= 252 ? [r, g, b] : null;
    };
    const hex = (rgb) => `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
    const behind = new Map();
    const canvasOf = (el) => {
      for (let node = el; node; node = node.parentElement) {
        if (behind.has(node)) return behind.get(node);
        const style = getComputedStyle(node);
        if (style.backgroundImage.includes('url(')) return behind.set(node, 'picture').get(node);
        const color = solid(style.backgroundColor);
        if (color) return behind.set(node, hex(color)).get(node);
        if (style.backgroundImage === 'none') continue;
        const stops = (style.backgroundImage.match(/[a-z]+\([^()]*\)|#[0-9a-f]{3,8}\b/gi) || [])
          .filter((stop) => !/gradient/i.test(stop)).map(solid).filter(Boolean);
        if (stops.length) return behind.set(node, hex([0, 1, 2].map((at) => stops.reduce((sum, stop) => sum + stop[at], 0) / stops.length))).get(node);
      }
      return '#ffffff';
    };
    const weight = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      const letters = node.textContent.replace(/\s+/g, '').length;
      if (!letters || !el || el.closest('script, style, noscript, svg') || !shown(el)) continue;
      const on = canvasOf(el);
      weight.set(on, (weight.get(on) || 0) + letters);
    }
    const total = [...weight.values()].reduce((sum, n) => sum + n, 0);
    const backgrounds = [...weight].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([on, letters]) => [on, Math.round((letters / total) * 100) / 100]);
    const sized = [];
    for (const el of first) {
      if (el.closest('svg, script, style, noscript')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      const letters = (own.match(/\p{L}/gu) || []).length;
      if (letters < 2) continue;
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      // A title kept for a screen reader and clipped out of sight is not the headline a visitor sees.
      const box = el.getBoundingClientRect();
      if (box.height < size * 0.6 || box.width < size) continue;
      sized.push({ el, letters, size, family: style.fontFamily });
    }
    const top = sized.reduce((most, item) => Math.max(most, item.size), 0);
    const byFamily = new Map();
    for (const item of sized) if (item.size >= top * 0.8) byFamily.set(item.family, (byFamily.get(item.family) || 0) + item.letters);
    const family = ([...byFamily].sort((a, b) => b[1] - a[1])[0] || [])[0];
    const lead = sized.filter((item) => item.family === family).sort((a, b) => b.size - a.size)[0];
    const headline = lead
      ? { family, size: Math.round(lead.size), text: lead.el.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) }
      : null;
    return { backgrounds, headline };
  })();

  return {
    probe: 1,
    width: vw,
    height: vh,
    actions,
    pictures: pictures.length,
    largestPictureShare: Math.round((largest / (vw * vh)) * 100) / 100,
    families: [...families],
    records,
    largestSet,
    destinations: destinations.size,
    controls,
    pinned,
    screens: Math.round((pageHeight / vh) * 10) / 10,
    overflow: Math.max(0, root.scrollWidth - vw),
    access,
    look,
  };
}

const count = (value) => Number.isFinite(value) && value >= 0;

const ACCESS_COUNTS = ['images', 'imagesNoAlt', 'picturesEmptyAlt', 'fields', 'fieldsUnlabelled', 'named', 'unnamed', 'targets', 'smallTargets',
  'underComfort', 'focusable', 'focusUnmarked', 'focusUnread', 'texts', 'lowContrast', 'textOnPictures'];

// A result saved before the probe measured access has no `access` and still judges.
function validAccess(access) {
  const positive = (value) => value === undefined || (Number.isFinite(value) && value > 0);
  return access === undefined || (Boolean(access) && typeof access === 'object' && typeof access.lang === 'string'
    && typeof access.title === 'boolean' && ACCESS_COUNTS.every((key) => count(access[key]))
    && (access.photoText === undefined || validPhotoText(access.photoText)) && positive(access.pixelRatio) && positive(access.pageHeight)
    && (access.textCovered === undefined || count(access.textCovered)));
}

// A result saved before the probe read the look has no `look` and still judges.
function validLook(look) {
  if (look === undefined) return true;
  if (!look || typeof look !== 'object' || !Array.isArray(look.backgrounds) || look.backgrounds.length > 8
    || !look.backgrounds.every((entry) => Array.isArray(entry) && entry.length === 2 && /^(#[0-9a-f]{6}|picture)$/.test(entry[0])
      && Number.isFinite(entry[1]) && entry[1] >= 0 && entry[1] <= 1)) return false;
  const { headline } = look;
  return headline === null || (Boolean(headline) && typeof headline === 'object' && typeof headline.family === 'string'
    && Number.isFinite(headline.size) && headline.size > 0 && typeof headline.text === 'string');
}

function validView(view) {
  return Boolean(view) && typeof view === 'object' && view.probe === 1
    && ['actions', 'pictures', 'largestPictureShare', 'records', 'largestSet', 'destinations', 'controls', 'screens', 'overflow']
      .every((key) => count(view[key]))
    && view.width > 0 && view.height > 0 && validAccess(view.access) && validLook(view.look);
}

// Serif families a builder is likely to load or fall back on. A family not named here is
// judged by the generic family at the end of its list, so "MyFace, serif" is a serif.
const SERIFS = new Set(['fraunces', 'georgia', 'times', 'times new roman', 'playfair', 'playfair display', 'cormorant', 'cormorant garamond',
  'eb garamond', 'garamond', 'libre baskerville', 'baskerville', 'lora', 'merriweather', 'newsreader', 'spectral', 'crimson pro', 'crimson text',
  'literata', 'bodoni moda', 'young serif', 'gloock', 'besley', 'alegreya', 'cardo', 'domine', 'gelasio', 'libre caslon text', 'libre caslon display',
  'abril fatface', 'prata', 'yeseva one', 'charter', 'iowan old style', 'palatino', 'palatino linotype', 'book antiqua', 'cambria', 'ui-serif']);

// Whether a computed font-family list asks for a serif first.
export function serifFamily(list) {
  const names = String(list || '').split(',').map((name) => name.replace(/["']/g, '').trim().toLowerCase()).filter(Boolean);
  if (!names.length) return false;
  const [first] = names;
  if (/sans|mono|grotesk|grotesque|gothic/.test(first)) return false;
  if (/serif/.test(first) || SERIFS.has(first)) return true;
  return names[names.length - 1] === 'serif';
}

const lightness = (hex) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const channel = (value) => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
  return { r, g, b, light: 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) };
};

// A cream or paper canvas: light, with red above green above blue by a visible step. Four
// takes in #fbfaf7, the lightest warm tint color.md names, and leaves out neutral greys
// such as #f9f9f8 and #f4f4f1.
export function warmTint(hex) {
  const { r, g, b, light } = lightness(hex);
  return light >= 0.75 && r >= g && g >= b && r - b >= 4;
}

const SURFACES = { warm: 'a warm tint', light: 'white or a neutral light surface', dark: 'a dark or coloured surface', picture: 'pictures' };
const surfaceOf = (on) => {
  if (on === 'picture') return 'picture';
  if (warmTint(on)) return 'warm';
  return lightness(on).light >= 0.75 ? 'light' : 'dark';
};

// The look builds without the method chose: three of three set the page on cream, two of
// them under a Fraunces headline. Either alone is a choice; the pair, unasked for, is the
// default. The canvas is the kind of surface that holds the most text, so a page whose text
// is spread over several creams is read as cream.
function judgeLook(look, add, brand) {
  const say = (level, text) => add(level, text, 'look');
  if (!look) {
    say('note', 'the canvas and the headline were not recorded: this result is from an earlier probe, so print the probe and run it again');
    return;
  }
  if (!look.backgrounds.length) {
    say('note', 'no text on the page to read the canvas from');
    return;
  }
  const kinds = {};
  for (const [on, share] of look.backgrounds) {
    const kind = surfaceOf(on);
    kinds[kind] ??= { share: 0, most: on };
    kinds[kind].share += share;
  }
  const [kind, { share, most }] = Object.entries(kinds).sort((a, b) => b[1].share - a[1].share)[0];
  const where = `${Math.round(share * 100)}% of the text on ${SURFACES[kind]}${kind === 'picture' ? '' : ` (${most} most)`}`;
  if (!look.headline) {
    say('note', `${where}; no text in the first screen to read as a headline`);
    return;
  }
  const family = look.headline.family.split(',')[0].replace(/["']/g, '').trim();
  const named = `“${look.headline.text}” in ${family}`;
  if (!(kind === 'warm' && serifFamily(look.headline.family))) {
    say('pass', `${where}, headline ${named}; not the cream canvas with a serif headline that builds without this method chose`);
  } else if (brand) {
    say('note', `${where} and a serif headline, the look builds without this method chose; not judged, because --brand says an existing brand sets them`);
  } else {
    say('FAIL', `the look builds without this method chose: ${where} and a serif headline, ${named};`
      + ' change the canvas or the type voice, or judge with --brand when an existing brand sets both');
  }
}

// Access findings for one view: what a script can count against WCAG 2.2 AA. Passing
// them is not an audit; the keyboard journey and a screen reader stay manual.
function judgeAccess(access, add, view, shot) {
  const say = (level, text) => add(level, text, 'access');
  if (!access) {
    say('note', 'access was not measured: this result is from an earlier probe, so print the probe and measure again');
    if (shot) say('note', 'the screenshots were not used: this result has no places for text, so print the probe and measure again');
    return;
  }
  const examples = (key) => {
    const list = access.examples && Array.isArray(access.examples[key]) ? access.examples[key].slice(0, 3).map(String) : [];
    return list.length ? `: ${list.join('; ')}` : '';
  };
  const of = (part, whole, things) => `${part} of ${whole} ${things}`;
  const some = (number, one, many) => `${number} ${number === 1 ? one : many}`;
  const basics = [];
  if (!access.lang) say('FAIL', 'no page language: set lang on the html element so a screen reader pronounces the words');
  else basics.push(`language (${access.lang})`);
  if (!access.title) say('FAIL', 'no page title: a screen reader announces the title first');
  else basics.push('title');
  if (access.imagesNoAlt) say('FAIL', `no alt attribute on ${of(access.imagesNoAlt, access.images, 'images')}${examples('imagesNoAlt')}`);
  else basics.push(`alt on ${access.images} images`);
  if (access.fieldsUnlabelled) {
    say('FAIL', `no label on ${of(access.fieldsUnlabelled, access.fields, 'fields')}; a placeholder is not one${examples('fieldsUnlabelled')}`);
  } else basics.push(`a label on ${access.fields} fields`);
  if (access.unnamed) say('FAIL', `no name to announce on ${of(access.unnamed, access.named, 'links and buttons')}${examples('unnamed')}`);
  else basics.push(`a name on ${access.named} links and buttons`);
  if (basics.length) say('pass', `present: ${basics.join(', ')}`);

  say(access.smallTargets ? 'FAIL' : 'pass', access.smallTargets
    ? `${of(access.smallTargets, access.targets, 'tap targets')} under ${FLOOR.targetSize} px with another target within reach${examples('smallTargets')}`
    : `${some(access.targets, 'tap target', 'tap targets')}, none under ${FLOOR.targetSize} px with another target within reach`);
  say(access.focusUnmarked ? 'FAIL' : 'pass', access.focusUnmarked
    ? `no visible change on focus for ${of(access.focusUnmarked, access.focusable, 'controls')}${examples('focusUnmarked')}`
    : `${some(access.focusable - access.focusUnread, 'control changes', 'controls change')} when focused`);
  say(access.lowContrast ? 'FAIL' : 'pass', access.lowContrast
    ? `${of(access.lowContrast, access.texts, 'pieces of text')} below contrast (${FLOOR.contrast}:1, or ${FLOOR.largeContrast}:1 from 24 px)${examples('lowContrast')}`
    : `${some(access.texts, 'piece of text meets', 'pieces of text meet')} contrast (${FLOOR.contrast}:1, or ${FLOOR.largeContrast}:1 from 24 px)`);

  if (access.focusUnread) {
    say('note', `${some(access.focusUnread, 'control', 'controls')} did not show keyboard focus to the script in this browser; Tab there by hand`);
  }
  const boxes = Array.isArray(access.photoText) ? access.photoText : null;
  if (shot && !boxes) say('note', 'the screenshots were not used: this result has no places for text, so print the probe and measure again');
  if (access.textOnPictures && (!shot || !boxes)) {
    say('note', `${some(access.textOnPictures, 'piece of text sits', 'pieces of text sit')} on a picture, a gradient or a see-through surface, not measured; check the render`
      + (boxes ? ', or measure it with a --marked and a --hidden screenshot' : ''));
  } else if (access.textOnPictures) {
    const found = measurePhotoText(access, view, shot, FLOOR.photoCover);
    const rule = `${FLOOR.contrast}:1, or ${FLOOR.largeContrast}:1 from 24 px, behind ${FLOOR.photoCover * 100}% of the letters`;
    if (found.measured) {
      const named = found.low.slice(0, 3).map((item) => `${item.tell} ${Math.floor(item.ratio * 10) / 10}:1, needs ${item.need}:1`).join('; ');
      say(found.low.length ? 'FAIL' : 'pass', found.low.length
        ? `${of(found.low.length, found.measured, 'pieces of text')} on a picture below contrast (${rule}): ${named}`
        : `${some(found.measured, 'piece of text on a picture meets', 'pieces of text on a picture meet')} contrast (${rule})`);
    }
    const reasons = [];
    if (found.outside) reasons.push(`${found.outside} outside the screenshots`);
    if (found.unseen) reasons.push(`${found.unseen} whose letters do not show in them`);
    if (found.changed) reasons.push(`${found.changed} where the page changed between the two screenshots`);
    if (found.moved) reasons.push(`${found.moved} below the first screen, where the page moved after the probe`);
    if (found.unrecorded) reasons.push(`${found.unrecorded} past the first ${access.photoText.length} the probe records`);
    if (reasons.length) say('note', `text on a picture not measured: ${reasons.join(', ')}; check the render`);
  }
  if (access.textCovered) {
    say('note', `${some(access.textCovered, 'piece of text lies', 'pieces of text lie')} under something drawn on top of it and ${access.textCovered === 1 ? 'was' : 'were'} not judged; make sure nothing a visitor needs is hidden`);
  }
  if (access.picturesEmptyAlt) {
    say('note', `${some(access.picturesEmptyAlt, 'picture has an empty alt and a screen reader skips it', 'pictures have an empty alt and a screen reader skips them')}: right for decoration, wrong for a picture of the item${examples('picturesEmptyAlt')}`);
  }
  if (access.underComfort) {
    say('note', `${some(access.underComfort, 'button or field is', 'buttons and fields are')} under ${FLOOR.comfortTarget} px tall; main buttons are ${FLOOR.comfortTarget} px or more`);
  }
}

// Findings for one view. Each has `level`: 'pass', 'FAIL' or 'note'. A note reports
// what the probe saw without a verdict, because no number on that count separated
// the measured sites from a brochure.
export function judgeView(view, { label = 'page', onePage = false, shot, look = true, brand = false } = {}) {
  if (!validView(view)) throw new TypeError('Expected a result from this probe.');
  const phone = view.width < 700;
  const floor = phone ? FLOOR.phoneActions : FLOOR.actions;
  const surface = view.actions >= floor * FLOOR.surfaceFactor;
  const findings = [];
  const add = (level, text, kind = 'substance') => findings.push({ level, ok: level !== 'FAIL', kind, text: `${label}: ${text}` });
  const verdict = (ok) => (ok ? 'pass' : 'FAIL');

  add(verdict(view.actions >= floor), `${view.actions} things to act on in the first screen (floor ${floor})`);
  if (onePage) {
    add('note', `${view.destinations} other pages linked; not judged for a one-page brief`);
  } else {
    add(verdict(view.destinations >= FLOOR.destinations), `${view.destinations} other pages or views linked (floor ${FLOOR.destinations})`);
  }
  if (surface && view.screens < FLOOR.screens) {
    add('pass', `working surface: ${view.actions} actions in view, so ${view.screens} screens of height is not judged`);
  } else {
    add(verdict(view.screens >= FLOOR.screens), `${view.screens} screens of content (floor ${FLOOR.screens})`);
  }
  // Pictures. Every studied desktop first screen had four or more, or one covering
  // over a quarter of it. One studied phone page opens on text and a button, so the
  // phone count is reported and not judged.
  const share = Math.round(view.largestPictureShare * 100);
  const seen = `${view.pictures} ${view.pictures === 1 ? 'picture' : 'pictures'} in the first screen`
    + (view.pictures ? `, the largest covering ${share}%` : '');
  if (phone) {
    add('note', `${seen}; seven of the eight studied phone pages showed at least one`);
  } else {
    const enough = view.pictures >= FLOOR.pictures || (view.pictures >= 1 && view.largestPictureShare >= FLOOR.pictureShare);
    add(verdict(enough), `${seen} (floor ${FLOOR.pictures} pictures, or one covering ${FLOOR.pictureShare * 100}%)`, 'pictures');
  }
  const tolerance = phone ? 0 : 16;
  add(verdict(view.overflow <= tolerance), view.overflow <= tolerance ? 'no sideways scroll' : `${view.overflow} px of sideways scroll`);
  add('note', `${view.records} alike items in sets of three or more, largest set ${view.largestSet}; ${view.controls} controls that take input or change state`);
  if (look) judgeLook(view.look, add, brand);
  judgeAccess(view.access, add, view, shot);
  return findings;
}

// `shots` holds each view's pair of decoded screenshots, { marked, hidden }, by view:
// { desktop, phone } for a result with both views, or { page } for a single one.
export function judge(result, { shots = {}, ...options } = {}) {
  const views = result && typeof result === 'object' && (result.desktop || result.phone) ? ['desktop', 'phone'] : ['page'];
  for (const name of Object.keys(shots)) {
    if (!views.includes(name) || (name !== 'page' && !result[name])) {
      const error = new TypeError(views[0] === 'page' ? `a screenshot is named ${name}, and this result has one view: give it as --marked <file> --hidden <file>.`
        : `a screenshot is ${name === 'page' ? 'not named' : `named ${name}`}, and this result has no such view: name it desktop=<file> or phone=<file>.`);
      error.shot = true;
      throw error;
    }
  }
  if (views[0] === 'page') return judgeView(result, { ...options, shot: shots.page });
  // The look is the same at both widths, so it is judged once: on the desktop view when there is one.
  return [
    ...(result.desktop ? judgeView(result.desktop, { ...options, label: 'desktop', shot: shots.desktop }) : []),
    ...(result.phone ? judgeView(result.phone, { ...options, label: 'phone', shot: shots.phone, look: !result.desktop }) : []),
  ];
}

function main(argv) {
  if (argv[0] === '--probe' && argv.length === 1) {
    process.stdout.write(`(${probe.toString()})()\n`);
    return 0;
  }
  if (argv[0] === '--mark-text' && argv.length === 1) {
    process.stdout.write(`(${markText.toString()})()\n`);
    return 0;
  }
  if (argv[0] === '--hide-text' && argv.length === 1) {
    process.stdout.write(`(${hideText.toString()})()\n`);
    return 0;
  }
  const usage = 'Usage: node first-screen.mjs --probe | --mark-text | --hide-text | node first-screen.mjs [--one-page] [--access] [--brand]'
    + ' [--marked desktop=<png> --hidden desktop=<png> --marked phone=<png> --hidden phone=<png>] <result.json>\n';
  const rest = [...argv];
  const shotPaths = {};
  for (const flag of ['--marked', '--hidden']) {
    for (let at = rest.indexOf(flag); at >= 0; at = rest.indexOf(flag)) {
      const value = rest[at + 1];
      const named = /^(desktop|phone)=(.+)$/.exec(value || '');
      const name = named ? named[1] : 'page';
      const kind = flag.slice(2);
      if (!value || value.startsWith('--') || shotPaths[name]?.[kind]) {
        process.stderr.write(usage);
        return 2;
      }
      shotPaths[name] = { ...shotPaths[name], [kind]: named ? named[2] : value };
      rest.splice(at, 2);
    }
  }
  for (const [name, pair] of Object.entries(shotPaths)) {
    if (!pair.marked || !pair.hidden) {
      process.stderr.write(`No verdict: ${name === 'page' ? 'the view' : `the ${name} view`} has a ${pair.marked ? 'marked' : 'hidden'} screenshot`
        + ` and no ${pair.marked ? 'hidden' : 'marked'} one; the letters are found by comparing the two.\n`);
      return 2;
    }
  }
  const onePage = rest.includes('--one-page');
  const accessOnly = rest.includes('--access');
  const brand = rest.includes('--brand');
  const files = rest.filter((arg) => arg !== '--one-page' && arg !== '--access' && arg !== '--brand');
  if (files.length !== 1 || files[0].startsWith('--')) {
    process.stderr.write(usage);
    return 2;
  }
  const shots = {};
  for (const [name, pair] of Object.entries(shotPaths)) {
    shots[name] = {};
    for (const [kind, path] of Object.entries(pair)) {
      try {
        shots[name][kind] = readPng(readFileSync(path));
      } catch (error) {
        process.stderr.write(`No verdict: ${path}: ${error.code === 'ENOENT' ? 'no such file.' : error.message} Save the screenshot as a PNG.\n`);
        return 2;
      }
    }
  }
  let findings;
  try {
    // Windows PowerShell's redirection puts a byte-order mark first, which is not JSON.
    findings = judge(JSON.parse(readFileSync(files[0], 'utf8').replace(/^﻿/, '')), { onePage, brand, shots });
  } catch (error) {
    if (error.shot) {
      process.stderr.write(`No verdict: ${error.message}\n`);
      return 2;
    }
    process.stderr.write(`No verdict: ${error.message} Save the object the probe returned, or {"desktop": ..., "phone": ...}.\n`);
    return 2;
  }
  // A page that is not the home page is held to the access lines, not to the first-screen floor.
  if (accessOnly) findings = findings.filter((finding) => finding.kind === 'access');
  for (const finding of findings) process.stdout.write(`${finding.level.padEnd(4)}  ${finding.text}\n`);
  const failed = findings.filter((finding) => !finding.ok);
  const unmeasured = findings.some((finding) => finding.kind === 'access' && /access was not measured/.test(finding.text));
  if (accessOnly && !failed.length) {
    process.stdout.write(unmeasured ? '\nAccess was not measured.\n'
      : '\nNo access failure a script can count. Use the page by keyboard too.\n');
    return 0;
  }
  if (!failed.length) {
    process.stdout.write('\nAt or above the floor. The floor only catches a brochure or a bare first screen; judge the design in the render.'
      + (unmeasured ? ' Access was not measured.\n'
        : ' The access lines are what a script can count: use the journey by keyboard too.\n'));
    return 0;
  }
  const reasons = [];
  if (failed.some((finding) => finding.kind === 'substance')) reasons.push('this is a brochure: add what a visitor can choose and do');
  if (failed.some((finding) => finding.kind === 'pictures')) {
    reasons.push('this first screen is bare: give it the photographs, or the product, that a visitor came to see');
  }
  const closing = [];
  if (reasons.length) closing.push(`By the measure of the studied sites ${reasons.join(', and ')}.`);
  if (failed.some((finding) => finding.kind === 'look')) {
    closing.push('This is the look a builder reaches for without the method: change the canvas or the type voice (Step 3).');
  }
  if (failed.some((finding) => finding.kind === 'access')) {
    closing.push('By WCAG 2.2 AA this page shuts some visitors out: repair every access FAIL.');
  }
  process.stdout.write(`\n${failed.length} below the floor. ${closing.join(' ')} Then measure again.\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
