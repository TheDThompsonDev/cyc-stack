# Decision sheet

Write this before any markup, as `design/decisions.md` in the project. Every field holds a value a reviewer could check against the rendered page, and the palette line carries the contrast ratios the script in [color](color.md) printed. Adjectives are not values. Two filled examples follow the template, then the set-divergence table for several sites.

## Template

```markdown
# Design decisions: <site>

Subject and audience: <who arrives, what they came to do, what they already know>
Premise (one sentence a visitor could verify in the first screen): <...>
Rejection condition: fail if <the opening could belong to any ... / the work is buried under a slogan / ...>

Opening archetype: <1 to 4 from layout-archetypes.md> because <...>
Content archetypes: <5 to 9> for <which sections>
Section plan: <section: its job, its surface (canvas / brand-dark / image), its density>

Display face: <name, weight> · Text face: <name> · Accent voice: <italic phrase / handwritten word / none>
Display size: <desktop px / phone px>, tracking <−0.0x em>, line height <x>

Palette (canvas, surface, ink, ink-muted, brand, accent, accent-ink, line): <8 hex values>
Contrast (from the script in color.md): <ink/canvas, muted/canvas, canvas/brand, accent-ink/canvas, accent display/canvas>
Derived from: <two materials and a place>
Radius: <0 / 4 / 8 / 999> · Surface system: <hairline / flat blocks / sharp panels> · Dark section: <which one>

Signature element: <the one thing a visitor would describe afterwards>
Imagery (see visual-material.md): <kinds: photograph / rendered object / illustration / surface / texture / map>, <subject, crop, treatment>, <source and license, stored in /assets>. "None" only for a tool-dense screen, with the reason.
Icons: <set, stroke, size>

Voice: <how it talks> · Headline candidates: 1. <...> 2. <...> 3. <...>
Primary action: <verb + object> → <what happens next, and what is demo>

Tells to watch: <numbers from generic-tells.md this subject tends to attract>
```

## Example: café

```markdown
# Design decisions: Halvard Coffee, Ballard

Subject and audience: a neighborhood café that roasts on Thursdays; regulars checking hours and the week's filter, newcomers deciding whether to walk over.
Premise: the first screen shows the counter in morning light, this week's coffees and the hours, so you can decide to come in without reading a paragraph.
Rejection condition: fail if the opening could belong to any café in any city, or if the menu is three cards with cup icons.

Opening archetype: 1, split with bleed, because the one good photograph is the counter and it should run off the right edge.
Content archetypes: 9, index list, for the menu and the weekly filters; 7, stacked bands, for the roasting-day story on a dark band.
Section plan: opening (canvas, airy) → this week's filters as an index list (canvas, dense) → roasting Thursdays (brand-dark band, one statement and three facts) → menu by category (canvas, index list) → find us (image band with a map crop and the hours line).

Display face: Fraunces 500, optical size 96 · Text face: Work Sans · Accent voice: Fraunces italic on "roasted here"
Display size: 84 px / 40 px, tracking −0.03 em, line height 1.0

Palette: #f6efe4 #fff9ef #2a1f16 #6d5d50 #3b2419 #c9772b #995d25 #e4d6c3
Contrast: ink 14.1, muted 5.5, canvas on brand 12.7, accent-ink 4.7, accent display 2.99 (fails 3:1, so the accent word in the headline uses accent-ink)
Derived from: espresso and crema, the cream paper of the menu board, the counter at 7 a.m.
Radius: 4 · Surface system: hairline on tinted canvas · Dark section: roasting Thursdays

Signature element: the weekly filter list with origin, process and tasting notes, set like a wine list with index numerals.
Imagery: counter photograph (Openverse, CC BY, author noted in /assets/SOURCES.md) cropped to keep the grinder and the window light, warm treatment, bleeding off the right edge; the day's board rendered as a dark chalkboard panel; bean close-up behind the dark band at 8 percent texture; a drawn street map in the footer. Material kinds: photograph, rendered object, surface, map.
Icons: Lucide, 1.5 px stroke, 20 px, only for hours, map and phone.

Voice: short, specific, no exclamation marks · Headline candidates: 1. Roasted here on Thursdays. 2. Two shots, textured milk, no hurry. 3. The 6:30 pour for the 7:15 ferry.
Primary action: "See this week's coffees" → scrolls to the index list; "Order ahead" is labeled demo and shows the pickup form with a saved-locally notice.

Tells to watch: 2, 16 (cup icons), 17 ("crafted with care").
```

