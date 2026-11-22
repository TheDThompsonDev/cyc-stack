# Typography

The eight studied sites do not share a typeface or a size. Each chose a voice and held to it: one has no headline at all, one sets a light 40 px line, one sets 88 px at the heaviest weight. What they share is discipline. Each family has one job, interface text is small and steady, and the display size is far from the body size or absent.

Choose one voice below from the subject and write it in the [decision sheet](decision-sheet.md). An existing brand's type replaces all of this.

## Voices

Sizes are what was measured at 1440 wide. Phone sizes follow each voice.

### Quiet: a short headline, small everything else

The items carry the page, so the interface stays small and steady. A scene-led offer can use a short 44 to 64 px headline. A catalog can lead straight into a compact department heading and its items. Section and shelf headings 20 to 28 px at weight 600 to 700. Body and item titles 13 to 16 px. Secondary facts 12 px in gray. One family, two or three weights.

Fits a finder, a store, a dealer, a marketplace: anywhere the items carry the page once the opening has set the mood. A working surface may drop the headline entirely; nothing else should. Phone: headline 34 to 40 px, the rest the same.

### Light: a calm, thin headline

Headline 40 px at weight 300, column headings 32 px at 300, sub-points 24 px at 300. Body 16 px at 400 with a 1.5 line height. Eyebrows 16 px at 600 in capitals with 0.5 px tracking. One family in three weights: 300, 400, 600.

Fits money, health, insurance, anything where calm is the promise. Needs a family with a true light weight, such as Source Sans 3, Nunito Sans or Figtree. Phone: 32 px.

### Editorial serif: a serif headline over a plain sans

Headline 52 px in the hero and 60 to 70 px in later sections, in a display serif, line height about 1.0, tracking about −0.035 em. Body 17 px sans with a 1.7 line height. Small capital eyebrows with wide tracking. Optionally one phrase of the headline in a handwriting face, in the accent color, with a drawn underline.

Fits a personal service, craft, food, heritage, anything sold on care and judgment. Three families at most and each has one job: the serif only for headlines, the sans for everything else, the handwriting only for the one phrase. Candidates: DM Serif Display, Fraunces, Instrument Serif or Newsreader, with DM Sans, Figtree or Instrument Sans; Kalam or Caveat for the handwritten phrase. Phone: 44 to 48 px. Set it on a white or dark canvas: on a warm tint it is the look builds without this method chose ([tell 40](generic-tells.md#the-unchosen-look)), and the judge fails it unless a brand you were given sets both.

### Large grotesque: one big plain statement

Headline 80 px at weight 500 with a line height of 1.0, centered, two lines. Section headings 54 px at 500. Body 18 px under the headline and 16 px elsewhere. Navigation 14 px. Weights stay in the middle: 400 to 500, never bold.

Fits software and tools, where the product picture below the headline is the proof. Candidates: Inter, Geist, Schibsted Grotesk, Hanken Grotesk. Phone: 40 px.

### Heavy: very large and very bold

Headline 88 px at weight 800, tracking about −0.06 em, line height 0.95. Section headings 68 px, smaller ones 43 to 53 px. Body 18 to 20 px. A second, handwritten family at 36 to 48 px for short labels and photo captions that sound like a person talking.

Fits a community, an event, a cause, a brand with energy. Needs a family with an 800 weight, such as Plus Jakarta Sans, Bricolage Grotesque, Outfit or Epilogue. Phone: 52 px.

### Display on photographs: type as part of the picture

Display capitals at 60 to 90 px set on full-bleed photographs, tracked out by about 2 px, for offers and prices. Interface text small: 12 to 14 px navigation and labels, 16 px body. A third, seasonal display face may carry one campaign.

Fits fashion, retail campaigns, entertainment. The type and the photograph are designed together; check its contrast on the picture. Candidates for the display face: Anton, Oswald, Barlow Condensed, Bebas Neue. Phone: 30 to 50 px.

## Rules that held across all of them

- **Body text is 14 to 20 px**, most often 16 px. Navigation, labels and facts are 12 to 16 px.
- **Choose the scale for the task.** A display headline can dominate an invitation. A department or workspace heading should leave room for the first useful comparison.
- **Tight tracking on large type.** About −0.035 em at 50 px and −0.06 em near 90 px. Line height 0.95 to 1.05 above 48 px.
- **Each family has one job.** Four of the eight sites use one family. The others use two or three and never mix their jobs.
- **Weights are few.** Two or three per family.
- **Numbers people compare** use `font-variant-numeric: tabular-nums` and sit in the same place on every item. Check it in the render: set “11111” and “88888” and compare their widths. A builder found that DM Sans ignored it.
- **A price or a date may take display size** when it is the thing to read first.
- Measure: body 55 to 72 characters. A display line wraps on purpose, at about 20 characters per line.
- Hierarchy test: screenshot at 25 percent zoom. The lead, the items and the action should still be told apart.

Rotate families between projects. Do not reach for the same one each time, and never choose a family because the page felt plain: choose the voice first, then a family that can carry it.

## Loading

- Local-only sites: `npm i @fontsource/<name>` and import the weights used, or copy the woff2 files into `/fonts` with `@font-face { font-display: swap; }`. Do not link Google Fonts on a site that must work offline.
- Networked sites: the Google Fonts `<link>` with `display=swap`, only the weights used. A site that opens from disk but loads its pictures from the network is a networked site.
- Declare a fallback stack with `size-adjust` so the layout holds before the web font arrives, and render the page once with the font blocked to confirm nothing breaks.
- Verify in the rendered page (`document.fonts.check` or the computed style) that the family loaded. Inputs, selects and buttons need `font: inherit`.
