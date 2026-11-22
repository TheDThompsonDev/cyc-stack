# Frontend method: open findings

Kept from two reviews of 2026-11-22: an audit of the method in `methods/cyc-design/frontend-design/`, and a review of the eight studies in this folder, the field guide and the skill. Items that have since been done are listed at the end. Each open item says what was observed and the smallest fix.

## Evidence

| Finding | Observed | Smallest fix |
| --- | --- | --- |
| Tuned on few builds | Each change answered the comparison before it, on four small-business briefs, one build each. `evals/` has no frontend case. The three-brief test on 2026-11-22 went three of three for the method, still one build each, judged by a floor partly set from the owner's taste. | Keep eight to ten briefs in `evals/`, two or three builds per condition, three briefs never used while tuning |
| The bar is eight large sites | Six of the eight are very large companies linking 58 to 291 pages. The floor of 12 actions comes from their navigation. | Study six to eight excellent small sites of the kinds people ask for |
| The studies record virtues only | One shortcoming in 278 bullets, though the probe reported access FAILs on every studied page it ran on. A study's reason for each practice is the reviewer's inference, in the same voice as the measurement. | Add "what this site gets wrong" to each study, starting with the probe's access findings |

## Coverage

| Finding | Observed | Smallest fix |
| --- | --- | --- |
| Work inside an existing product | One sentence covers an existing design system. Nothing on tables, forms, charts, density or application states, though the description promises dashboards. | A first branch in Step 1 for existing components and tokens, and one reference for working screens |
| Performance, search and sharing | No `srcset`, image formats, `fetchpriority`, load measurement, meta description, Open Graph or structured data, while the method favors a photograph over most of the first screen. | One short reference page, and judge notes for image weight, a description and a share image |

## Rules and tools

| Finding | Observed | Smallest fix |
| --- | --- | --- |
| The cream-with-serif FAIL | `color.md` and `typography.md` recommend a warm tint and a serif for the same subjects and forbid the pair. It fails the card shop the owner praised and one of the eight models. All three builds without the method on 2026-11-22 chose it again. | Report it as a note that needs a reason from the subject in the sheet |
| Counted floors | The action floor was met once with rows of small controls. `--one-page` still fails a focused single page under 12 actions or 3 screens. | Keep access as the hard gate; let a written reason clear the content floors |
| Weight and running | About 29,000 words; a sheet of about 30 fields; Step 4 needs two probe runs, four screenshots and a judge call, and no script opens a browser. A working harness that does all of it, `measure-site.mjs`, was written for the 2026-11-22 builds and kept outside the repository. | Ship one measuring command based on that harness; give each number one home |
| Three groupings of the same sites | The site models, the field guide chapters and the pattern groups divide the eight sites differently, and no file maps one to another. | One table for model, chapter and first screen |
| Look values in the guide | 65 of the guide's entries record one site's sizes and colors, which Step 3 says not to reuse. | Move them to each model's "look seen with it" line, labelled as examples |
| No pictures | The method teaches a visual craft in words only. | Two or three annotated renders of builds the owner liked |

## Claims that do not match the research

- `SKILL.md` gives 14 to 89 actions, 7 to 293 pages and 4 to 30 pictures; `reference-standards.md` tops out at 88, 291 and 22.
- "Main buttons are 44 to 56 px tall" is listed as observed on the sites; one primary action measured 156 × 38 px.
- `color.md` says one color does the main action on every site; one card carried a green eligibility button above a blue application button.

## Stale lines

- `methods/cyc-design/SKILL.md` line 10 describes the old sheet: "archetype, type, palette, signature element, rejection condition."
- `CHANGELOG.md` under Unreleased still says the default opening is a full-width photograph, which later changes replaced.
- `patterns.md` says navigation has no icons on every site; one studied finder's signature move is illustrated category icons.
- `layout-archetypes.md` calls the centered hero "banned"; the product-showcase model opens on a centered headline with two buttons.

## Done

- The current method had no judged build. Two now exist: a ferry pair the owner judged, and the three-brief test of 2026-11-22, recorded in the [design history](../context/frontend-design.md).
- The field guide kept each study's first sentence, often the setup (183 of 278 entries). Rewritten in run c998570f.
- Practices seen on several sites were scattered across chapters. The guide now opens with seventeen of them, counted.
- First-person entries and proprietary typeface names in the guide were removed in the same run.
