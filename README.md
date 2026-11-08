<a id="readme-top"></a>

<div align="center">
  <p><strong>CYC Stack</strong></p>
  <h1>Give your AI the project knowledge behind the change.</h1>
  <p>CYC helps your coding assistant find relevant project rules, check its changes and leave useful knowledge for the next chat. Inspect what changed, what was checked and what remains uncertain.</p>
  <p>
    <a href="https://github.com/TheDThompsonDev/cyc-stack/actions/workflows/ci.yml"><img src="https://github.com/TheDThompsonDev/cyc-stack/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
    <a href="https://www.npmjs.com/package/cyc-stack"><img src="https://img.shields.io/npm/v/cyc-stack" alt="Latest cyc-stack version on npm"></a>
    <a href="#get-started"><img src="https://img.shields.io/badge/Node.js-20%2B-397b60" alt="Node.js 20 or later"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5268a8" alt="MIT license"></a>
  </p>
  <p>
    <a href="#get-started"><strong>Try CYC in your project &rarr;</strong></a> &nbsp; &middot; &nbsp;
    <a href="#why-cyc">Why CYC</a> &nbsp; &middot; &nbsp;
    <a href="#how-it-works">How it works</a> &nbsp; &middot; &nbsp;
    <a href="docs/README.md">Docs</a>
  </p>
</div>

<picture>
  <source media="(max-width: 600px)" srcset="docs/assets/cyc-readme-banner-mobile.svg">
  <img src="docs/assets/cyc-readme-banner.svg" alt="Project knowledge informs the next change. Checks produce reviewable evidence, and verified lessons return to the project for the next task or teammate.">
</picture>

CYC uses project knowledge to guide the task, checks the work, and carries useful lessons forward. Here&rsquo;s the full workflow:

<a id="workflow-diagram"></a>

![CYC workflow: project knowledge informs Scout, Build, Verify and Deliver; failed checks return to the responsible stage, and retained lessons support later work.](docs/assets/cyc-workflow-diagram.svg)

[Open the full-size diagram](docs/assets/cyc-workflow-diagram.svg) · [Step-by-step walkthrough](docs/cyc-workflow.md)

## Why CYC?

Your request says what to change. Project rules and earlier decisions say what must keep working. CYC guides the assistant to find that knowledge, recheck it, verify the change and leave a useful handoff. The intended payoff is easier review and continuation; speed, token savings and universal reliability require separate evidence.

