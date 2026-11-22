# Craft rules

Execution rules with numbers, applied once the first screen clears the [floor](../SKILL.md#step-4-build-the-first-screen-and-the-journey-then-measure) and before the system is carried to every page. They make the site consistent; they do not decide what it contains.

## Spacing and containers

- One spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px. Section padding follows the model: 32 to 64 px on a catalog, a booking page or a working surface, where the first screen has to hold real items; 96 to 128 px on a page that persuades. On a phone, 24 to 72 px by the same rule.
- Three widths, not one: full bleed for images and bands, about 1280 px for grids, about 720 px (or 65 ch) for reading. A page where everything sits in the same centered 1200 px box is tell 3.
- Main buttons 44 to 56 px tall at every width, with 16 to 24 px of padding each side. One radius for controls and one for pictures, from the corners chosen in the decision sheet.
- Phone gutters 16 to 20 px. Primary tap targets at least 44 px tall; checkboxes and radios 24 px or larger, or their label row at least 44 px tall and clickable.
- Every other target, at every width, is at least 24 px each way, or has no other target within 12 px of its centre. A footer link gets a 24 px line or block padding. A title link takes the whole row or card, not the 16 px of its text. The [judge](../SKILL.md#step-4-build-the-first-screen-and-the-journey-then-measure) fails a smaller one.

## Surfaces

- Group surfaces by purpose. A button and an event listing can share an edge treatment while the underlying photographic scene stays open. Keep repeated controls visually consistent.
- One surface system: hairline borders (`--line`) on a tinted canvas, or flat color blocks, or sharp-edged panels. Shadows only on things that actually float (a menu, a dialog, a dragged item).
- Make a surface change mark a real transition, such as moving from a finished project to its commission details. A change in scale, density or spacing can carry that transition on a single surface.

## Imagery

- Every image has a reason recorded in the decision sheet: which subject, why this crop, what it proves.
- `aspect-ratio` set and `object-fit: cover`; crop for the layout, not the other way round. Decide `object-position` for the phone crop separately.
- Art-direct each photograph for its role. A candid may fill the opening, a group portrait may sit beside community facts, and a speaker directory may use tightly aligned headshots. Keep related pictures consistent within each group.
- When the visitor needs to see the work, source it or render a representative example at readable scale. In a record-based tool, give that room to the working records and controls. [Visual material](visual-material.md)
- Local-only sites store assets in the repository with their source and license noted.
- Alt text says what the picture shows that the words beside it do not: “Worn tuck box, seal broken, corners rounded”, not the deck's name a second time. Write it for every picture of an item, a person or a place. An empty alt is for decoration only: a texture, a divider, a second view of something already described. The opening photograph gets alt text when it shows the subject.

## Icons and marks

- One icon set (Lucide, Phosphor, Heroicons, Tabler), one stroke width, 20 or 24 px, inline SVG. No emoji.
- A wordmark set in the display face is a logo. Add a mark only if it means something.

## Details that signal craft

- Add a short label when it gives a heading needed context. Remove it if the heading already says the same thing.
- Use index numerals for a sequence the visitor actually follows. For an unordered collection, give that space to the work.
- Hairline rules between rows instead of boxes around them.
- Captions under images; meta lines under titles (date, place, duration, price).
- Close with a useful next action or verified contact details, proportional to the site.
- Hover and focus change one property (color, underline offset, background), 150 to 250 ms, and respect `prefers-reduced-motion`.
- `text-wrap: balance` on display and section headings, `text-wrap: pretty` on paragraphs; `touch-action: manipulation` on buttons and links; a `theme-color` meta matching the canvas; the display face preloaded when it is self-hosted.

## Copy

- Nouns from this business: the roast origin, the street, the neighborhood, the service radius, the dish, the lens, the venue, the plan limit. A headline that fits any business is tell 17.
- Give the main task a clear verb and object, such as "Reserve a table". When returning and first-time visitors have genuinely separate tasks, each can have a distinct entry. Use grouping, placement and emphasis to make the right one easy to find.
- Reassurance next to the action only when it answers a hesitation: no account needed, free estimate, cancel any time, and only if true.
- Plausible, specific invented details on a demo (a named roaster, a named street) are fine; label demo behavior where a visitor could mistake it for a real save or a real payment, with a small tag such as "Local demo" or "Estimated · editable".

## States

- Empty, loading, error and success states are designed in the same grammar as the rest of the page, not browser defaults. The empty state says what to do next.
- Form errors appear next to the field, name the fix, and keep the entered values.
- Inputs, selects, textareas and buttons get `font: inherit`; a browser default (Arial on Windows) inside a page set in the chosen faces is the first thing a reviewer notices.
- Disabled is visibly disabled and explains why when it matters.

## Navigation

- Size the header to the real destinations. Give the main action clear priority and group related routes. On a phone, let labels wrap or move secondary destinations into a keyboard-operable menu while keeping the main action reachable.
- Skip link, a visible focus ring that reaches 3:1 against what it sits on (the brand color when it does, the ink when the brand color is too light), logical tab order, `Escape` closes what opened. The ring may be drawn on a wrapper or a label, as with a styled select or radio, but every control changes visibly when it takes focus; removing an outline without replacing it fails the judge.

## Phone recomposition

Each archetype in the [catalog](layout-archetypes.md) says how it recomposes. Beyond that: display text at 32 to 52 px, the action within the first screen, the hero image cropped for its new aspect, three-across grids becoming an index list or a two-across grid, and nothing that needs a hover.
