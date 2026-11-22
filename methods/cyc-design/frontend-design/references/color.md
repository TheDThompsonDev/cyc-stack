# Color

On the eight studied sites, color is decided twice: what the page sits on, and where its color comes from. Five sit on white, one on a warm cream and two on near-black. Every one gives a single color the job of the main action. Beyond that they differ on purpose, and that difference is much of why no two look alike.

An existing brand's colors come first. Use them, record them, and let nothing below override them.

## Canvas

Choose one from the subject.

- **White.** `#ffffff` with near-black text (`#111827`, `#1c1917`, `#222222`) and one gray for secondary facts (`#4b5563` on white measures 7.5:1). Fits a catalog, a finder, money, software: wherever photographs or the product supply the color. Use a pale gray (`#f4f4f4` to `#f7f7f7`) for bands and panels.
- **Warm tint.** A cream or paper canvas (`#fbfaf7`, `#f8f5ee`) with a near-black that leans toward the brand hue (`#171b18`) and a muted secondary text (`#5c625d` on `#fbfaf7` measures 5.9:1). Fits a personal service, craft, food, hospitality, heritage. It needs a deep color for buttons and for one or two full dark sections, so the page has contrast and does not read as beige. Do not set it with a serif headline unless a brand you were given does: that pair is the look builds without this method chose ([tell 40](generic-tells.md#the-unchosen-look)), and the judge fails it.
- **Dark.** Near-black (`#0b1318`, `#121212`) with off-white text (`#f7f7f1`) and a light gray for secondary text (`#b3b3b3`, `#cbd2d7`). Fits media, events, nightlife, developer tools, anything used in the evening or built around covers and photographs. Panels are one step lighter than the page (`#121212` on `#000000`).

A tinted canvas is a choice like any other. It is wrong only when nothing about the subject asked for it.

## Where the color comes from

Choose one. This is the decision that most separates one site from another.

- **One brand color, used in fields.** A single saturated hue on the main button, the selected state and the mark, and also in larger areas: a highlight block behind a key word, a band, an offset shadow, numbers. Seen as a yellow on a dark canvas, a red and a blue on white.
- **The photographs.** The interface stays black, white and gray, and the brand color appears only on the mark and the one main button. Every other color on the page is in the pictures, so there must be many of them and they must be good.
- **The content.** Covers, product shots or category tiles in many saturated colors on a neutral or dark page. The interface adds one accent, saved for the paid or primary offer.
- **Artwork.** A page with no brand color at all: black buttons on white, with color only in illustrations, painted backdrops behind product frames, and partner marks.
- **A two-color palette.** A deep color and a warm accent used together everywhere: deep green with mustard, navy with coral. The deep color fills buttons and whole sections; the accent marks the one emphasized phrase, the highlighted plan and small labels.
- **A campaign palette over a plain shop.** The shop itself is white with near-black text. The current campaign brings three or four colors of its own for banners, buttons on photographs and bands, and can be replaced without touching the shop.

## Rules that held across all of them

- **One color does the main action** on every screen. Count the filled buttons in the action color in one view: more than one or two means nothing is leading.
- **The second button is quiet:** outlined, pale gray or plain text. Never a second saturated color.
- **Status has its own hue** (error, success, sale) plus an icon or words, never color alone.
- **A dark or colored band marks a real change of content**, and its text, links and focus ring are chosen and measured for that surface.
- **A brand color too light for text**, such as a yellow, becomes a background with dark text on it.

## Roles

```css
:root {
  --canvas: ...;      /* the page */
  --surface: ...;     /* cards, inputs, panels; one step off the canvas */
  --ink: ...;         /* primary text */
  --ink-muted: ...;   /* secondary facts; still 4.5:1 on canvas and surface */
  --brand: ...;       /* the main action, the selected state, the mark */
  --on-brand: ...;    /* text and icons on the brand color */
  --accent: ...;      /* only for a two-color or campaign palette */
  --line: ...;        /* hairline rules and borders */
  --focus: ...;       /* focus ring; 3:1 against what it sits on */
}
```

White text on these was measured with the calculator below: `#1d4ed8` blue 6.7:1, `#b91c1c` red 6.4:1, `#047857` green 5.4:1, `#7c3aed` violet 5.6:1, `#c2410c` orange 5.1:1, `#104034` deep green 11.6:1. Dark ink `#111827` on `#f59e0b` amber measures 8.2:1. They are examples of a workable action color, not a palette to reuse. Take the hue from something the business owns, such as its sign, its uniform or its packaging. When nothing is supplied, choose a hue the neighboring businesses in its category are not all using.

## Check it before writing markup

Run the bundled [contrast calculator](../scripts/contrast.mjs) with Node before committing to a color. Quote each hex value. Give it two colors, foreground then background, for a specific use such as the label on the primary button or a control outline against its surface. Run this from the frontend method directory.

```sh
node scripts/contrast.mjs "#ffffff" "#1d4ed8"
```

Read the verdict for the role you intend. The tool compares the full ratio and truncates only the printed value. Resolve failing combinations the page uses and check the rendered states too, including focus, text over photographs and translucent surfaces. The calculator takes opaque sRGB hex colors. Use the [experience review](experience-review.md#access-and-comfort-pass) for the browser checks. [W3C text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

The two-color form is the one to use. Given eight colors in the order canvas, surface, ink, ink-muted, brand, accent, accent-ink, line, the calculator prints a fixed set of pairings for a brand that has a second accent color. Some of those pairings a page never uses, such as canvas-colored text on a light brand color; read only the lines for pairings in use.
