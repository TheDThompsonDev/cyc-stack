# Layout archetypes

Nine compositions, each with a sketch, a CSS skeleton, when it fits and how it recomposes on a phone. Pick one by name in the decision sheet. Archetype 0 is the default a model produces unprompted; it is not available unless an existing brand system requires it.

Column widths below assume a 12-column grid on a 1280 px content width with full bleed allowed outside it.

## 0. Centered hero and card grid (banned)

```text
[            headline            ]
[            subhead             ]
[     (button)   (button)        ]
[ card ] [ card ] [ card ]
```

Tells 1, 2 and 3 on the [generic list](generic-tells.md) in one screen. Not an option.

## 1. Split with bleed

```text
| eyebrow                  |                        |
| DISPLAY HEADLINE         |   image bleeds to      |
| two-line subhead         |   the viewport edge    |
| (action)  trust · row    |   and is taller        |
```

```css
.hero { display: grid; grid-template-columns: 5fr 7fr; min-height: 80vh; }
.hero__media { margin-right: calc(50% - 50vw); } /* bleed */
.hero__media img { width: 100%; height: 100%; object-fit: cover; }
```

Fits: a service with one strong photograph of the work or the person. Phone: image first at full width, cropped 4:5, then text; the action stays within the first screen.

## 2. Full-bleed scene

```text
+----------------------------------------------+
| eyebrow                       photo fills     |
| DISPLAY HEADLINE              the viewport;   |
| subhead                       subject sits in |
| (action)  trust · row         the right half  |
+----------------------------------------------+
   next section overlaps upward by 64 px
```

```css
.scene { position: relative; min-height: 92vh; display: grid; align-content: center; }
.scene__img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 70% center; }
.scene__copy { position: relative; max-width: 36rem; padding-inline: 6vw; z-index: 1; }
.scene__scrim { position: absolute; inset: 0; background: linear-gradient(90deg, var(--canvas) 30%, transparent 70%); }
.next { margin-top: -4rem; position: relative; }
```

The scrim covers only the text half; the subject keeps its detail. Fits: a product with a person in it, hospitality, anything where atmosphere is the promise. Phone: change `object-position` to keep the subject, scrim from the bottom, text at the bottom of the scene. Observed at Undersold.ai.

## 3. Typographic poster

```text
| EYEBROW                                         |
| VERY LARGE DISPLAY,                             |
| accent word in a second color.                  |
| ------------------------------------------------|
| paragraph in a narrow column   |  second column |
```

```css
.poster h1 { font-size: clamp(3.5rem, 9vw, 8.5rem); line-height: 0.95; letter-spacing: -0.04em; }
.poster__cols { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; border-top: 1px solid var(--line); padding-top: 2rem; }
```

No image in the opening; a full-bleed photograph or rendered object must arrive in section two, within the second viewport, or the page is tell 21. Fits: events, studios, a catalog with a strong name, anything where the name carries more than any available photograph. Not a way to avoid sourcing images. Phone: headline at 44 px, columns stack, the rule stays.

## 4. Tool first

```text
+---------------------- brand band ----------------------+
|  +----------------- surface card -------------------+  |
|  | eyebrow                                           |  |
|  | HEADLINE in display face                          |  |
|  | [ input field          ] (action)                 |  |
|  | one line of reassurance                           |  |
|  +---------------------------------------------------+  |
+--------------------------------------------------------+
| results / list / plans directly beneath                |
```

```css
.band { background: var(--brand); padding-block: 4rem 6rem; }
.tool { background: var(--surface); max-width: 48rem; padding: 2.5rem; border-radius: var(--radius); }
.tool form { display: grid; grid-template-columns: 1fr auto; gap: 0.75rem; }
```

The main action is the opening; explanation follows. Fits: catalogs, registrations, quote finders, anything the visitor came to use. Phone: the card fills the width with 16 px gutters; the input and button stack. Observed at ahs.com (zip-code input beside the primary action).

## 5. Editorial grid

```text
| hero item (8 cols)                  | item (4) |
|                                     | item (4) |
| item (4) | item (4) | item (4)                 |
| caption in eyebrow style under each item       |
```

```css
.work { display: grid; grid-template-columns: repeat(12, 1fr); gap: 1.5rem; }
.work > * { grid-column: span 4; }
.work > :first-child { grid-column: span 8; grid-row: span 2; }
.work img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
```

One item leads; the others are secondary on purpose. Fits: portfolios, menus with photographs, project lists. Phone: the lead item full width, the rest in a two-column grid, captions kept.

## 6. Sidebar workspace

```text
| brand     |  breadcrumb                 status · avatar |
| nav item  |  eyebrow date                               |
| nav item  |  Display greeting, italic accent.           |
| nav item  |  [ ring chart card  ] [ photo action card ] |
|           |  [ stat ] [ stat ] [ note ]                 |
| footer    |  list of records with small photos          |
```

```css
.app { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
.main { padding: 2rem 3rem; display: grid; gap: 2rem; }
.row-2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 1.5rem; }
.row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
```

Cards differ in content shape (a chart, a photo with a button, a number with a sentence); same-shaped cards are tell 2. Fits: dashboards, daily tools. Phone: the sidebar becomes a five-item bottom bar, rows stack, the greeting stays in the display face. Observed in Rep & Plate.

## 7. Stacked bands

```text
| canvas band: headline + image                   |
| brand-dark band: the one statement, 3 facts     |
| full-bleed image band with a caption            |
| canvas band: plan table                         |
```

```css
.band { padding-block: clamp(4rem, 10vw, 8rem); }
.band--dark { background: var(--brand); color: var(--canvas); }
.band--image { padding: 0; aspect-ratio: 21 / 9; }
.band > .inner { max-width: 80rem; margin-inline: auto; padding-inline: clamp(1rem, 5vw, 4rem); }
```

Each band has its own internal grid and its own density. Fits: service sites with several audiences, long marketing pages. Phone: bands keep their surfaces; the image band becomes 4:5.

## 8. Sticky panel scroll

```text
| sticky: eyebrow           |  step 01  title, text        |
|         HEADLINE          |  step 02  title, text        |
|         (action)          |  step 03  title, text        |
|                           |  step 04  title, text        |
```

```css
.steps { display: grid; grid-template-columns: 5fr 7fr; gap: 4rem; }
.steps__panel { position: sticky; top: 6rem; align-self: start; }
.step { display: grid; grid-template-columns: 4rem 1fr; padding-block: 2.5rem; border-top: 1px solid var(--line); }
.step__num { font-family: var(--display); font-size: 2.5rem; }
```

Fits: a process, a menu by category, a gallery with a persistent caption. Phone: the panel unsticks and sits above the list.

## 9. Index list

```text
| 01 | Flat white          | Two shots, textured milk       | 4.20 |
| 02 | Cortado             | Equal parts, 4 oz glass        | 3.90 |
| 03 | Filter, Kiambu      | Washed, black tea, stone fruit | 4.50 |
```

```css
.index__row { display: grid; grid-template-columns: 3rem 1fr 2fr auto; gap: 1.5rem; padding-block: 1.25rem; border-bottom: 1px solid var(--line); align-items: baseline; }
.index__num { font-family: var(--display); font-size: 1.5rem; color: var(--ink-muted); }
.index__price { font-variant-numeric: tabular-nums; }
```

The list is the design; no cards. Fits: menus, services, schedules, specifications. Phone: number and title on one line, description beneath, price right-aligned on the first line.

## Combining

A page uses one opening archetype (1 to 4) and one or two content archetypes (5 to 9). Changing archetype between sections is the rhythm; repeating one archetype with different content is tell 3.
