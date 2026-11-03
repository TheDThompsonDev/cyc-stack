# CYC Stack

**Turn individual AI coding sessions into shared project knowledge and changes your team can verify.**

CYC helps your coding assistant reuse project decisions, check affected behavior, and leave evidence and useful lessons for the next teammate. Keep the reasoning with the project so the next person can build on it without recovering the original chat.

Your team keeps control of its code, context, verification commands, and review process. CYC makes the assistant's scope, checks, findings, and remaining limits inspectable.

It's built for existing codebases: extending a service, fixing a bug, preserving API contracts, and preparing a change teammates can review against the checks they already trust.

One entry point: **`/cyc`**. The orchestrator selects the supporting methods as the task needs them. You don't need to memorize a catalog of skills.

```text
/cyc Add CSV export to the orders dashboard. Respect the current filters
and existing access rules. Export all matching orders, not just the visible page.
```

[Get started](#get-started) · [See the experience](#what-working-with-cyc-feels-like) · [Try a task](#what-can-i-use-it-for) · [Inspect the evidence](#what-you-can-trust-and-why)

> **Pilot: 0.6.0.** Project installation and adapters for Claude Code, Codex, and Cursor are implemented. Current integration checks use simulated host events; the updated adapters still need a fresh live trial. Registry and marketplace publication are not established. See [validation status](#validation-status) before a team rollout.

Follow the full engineering flow: how CYC uses project knowledge, handles failed checks, and leaves a result your team can review. [Open the diagram at full size](docs/assets/cyc-workflow-diagram.svg).

![Detailed CYC engineering flow: Scout defines the outcome, investigates the code and project history, and chooses the approach. Build implements tested slices and retains useful knowledge before final checks. Verify proves applicable tests on original code, runs configured checks, and reviews intent and consumers. Deliver records outcomes, evidence, limits, and context pointers. Recovery arrows return failures to the responsible work within bounded retries; the local controller checks evidence and an active host hook checks delivery.](docs/assets/cyc-workflow-diagram.svg)

[Step-by-step explanation and recovery paths](docs/cyc-workflow.md) · [Quick overview](docs/assets/cyc-overview.svg) · [All methods and their roles](docs/cyc-method-map.md)

## What working with CYC feels like

You ask for a feature. CYC should help you understand what it touches, why the implementation takes a particular shape, and how the result was checked.

For the orders export request above, an illustrative task might look like this. These are examples of the intended experience, not a recorded run; the assistant must inspect your project before making these claims.

**First, understand the change.**

> The dashboard fetches one page at a time, so exporting its displayed rows would silently leave out other matching orders. I'll trace the server query and access checks before adding the export, so it includes the full filtered result without exposing orders the user cannot view.

**Then, explain the decision as the work happens.**

> The export now reuses the dashboard's server-side filtering and access checks. That keeps the two paths consistent when those rules change. I'm testing results that span multiple pages and requests from users with different access levels.

**Finally, report what the evidence supports.**

> The checks pass for filtering, results across multiple pages, and restricted access. The existing dashboard checks also pass. Large-volume performance hasn't been measured yet, so we haven't established whether this is ready for the biggest exports.

Short updates should make the engineering understandable. Consequential decisions get an explanation; routine tool calls don't need a running commentary. The default is a brief explanation of the concrete behavior, its mechanism, and the relevant decision or next check.

### The engineering inside the loop

The full flow above opens up the responsibilities, retained knowledge, and recovery paths inside Scout, Build, Verify, and Deliver. The [step-by-step explanation](docs/cyc-workflow.md) adds detail for each responsibility. Other playbooks use the sequence appropriate to their task.

**Three feedback loops do different jobs.** Focused checks and diff review improve each implementation slice. Broader verification can uncover a defect or send the work back to investigate a missed dependency. Delivery review repairs an unclear handoff; a substantive defect still requires a code fix and fresh verification.

The detailed diagram shows activities within the methods, not a separate mandatory controller stage for every box. Scout stays a focused pass; challenge depth and integration or UI checks depend on the task. For applicable feature and bug-fix runs, the controller proves changed tests fail on the original code before final verification; refactor tests must pass on it. An explicit exemption records its reason and limits.

The assistant interprets findings and chooses the repair. The controller checks recorded transitions, evidence freshness, and the shared work-retry budget; delivery corrections have their own bound. A blocker can stop work at any stage. Changing stages does not reset the work budget, and passing checks does not authorize a merge or deployment.

## Get started

You need **Node.js 20+**, access to this repository, and an AI host. Your application can use another language; CYC should run that project's own checks. Claude project hooks use Bash, including **Git Bash on Windows**.

Choose one install route:

| Route | What you do |
| --- | --- |
| npm | Run `npx cyc-stack init` in your project |
| Your agent | Ask it to follow the [agent install guide](docs/installation.md#agent-guided-installation) |
| Plugin | Install through the [host's plugin flow](docs/installation.md#activation-and-diagnosis), then ask CYC to set up the project |

All routes use one public `cyc` skill and the same supporting methods. [Full install guide, updates and removal](docs/installation.md).

### 1. Install into your project

After npm publication, run from your application's root:

```sh
npx cyc-stack init
```

This installs the local engine, the single `cyc` skill, and the hook configuration. It detects hosts from the project's existing files; if none are detected, it sets up all three supported hosts. No flags are required. npm may ask before downloading the package.

Prefer adding it to `package.json`? Run `npm install cyc-stack`, then `npx cyc-stack init`. Downloading the package and setting up project integration are separate steps. Previewing changes, choosing a host, and selecting an approved version are [optional install controls](docs/installation.md#optional-npm-controls).

**Registry publication is pending.** Until then, or for a private repository/npm GitFetcher error, use an authenticated checkout instead. From a separate tools directory:

```sh
gh repo clone TheDThompsonDev/cyc-stack cyc-source
node cyc-source/bin/cyc.mjs init --project "/path/to/your-project" --dry-run
node cyc-source/bin/cyc.mjs init --project "/path/to/your-project"
```

Replace the target path with your existing project directory. The GitHub CLI must be authenticated with repository access. This route bypasses npm's Git fetching. For a repeatable team trial, check out a full commit before installation and keep that revision fixed. [Pinned checkout and offline archive instructions](docs/installation.md#private-repositories-and-npm-git-fetch-failures).

### 2. Connect your project's checks

Reload your AI host, review any hook-trust prompts, and ask:

```text
/cyc Set up CYC for this project. Find the checks we already use in CI,
explain which ones you recommend, and help me configure verification.
Preserve our existing hooks and project conventions.
```

Setup inspects the project's defined commands, proposes the appropriate checks, and records approved commands in `.cyc/config.json`. It runs them once and reports existing failures. Installing files alone does not configure meaningful verification or prove hooks are active.

For hosts that don't expose `/cyc` directly, select the discovered `cyc` skill or say **“Use the cyc skill to…”**. Plugin hosts may add a namespace to the command.

### 3. Start with one bounded task

Use an actual bug, a small feature, or a focused review. Give CYC the outcome and any behavior that must remain intact. You can check the installation from the project root with:

```sh
node .cyc/engine/bin/cyc.mjs doctor
```

`doctor` checks configuration and installed files. Confirm hook activation in a real session separately. Review and commit the installed files when you're ready to share the setup with teammates.

For a guided view of what is ready and what to do next, use `node .cyc/engine/bin/cyc.mjs onboard`. Inspection runs no project commands. After reviewing the configured checks, `onboard --verify` executes them and records their results; the report keeps live hook activation separate. If a task fails or is interrupted, `run recover --run ID` explains its recorded state and next action without changing files or resetting its budget. The `/cyc` assistant uses these views for you. [Onboarding and recovery](docs/onboarding-recovery.md).

[Installation, updates, conflicts, and removal](docs/installation.md) · [Plugin manifests and activation](docs/installation.md#activation-and-diagnosis)

## What can I use it for?

Use the same entry point and describe the job. The prompts below are starting points you can adapt.

**Fix a bug with a reproducible cause**

```text
/cyc The operations dashboard shows stale totals after an order is cancelled.
Reproduce it, trace the update through the API and cache, and fix the cause.
Check that other order-status changes still update correctly.
```

**Build a feature across its dependencies**

```text
/cyc Add an optional department filter to the employee search API.
Preserve the response format and existing behavior when the filter is omitted.
Find the callers and check that access rules still apply.
```

**Refactor while preserving behavior**

```text
/cyc Simplify the duplicated permission checks in these handlers.
Preserve the public API and prove that unauthorized requests remain blocked.
```

**Investigate before deciding to change anything**

```text
/cyc Our nightly customer import is approaching its processing window.
Use the available logs and profiling tools to find the bottleneck.
Recommend a next step with evidence. Do not change code yet.
```

**Review work you already have**

```text
/cyc Review this diff before I open a pull request. Check API compatibility,
error handling, and affected consumers. Prioritize actionable findings
and explain what evidence supports each one.
```

**Get oriented in an unfamiliar service**

```text
/cyc I'm new to this service. Walk me through how an order reaches billing,
including retries and failure handling. Use the actual code, explain the
important design choices, and flag anything you can't establish. No edits.
```

Understanding an unfamiliar system can be a task of its own. During implementation, you can also ask for more explanation of a particular decision. Ordinary progress updates remain brief; deeper explanations should match your experience and the question at hand.

## Why CYC works this way

### A small request can have a larger impact

An export can affect query behavior, access checks, pagination, and service load. CYC asks the assistant to trace relevant readers, writers, and consumers before changing behavior, then use those findings to choose checks.

For ordinary work, the target is a useful first source or test edit within one or two minutes. Investigation stays focused and expands when the evidence reveals a consequential unknown. This is a working target, not a timing guarantee or a reason to skip a critical question.

[How impact investigation works](docs/impact-analysis.md)

### Checks need to test the promise

A passing type check cannot establish that an export respects a user's access level or includes every matching record. CYC combines the project's configured commands with task-specific criteria and relevant observations. For bugs, the method calls for reproducing the failure and showing that the regression test can detect it.

When verification fails, the assistant should repair the cause and recheck. A check that already failed before the work started can be accepted with a reason. It then stops blocking completion only while it fails exactly as it did before: the same exit code and output, and no changed file named. Any new failure still prevents completion. Tests should not be weakened to produce a green result.

[Verification and recovery](docs/runtime.md#configure-meaningful-executable-checks)

### Fast feedback needs a stopping point

The ordinary implementation flow is **Scout → Build → Verify → Deliver**. Deeper design and challenge methods are available when the task warrants them. Skill chaining does not automatically mean more agents or a larger process.

Retries share a failure budget, including a limit on repeated unchanged failures. There is no default wall-clock deadline; projects can configure one. If the work cannot complete, the result should say what remains and why.

[Controller and run records](docs/runtime.md)

### Engineering decisions should remain useful after the chat

CYC's context and error-ledger methods record supported lessons, design reasons, and failed approaches for later work. The assistant can reuse a project's existing ledger and conventions. This gives the next task a place to look before repeating a known mistake.

New implementation runs make those responsibilities explicit inside the existing four stages. Scout reuses relevant history after checking its evidence, chooses whether to reuse, extend, repair, or create functionality, and identifies consequential decisions. Verify records semantic review and consumer checks alongside executable checks. Deliver retains verified technical findings with their limits; design proposals awaiting acceptance stay labeled as provisional. The Context method includes an optional Node helper to capture/check selected component and dependency file hashes. Matching bytes support a freshness investigation; they do not establish semantic correctness or human approval.

One generated review document follows the change through developer review and an authorized PR. It connects the request, changes, evidence, risks, and learning without requiring the reader to reconstruct the chat. These records make the process inspectable; they do not prove an agent's judgment or manufacture human approval. [Work assessments and review lifecycle](docs/work-assessments.md).

[Project context](methods/cyc-context/SKILL.md) · [Error ledger](methods/cyc-error-ledger/SKILL.md)

Project tools make this reuse concrete. `cyc investigate --path ...` finds relevant context, linked file evidence and recipes; `cyc recipe list/run` inspects or executes applicable project commands and retains diagnostic receipts. Scout, Build and Verify select these automatically through their skills. Project-owned recipes describe coverage, prerequisites, side effects and expected outcomes; they supplement required controller checks. [Reusable tools and recipes](docs/project-tools.md).

## What you can trust, and why

CYC combines instructions the assistant follows with code that checks recorded work. They serve different purposes.

| CYC checks in code | Engineering judgment still required |
| --- | --- |
| Recorded stage order, task criteria, and declared artifact hashes | Whether the investigation found the consequential dependencies |
| Configured command results and covered-source freshness | Whether those checks exercise the requested behavior |
| Failure budgets and recorded completion conditions | Whether the next repair is the right one |
| Delivery packet identity, length mode, and visual structure | Whether the explanation is clear and its claims are justified |
| Installation ownership and configuration consistency | Whether the host has trusted and activated the integration |

You can inspect the methods, configuration, and `.cyc/runs/` records. Existing project hooks are preserved. Updates report conflicts with customized managed files rather than silently replacing them; keep supported project preferences in `.cyc/config.json`.

These checks are workflow guardrails, not a security sandbox or tamper-proof attestation. The runtime does not launch models or grant permission to merge or publish. Impact analysis is not an exhaustive dependency scanner. Hook behavior depends on the host, and Stop hooks cannot retract text already streamed.

For a team pilot, use one fixed CYC revision and a representative task. Inspect the result, verification and a fresh-chat or teammate handoff. Volunteered feedback can guide improvements; no usage collector is required.

## Keep the final answer usable

By default, the final summary contains at most **1,000 Unicode characters** and a useful visual. Detailed work and artifacts can be as long as needed. Progress updates explain important developments along the way.

| Send as a standalone message | Effect |
| --- | --- |
| `limit off` | Allow longer final responses in this conversation |
| `limit on` | Restore the character cap |
| `limit status` | Show the current setting |
| `expand` | Allow a detailed response once |

Changing length does not remove readiness or evidence requirements. Projects can configure the new-session default or let existing project rules own presentation while retaining CYC's run-completion checks.

[Response and progress standards](docs/response-standard.md)

## Under the hood

One orchestrator coordinates focused methods. Only the parent lives in the public `skills/` directory; supporting procedures live in `methods/` and load as needed. A method is not automatically a separate agent.

<details>
<summary><strong>The 15 playbooks the orchestrator can select</strong></summary>

| Playbook | Purpose |
| --- | --- |
| Investigation | Explain current behavior from evidence |
| Explore | Compare approaches or make a scoped prototype |
| Plan | Sequence a larger change into verifiable units |
| Feature | Build new or changed behavior |
| Bug fix | Reproduce, repair, and check a defect |
| Refactor | Improve structure while preserving behavior |
| Performance | Measure and improve a targeted bottleneck |
| Review | Assess existing work for consequential issues |
| Verify | Check explicit criteria against current evidence |
| Experience | Improve a connected user journey |
| Teach | Explain through the learner's project |
| Handoff | Prepare work for another person or agent |
| Resume | Reconstruct context before continuing |
| Reflect | Extract supported lessons from completed work |
| Evaluate | Compare a workflow against a baseline |

The parent chooses the route; the CLI's keyword-based suggestion is advisory. Completing a resume run establishes recovered context, not completion of the original project.

</details>

[Orchestrator](skills/cyc/SKILL.md) · [Playbook catalog](catalog/playbooks.json) · [Handoff contract](docs/skill-contract.md) · [Runtime reference](docs/runtime.md)

## Validation status

Automated checks exercise controller transitions, original-code test proof, recovery, context freshness, installation ownership and packed-archive installation. Hook tests use simulated host events; passing them does not prove that a particular AI host loaded the hooks.

Confirm installation, configured project checks and actual prompt/Stop behavior in a fresh session before a team rollout. Current desktop behavior, live correction/continuation, updated host integrations and marketplace installation still need qualification. No speed, token-saving or universal reliability claim is established.

The source checkout keeps small task fixtures for exercising features, refactors, review and context handoff. Their scope and the distinction between automated checks, browser review and native host behavior are described in [validation](docs/validation.md).

## Develop and adapt CYC

The standard engine keeps executable verification and recovery, has no third-party runtime dependencies, and works with applications written in other languages. Its `.mjs` files are JavaScript modules for the local tooling, not files users must add to their application code.

The runtime has no third-party dependencies. From the source checkout:

```sh
node --test
node bin/cyc.mjs help
node bin/cyc.mjs playbooks
npm pack --ignore-scripts
```

`npm pack` creates a local archive; it does not publish it. CI is configured for Ubuntu with Node 20 and 22, and Windows with Node 22. Future tagged releases use the release workflow to attach an installable archive and checksum.

Change a method in the CYC source, test it on a representative task, and compare the outcome before rolling it into projects. Source edits are adaptable; installed managed copies deliberately require conflict resolution on update. Keep evidence of both improvements and regressions.

[Documentation index](docs/README.md)

**Start with one real task. Judge the work, the explanation, and the evidence together.**

## License

MIT. See [LICENSE](LICENSE).
