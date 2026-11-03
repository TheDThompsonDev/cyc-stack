# Craft rules

Execution rules with numbers, applied after the signature section passes the [tells score](generic-tells.md#score-sheet) and before the treatment is extended. They make the page consistent; they do not choose its identity.

## Spacing and containers

- One spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px. Section padding 96 to 128 px on desktop, 56 to 72 px on a phone, and not the same in every section.
- Three widths, not one: full bleed for images and bands, about 1280 px for grids, about 720 px (or 65 ch) for reading. A page where everything sits in the same centered 1200 px box is tell 3.
- Phone gutters 16 to 20 px. Primary tap targets at least 44 px tall; checkboxes and radios 24 px or larger, or their label row at least 44 px tall and clickable.

## Surfaces

- One radius for the whole site, chosen from 0, 4, 8 or 999 (pill). Cards at 16, buttons at 8 and badges at 999 on the same page is the default look.
- One surface system: hairline borders (`--line`) on a tinted canvas, or flat color blocks, or sharp-edged panels. Shadows only on things that actually float (a menu, a dialog, a dragged item).
- Exactly one dark section on a light site. Its text is the canvas color, not white.

## Imagery

- Every image has a reason recorded in the decision sheet: which subject, why this crop, what it proves.
- `aspect-ratio` set and `object-fit: cover`; crop for the layout, not the other way round. Decide `object-position` for the phone crop separately.
- One treatment across the site: all warm, or all duotone, or all with a 1 px line, or all untouched. Mixed treatments read as stock.
- No photograph yet: get one (see [visual material](visual-material.md), which covers local-only builds), or render the product as an object and draw an illustration with depth. Never a gray box with an icon, and never a page of type and rules; that is tell 21.
- Local-only sites store assets in the repository with their source and license noted.

## Icons and marks

- One icon set (Lucide, Phosphor, Heroicons, Tabler), one stroke width, 20 or 24 px, inline SVG. No emoji.
- A wordmark set in the display face is a logo. Add a mark only if it means something.

## Details that signal craft

- Eyebrow labels (uppercase, tracked, 11 to 13 px) above display text and section headings, saying something specific.
- Index numerals (01, 02) on lists and steps, set in the display face.
- Hairline rules between rows instead of boxes around them.
- Captions under images; meta lines under titles (date, place, duration, price).
- A footer line with a real-sounding address, hours and one contact, proportional to the site.
- Hover and focus change one property (color, underline offset, background), 150 to 250 ms, and respect `prefers-reduced-motion`.
- `text-wrap: balance` on display and section headings, `text-wrap: pretty` on paragraphs; `touch-action: manipulation` on buttons and links; a `theme-color` meta matching the canvas; the display face preloaded when it is self-hosted.

## Copy

- Nouns from this business: the roast origin, the street, the neighborhood, the service radius, the dish, the lens, the venue, the plan limit. A headline that fits any business is tell 17.
- One primary action per view, labeled verb plus object: "Reserve a table", "Request a quote", "Search the catalog". Not "Get started".
- Reassurance next to the action only when it answers a hesitation: no account needed, free estimate, cancel any time, and only if true.
- Plausible, specific invented details on a demo (a named roaster, a named street) are fine; label demo behavior where a visitor could mistake it for a real save or a real payment, as Rep & Plate does with "Local demo" and "Estimated · editable".

## States

- Empty, loading, error and success states are designed in the same grammar as the rest of the page, not browser defaults. The empty state says what to do next.
- Form errors appear next to the field, name the fix, and keep the entered values.
- Inputs, selects, textareas and buttons get `font: inherit`; a browser default (Arial on Windows) inside a page set in the chosen faces is the first thing a reviewer notices.
- Disabled is visibly disabled and explains why when it matters.

## Navigation

- Header: wordmark, three to five links, one action. On a phone the action stays visible and the menu button opens a real menu that the keyboard can use.
- Skip link, visible focus ring in the accent or brand color, logical tab order, `Escape` closes what opened.

## Phone recomposition

Each archetype in the [catalog](layout-archetypes.md) says how it recomposes. Beyond that: display text at 36 to 44 px, the action within the first screen, the hero image cropped for its new aspect, three-across grids becoming an index list or a two-across grid, and nothing that needs a hover.
