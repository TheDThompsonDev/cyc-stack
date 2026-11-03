# Project context

CYC keeps useful project knowledge in the repository so a fresh chat or teammate can find the relevant reasoning without replaying the original conversation. The agent selects and interprets that knowledge; structural validation does not establish that every recorded claim is correct.

## What belongs in context

Keep decisions and their reasons, integration constraints, failed approaches worth avoiding, and checks that protect the behavior. Reference the supporting source or observed result. Separate verified facts from proposals and assumptions. Update a current view when the implementation changes; retain historical entries as history.

Use one index at `docs/context/INDEX.md`, with path coverage and links to the relevant component notes. Read the matching notes and error-ledger entries for the task. Do not load every component or the entire run history by default.

The [Context method](../methods/cyc-context/SKILL.md) defines the component layout and retention procedure. [Work assessments](work-assessments.md) describe learning dispositions and the distinction between technical evidence and adopted decisions.

## Inspect and maintain context

From the CYC source checkout:

```sh
node bin/cyc.mjs investigate --path src/orders
node bin/cyc.mjs context lint
node bin/cyc.mjs context review
node bin/cyc.mjs context measure --path src/orders
```

Replace `src/orders` with the paths relevant to the task. In an installed application, use `node .cyc/engine/bin/cyc.mjs` instead. These inspection commands do not run the project's verification recipes.

`context lint` checks document/index structure and evidence freshness where supported. A valid index can still contain an incorrect or unhelpful explanation. Recheck consequential statements against current code and dependencies.

`context review` proposes entries from recorded completed work. Review the proposed retention before using `--write`; keep changes within the authorized scope. Existing records and reference rows are handled according to the [project-tools contract](project-tools.md).

## Interpret reading-size measurements

`context measure` reports the current index and matching linked documents, the wider context folder, and available local run records. It counts matching local documents once, including multiple links in a row, and avoids counting the index twice. Repeated links do not increase the selected size.

Character counts are Unicode code points. Estimated tokens use approximately four characters per token; no model tokenizer is run. Controller run records are not chat transcripts. A source-only machine may have history that a teammate's checkout does not contain.

These are file-size measurements. They do not establish provider billing, tokens saved, faster work or successful context reuse. Rerun the measurement for the current files rather than relying on historical figures.

## Check that knowledge transfers

Complete one bounded task and retain the useful constraint with its evidence. Then use a fresh chat or teammate, without the original conversation, for a related change. Observe whether the relevant record is found, read, revalidated and used. Run the new task's real checks and inspect the result. Record missed or stale guidance honestly.
