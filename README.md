<a id="readme-top"></a>

<div align="center">
  <h1>CYC Stack</h1>
  <p><strong>AI coding work your team can pick up and verify.</strong></p>
  <p>Context engineering and a shared delivery workflow for enterprise teams.</p>
  <p>
    <a href="https://github.com/TheDThompsonDev/cyc-stack/actions/workflows/ci.yml"><img src="https://github.com/TheDThompsonDev/cyc-stack/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
    <a href="#validation-status"><img src="https://img.shields.io/badge/release-0.6.0%20pilot-5268a8" alt="Release: 0.6.0 pilot"></a>
    <a href="#get-started"><img src="https://img.shields.io/badge/Node.js-20%2B-397b60" alt="Node.js 20 or later"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5268a8" alt="MIT license"></a>
  </p>
  <p><strong>Claude Code &middot; Codex &middot; Cursor</strong> &nbsp; / &nbsp; one entry point: <code>/cyc</code></p>
  <p>
    <a href="#get-started"><strong>Get started</strong></a> &nbsp; &middot; &nbsp;
    <a href="docs/README.md">Explore the docs</a> &nbsp; &middot; &nbsp;
    <a href="#context-engineering-for-enterprise-teams">Why CYC</a> &nbsp; &middot; &nbsp;
    <a href="https://github.com/TheDThompsonDev/cyc-stack/issues">Report an issue</a>
  </p>
</div>

<picture>
  <source media="(max-width: 600px)" srcset="docs/assets/cyc-readme-banner-mobile.svg">
  <img src="docs/assets/cyc-readme-banner.svg" alt="CYC context loop: project knowledge informs the next change, the work produces reviewable evidence, and verified lessons return to the project.">
</picture>

CYC Stack helps enterprise teams turn individual AI coding sessions into **shared engineering knowledge**. Architectural decisions, integration constraints and failed approaches stay connected to the code they describe, ready for the next developer, chat or change.

**Context engineering drives the workflow:** retrieve relevant knowledge, recheck it against current code, apply the team's standards, verify the changed behavior, and retain what the work teaches.

