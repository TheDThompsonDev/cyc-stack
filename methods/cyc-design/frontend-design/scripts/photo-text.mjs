// Measures text that sits on a photograph, a gradient or a see-through surface.
//
// A script in the page cannot read the pixels of most photographs: an image from
// another origin, or any image on a file:// page, taints the canvas it is drawn on.
// So the probe records where such text sits, and the builder saves two screenshots:
// one after `markText` paints every letter one flat magenta, and one after `hideText`
// makes every letter transparent. Neither moves anything. The pixels that differ
// between the two are the letters themselves, and the hidden screenshot holds what is
// behind them, scrims, panels and text shadows included. Line boxes, rotation and the
// gaps between letters do not count, so a bright band beside a word does not fail it.
//
// WCAG gives no method for text on a photograph. The rule here is the method's own:
// the text's colour meets 4.5:1, or 3:1 when large, against what is behind at least
// 90 percent of its letters.

import { inflateSync } from 'node:zlib';

// Run in the page after the probe, then take the first screenshot. Self-contained.
export async function markText() {
  for (const image of document.images) if (image.loading === 'lazy') image.loading = 'eager';
  const settle = (image) => new Promise((done) => {
    if (image.complete) { done(); return; }
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
  }).then(() => image.decode().catch(() => {}));
  const waiting = [...document.images].filter((image) => !image.complete || !image.naturalWidth);
  await Promise.race([Promise.all([...document.images].map(settle)), new Promise((done) => setTimeout(done, 10000))]);
  for (const old of document.querySelectorAll('#cyc-hide-text, #cyc-mark-text')) old.remove();
  const style = document.createElement('style');
  style.id = 'cyc-mark-text';
  style.textContent = '*, *::before, *::after { color: #ff00ff !important; -webkit-text-fill-color: #ff00ff !important;'
    + ' text-decoration-color: transparent !important; caret-color: transparent !important;'
    + ' transition: none !important; animation-play-state: paused !important; }'
    + ' svg text, svg tspan, svg textPath { fill: #ff00ff !important; stroke: none !important; }';
  document.head.appendChild(style);
  window.scrollTo(0, 0);
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return { marked: true, images: document.images.length, waitedFor: waiting.length,
    pageHeight: Math.round(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)) };
}

// Run in the page after the first screenshot, then take the second. Self-contained.
export async function hideText() {
  for (const image of document.images) if (image.loading === 'lazy') image.loading = 'eager';
  const settle = (image) => new Promise((done) => {
    if (image.complete) { done(); return; }
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
  }).then(() => image.decode().catch(() => {}));
  const waiting = [...document.images].filter((image) => !image.complete || !image.naturalWidth);
  await Promise.race([Promise.all([...document.images].map(settle)), new Promise((done) => setTimeout(done, 10000))]);
  for (const old of document.querySelectorAll('#cyc-hide-text, #cyc-mark-text')) old.remove();
  const style = document.createElement('style');
  style.id = 'cyc-hide-text';
  style.textContent = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important;'
    + ' text-decoration-color: transparent !important; caret-color: transparent !important;'
    + ' transition: none !important; animation-play-state: paused !important; }'
    + ' svg text, svg tspan, svg textPath { fill: transparent !important; stroke: none !important; }';
  document.head.appendChild(style);
  window.scrollTo(0, 0);
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return { hidden: true, images: document.images.length, waitedFor: waiting.length,
    pageHeight: Math.round(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)) };
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

// Reads an 8-bit, non-interlaced PNG, which is what browsers write for a screenshot.
export function readPng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    throw new TypeError('not a PNG file.');
  }
  let offset = 8;
  let header = null;
  const data = [];
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const kind = bytes.toString('latin1', offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (body.length !== length) throw new TypeError('the PNG is cut short.');
    if (kind === 'IHDR') header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], type: body[9], interlace: body[12] };
    else if (kind === 'IDAT') data.push(body);
    else if (kind === 'IEND') break;
    offset += 12 + length;
  }
  const channels = header && CHANNELS[header.type];
  if (!header || !header.width || !header.height || header.depth !== 8 || !channels || header.interlace !== 0) {
    throw new TypeError('the PNG must be 8-bit grey or colour and not interlaced, as a browser screenshot is.');
  }
  const { width, height } = header;
  const stride = width * channels;
  let raw;
  try { raw = inflateSync(Buffer.concat(data)); } catch { throw new TypeError('the PNG data does not decompress.'); }
  if (raw.length < height * (stride + 1)) throw new TypeError('the PNG data is cut short.');
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[out + x - channels] : 0;
      const up = y ? pixels[out - stride + x] : 0;
      const corner = y && x >= channels ? pixels[out - stride + x - channels] : 0;
      let guess;
      if (filter === 0) guess = 0;
      else if (filter === 1) guess = left;
      else if (filter === 2) guess = up;
      else if (filter === 3) guess = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner;
        const [a, b, c] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
        guess = a <= b && a <= c ? left : b <= c ? up : corner;
      } else throw new TypeError(`the PNG has an unknown row filter (${filter}).`);
      pixels[out + x] = (raw[line + x] + guess) & 255;
    }
  }
  return { width, height, channels, pixels };
}

