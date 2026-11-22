# Review appearance and usefulness separately

Use the project's existing browser or preview tooling. Adapt checks to the changed surface; a copy correction does not require an application-wide audit. Record the route, viewport, exercised state, observation and resulting repair in the existing task evidence. This is a self-review unless someone else actually reviewed it.

## Visual pass

Read the decision sheet's line “Without this method I would have built” and look at the first screen and its next meaningful page or in-place state without rereading the reasons written in the sheet. Could that line describe what was delivered? If so, return to [Step 2](../SKILL.md#step-2-choose-the-site-model-and-its-patterns-by-the-visitors-job), even when the page passed every tell and accessibility check. Then name what a visitor can do on the delivered site that they could not do on that page, and do it in the browser. Keep owner-fixed compositions and conventional interactions within their brief.

Use the measurement scope selected before implementation in Step 4. For a visual public homepage read the [first-screen judge](../SKILL.md#step-4-build-the-first-screen-and-the-journey-then-measure) result for the finished home page at desktop and phone width. A FAIL keeps the work open. A pass says only that the site is neither a brochure nor bare. It does not say the page looks good.

Then use the [generic-tells score sheet](generic-tells.md#score-sheet) at desktop and phone width. Record the numbers, apply its failing check and test the decision sheet's rejection condition. Keep the visual judgment even when the count is zero.

Read the visual criterion before judging the screenshot; when the brief states none, use the decision sheet's rejection condition. If it only names colors, an illustration and readable layout, it cannot establish the intended design quality. Refer back to the decision sheet's model and rejection condition to make the intended effect explicit. Preserve the user's ambition and criterion count; do not rewrite a failed criterion to match the result.

Inspect a representative desktop and phone view. Also inspect the narrowest supported width for a new layout or a suspected breakpoint defect; include a middle width when the transition itself is in question. Choose dimensions from the project; 1440, 390 and 320 CSS pixels are possible samples, not a universal support contract.

Start at the full composition, then inspect normal reading size. Check the first viewport, middle, close and next destination. Ask whether the headline, actual proof and main action form a clear priority. Check density, section continuity, image crop, text wrapping, crowded labels, broken assets and loading shifts. A full-page screenshot is useful for rhythm, but does not prove legibility or interaction.

For each important finding, write an observation that points to a repair: "At phone width the primary action follows three repeated summaries; group those below the action" is usable. "Needs more polish" is not. Repair the highest-impact issue before decorative details, then re-inspect the changed view. Do not call visual taste an objective score.

Trace the visual brief into implemented decisions: the actual asset and crop, dominant composition, type roles, useful interaction and the transition into the next content. Explain why a consequential choice helps this product. Sketch counts, repeated generic study panels and statements such as "clear hierarchy" are not evidence of resolved design. Inspect the ordinary reading-size view as well as the full page: a good overview can hide weak typography, placeholder imagery or unfinished controls. No finding quota is required; report a real miss when present, and do not invent a repair to certify the review.

Evaluate the product-specific visual acceptance criterion and its rejection condition explicitly. "Screenshots opened; no clipping" establishes an inspection and a layout observation, not an art-direction pass. A theme description is also insufficient: identify what the visitor can see, why it achieves or misses the intended effect, and any repair. Ask whether a generic starter could pass on the same evidence. A photographer's work buried beneath a slogan or a search tool buried beneath a marketing hero can fail the intended emphasis while remaining readable and functional. Judge against the actual brief, not a universal rule that every site needs an image or search above the fold. A material miss remains unmet even when behavior checks pass.

For several unrelated identities, add a comparison across the set: view openings at the same viewport and compare the full scroll. Judge the complete expression, then set names, colors and illustration subjects aside to expose shallow reuse. Inspect hierarchy, imagery and its integration, density, navigation, voice and where the useful interaction begins. A shared split or centered layout is not itself a defect; identify whether execution makes the products meaningfully distinct. A screenshot row is evidence to judge, not a passing result. Repair convergence when variety was requested; preserve shared-brand consistency. Never derive an originality score from pixel or DOM differences.

Apply the relevant [UX foundations](ux-foundations.md) to the chosen visual mechanisms. Keep visual observations separate from tested behavior; a screenshot of a control does not show whether it works or is accessible.

## Primary-task pass

Start from the study decision saved in the project sheet. On the recorded route, identify the actual item, time, filter or variant. Follow it to the destination and back at desktop and phone widths. Check the label, unit, selected state and return focus that matter to that task. On a one-view tool, inspect the in-place change and how someone reverses it. Add the observed outcome or the remaining evidence gap to the same sheet. A cited practice or a screenshot alone cannot demonstrate continuity.

Follow the promised action to its outcome. A modal opening is not a completed booking, a submit click is not a saved record, and a toast alone is not persistence evidence. Where the feature promises saving, check the displayed result and reload or revisit it. Check cancellation and an applicable failure/recovery path using permitted test fixtures, not consequential live submissions.

Use honest first-use state, representative populated state, and an edge state that could break this layout. Depending on the feature, that might mean a long name, missing photo, large value, many rows, narrow locale, delayed response or validation error. Exercise only states relevant to the feature. Avoid filling production screens with invented success, progress, testimonials or personal records to make them look complete.

In a prototype, local state and example data can be the intended outcome. Label that boundary where users might mistake it for a real save or external action. Prefer a working local demonstration or honest unavailable control to a fake success alert. Report the precise missing integration.

## Access and comfort pass

The [judge](../SKILL.md#step-4-build-the-first-screen-and-the-journey-then-measure) has already counted, on each page you measured, the language and title, alt attributes, field labels, link and button names, tap-target size, a visible change on focus and contrast on solid backgrounds and, from the two screenshots, behind text on photographs. It cannot tell whether an alt describes the picture, whether the tab order makes sense, whether an error is announced, or whether text stays readable on a video, a slideshow or an animation. This pass is those.

Scan the rendered page with axe-core or an equivalent at desktop and phone widths. Exercise the relevant opened, error or success state and scan changed controls there too. Investigate incomplete results, particularly text over photos or translucent surfaces. Measure the actual foreground/background at the least legible part under the text, or give it a known surface and retest. Record the state and result. Leave an uncheckable item visibly unverified.

- Start with the keyboard at the page entry. Use Tab and Shift+Tab to reach the main control and Enter or Space as appropriate to its role. Check visible, unobscured focus, dialog containment where needed, close and return. Clicking a control or calling `focus()` directly can hide a missing tab stop.
- Follow focus through recovery too. If a Retry button disappears while content reloads, check where the keyboard user lands and how they learn the outcome.
- Inspect names, roles, states, heading order, meaningful alternatives and form error associations in the browser's accessibility tree. Check reading order when layouts reorder content. If assistive technology is available, exercise the changed journey with it and name the tool used. Record a tree inspection as such.
- Enlarge text to 200% and check the primary task for clipping or lost controls. Check reflow of vertical content at a 320 CSS pixel viewport, allowing applicable two-dimensional content exceptions. Inspect the action's touch target and spacing. Apply the [criterion-specific guidance](ux-foundations.md#keep-visual-treatment-accessible).
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
