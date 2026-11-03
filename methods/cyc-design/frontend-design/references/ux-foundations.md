# Apply established UX principles to the chosen visual idea

Use while planning and reviewing the relevant frontend flow. Preserve the product's character while making its choices understandable and usable. The principles below support judgment; they do not prove that a particular reference, design or implementation works. Sources were consulted on 2026-11-02.

## Direct attention and group meaning

Use relative scale, spacing, alignment, contrast and grouping to establish a reading/action order. Visually connect related information and distinguish different jobs. Balance the amount and placement of visual weight; symmetry is optional. Inspect the composition at ordinary reading size as well as a small overview. These decisions adapt [NN/g's visual-design principles](https://www.nngroup.com/articles/principles-visual-design/).

For this product, identify the primary decision, its supporting evidence and the next action. Make that relationship visible. Emphasis should reflect importance rather than making every heading large or every block a card. A decoration can be prominent when it contributes meaning; judge the whole composition rather than applying a density quota.

## Make the interaction understandable and recoverable

The following review questions adapt [Nielsen's usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/):

| Principle | Design decision | Verify in the relevant flow |
| --- | --- | --- |
| Familiar language and recognition | Use the audience's terms, visible options and consistent action patterns | Can someone choose the next step without remembering hidden instructions or decoding an invented control? |
| Visible status | Show the current selection, progress and actual outcome | Do loading, saving, failure and completion accurately reflect the underlying operation? |
| Control and recovery | Provide appropriate cancel, back, edit or undo; preserve useful input | Can someone correct a mistake without losing unrelated work or repeating an effect? |
| Prevention before repair | Explain relevant requirements and constrain invalid choices | Can an invalid or unavailable option lead to a misleading success? |

Reduce competing decisions where they impede this task; keep important choices discoverable. Do not hide the central function to make the page look cleaner. A novelty treatment should not require learning a new navigation convention without a product reason.

## Keep visual treatment accessible

Use the project's applicable accessibility target. For work targeting WCAG 2.2, the following are concrete considerations, not a complete conformance checklist. Read the linked criterion for its exact scope and exceptions when a boundary case matters.

| Concern | Implementation and check | Primary source |
| --- | --- | --- |
| Text on photos, gradients or translucent surfaces | Check actual rendered backgrounds and interaction states. AA text contrast is generally at least 4.5:1, or 3:1 for qualifying large text, with stated exceptions. | [Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Small or crowded controls | Make pointer targets practical to activate. SC 2.5.8 uses 24×24 CSS pixels or applicable exceptions such as sufficient spacing; do not incorrectly call 44×44 a universal AA rule. Larger touch targets can still be a good design choice. | [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Enlarged text and narrow views | Preserve content and functionality when reflowing at 320 CSS pixels for vertical content, with the criterion's exceptions for inherently two-dimensional parts. Inspect zoom and content rather than only page width. | [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Floating navigation, chat and banners | Follow the keyboard path and ensure author-created layers do not entirely hide the focused component; prefer keeping it fully visible. | [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| Automatic tours and moving compositions | Provide pause/stop/hide or update controls when the criterion applies. For nonessential automatic motion alongside other content lasting more than five seconds, a decorative label or reduced-motion mode alone is not a substitute for the required control. | [Pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) |
| Styled forms and compact input/action groups | Supply visible labels or necessary instructions. An accessible name alone does not establish visible input guidance; labels also need correct programmatic association. | [Labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) |

Keep semantic controls, meaningful alternatives, logical keyboard order and appropriate focus behavior while composing visual layers. Choose project-supported tools for access checks and inspect the journey manually where needed. A screenshot can suggest a question; it cannot establish keyboard operation, semantics or conformance. Automated results are limited to the rules and states actually exercised.

## Preserve character under real conditions

Check the chosen idea with representative long content, a missing or delayed asset, first use and a relevant failure state. On phones, preserve the meaning of the subject and primary action while rearranging secondary layers. Avoid simply scaling down the desktop composition or removing every expressive detail. Reserve media space and choose suitable assets so the interface remains usable as content loads; measure any performance claim with the project's tools rather than inferring it from the screenshot.

Use a concrete critique: observation → affected user/task → smallest repair → recheck. A photo layer that obscures a label calls for crop, positioning or surface changes; it does not automatically invalidate photography. A product preview that cannot be understood at the displayed size may need a focused crop or interactive explanation rather than more ornament.

The [experience review](experience-review.md) records visual judgment, behavior checks, access observations and actual user acceptance separately. No fixed palette, font blacklist, universal card ban or requirement to maximize originality follows from these principles.