const linear = (value) => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (r, g, b) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const MARK = [255, 0, 255];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// The colour at one pixel, over white where the screenshot is not opaque.
function pixel(shot, x, y) {
  const at = (y * shot.width + x) * shot.channels;
  const p = shot.pixels;
  const [r, g, b, a] = shot.channels >= 3
    ? [p[at], p[at + 1], p[at + 2], shot.channels === 4 ? p[at + 3] / 255 : 1]
    : [p[at], p[at], p[at], shot.channels === 2 ? p[at + 1] / 255 : 1];
  return [r * a + 255 * (1 - a), g * a + 255 * (1 - a), b * a + 255 * (1 - a)];
}

function refuse(message) {
  const error = new TypeError(message);
  error.shot = true;
  throw error;
}

// Measures each recorded piece of text against the two screenshots of its view. Returns
// the pieces that fall short and the count of those that could not be measured, by reason.
export function measurePhotoText(access, view, { hidden, marked }, cover) {
  const ratio = access.pixelRatio || 1;
  const expected = view.width * ratio;
  if (hidden.width !== marked.width) {
    refuse(`the two screenshots differ in size (${marked.width}×${marked.height} marked, ${hidden.width}×${hidden.height} hidden):`
      + ' take both the same way, one straight after the other.');
  }
  // A screenshot may include a scrollbar that the probe's width leaves out, and a full-page
  // screenshot of a page that scrolls sideways is as wide as the page.
  if (hidden.width < expected - 1 || hidden.width > (view.width + (view.overflow || 0) + 24) * ratio) {
    refuse(`the screenshots are ${hidden.width} px wide, and this view is ${view.width} CSS px at a pixel ratio of ${ratio}:`
      + ' take them at the width the probe ran at.');
  }
  const shotHeight = Math.min(hidden.height, marked.height) / ratio;
  const fullPage = shotHeight > view.height + 2;
  // A lazy image that loaded after the probe pushes everything below it down, and a live
  // page may change height between the two shots; then only the first screen still lines up.
  const grew = fullPage && ((access.pageHeight > 0 && Math.abs(hidden.height / ratio - access.pageHeight) > 2) || hidden.height !== marked.height);
  const reach = fullPage && !grew ? shotHeight : view.height;
  const found = { measured: 0, low: [], outside: 0, moved: 0, unseen: 0, changed: 0,
    unrecorded: Math.max(0, access.textOnPictures - access.photoText.length) };
  for (const text of access.photoText) {
    if (text.rects.some(([, top, , tall]) => top + tall > reach + 0.5 || top < -0.5)) {
      if (grew && text.rects.every(([, top, , tall]) => top + tall <= shotHeight + 0.5)) found.moved += 1;
      else found.outside += 1;
      continue;
    }
    const [inkR, inkG, inkB, alpha] = text.ink;
    const ratios = [];
    let inside = false;
    let around = 0;
    let differ = 0;
    const seen = new Set();
    for (const [left, top, wide, tall] of text.rects) {
      // Two CSS pixels of margin to each side, where an italic can reach past its box; none
      // above or below, where the next line's letters are.
      const x0 = Math.max(0, Math.floor((left - 2) * ratio));
      const y0 = Math.max(0, Math.floor(top * ratio));
      const x1 = Math.min(hidden.width, Math.ceil((left + wide + 2) * ratio));
      const y1 = Math.min(hidden.height, Math.ceil((top + tall) * ratio));
      if (x1 > x0 && y1 > y0) inside = true;
      const step = (x1 - x0) * (y1 - y0) > 400000 ? 2 : 1;
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          if (seen.has(y * hidden.width + x)) continue;
          seen.add(y * hidden.width + x);
          const back = pixel(hidden, x, y);
          const lit = pixel(marked, x, y);
          // A letter is where the marked screenshot moved at least halfway from the
          // background toward magenta. Where the background is itself near magenta, no
          // letter can be told from it, and the pixel is left out.
          const span = distance(back, MARK);
          if (span < 60 || distance(lit, back) < span * 0.5 || distance(lit, MARK) >= span) {
            // Around the letters the two screenshots should match.
            around += 1;
            if (distance(lit, back) > 24) differ += 1;
            continue;
          }
          const behind = luminance(...back);
          const ink = luminance(inkR * alpha + back[0] * (1 - alpha), inkG * alpha + back[1] * (1 - alpha), inkB * alpha + back[2] * (1 - alpha));
          ratios.push((Math.max(behind, ink) + 0.05) / (Math.min(behind, ink) + 0.05));
        }
      }
    }
    if (!inside) { found.outside += 1; continue; }
    // An image that loaded, or a slide that moved, between the two screenshots.
    if (around && differ > around * 0.2) { found.changed += 1; continue; }
    if (ratios.length < 8) { found.unseen += 1; continue; }
    ratios.sort((a, b) => a - b);
    const worst = ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * (1 - cover)))];
    found.measured += 1;
    if (worst < text.need) found.low.push({ tell: text.tell, ratio: worst, need: text.need });
  }
  found.low.sort((a, b) => a.ratio - b.ratio);
  return found;
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value);

// What the probe records for one piece of text it could not measure on a solid background.
export function validPhotoText(list) {
  return Array.isArray(list) && list.every((text) => Boolean(text) && typeof text === 'object' && typeof text.tell === 'string'
    && Array.isArray(text.ink) && text.ink.length === 4 && text.ink.every(finite) && text.ink[3] >= 0 && text.ink[3] <= 1
    && finite(text.need) && text.need > 0
    && Array.isArray(text.rects) && text.rects.length > 0
    && text.rects.every((rect) => Array.isArray(rect) && rect.length === 4 && rect.every(finite) && rect[2] > 0 && rect[3] > 0));
}
