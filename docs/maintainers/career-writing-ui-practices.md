# UI and UX practices worth borrowing from a résumé-writing product

The strongest choice is showing how a sentence improves. A résumé writer can be skeptical of a polished rewrite and still judge whether the new version says who did the work, how it was measured, and what changed. The site gives visitors that experience before asking them to hand over their own résumé.

Reviewed November 22, 2026, in Edge. I inspected the homepage, score page, and pricing at 1,440 × 900 and 390 × 844, plus the desktop process explainer and public sample workspace. Font, size, color, and control measurements below are computed CSS values at those widths. I used fictional examples already supplied by the site and stopped at the résumé-entry dialog. Scores, saved-work policies, and pricing below describe what the public interface showed.

## The first screen

- **Open with a problem the visitor recognizes.** The desktop headline speaks to someone who has experience and struggles to prove its value. The phone version gets even more specific by pointing out that their résumé leaves good work out. Either opening makes sense before the visitor knows the product. [Homepage][home]
- **Show the method in miniature.** Beside a photograph of someone working at a laptop, three chat bubbles show a question, a plausible answer, and a sharper follow-up about users and impact. That third bubble demonstrates something a generic promise about AI writing would leave unexplained.
- **Compose the photograph around the text.** The person and laptop occupy the right side of the desktop hero. The image fades into cream toward the headline, giving the copy a quiet background while keeping the subject large enough to recognize.
- **Speak to two levels of readiness.** A filled green button starts the résumé path. A lighter, play-marked link opens the explanation. Visitors who want evidence can investigate without entering the intake flow.
- **Put reassurance where hesitation occurs.** Directly beneath the hero actions, three compact notes explain that scores come with reasons, which drafts the visitor keeps, and that a card is unnecessary to start. Each answers a different objection.
- **Set expectations about the product’s maturity.** A short open-beta note sits in the introduction. Someone deciding whether to share important work sees that qualification before they begin.
- **Rebuild the introduction for a phone.** At 390 px the homepage leads with shorter copy, one **350 × 54 px** primary button, and four steps arranged two by two. It brings the interactive writing example forward. The desktop photograph and conversation can do their job without being squeezed into the phone layout.

## Typography, color, and composition

- **Give the three typefaces separate jobs.** **DM Serif Display** carries major headings, **DM Sans** carries body text and controls, and **Kalam** adds a handwritten emphasis. A visitor can recognize the editorial statement, the practical instruction, and the personal aside by their appearance. [Homepage][home]
- **Give the headline a compact silhouette.** At 1,440 px the homepage heading measured **51.84 px**, weight **400**, with **53.40 px** line height and **−1.81 px** letter spacing. Its two lines read as one thought. The score page uses the same serif at about **63 px** to introduce its single-purpose offer. [Score page][score]
- **Spend the handwritten accent on meaningful words.** On the desktop homepage, only the phrase about proving the work switches to Kalam, with a drawn underline. That emphasis identifies the promise a visitor should remember.
- **Give explanatory text more breathing room.** The homepage uses **17 px DM Sans** with **28.9 px** line height beneath the tight headline. On the phone introduction, the corresponding treatment is **14.5 px / 23.49 px**. Both leave room to follow a multi-line explanation.
- **Use warm neutrals to suggest a document on a desk.** The sampled palette includes **#FBFAF7** and **#F8F5EE** for light surfaces, **#171B18** for primary ink, and **#5C625D** for secondary copy. Slight changes of surface distinguish a sample document from the page around it.
- **Change the accent ink with the surface.** The handwritten homepage phrase uses dark ochre **#805000** on cream. On the explainer’s dark-green hero, the handwritten phrase uses pale gold **#F9DFAD**. The visual signature survives the change in background. [Process explainer][how]
- **Give the primary action a consistent color and shape.** The desktop hero button measured **318 × 56 px**, with **14 px**, weight **700** DM Sans, an **8 px** radius, and a **#104034** fill. The header action uses the same green in a more compact **45 px** height. Gold **#E5A128** marks selected actions against dark green elsewhere.
- **Use a change of surface to mark a change of purpose.** The cream introduction makes the offer. The next dark-green section frames a sample workspace with tabs and a visible result. Even at a glance, the visitor can tell where the explanation gives way to the demonstration.
- **Give a sample output the shape of the thing users will keep.** The scorecard appears as a light sheet, offset against a second layer, with a gauge and rows of findings. Its composition makes the deliverable recognizable before someone reads the surrounding copy. [Score page][score]
- **Keep button feedback brief.** The main desktop action uses **160 ms** transitions for background, border color, and transform. The control can acknowledge interaction without shifting the surrounding composition.

## Demonstrating value before intake

