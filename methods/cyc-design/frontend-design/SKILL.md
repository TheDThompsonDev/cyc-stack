---
name: frontend-design
description: "Build web interfaces a reviewer cannot mistake for a default AI page. Three gates: a written design decision sheet before any markup, the signature section rendered and scored against the generic-tells list before the page is extended, and a set-divergence table when several sites are requested. Use for new websites, pages, dashboards and visual redesigns. For a narrow UI bug, keep the existing identity and use only the relevant checks."
---

# Frontend design

The page a model writes without instructions is recognizable at a glance: a centered hero, one sans-serif font, three equal cards with icons, a blue or violet accent, rounded corners and soft shadows on everything, the same container and padding in every section. Every site built that way looks like every other site built that way. This method makes that output impossible to ship by requiring three things you can show.

## Gate 1: the decision sheet exists before any markup

Write `design/decisions.md` in the project (or in the run directory when the project forbids new files) using the [decision sheet](references/decision-sheet.md). Every field holds a concrete value: a named typeface pair, eight hex values with roles and their contrast ratios, a layout archetype by name, a signature element, the visual material by kind and source (a photograph stored in `/assets` with its license, a rendered object, an illustration with depth), three candidate headlines in the product's own voice. "Warm and modern" is not a value, and "none, strong type instead" is not a material plan for a site; a tool-dense dashboard may have no photograph, a café, a portfolio or a service may not. Read these first; they are short and they are where the values come from:

- [Generic tells](references/generic-tells.md): the default page, numbered, and what replaces each tell.
- [Typography](references/typography.md): pairings with character notes, sizes, tracking and loading.
- [Color](references/color.md): deriving a palette from the subject, token roles, example palettes.
- [Layout archetypes](references/layout-archetypes.md): nine compositions with CSS skeletons. Archetype 0 is the banned default.
- [Visual material](references/visual-material.md): what counts as imagery, how much a page needs, and how to source photographs when everything must stay local.
- [Reference standards](references/reference-standards.md): what the sites held up as the bar actually do, with observed values.

When several sites or identities are requested, the sheet includes the set-divergence table: no two sites share a layout archetype, a display face, a palette temperature or a hero mechanism. Fill the table before building the first site. A model building five sites in a row reuses its own scaffolding unless divergence is decided up front.

Keep the user's criterion count. Visual quality is a subcondition with a rejection condition ("fail if the opening could belong to any café in any city"), not an extra criterion.

## Gate 2: the signature section is rendered and scored before the page is extended

Build the one section that carries the identity (usually the opening; for a tool or portfolio, the tool or the work) in the real page: final copy, the chosen material actually in place (the downloaded photograph, the rendered board, not a placeholder rectangle), the main action and its next state, and the transition into the next section. Render it at desktop and phone width. Score it with the [generic-tells score sheet](references/generic-tells.md#score-sheet). Three or more tells is a fail, and the fix is a different decision (archetype, type, imagery, copy), not a color swap. Then apply the [craft rules](references/craft-rules.md) and extend the treatment to the rest of the page.

Writing the whole site and taking screenshots at the end skips this gate. Do not skip it.

## Gate 3: the finished page passes the tells check and the experience review

Score the full page at desktop and phone width, including the [density rule](references/visual-material.md#the-density-rule) for material, then run the [experience review](references/experience-review.md) (visual pass, primary-task pass, access pass) with the applicable [UX foundations](references/ux-foundations.md). The access pass includes an executed check, not a reading: axe-core or an equivalent in the rendered page at desktop and phone width, with the contrast ratios and target sizes it reports recorded in the evidence. A contrast rule "computed, not eyeballed" that nobody ran is how a page with a perfect tells score still ships 4.0:1 numerals. Test the decision sheet's rejection condition directly. A page that works, passes every automated check and still reads as a default page has an unmet visual criterion. Say so; do not shrink the criterion to fit the page.

For a set, lay the openings side by side at the same width and the full scrolls side by side. Cover the names and the colors. What remains different must be composition, type, imagery and voice.

## What this method does not require

No mascot, animation, asymmetry or paid assets. A conventional grid in a well-chosen face, with a palette derived from the subject and copy full of that business's nouns, beats a novelty layout. When the project already has a brand system, the decision sheet records it and the gates check adherence to it instead. A narrow repair keeps the existing identity and runs only the relevant checks. Nothing here is machine-enforced; the controller cannot judge taste, so the rendered evidence and the scored sheet are the proof.

## Handoff

Pass the decision sheet, the rendered evidence at both widths, the tells scores and the review findings through [Build](../../cyc-build/SKILL.md) and [Verify](../../cyc-verify/SKILL.md). Keep `design/decisions.md` in the repository so the next change can read why the page looks the way it does.