## Example: home-repair service

```markdown
# Design decisions: Keel & Timber Home Repair

Subject and audience: homeowners with something broken today; they want to know if the job is covered, what it costs and how fast someone comes.
Premise: the first screen asks for the problem and the zip code and promises a window, with the plan limits visible directly beneath.
Rejection condition: fail if the opening is a slogan over a stock handshake, or if the services are three equal cards with a wrench, a pipe and a plug.

Opening archetype: 4, tool first, because the visitor came to request a repair, not to be welcomed.
Content archetypes: 9, index list, for services with their response windows and from-prices; a real table for plan comparison; 7, stacked bands, for one dark band with the service radius and the crew.
Section plan: brand band with the request card (dense) → services index (canvas) → plan table with actual limits (surface) → crew and radius (brand-dark band with a photograph of a technician at a real door) → request again, short.

Display face: Bricolage Grotesque 800 · Text face: Figtree · Accent voice: none; the numbers are the voice
Display size: 64 px / 38 px, tracking −0.02 em, line height 1.05

Palette: #f3f4f1 #ffffff #15202b #55606b #1f3a5f #e4572e #b94b2d #d6dad3
Contrast: ink 14.9, muted 5.8, canvas on brand 10.4, accent-ink 4.6, accent display 3.3
Derived from: workwear navy, safety orange, plaster dust, galvanized conduit.
Radius: 8 · Surface system: flat blocks and hairlines · Dark section: crew and radius

Signature element: the request card with the problem picker and the promised window ("today before 6 pm" / "tomorrow 8 to 12").
Imagery: one photograph of a technician at a door in a branded jacket, cropped to the handshake and the jacket mark; conduit and copper close-ups for the dark band.
Icons: Phosphor regular, 24 px, in the problem picker only.

Voice: plain, direct, numbers first · Headline candidates: 1. Broken today. Fixed today. 2. Tell us what failed; we tell you when. 3. Twelve miles, four crews, one window.
Primary action: "Request a window" → confirmation with the chosen window; labeled demo, nothing sent.

Tells to watch: 2 (service cards), 5 (invented 10k+ repairs), 11 (blue accent is close to navy; keep orange as the only accent).
```

## Set divergence (several sites)

Fill this before building the first site. No two rows share a column value.

| Site | Opening archetype | Display face | Palette temperature | Hero mechanism | Signature element |
| --- | --- | --- | --- | --- | --- |
| Café | 1 split with bleed | Fraunces | warm cream | counter photograph bleeding right | weekly filter index list |
| Photography portfolio | 5 editorial grid as the opening | Playfair Display | dark | one lead image at 8 columns, no headline above it | project sequence with captions |
| Searchable catalog | 4 tool first | Space Grotesk | cool paper | search input on a signal-color band | results as an index list with tabular numbers |
| Event registration | 3 typographic poster | Syne | night with one hot accent | 120 px date and venue, no image | the schedule as a sticky-panel scroll |
| Home-repair service | 4 tool first (different band color and card content from the catalog) | Bricolage Grotesque | neutral with orange | problem picker and zip code | plan table with actual limits |

Two sites sharing archetype 4 is allowed only when band color, card content and the next section differ; mark it in the table, as above. If the table cannot be filled without repetition, the set does not yet have five identities.
