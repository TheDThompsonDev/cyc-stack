# Project context

Project context is what the next agent or teammate needs without the original chat. It lives in the target project under docs/context/, in three parts:

| Part | Answers | Written by |
| --- | --- | --- |
| Index, INDEX.md | Which doc covers the files I am about to change? | Rebuilt from the docs |
| Component doc | What is true now: boundaries, contracts, choices, checks, limits, lessons | The run that changes the component, before its checks |
| Change record, changes/ | What did a run change, and how did its checks end? | The controller, after the checks pass |

A doc changes only when the rule a reader should follow changes. History is one small record per completed run, so docs stay short and two people in one component conflict only where they changed the same line.

## Normal workflow

Read docs/context/INDEX.md, then matched docs and relevant error history; revalidate consequential claims against current source. Start plans each feature's doc and entrypoints before scope freezes. Finish validates the authored Current view and the index before final checks; missing or stale context returns needs-context with the remaining input (fill learning.context, or use context prepare --run ID earlier). On completion the controller publishes the change record with the results it observed. Restrictions remain pending without unauthorized writes. See the [Context method](../methods/cyc-context/SKILL.md) for schemas, layout and recovery.

```text
node bin/cyc.mjs investigate --path src/orders
node bin/cyc.mjs context history orders
node bin/cyc.mjs context lint
node bin/cyc.mjs context index --write
node bin/cyc.mjs context rollup --write
node bin/cyc.mjs context migrate --write
node bin/cyc.mjs context review [--run ID] [--write]
node bin/cyc.mjs context measure --path src/orders
```

Installed projects use .cyc/engine/bin/cyc.mjs. Commit a change record with the change it describes. rollup folds earlier months into one digest each, so the folder stays bounded; run it on the default branch. migrate converts docs that still hold a History section. review publishes the record of a completed run that lacks one and never edits a doc. A configured context.directory can reuse an equivalent convention; never substitute the engine's development index.

## Evidence limits

Lint validates structure, mapping and supported freshness, not semantic truth or adoption. A change record states what one run observed when it completed; it is not verified source and does not show the code is correct now. measure counts selected local files and estimates tokens as characters/4; it cannot see chat usage, billing or savings.

To evaluate actual reuse, give a fresh chat or teammate a related bounded task without the original conversation; observe discovery, reading, revalidation and successful use with real checks. Parser or fixture passes alone do not establish future model quality or measured savings.

## Consolidate delegated findings

[Task context](task-context.md) reconciles read-only worker evidence into one parent document and feeds existing feature owners before checks. It creates no permanent worker context documents and waives no retention, proof or freshness requirement.