- **Show one complete before-and-after.** On the phone homepage, selecting the before tab shows a vague project statement scored **3/10**. Selecting after shows **8/10**, the person’s contribution, a measured change, and time saved. Keeping both versions in the same panel makes the added evidence easy to spot. [Homepage][home]
- **Label fictional evidence where the numbers appear.** The improved example identifies its facts as illustrative beside the result. The scorecard and sample workspace also identify their sample data. Visitors get a concrete demonstration without mistaking it for a customer outcome.
- **Translate an average into a useful distribution.** The fictional scorecard gives **17 bullets** an average of **3.4/10**, then shows **13** in the weakest band, **3** in the middle, and **1** ready for an interview. Those counts tell a writer how much work needs attention. [Score page][score]
- **Quote the exact word that needs attention.** One sample flags *improved*, explains that a starting point and an outcome are missing, and asks what changed. The writer leaves with a question they can answer.
- **Keep the basis for comparison stable.** The score page explains that the same ten criteria apply to the original and revised bullets. A score change is easier to interpret when the reader knows the scale stayed fixed.
- **Show where an AI-generated claim came from.** The explainer places a candidate’s quoted answer beside the facts extracted from it and carries those facts into a sample résumé line. Someone can trace the number back to what the candidate said. [Process explainer][how]
- **Use examples in which success looks different.** A retail example makes training two new cashiers specific without inventing a sales increase. A reporting example uses preparation time as its measure. This gives people whose work lacks a revenue metric a credible way to describe it. [Homepage][home]
- **Let visitors tour the task they care about.** Seven named tabs open sample views. Selecting the job-targeting tab brought up a job-description input example, while the workspace tab showed the broader working environment. Visitors can answer their own question without watching the whole sequence.
- **Give moving content a pause and a reduced-motion state.** Pausing the tour exposed a play control. Over the same 8.5-second observation, the default tour advanced from its first to third view, while the reduced-motion version stayed on its first view.

## Résumé intake and the interview

- **Show the output before requesting the input.** On the score page, a visitor can inspect the sample scorecard, its reading guide, and a diagnosed bullet before opening the résumé-entry dialog. The request for a personal document has a visible purpose. [Score page][score]
- **Offer file upload and plain text in the same dialog.** Choosing the paste option replaces the drop area with a labeled text box. Someone editing in a document or borrowing a phone can use whichever format is already handy.
- **State file constraints beside the chooser.** The upload area lists **PDF, DOCX, TXT, and Markdown**, with a **3.5 MB** limit, and offers both drag-and-drop and a browse button. A visitor can check their file before attempting the upload.
- **Separate optional data use from the main task.** An unchecked option explains what a separate improvement copy would contain, which identifiers the site says it removes, and where the visitor could turn the choice off later. The explanation appears at the moment of consent.
- **Give a keyboard visitor a way back.** Pressing Escape closed the intake dialog and returned focus to the score button that opened it. The visitor could reconsider without losing their place.
- **Ask about one piece of work at a time.** In the public interview demo, the current résumé line and a focused follow-up share the working area. The interface offers typing and voice and leaves the question in view while the visitor considers an answer. [Sample interview][demo]
- **Make help specific to the difficulty.** I expanded one disclosure to see why the question mattered and another to get three prompts about the need, the person’s contribution, and how they knew it worked. A confident writer can keep moving while a stuck writer gets a foothold.
- **Explain the cost of changing direction.** Another disclosure says that asking for a different question leaves the saved conversation intact and does not spend a discovery turn. That is information visitors need before trying an alternative.
- **Distinguish a saved fact from a finished draft.** The sample workspace separates the recorded accomplishment, the person’s contribution, and the next action to review it in the builder. A saved status tells the visitor exactly what is ready.

## Pricing and informed choices

- **Describe plans by the job they support.** The free option spells out the scorecard, baseline draft, guided interview, and included rebuild. The higher tiers describe ongoing updates and job-specific preparation. A visitor can compare the work they expect to do. [Pricing][pricing]
- **Give the recommended plan visual prominence while keeping the alternatives legible.** On desktop, three cards align side by side. Two use light surfaces, while the featured tier uses dark green, a gold label, and a gold action. Prices and benefits occupy comparable positions across the row.
- **Change the comparison control on a narrow screen.** The phone pricing page offers one tab per tier and shows the selected plan’s details directly below. Visitors can inspect another tier without scrolling through several full cards.
- **Show the amount actually billed.** Switching the premium plan from monthly to three months changed **$99 per month** to **$297 every three months**, retained the **$99 monthly equivalent**, and explained how the usage allowance is pooled. The buyer can distinguish payment timing from capacity.
- **Answer what happens after cancellation.** Opening the pricing question with Enter revealed when paid controls end and whether saved work remains readable and copyable. It answers a more practical question than a short cancellation promise alone.
- **Keep both privacy choices immediately available.** On the phone homepage, the analytics prompt offered decline and allow side by side, both about **167 × 42 px**. Declining dismissed the prompt and left the public experience available. [Homepage][home]

The phone comparison tabs have one keyboard limitation. I could focus the second tab with Tab and activate it with Enter. Right Arrow left the first tab selected.

[home]: https://www.undersold.ai/
[score]: https://www.undersold.ai/score
[how]: https://www.undersold.ai/how-it-works
[pricing]: https://www.undersold.ai/pricing
[demo]: https://www.undersold.ai/demo/session/11111111-1111-4111-8111-111111111100
