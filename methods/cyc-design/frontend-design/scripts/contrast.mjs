// Compare opaque sRGB colors. Evaluate thresholds before formatting for display.
function luminance(hex) {
  const linear = hex.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function report(role, foreground, background, minimum) {
  const first = luminance(foreground);
  const second = luminance(background);
  const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  const verdict = ratio >= minimum ? 'pass' : 'FAIL';
  const displayed = (Math.floor(ratio * 1000) / 1000).toFixed(3);
  console.log(`${verdict}  ${role}: ${displayed}:1 (minimum ${minimum}:1)`);
}

const colors = process.argv.slice(2);
if (![2, 8].includes(colors.length) || !colors.every(color => /^#[0-9a-f]{6}$/i.test(color))) {
  console.error('Expected two opaque #RRGGBB colors or the eight palette colors in the order given in references/color.md.');
  process.exitCode = 1;
} else if (colors.length === 2) {
  report('normal text', ...colors, 4.5);
  report('large text or required non-text cue', ...colors, 3);
} else {
  const [canvas, surface, ink, muted, brand, accent, accentInk] = colors;
  report('ink on canvas', ink, canvas, 4.5);
  report('ink on surface', ink, surface, 4.5);
  report('muted on canvas', muted, canvas, 4.5);
  report('muted on surface', muted, surface, 4.5);
  report('canvas text on brand', canvas, brand, 4.5);
  report('accent-ink on canvas', accentInk, canvas, 4.5);
  report('accent-ink on surface', accentInk, surface, 4.5);
  report('canvas text on accent-ink', canvas, accentInk, 4.5);
  report('accent display on canvas', accent, canvas, 3);
  report('accent display on brand', accent, brand, 3);
  report('normal accent text on brand', accent, brand, 4.5);
}