Start with a task you know, then observe a fresh chat extending it. Inspect actual decisions, checks, retained context and missed behavior. [How it works](#how-it-works) · [Validation](#validation-status)

<a id="get-started"></a>

## Installation

**Put CYC to work in a project you already know.**

You need **Node.js 20+, npm, and Claude Code, Codex or Cursor**. Your application can use any language. Claude project hooks also need Bash, including Git Bash on Windows.

> [!NOTE]
> CYC is available on [npm](https://www.npmjs.com/package/cyc-stack). CYC is a pilot; confirm hooks in your own AI host before a team rollout. [Validation status](#validation-status)

### 1. Open your project

Open a terminal in the root of the project where you want to use CYC. No source checkout or global installation is needed.

<a id="preview-and-install"></a>
<a id="2-install-cyc"></a>

### 2. Install the skills and checks

```sh
npx cyc-stack@latest init
```

Accept npm's package-download prompt if it appears. The command installs the latest published release into this project without adding a dependency to your application's `package.json`.

The installer adds CYC's engine, the `cyc` entry skill and host hooks. Existing project instructions and unrelated hooks are preserved. Hosts are detected automatically; [choose a host explicitly](docs/installation.md) when needed.

<details>
<summary><strong>Preview the changes first</strong></summary>

```sh
npx cyc-stack@latest init --dry-run
```

Review the proposed changes, then run the install command above to apply them.

</details>

### 3. Connect your project's checks

Reload your AI host and review any hook-trust prompts. Then paste this into your **AI chat**:

```text
/cyc Set up CYC for this project. Find the checks we already use in CI,
help me configure verification, and preserve our hooks and conventions.
```

Setup records approved commands in `.cyc/config.json` and reports their results. Confirm real prompt/Stop hook behavior in a fresh session; installed files alone do not establish activation. [Setup and activation guide](docs/installation.md#activation-and-diagnosis)

<a id="4-start-your-first-task"></a>

### 4. Give it a real task

Describe the outcome you want. For example:

```text
/cyc Add CSV export to the orders dashboard. Respect the current filters
and access rules. Export all matching orders, not just the visible page.
```

Replace the example with your own task. Use `/cyc` in your AI host. If it is unavailable, select the discovered `cyc` skill or say **“Use the cyc skill to…”**

Expect a short explanation before work: the outcome, existing behavior to preserve and the relevant project knowledge. During work, discoveries and failed checks should explain a decision. At delivery, inspect actual checks, limitations and the linked project notes. These explanations are guidance, not automatic proof of quality.

For a first exercise, use a bounded task in a project you know. Illustrative example: add an Open tasks filter while preserving the All tasks view and stored records. A useful discovery might be that imported fields exist outside the screen model; the filter should preserve them. A fresh chat can later add an Open tasks count using the same revalidated rule. Observe whether it actually finds and uses the saved knowledge.

Request → find relevant knowledge → check the change → retain what matters

Say `expand` for more detail once, or `limit off` to allow longer replies in this chat. `limit on` restores short replies. Send commands as their own message; allowing longer answers keeps CYC's workflow and evidence requirements. The ambiguous phrase “turn this off” is not a supported control.

<a id="other-installation-routes"></a>

[Agent-guided, plugin, archive and pinned installation options](docs/installation.md) · [Full install guide](INSTALL.md). Downloading the package and activating it in the project are separate steps.

<a id="context-engineering-for-enterprise-teams"></a>

## Context engineering: put your project knowledge to work

Load the project's index and matching notes, check consequential claims against current code and your request, then apply and retain what matters. The target project's focused records live under docs/context/ with INDEX.md; engine documentation is not application knowledge.

Find → revalidate → apply to a decision → retain → reuse

### Token optimization: give context a purpose

Load deeper methods only when relevant. Reading-size estimates cannot establish billing or useful reuse; investigation can add work upfront. [Context and measurement limits](docs/context.md).

<a id="what-that-means-in-a-real-task"></a>

### A lesson the next task can use

For the illustrative task-board filter, preserve imported fields even if the screen does not show them. Save the rule and its evidence. A fresh chat adding a count should find/revalidate the same definition of Open tasks. Observe that behavior before claiming successful reuse.

## Get answers you can use

Delivery leads with the result or blocker, actual checks and limits, one useful visual, and links to retained project knowledge. Progress explains consequential decisions. Response-length choices are shown with the first task above; [the response standard](docs/response-standard.md) explains them. Where active, hooks validate structure and recorded readiness. Clarity, semantics and human understanding still need judgment.

## Make it a shared standard

Try a bounded task on a fixed release, inspect the evidence and observe a fresh chat using its knowledge. Confirm hooks in each actual host before rollout. Teams retain ownership of context, verification commands and merge/access controls. Detailed receipts stay local by default. [Engineering standards](docs/code-quality.md) · [Rollout limits](#validation-status)

## How it works

Start with [`/cyc`](skills/cyc/SKILL.md). The assistant selects relevant methods and a route. The controller records handoffs, runs configured checks and validates evidence freshness, including applicable original-code proof. Failed checks return to responsible work within recorded budgets.

Scout → Build → Verify → Deliver

Recorded stages do not certify comprehension or product correctness. The controller does not continuously monitor the host agent. [Workflow diagram](#workflow-diagram) · [Walkthrough](docs/cyc-workflow.md) · [Runtime](docs/runtime.md)

## Skills

Use the single `/cyc` entry point and describe the outcome. CYC selects supporting methods; you do not need to choose an internal skill. The [method map](docs/cyc-method-map.md) and [skill index](docs/README.md) describe the library when you need deeper detail.

<a id="start-with-understanding"></a>
<a id="choose-and-deliver-the-change"></a>
<a id="continuity-learning-and-correction"></a>

## Playbooks

<a id="example-tasks"></a>

Implementation uses Scout → Build → Verify → Deliver. Investigation, planning, review, teaching and recovery have their own recorded routes. The [catalog](catalog/playbooks.json) defines those stages; the [CYC guide](skills/cyc/SKILL.md#playbooks) links each procedure. Routes and stages support the requested outcome; their completion does not establish product correctness or user comprehension.

### Try a different kind of task

```text
/cyc Review this diff for API compatibility, error handling and affected consumers.
Explain the evidence behind the findings. No edits.
```

```text
/cyc Improve this site's complete signup journey. Establish a visual direction,
build a usable mobile layout, and check keyboard, validation and recovery states.
```

## Updating

From the target project, preview with `npx cyc-stack@latest init --dry-run`, then update with `npx cyc-stack@latest init`. Reload the host and repeat setup validation. Project configuration and run records are preserved. Modified managed files cause a conflict with no writes; merge deliberately before retrying. [Updates, version pinning and conflicts](docs/installation.md#updating-conflicts-and-removal).

## Validation status

CYC is a pilot. Automated tests exercise controller, recovery, context and installation behavior; adapter tests use simulated events. Qualify fresh prompt/Stop, rejection/correction, restart and upgrade in each actual host before making compatibility claims. Inspect configuration, source-bound receipts and retained context on representative work.

Local hooks are workflow guardrails, not a security sandbox or tamper-proof attestation. Stage/hash/test passes do not certify complete coverage, human comprehension or universal correctness. Speed and token savings remain unestablished. [Evidence and rollout limits](docs/validation.md).

## Documentation

[Browse the guides](docs/README.md) for installation, context, recovery, recipes, frontend design and controller contracts. Start with [onboarding/recovery](docs/onboarding-recovery.md) for setup or interrupted work, and [project tools](docs/project-tools.md) for existing investigation/check recipes.

## Contribute

**Bring a reproducible problem or a tested improvement.**

[Open an issue](https://github.com/TheDThompsonDev/cyc-stack/issues) with the host, Node version, steps and observed result.

For source changes, run:

```sh
node --test
npm run check:distribution
```

The local runtime has no third-party dependencies. For method changes, compare a representative task before rollout and retain evidence of improvements and regressions. [Skill-writing guidance](docs/skill-craft.md)

## License

Distributed under the [MIT License](LICENSE).

<p align="right"><a href="#readme-top">Back to top ↑</a></p>
