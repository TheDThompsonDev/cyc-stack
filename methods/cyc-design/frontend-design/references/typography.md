# Typography

Type is the fastest way to leave the default page. Choose a pairing by the character the product needs, set the display size and tracking by the numbers below, and load the fonts so they actually render.

## Pairings

All are free on Google Fonts and as `@fontsource` packages. Character notes say what the pairing does, not what it is "for"; choose against the decision sheet's premise.

| Display | Text | Character | Fits |
| --- | --- | --- | --- |
| DM Serif Display | DM Sans | High-contrast serif with tight tracking; confident, editorial, warm when set on cream | Services that sell judgment: careers, finance, consulting, premium local trades |
| Lora (regular and italic) | DM Sans | Calm book serif; the italic reads as a second, softer voice | Health, food, daily tools, anything that should feel taken care of |
| Fraunces | Inter Tight or Work Sans | Soft "wonky" serif with optical sizes; cozy without being cute | Cafés, bakeries, craft products, small hospitality |
| Playfair Display | Source Sans 3 | Classic high-contrast; luxury if restrained, costume if overused | Photography, weddings, galleries, hotels |
| Cormorant Garamond (500 to 600) | Manrope | Delicate, long ascenders; needs size to work (72 px and up) | Fine dining, perfume, art, editorial covers |
| Instrument Serif | Instrument Sans | Narrow, modern serif; tech with taste | Software with a point of view, studios, agencies |
| Newsreader | Public Sans | Journal serif with real italics; long-form comfort | Blogs, documentation with voice, reports |
| Libre Caslon Text | Karla | Bookish and even; quiet authority | Education, nonprofits, archives |
| Space Grotesk | IBM Plex Sans + IBM Plex Mono | Geometric with quirks; engineering honesty | Catalogs, data tools, developer products |
| Bricolage Grotesque (700 to 800) | Figtree | Friendly, slightly condensed, punchy at size | Local services, home repair, community events |
| Archivo Black or Archivo Expanded | Archivo | Heavy industrial grotesque | Workshops, trades, sports, bold retail |
| Syne (800) | Inter | Wide, poster-like, a little strange | Festivals, music, art events |
| Bebas Neue | Barlow | Tall condensed caps; loud and cheap in a good way | Events, gyms, schedules, menus on walls |
| Epilogue (variable) | Epilogue | One family, 100 to 900; wide headings, clean text | Dashboards and apps that want one voice |

Not for display: Inter, Roboto, Poppins, Montserrat, Open Sans, Lato, `system-ui`. They are tell 7 on the [generic list](generic-tells.md). Inter or a system stack is acceptable as the text face in a dense tool when the decision sheet says why.

One accent voice per page, at most: a Kalam or Caveat phrase, or the display face's italic, on the two or three words that carry the promise. On every heading it stops being an accent.

## Numbers

| Role | Desktop | Phone | Tracking | Line height |
| --- | --- | --- | --- | --- |
| Display (page opening) | 56 to 96 px, `clamp(2.75rem, 6vw, 6rem)` | 36 to 44 px | −0.02 em to −0.04 em | 0.95 to 1.1 |
| Section heading | 32 to 44 px | 28 to 32 px | −0.01 em to −0.02 em | 1.1 to 1.2 |
| Body, marketing | 17 to 19 px | 16 to 17 px | 0 | 1.5 to 1.65 |
| Body, dense tool | 14 to 16 px | 14 to 15 px | 0 | 1.4 to 1.5 |
| Eyebrow label | 11 to 13 px, uppercase | same | +0.08 em to +0.14 em | 1 |
| Caption, meta | 12 to 13 px | same | 0 to +0.02 em | 1.3 |

- Measure: body 55 to 72 characters; a display headline at most 12 words and about 20 characters wide per line, so it wraps on purpose.
- Weight: serif display faces usually at 400 to 500; one heavy weight on the page, not three.
- Oversized numerals: index numbers (01, 02), prices and the one real statistic set in the display face at display size. `font-variant-numeric: tabular-nums` on any column of numbers.
- Hierarchy test: screenshot at 25% zoom. If display, heading, body and eyebrow are not distinguishable as four roles, the scale is too flat.

## Loading

- Local-only sites: `npm i @fontsource/<name>` and import the weights used, or copy the woff2 files into `/fonts` with `@font-face { font-display: swap; }`. Do not link Google Fonts on a site that must work offline.
- Networked sites: the Google Fonts `<link>` with `display=swap`, two families at most, only the weights used.
- Declare a fallback stack with `size-adjust` so the layout holds before the web font arrives, and render the page once with the font blocked to confirm nothing breaks.
- Verify in the rendered page (`document.fonts.check` or the computed style) that the display face loaded. A pairing chosen in the decision sheet and silently replaced by Times is the worst outcome on this list.
