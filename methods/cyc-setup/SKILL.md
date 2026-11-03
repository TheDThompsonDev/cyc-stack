---
name: cyc-setup
description: "Set up CYC in the current project: activate it, find the project's real test, lint, and type-check commands, write them into the CYC config, and confirm everything works. Use when the user says \"set up cyc\", \"activate cyc\", \"install cyc here\", or right after installing the CYC plugin."
---

# Set up CYC in this project

Guide the developer from installation to one useful task. Keep installed files, configured checks, executed checks, and live host activation distinct. Use the existing project conventions and ask only about consequential missing decisions.

The CYC CLI is [bin/cyc.mjs](../../bin/cyc.mjs), two folders up from this skill. Resolve it to an absolute path and run it with `node`.

## The core loop

1. **Inspect readiness.** Run `node <cli> onboard`. If this request supplied CYC gate context, add `--host codex|claude --session <gate ID> --token <injected review token>`. Otherwise omit the token: native Codex/Claude session identity is detected when available, and missing prompt state is an actionable setup failure. Inspection runs no project commands and changes no files. Explain its first unresolved step in plain language, not the entire JSON report.
   - A project manifest exists: the report includes `doctor` findings. Resolve actual installation conflicts while preserving customized files.
   - Only a config exists: the project is configured, but confirm that the host supplies the plugin. Do not reinstall or overwrite a team's existing checks just to repeat onboarding.
   - No config exists: continue with activation or the project installer, according to how the user obtained CYC.
2. **Activate.** Run `node <cli> activate --dry-run`, show the planned files, then run it without `--dry-run`. This creates `.cyc/config.json` and `.cyc/.gitignore` only. It changes nothing else.
3. **Find the real checks.** Use `onboard.evidenceSources` as pointers, then read the project's own sources of truth: CI workflow files (`.github/workflows`, `.gitlab-ci.yml`), `package.json` scripts, `Makefile`, `pyproject.toml`, `go.mod`, `Cargo.toml`, and contributing instructions. Discovery does not parse or endorse commands. CI is the best evidence of what the team actually trusts. Explain each recommended check through the behavior or error it can detect. If no checks exist, say so and propose one bounded behavior check grounded in the project; creating it requires appropriate task scope, and an always-successful command is not a substitute.
   Read existing project recipes with `node <cli> recipe list`. Reuse actual investigation scripts and behavior checks. Register successful, reusable commands in the project's `docs/context/recipes.json` using the [project-tools contract](../../docs/project-tools.md), with concrete coverage, references, prerequisites, effects and expected outcomes. This is authorized project configuration work, not permission to publish or copy CYC's development recipes into the application. Keep mandatory checks in `verification.commands`; optional relevant tools do not replace them.
4. **Propose the commands in one round**, each with the reason and your recommendation:

   ```text
   Proposed verification commands for .cyc/config.json:
   1. test       npm test              (runs in CI: .github/workflows/ci.yml:31)   Recommended: yes
   2. typecheck  npx tsc --noEmit      (in CI)                                     Recommended: yes
   3. lint       npm run lint          (in CI, ~40s)                               Recommended: yes
   4. e2e        npm run test:e2e      (needs a running server)                    Recommended: no, keep it in the verify recipe
   ```

   Never add a command you haven't seen defined in the project. Never guess. Prefer checks that finish in a few minutes: CYC runs them to verify every change (optional diagnostic baseline checks are off by default). Leave hour-long suites to CI or the verify recipe, and split one giant command into separate ones (unit, integration) so each can be run and judged on its own.
   When no one can answer (an unattended run, or `/cyc` was invoked with instructions not to wait), do not stop: write only commands the project itself defines and runs (CI or a package script), prove them in step 7, and name them in the final handoff as configured checks. That disclosure is information, not a blocker.

   Do all of this before `run start`. The controller captures the checks when a run starts and protects `.cyc/config.json` while it runs; an edit then halts the run, and `run start` refuses code playbooks while no checks exist.
5. **Write the approved commands** into `verification.commands` as `{ "id", "command", "args": [], "timeoutMs" }`. Reuse already authorized team configuration; do not ask for approval again when the session already provides it. Do not change configuration beneath an active run. Split the executable from its arguments (`"command": "npm", "args": ["test"]`). On Windows, Node cannot launch `npm`, `npx`, or other `.cmd` shims directly, so wrap them: `"command": "cmd", "args": ["/c", "npm", "test"]`.
6. **Respect existing conventions.** Reuse the project ledger through `context.ledgerPath`. If another hook already enforces response formatting, configure `delivery.presentation: "project"`; preserve that hook. CYC still enforces controller completion. Show these choices with the proposed commands.
7. **Prove the configured commands run.** After inspecting their side effects and establishing authorization, run `node <cli> onboard --verify`. It runs the configured checks and saves `.cyc/runtime/onboarding-checks.json`, bound to the configuration and covered source. Read failures from that receipt. A passing exit that changes source is not passing setup verification; later edits make the result stale. This receipt is diagnostic and never replaces a task's `run verify`. Keep baseline checks off for ordinary runs. Report existing failures without fixing unrelated code unasked or weakening checks.
8. **Check the hooks in the actual host.** `onboard` exits nonzero while setup is not ready. Follow the `host` step rather than treating passing project tests as activation. Missing state means inspect the exact hook definitions and host trust/settings, then open a fresh session or reload. Use the supported hook review UI; do not edit trust records or fabricate hook state. A missing injected token cannot be repaired by reading an older state file or inventing a Cursor tag in Codex/Claude.
   With the current injected token, `pending` plus `canStartTask: true` means the prompt hook ran and the authorized first task can proceed. Do not wait for your own Stop before starting it. After the turn ends, a separate observation can confirm `passed` from matching prompt/Stop identity, exact review/response and unchanged hook/configuration bytes. A rejected draft remains pending repair; blocked/not-ready completion is not successful setup. Old, copied, legacy or changed evidence stays stale/unverified. Cursor retains its own conversation/tag correlation and cannot be certified by a constant token through this check.
   Do not manually invoke a hook script and call it live activation. A missing table alone is not a reliable probe: project-owned presentation and alternative valid visuals change the requirements. Report the observed host/version and remaining limits; local editable trace evidence is not independent certification.
9. **Connect setup to a first success.** If the user already requested a bounded task, continue that task through the existing orchestrator once prerequisites permit. Otherwise recommend a small task from inspected project evidence and let the user choose it before editing product behavior. Explain the outcome and the checks that would establish it. On delivery, connect one consequential change to its test and point to the existing review. Do not require practice or claim that an explanation proves understanding.

## Done when

- The report separates installation, configuration, executed checks, and host activation, with actual evidence and one next action for any unresolved step.
- Configured commands have recorded results; failed, stale or unavailable results remain disclosed. A failed setup is not called ready.
- The first task is continued when already authorized, or a concrete recommendation is offered without inventing approval. Setup completion and task completion remain separate.

## Anti-patterns

| Name | The tell | Fix |
| --- | --- | --- |
| Invented checks | Adding `npm test` to a project with no test script | Only use commands defined in the project |
| Silent writes | Changing config before showing the plan | Dry run first, then write |
| Fixing the baseline | "Tests were failing, so I fixed them" during setup | Report the failing baseline; fixing is a separate task |
| Committed secrets | Tokens or env values in config commands | Reference env vars by name only |

## Handoff

Report what is ready, the first unresolved step, and its smallest next action. Cite setup and host evidence separately. `ok`/`ready` require passing setup phases; neither establishes first-task completion or human understanding. Suggest sharing the existing project configuration through the team's normal review process.
