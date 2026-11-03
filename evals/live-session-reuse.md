# Validate context reuse across real sessions

Use this source-only procedure to check whether project knowledge transfers into a fresh real host session. Installation and diagnostic states are described in [onboarding and recovery](../docs/onboarding-recovery.md).

## Prepare one feature and a related follow-up

Use a project copy with a recorded baseline and a bounded feature that has a real integration constraint. Choose a related follow-up that must preserve that constraint. Keep existing unrelated changes safe. Record the actual source bytes, CYC engine/skill hashes, host version, model, checks, prompts, and launch options. A Git revision alone does not identify dirty files.

Install CYC locally and inspect its hooks and recipe effects. Configure the project's actual checks before starting a run. Use normal host configuration and its trust flow. A supported invocation-only hook trust option can be used in vetted automation, but record it; this does not test interactive trust. Confirm hook-issued state in the live host. In the recorded trial, `--ignore-user-config` omitted observable project hook execution. Do not infer activation from an installation, a manual packet check, or a simulated event.

## Run and checkpoint

1. In a real host session, invoke `/cyc` (or the host's skill invocation) with the feature outcome. Allow normal discovery, implementation, testing and proportionate retention. Do not supply the solving agent with an implementation answer. Keep failed checks and any intervention.
2. Complete the first run and save source hashes, its exact prompt, host transcript, controller assessments, proof/verification receipts, relevant context/index, registered tools/recipes, and their results. Confirm what was actually retained; a successful test does not prove a context record exists.
3. Close that session. Start a new session with a different ID in the same project state, without resume/fork or the first transcript. Give only the follow-up outcome and ordinary project constraints. Do not name the expected context document, investigation command or recipe ID in this prompt.
4. Observe whether the second session finds the matching record, reads its relevant reasoning, checks freshness, carries the supported constraint into its impact/approach, and executes the applicable current check. Inspect actual tool calls and results as well as self-authored assessments. A historical restriction may be superseded by the new request; retaining it must not turn project prose into authority.
5. Run observable behavior checks for the new feature and affected consumers. Confirm recipe selection/counts and any important rejected cases. An old passing recipe receipt is history, not proof of today's changed code. Required controller checks and test proof remain separate.
6. After the turn ends, inspect live hook evidence: a fresh prompt token and Stop decision tied to that exact response/run. Do not write or edit hook state to manufacture this evidence. A valid Stop acceptance does not establish that live rejection/continuation also works.

## Review separately

| Claim | Evidence required |
| --- | --- |
| Fresh session | Different host IDs; no resume/fork/history injection; retained prompts |
| Relevant context reused | Matching index result, actual record read/search, freshness result and a concrete constraint carried forward |
| Investigation tool reused | Actual execution and result, including its scope/limits; selected file bytes alone do not prove semantics |
| Verification recipe reused | Selected ID, inspected applicability/effects, a current execution receipt and actual result |
| Feature remains correct | Behavior assertions, affected consumers, rejection cases, proof and required checks |
| Host gate active | Host-created prompt state and post-turn Stop decision; manual checks alone are insufficient |

Report a missed behavior as a failure or unverified item, even if the code passes. Fix an identified mechanism within scope, preserve the original observation, and repeat the relevant live check in another fresh session before claiming the fix works. Keep the same acceptance criteria.

Separate observations from interpretation. Agent self-review is traceable evidence, not independent human approval or proof of understanding. One successful handoff establishes feasibility on that case; it cannot establish reliability across teams, operating systems or hosts. Different sequential tasks are not a basis for speed, cost or token-saving claims. Provider input totals include cached repeated context and must not be presented as unique tokens read or tokens avoided.

Save a concise public result with evidence hashes and explicit limits. Keep any sensitive raw transcripts outside distribution and say which evidence is local-only. When transferring a verified feature back from a copy, refuse to overwrite destination changes made after the baseline and recheck the integrated result. Do not copy runtime state or host-specific setup into product source.
