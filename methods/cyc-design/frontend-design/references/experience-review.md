# Review appearance and usefulness separately

Use the project's existing browser or preview tooling. Adapt checks to the changed surface; a copy correction does not require an application-wide audit. Record the route, viewport, exercised state, observation and resulting repair in the existing task evidence. This is a self-review unless someone else actually reviewed it.

## Visual pass

Score the view first with the [generic-tells score sheet](generic-tells.md#score-sheet) at desktop and phone width and record the numbers. Three or more tells is a fail whatever the rest of this pass finds, and the repair is a changed decision in `design/decisions.md`, not a color swap. Then read the sheet's rejection condition and judge the render against it.

Read the visual criterion before judging the screenshot. If it only names colors, an illustration and readable layout, it cannot establish the intended design quality. Refer back to the decision sheet's premise and rejection condition to make its intended effect and rejection condition explicit. Preserve the user's ambition and criterion count; do not rewrite a failed criterion to match the result.

Inspect a representative desktop and phone view. Also inspect the narrowest supported width for a new layout or a suspected breakpoint defect; include a middle width when the transition itself is in question. Choose dimensions from the project; 1440, 390 and 320 CSS pixels are possible samples, not a universal support contract.

Start at the full composition, then inspect normal reading size. Check the first viewport, middle, close and next destination. Ask whether the headline, actual proof and main action form a clear priority. Check density, section continuity, image crop, text wrapping, crowded labels, broken assets and loading shifts. A full-page screenshot is useful for rhythm, but does not prove legibility or interaction.

For each important finding, write an observation that points to a repair: "At phone width the primary action follows three repeated summaries; group those below the action" is usable. "Needs more polish" is not. Repair the highest-impact issue before decorative details, then re-inspect the changed view. Do not call visual taste an objective score.

Trace the visual brief into implemented decisions: the actual asset and crop, dominant composition, type roles, useful interaction and the transition into the next content. Explain why a consequential choice helps this product. Sketch counts, repeated generic study panels and statements such as "clear hierarchy" are not evidence of resolved design. Inspect the ordinary reading-size view as well as the full page: a good overview can hide weak typography, placeholder imagery or unfinished controls. No finding quota is required; report a real miss when present, and do not invent a repair to certify the review.

Evaluate the product-specific visual acceptance criterion and its rejection condition explicitly. "Screenshots opened; no clipping" establishes an inspection and a layout observation, not an art-direction pass. A theme description is also insufficient: identify what the visitor can see, why it achieves or misses the intended effect, and any repair. Ask whether a generic starter could pass on the same evidence. A photographer's work buried beneath a slogan or a search tool buried beneath a marketing hero can fail the intended emphasis while remaining readable and functional. Judge against the actual brief, not a universal rule that every site needs an image or search above the fold. A material miss remains unmet even when behavior checks pass.

For several unrelated identities, add a comparison across the set: view openings at the same viewport and compare the full scroll. Judge the complete expression, then set names, colors and illustration subjects aside to expose shallow reuse. Inspect hierarchy, imagery and its integration, density, navigation, voice and where the useful interaction begins. A shared split or centered layout is not itself a defect; identify whether execution makes the products meaningfully distinct. A screenshot row is evidence to judge, not a passing result. Repair convergence when variety was requested; preserve shared-brand consistency. Never derive an originality score from pixel or DOM differences.

Apply the relevant [UX foundations](ux-foundations.md) to the chosen visual mechanisms. Keep visual observations separate from tested behavior; a screenshot of a control does not show whether it works or is accessible.

## Primary-task pass

Follow the promised action to its outcome. A modal opening is not a completed booking, a submit click is not a saved record, and a toast alone is not persistence evidence. Where the feature promises saving, check the displayed result and reload or revisit it. Check cancellation and an applicable failure/recovery path using permitted test fixtures, not consequential live submissions.

Use honest first-use state, representative populated state, and an edge state that could break this layout. Depending on the feature, that might mean a long name, missing photo, large value, many rows, narrow locale, delayed response or validation error. Exercise only states relevant to the feature. Avoid filling production screens with invented success, progress, testimonials or personal records to make them look complete.

In a prototype, local state and example data can be the intended outcome. Label that boundary where users might mistake it for a real save or external action. Prefer a working local demonstration or honest unavailable control to a fake success alert. Report the precise missing integration.

## Access and comfort pass

Run an automated check in the rendered page first (axe-core through Playwright or the browser extension, or Lighthouse) at desktop and phone width, and record every reported contrast ratio and target size in the evidence. The decision sheet's script checks the palette; this step checks what the page actually rendered, including text on photographs, the dark band and button labels. Then:

- Follow the primary path with a keyboard. Check focus visibility, logical order, activation, modal containment where needed, Escape/close and focus return.
- Inspect labels and semantic roles for controls, alternatives for meaningful images and text equivalents for visual data. Icon-only actions need accessible names. Check reading order when layouts reorder content.
- Check contrast and legibility on actual surfaces, zoom/reflow, and targets that are practical to tap. Use project or applicable accessibility requirements; visual taste does not excuse inaccessible controls.
- Check fixed navigation, banners and overlays for obscured actions or content. Phone keyboards and safe areas matter when they affect the requested input flow.
- Check reduced motion and any automatic tour's pause/manual controls. Read status and errors without relying on animation or color alone.

Run established build, lint, type and behavior checks appropriate to the change. Add focused behavioral coverage for new risky interactions where it adds value; do not make screenshot or CSS-string assertions merely to certify taste. Automated access checks can supplement this pass, not establish that the whole experience is accessible.

## Completion evidence

Report these as separate claims:

| Claim | Supporting evidence | What it does not establish |
| --- | --- | --- |
| Runs | Actual build/start result and route | Visual quality or a completed user journey |
| Looks coherent | Current rendered views, specific inspection and repaired findings | Universal taste or conversion improvement |
| Meets the requested visual direction | Explicit judgment of the visual criterion, with composition evidence; for distinct identities, comparison across the set | That functional checks prove design quality or that novelty alone makes a design good |
| Main task works | Observed action → outcome and relevant recovery/persistence check | Every integration or device works |
| Access checks performed | Named keyboard, contrast, reflow and semantic observations | A formal accessibility certification |
| Direction accepted | The user's actual feedback on that direction | Acceptance of later unrelated revisions |

The handoff should let another person open and use the work: give the entry route or file, run instructions when needed, working scope, current visual evidence and material limits. When rendering is unavailable, continue useful implementation or review within scope, but label visual verification unperformed. Do not replace missing evidence with "responsive by design" or "production-ready."
