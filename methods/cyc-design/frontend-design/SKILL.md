---
name: frontend-design
description: "Design a distinctive, usable website or application screen from a brief as simple as “make my homepage look better.” Use for new pages, dashboards and visual redesigns. For a narrow UI repair, preserve the existing identity."
---

# Frontend design

Own the visual decisions. Someone with an existing project can point to the page and ask for a redesign. Inspect the current page, its destinations, brand assets, and representative content before asking for more input. For a new project, start with the brief and available material. A reference is optional. When supplied, use it to understand taste and verify its sample claims against the project. Ask a plain-language question only if an unresolved fact or preference would materially change the work and a reversible assumption is insufficient.

## Gate 1: the decision sheet exists before any markup

Decide what the visitor should see, feel and be able to do. Ground that direction in something specific you can actually show. For example, a developer meetup can feel like walking up to a table where people are building together. That suggests a close photograph of shared work, a conversational headline and an event within reach. A dispatch tool might open on a late delivery, with the promised time easy to scan and reassignment at hand. Trace important existing offerings and actions into the new page, including what happens below the opening. Treat unconfirmed material as a proposal.

Design the reading order, accessible name and keyboard path of the main action alongside its visual treatment. Identify where the signature idea could make the experience harder to use and how you will test it. Use the project's accessibility requirements and WCAG 2.2 AA as the working target when none is specified. Preserve stricter commitments. The [UX foundations](references/ux-foundations.md) give criteria and exceptions for common design choices.

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

Compose the section that carries the identity with the real headline or task, chosen material, primary action and transition to the next section. For implementation, build this slice in the real page and include the next action state. For a concept request, use the requested mockup format and identify any proposed behavior.

Before the first handoff, compare rendered treatments of the most consequential visual decision. When direction is open, explore different ways to present the same real material. When the brand or direction is settled, compare a focused choice within it, such as the headline weight and crop. Two studies can be successive renders of the same slice. Keep alternatives internal unless the user requests options.

Look at the pictures side by side. Where does the eye land first and next? What do the type size, weight and line breaks do to the actual words? Does the area of accent color lead toward the important content or compete with it? Which detail survives the phone crop? At DSD, a framed table photo made a friendly invitation. A closer view of people looking at a laptop gave “What are you building?” a subject. The yellow mark behind *building?* singled out the word the image answered. Use that reasoning with this project's material.

Before adopting a treatment, exercise its main action on the working slice. Tab to it from the page, see where focus lands, activate it and inspect the next state. Check its accessible name, actual text and control contrast, and narrow-screen reading order. For static concepts, assess the visible risks and specify the intended interaction. Repair a barrier in the treatment and check it again before extending it. For example, move an unreadable photo caption to an opaque print label and keep the photograph at its intended scale.

Choose among the usable treatments on visual merit. Record the difference that decided it in the decision sheet. Check the selected slice at desktop and phone width with the [generic-tells score sheet](references/generic-tells.md#score-sheet) and [craft rules](references/craft-rules.md). Three or more tells fail the check. A low count still needs a visible, project-specific reason to choose this design.

## Gate 3: the finished page passes the tells check and the experience review

For a static concept, judge the rendered composition and identify the actions proposed. Apply the following interaction and browser checks to a working implementation.

Read the full page as a sequence. Cover the hero and inspect the next section and the action it leads to. Can a visitor find concrete evidence for the opening promise? Give a collection, a story and a task the space each needs. Carry a recognizable type or alignment choice across the transition. Remove decoration or repeated copy that competes with the work. Check the result again at reading size and on a phone.

Score the full page, including the applicable [material checks](references/visual-material.md#the-density-rule), and test the decision sheet's rejection condition. Run the [experience review](references/experience-review.md) on the primary journey, including its access pass at desktop and phone widths. Record repairs, retests and remaining gaps. A known accessibility failure in the changed journey keeps it open for repair.

For a set, lay the openings side by side at the same width and the full scrolls side by side. Cover the names and the colors. What remains different must be composition, type, imagery and voice.

## What this method does not require

No mascot, animation, asymmetry or paid assets. A conventional grid in a well-chosen face, with a palette derived from the subject and copy full of that business's nouns, beats a novelty layout. When the project already has a brand system, the decision sheet records it and the gates check adherence to it instead. A narrow repair keeps the existing identity and runs only the relevant checks. Nothing here is machine-enforced; the controller cannot judge taste, so the rendered evidence and the scored sheet are the proof.

## Handoff

Give the owner the preview or working page and show the desktop and phone result. Explain one choice in everyday language by pointing to a visible detail. When a preference remains open, frame it in terms of what the visitor would experience. Carry the decision sheet, renders, tells scores and findings through [Build](../../cyc-build/SKILL.md) and [Verify](../../cyc-verify/SKILL.md). Keep the rationale with the project for its next change.
