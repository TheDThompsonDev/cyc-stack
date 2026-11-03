# Diagnose a failure

Use this branch when something is broken, throwing, wrong, or slow. The rule: **no red loop, no fix.** Read code freely: understanding the code is often how you find the conditions that reproduce the bug. But do not change code to fix a bug you have not reproduced, and treat any theory as unconfirmed until the loop shows it.

## 0. Check the error ledger

Search the project's selected shared history (`run next`'s `projectLedgerPath`) and relevant prior run-local histories for the error signature (see the [error ledger skill](../../cyc-error-ledger/SKILL.md)). If an entry exists, start from its recorded attempts and never repeat a failed fix without a new reason.

## 1. Build a red loop

A red loop is one command you have already run that shows the user's exact symptom. It must be:

- **Red-capable:** asserts the actual symptom, not a nearby one.
- **Deterministic:** same result every run (or a measured failure rate for flaky bugs).
- **Fast:** seconds, not minutes, so you can iterate.
- **Agent-runnable:** no human clicking, unless nothing else works.

Try these in order:

1. An existing failing test, or a new failing test at the user's boundary
2. A `curl` or HTTP request against the running app
3. A CLI invocation with output diffed against a known-good snapshot
4. A headless browser script for UI symptoms
5. Replaying a captured request, log, or payload
6. A throwaway harness that calls the suspect function directly
7. `git bisect run` with the loop as the test, when "it used to work"
8. A differential loop: run old and new versions on the same input and compare
9. A human-in-the-loop script with exact steps and a KEY=VALUE result, as a last resort

If you cannot build any loop (the bug only happens in staging, or needs data you cannot access), do not guess at a fix. Continue with what is useful without one: read the code paths, check the error ledger and logs, and narrow the candidates. Then stop and hand off what you learned and ask for one specific thing: access to the environment, a redacted sample of the failing data, or permission to add temporary logging.

## 2. Shrink it

Remove inputs, steps, and code until every remaining piece is load-bearing: removing any one turns the loop green.

## 3. Hypothesize before testing

Write up to three ranked, falsifiable hypotheses before testing any: "If X is the cause, then changing Y makes the symptom disappear." Show them to the user as you go; don't wait for approval. When the red loop and the evidence point to one clear cause (a stack trace into a null field, a failing assertion on one line), one hypothesis is enough: state the evidence that makes it clear.

## 4. Test one variable at a time

Change one thing, rerun the loop, record the result in the error ledger entry, including failures. Tag every temporary log line with a unique marker such as `[DEBUG-7f3a]` so cleanup is one search.

## 5. Stop rules

- Two hypotheses disproved: step back, re-read the symptom, and check your loop asserts the right thing.
- Four disproved: report findings and ask the user before continuing.

## 6. Hand off

Give Build the red loop command, the confirmed cause with evidence, and the smallest fix location. The red loop becomes the regression test. If no clean place exists to test the fix, say so: that is a design finding, not something to hide.

Clean up: search for your debug marker and delete throwaway harnesses before handing off.
