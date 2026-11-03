# Color

A palette is derived from the subject, then expressed as eight tokens with roles, then checked with a contrast script before any markup. A palette chosen from a swatch of pleasant blues is tell 11 on the [generic list](generic-tells.md). An accent that reads well as a 100 px word and fails as a 16 px label is the most common way a good palette ships inaccessible text, so the accent has two values.

## Derive it from the subject

Name two materials and one place or time that belong to this business, then take the colors from them.

| Subject | Materials and place | What falls out |
| --- | --- | --- |
| Café | Espresso, crema, cream paper, a wooden counter in morning light | Deep brown brand, warm cream canvas, a caramel accent |
| Photographer | Darkroom, silver print, matte black paper, one warm safelight | Near-black canvas or warm white, silver-gray muted ink, one brass accent |
| Catalog | Paper stock, ink, one signal color for "in stock" or "selected" | Paper-white canvas, true ink, one vermilion or cobalt signal, nothing else |
| Event | The venue at night, stage light, the wristband | Deep night canvas, one hot accent, warm white ink |
| Home repair | Workwear navy, safety orange, plaster white, galvanized steel | Navy brand, warm off-white canvas, orange accent, steel line color |
| Careers or finance | Forest green, aged paper, gold leaf | Deep green brand, cream canvas, gold accent (observed at Undersold.ai) |
| Daily health tool | Sage, linen, morning light | Sage-tinted canvas, forest brand, muted green ink (observed in Rep & Plate) |

A user-supplied brand always wins. Record it in the decision sheet and derive the missing roles from it.

## Eight roles

```css
:root {
  --canvas: ...;      /* page background, tinted, never #ffffff */
  --surface: ...;     /* cards, inputs, panels; one step off the canvas */
  --ink: ...;         /* body text, tinted toward the brand hue, never #000000 */
  --ink-muted: ...;   /* secondary text; still 4.5:1 on canvas and surface */
  --brand: ...;       /* the deep color: primary buttons, the dark section, the mark */
  --accent: ...;      /* marks, underlines, rules, display words of 24 px or more, text on the dark band */
  --accent-ink: ...;  /* the accent darkened (or lightened on a dark canvas) until it reaches 4.5:1; every accent-colored text under 24 px, and the background of an accent button */
  --line: ...;        /* hairline rules and borders, derived from canvas, not gray */
}
```

Rules:

- The canvas is tinted. Cream `#f8f5ee`, bone `#f5f2ec`, sage `#f3f8f5`, cool paper `#f4f5f7`, charcoal `#141414`. Pure white is for a surface sitting on a tinted canvas, if at all.
- Ink carries the brand hue: `#171b18` on a green site, `#2a1f16` on a brown site, `#101828` on a blue site. Gray-on-white text is the default page.
- One accent, under 10 percent of the view. The brand color does the heavy lifting (buttons, the dark section). The accent marks the two words that matter, a rule under them, one number, one state.
- `--accent` touches text only at display size (24 px and up, or 19 px bold), where 3:1 is the requirement, and only when the script's "accent display" line passes; on a light canvas most accents do not, and the display word then uses `--accent-ink` too. Index numerals, dates, prices, eyebrow labels, links and button labels in the accent hue use `--accent-ink`. Undersold.ai does exactly this: bright gold `#e5a128` for the underline and for text on the green band, dark gold `#805000` for the handwritten phrase on cream.
- Exactly one dark section per page, in the brand color, unless the whole site is dark. Its text is the canvas color, not white; the accent is usually fine there, check it.
- Surfaces come from mixing, not from a gray scale: `color-mix(in oklab, var(--brand) 6%, var(--canvas))` gives a surface that belongs to the palette.
- Status (error, success, warning) gets its own hue and an icon or text; never color alone.

## Check it before writing markup

Contrast is computed, not eyeballed. Run this on the eight values (Node, no dependencies) and paste the output into the decision sheet; the finished page is then checked again in the browser with axe-core or an equivalent (see [experience review](experience-review.md)).

```js
// node contrast.mjs "#canvas" "#surface" "#ink" "#ink-muted" "#brand" "#accent" "#accent-ink" "#line"
const [canvas, surface, ink, muted, brand, accent, accentInk] = process.argv.slice(2);
const lum = h => { const c = h.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => ((Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)).toFixed(2);
const pairs = [['ink on canvas', ink, canvas, 4.5], ['ink on surface', ink, surface, 4.5], ['muted on canvas', muted, canvas, 4.5], ['muted on surface', muted, surface, 4.5], ['canvas text on brand', canvas, brand, 4.5], ['accent-ink on canvas', accentInk, canvas, 4.5], ['accent-ink on surface', accentInk, surface, 4.5], ['canvas text on accent-ink', canvas, accentInk, 4.5], ['accent display on canvas', accent, canvas, 3], ['accent on brand', accent, brand, 3]];
for (const [name, a, b, min] of pairs) console.log(`${cr(a, b) >= min ? 'pass' : 'FAIL'}  ${name}: ${cr(a, b)} (min ${min})`);
```

Any FAIL means a different value, not a smaller font. Derive `--accent-ink` by mixing the accent toward the ink until the pair passes; keep the hue.

## Example palettes

Starting points to adapt. Eight values in the order canvas, surface, ink, ink-muted, brand, accent, accent-ink, line. Every accent-ink below was computed to 4.6:1 or better on its canvas and surface on 2026-11-02; the plain accent on a light canvas is 1.8 to 3.7:1, so there it is for underlines, rules, marks and text on the dark band; only the catalog and home-repair accents clear 3:1 for display words.

| Subject | Values |
| --- | --- |
| Café, espresso | `#f6efe4` `#fff9ef` `#2a1f16` `#6d5d50` `#3b2419` `#c9772b` `#995d25` `#e4d6c3` |
| Photographer, dark | `#111111` `#1a1a1a` `#f2efe9` `#9a9690` `#f2efe9` `#d9c58b` `#d9c58b` `#2a2a2a` |
| Photographer, light | `#f7f5f0` `#ffffff` `#161616` `#6a6660` `#161616` `#b8952e` `#846c26` `#e2ddd3` |
| Catalog, paper and signal | `#f4f4f1` `#ffffff` `#121417` `#5b6066` `#121417` `#e8412c` `#c83a29` `#d9d9d4` |
| Event, night | `#0f0e17` `#1b1930` `#fffffe` `#a7a9be` `#ff8906` `#e53170` `#e84880` `#2e2b4a` |
| Home repair, workwear | `#f3f4f1` `#ffffff` `#15202b` `#55606b` `#1f3a5f` `#e4572e` `#b94b2d` `#d6dad3` |
| Careers, green and gold | `#f8f5ee` `#fffaf0` `#171b18` `#5c625d` `#104034` `#e5a128` `#8e6921` `#e3ddd0` |
| Daily tool, sage | `#f8faf7` `#ffffff` `#102333` `#5f6b66` `#17674e` `#c9a24a` `#817041` `#d5e1dd` |
| Software, restrained | `#fbfbf9` `#ffffff` `#101828` `#5d6675` `#0c4a3a` `#ffb000` `#936c12` `#e3e5e0` |

For a set of sites, no two palettes share a temperature and a brand hue family. Two warm-cream sites with brown and green brands are still two cream sites; make one of them dark or cool.