> **Pilot release.** Project installation and host adapters are implemented. Live host qualification and registry/marketplace publication remain pending. [Current boundaries →](#validation-status)

<details>
<summary><strong>On this page</strong></summary>

- [Context engineering for enterprise teams](#context-engineering-for-enterprise-teams)
- [Get started](#get-started)
- [Example tasks](#example-tasks)
- [How it works](#how-it-works)
- [Validation status](#validation-status)
- [Documentation](#documentation)
- [Contribute](#contribute)
- [License](#license)

</details>

## Context engineering for enterprise teams

### Knowledge that stays with the code

Versioned component notes retain architectural decisions, integration constraints and useful failure history. Your team can review context changes alongside the code, using its existing Git and merge process.

### The right context for the next task

An index connects the affected paths to relevant notes, evidence and check recipes. The assistant rechecks consequential claims against current code and dependencies before relying on them. New findings feed future work.

### A workflow your team can share

The same methods guide supported assistants through impact analysis, implementation, verification and handoff. CYC uses your project's conventions and verification commands, with records that connect the request to test results, affected source and unresolved limits.

**Your team owns the context, checks and review process.** [Explore project context](docs/context.md) · [Engineering standards](docs/code-quality.md)

<p align="right"><a href="#readme-top">Back to top ↑</a></p>

## Get started

**Prerequisites:** Node.js 20+, a supported AI host, and the GitHub CLI for the checkout route. Your application can use any language. Claude project hooks also need Bash, including Git Bash on Windows.

### 1. Install into your project

Use a source checkout while registry publication is pending. From a separate tools directory:

```sh
gh repo clone TheDThompsonDev/cyc-stack cyc-source
node cyc-source/bin/cyc.mjs init --project "/path/to/your-project" --dry-run
node cyc-source/bin/cyc.mjs init --project "/path/to/your-project"
```

Replace the target path with your project directory. Review the preview before applying it. The installer adds the engine, one `cyc` skill and host hooks while preserving existing project instructions and unrelated hooks.

<details>
<summary><strong>Prefer an agent, a plugin, or npm?</strong></summary>

| Route | Start here |
| --- | --- |
| Ask your agent | [Agent-guided installation](docs/installation.md#agent-guided-installation) |
| Native plugin | [Host installation and activation](INSTALL.md#install-as-a-plugin) |
| npm, after publication | Run `npx cyc-stack init` from your application's root |

To save the package as a dependency, use `npm install cyc-stack` first. Downloading a package and activating it in a project are separate steps.

[Approved versions, offline archives, updates and removal →](docs/installation.md)

</details>

### 2. Connect the checks your team trusts

Reload your AI host, review its hook-trust prompts, then ask:

```text
/cyc Set up CYC for this project. Find the checks we already use in CI,
help me configure verification, and preserve our hooks and conventions.
```

Setup records approved commands in `.cyc/config.json` and reports their results. Installing files alone does not establish meaningful verification or prove hooks are active.

### 3. Give it a real task

```text
/cyc Add CSV export to the orders dashboard. Respect the current filters
and access rules. Export all matching orders, not just the visible page.
```

Start with a real bug, small feature or focused review. State the outcome and the behavior that must remain intact.

If your host does not expose `/cyc`, select the discovered `cyc` skill or say **“Use the cyc skill to…”**

[Full installation guide →](INSTALL.md)

## Example tasks

One entry point, different kinds of engineering work:

| Task | Ask CYC to… |
| --- | --- |
| **Fix a bug** | Reproduce stale totals after cancellation, trace the API/cache updates, and repair the cause. |
| **Build a feature** | Add a department filter while preserving response format, existing callers and access rules. |
| **Design a website** | Create a distinct café identity with meaningful imagery, working pickup preview and desktop/phone checks. |
| **Refactor** | Simplify permission checks while proving unauthorized requests remain blocked. |
| **Investigate** | Use logs and profiling to find an import bottleneck before changing code. |
| **Review** | Assess a diff for compatibility, error handling and affected consumers. |
| **Learn a codebase** | Trace an order through billing, retries and failures, with explanations grounded in the code. |

Progress updates explain consequential decisions. Final summaries stay brief and link to detailed evidence. Use `expand` for more detail once, or `limit off` for longer replies throughout the conversation. [Response controls](docs/response-standard.md#character-limit-toggle)

<p align="right"><a href="#readme-top">Back to top ↑</a></p>

## How it works

```text
Scout → Build → Verify → Deliver
```

| Stage | Work and evidence |
| --- | --- |
| **Scout** | Define success, inspect code and relevant history, trace impact, choose an approach. |
| **Build** | Implement tested slices, review changes, retain useful decisions. |
| **Verify** | Run configured checks, review affected behavior, establish applicable original-code test proof. |
| **Deliver** | Leave the result, evidence, limits and context pointers for review. |

Failed checks return to the responsible work within a shared retry budget. Investigation, planning and other tasks use their own routes.

![Full CYC engineering workflow: project knowledge, Scout, Build, Verify, Deliver and the recovery paths between them.](docs/assets/cyc-workflow-diagram.svg)

[Open the full-size diagram](docs/assets/cyc-workflow-diagram.svg) · [Step-by-step walkthrough](docs/cyc-workflow.md) · [All methods](docs/cyc-method-map.md)

## Validation status

CYC combines **instructions the assistant follows** with **code that checks recorded work**.

| Area | What is established |
| --- | --- |
| **Automated checks** | Exercise controller behavior, original-code test proof, recovery, context and installation. The CI badge links to current results. |
| **Host adapters** | Hook tests use simulated events. Actual prompt/Stop behavior needs confirmation in a fresh host session. |
| **Distribution** | Source checkout and archive routes are available. Registry and marketplace publication remain release work. |

Inspect the methods, `.cyc/config.json` and local `.cyc/runs/` records. Evidence freshness and passing commands do not establish that the assistant found every dependency or chose sufficient checks. These are workflow guardrails, not a security sandbox, tamper-proof attestation or permission to merge or deploy.

For a team pilot, use a fixed revision and a representative task, then inspect the work and a fresh-chat or teammate handoff. Speed, token savings and universal reliability are not established.

[Validation details →](docs/validation.md)

## Documentation

| I want to… | Guide |
| --- | --- |
| Install, update or remove CYC | [Installation](docs/installation.md) |
| Configure checks or recover interrupted work | [Onboarding and recovery](docs/onboarding-recovery.md) |
| Share project knowledge | [Context engineering](docs/context.md) |
| Understand the workflow | [Engineering flow](docs/cyc-workflow.md) · [Method map](docs/cyc-method-map.md) |
| Build a usable frontend | [Frontend design](methods/cyc-design/frontend-design/SKILL.md) |
| Reuse checks and recipes | [Project tools](docs/project-tools.md) |
| Inspect the controller and contracts | [Runtime](docs/runtime.md) · [Skill contract](docs/skill-contract.md) |

[Browse all documentation →](docs/README.md)

## Contribute

Have a reproducible bug or an idea? [Open an issue](https://github.com/TheDThompsonDev/cyc-stack/issues). Include the relevant host, Node version, steps and observed result.

For source changes, run:

```sh
node --test
npm run check:distribution
```

The local runtime has no third-party dependencies. For method changes, compare a representative task before rollout and retain evidence of both improvements and regressions. [Skill-writing guidance](docs/skill-craft.md)

<details>
<summary><strong>Useful maintainer commands</strong></summary>

```sh
node bin/cyc.mjs help
node bin/cyc.mjs playbooks
npm pack --ignore-scripts
```

`npm pack` creates a local archive; it does not publish it. [Release and distribution](https://github.com/TheDThompsonDev/cyc-stack/blob/main/docs/maintainers/distribution.md)

</details>

## License

Distributed under the [MIT License](LICENSE).

<p align="right"><a href="#readme-top">Back to top ↑</a></p>
