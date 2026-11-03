<a id="readme-top"></a>

<div align="center">
  <h1>CYC Stack</h1>
  <p><strong>AI coding work your team can pick up and verify.</strong></p>
  <p>Give every developer and AI session the benefit of what your team has already learned.</p>
  <p>A project-local workflow for <strong>Claude Code, Codex and Cursor</strong>.<br>Context engineering, focused skills and executable checks for enterprise codebases.</p>
  <p>
    <a href="https://github.com/TheDThompsonDev/cyc-stack/actions/workflows/ci.yml"><img src="https://github.com/TheDThompsonDev/cyc-stack/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
    <a href="#validation-status"><img src="https://img.shields.io/badge/release-0.6.0%20pilot-5268a8" alt="Release: 0.6.0 pilot"></a>
    <a href="#get-started"><img src="https://img.shields.io/badge/Node.js-20%2B-397b60" alt="Node.js 20 or later"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5268a8" alt="MIT license"></a>
  </p>
  <p><strong>17 supporting skills &middot; 15 task playbooks</strong> &nbsp; / &nbsp; one entry point: <code>/cyc</code></p>
  <p>
    <a href="#why-cyc"><strong>Why CYC</strong></a> &nbsp; &middot; &nbsp;
    <a href="#skills">Skills</a> &nbsp; &middot; &nbsp;
    <a href="#playbooks">Playbooks</a> &nbsp; &middot; &nbsp;
    <a href="#get-started">Get started</a> &nbsp; &middot; &nbsp;
    <a href="docs/README.md">Docs</a>
  </p>
</div>

## Why CYC?

Architectural decisions, access rules, integration contracts and earlier failures shape what a correct change looks like. Your team needs that reasoning to remain available when the developer, AI tool or chat changes.

**CYC makes that reasoning part of the work.** It guides the assistant to retrieve relevant project knowledge, check it against current code, trace the impact of a change, verify the promised behavior, and retain useful findings for the next task.

| What your team needs | What the workflow asks the assistant to leave |
| --- | --- |
| **Continuity between people and sessions** | Versioned decisions, constraints and failure history the next task can find and revalidate. |
| **Changes that fit the existing system** | An account of affected callers, state, storage and interfaces, with checks for the behavior that must remain intact. |
| **A result someone else can review** | The implementation, executed checks, findings, unresolved limits and the reasoning behind consequential decisions. |

**Instructions plus executable checks:** CYC's local controller runs your project commands, checks source freshness and records completion. Applicable new regression tests must fail against the original code before the change can be accepted by the controller.

### What that means in a real task

**Illustrative example: “Add CSV export to the orders dashboard.”**

CYC directs the assistant to investigate pagination, filters and access rules before implementing a download. Verification should exercise complete authorized results, including records beyond the visible page and rejected access. The handoff explains the query decision, the cases actually checked and any unmeasured limits.

A teammate extending that export can then retrieve the saved constraint and its evidence, check whether it still holds, and continue without reconstructing the original conversation.

<picture>
  <source media="(max-width: 600px)" srcset="docs/assets/cyc-readme-banner-mobile.svg">
  <img src="docs/assets/cyc-readme-banner.svg" alt="CYC context loop: project knowledge informs the next change, the work produces reviewable evidence, and verified lessons return to the project.">
</picture>

> **Pilot release.** Installation and host adapters are implemented. Registry/marketplace publication and fresh live-host qualification remain release work. [Validation boundaries →](#validation-status)

<details>
<summary><strong>On this page</strong></summary>

- [Why CYC?](#why-cyc)
- [Context engineering for enterprise teams](#context-engineering-for-enterprise-teams)
- [How it works](#how-it-works)
- [Every supporting skill](#skills)
- [All 15 playbooks](#playbooks)
- [Get started](#get-started)
- [Validation status](#validation-status)
- [Documentation](#documentation)
- [Contribute](#contribute)
- [License](#license)

</details>

## Context engineering for enterprise teams

CYC keeps useful project knowledge in Git, where the team can review it alongside the code.

1. **Retain the reasoning.** Component notes hold decisions, integration constraints, useful failed approaches and supporting evidence.
2. **Find relevant context.** A path-based index connects the task to the matching notes, failure history and check recipes.
3. **Check freshness.** The assistant revalidates consequential claims against current code and dependencies before relying on them.
4. **Carry learning forward.** Verified findings and useful decisions become starting context for later work.

Your team owns the context, verification commands and review process. Shared knowledge lives in repository documents; detailed run records stay local by default. Existing CI, access rules and merge controls remain yours.

[Context engineering guide](docs/context.md) · [Engineering standards](docs/code-quality.md) · [Project tools and recipes](docs/project-tools.md)

## How it works

**Skills describe how to perform part of the work. Playbooks choose the recorded route for a task.**

Use the public [`/cyc` skill](skills/cyc/SKILL.md) to describe your outcome. The assistant selects a playbook and loads the relevant supporting skills. The local controller records stage handoffs, runs configured checks and checks evidence freshness.

The common implementation route is:

```text
Scout → Build → Verify → Deliver
```

| Stage | What moves forward |
| --- | --- |
| **Scout** | A concrete outcome, relevant history, affected behavior and a plan with checks. |
| **Build** | Tested changes, reviewed decisions and useful context updates. |
| **Verify** | Current check results, applicable original-code test proof, findings and limits. |
| **Deliver** | A reviewable result the next person can open, inspect and continue. |

Failed checks return to the responsible work within a shared retry budget. Planning, exploration, learning and other tasks use different routes. Supporting skills can work within or across recorded stages; the four-stage route is one use of the full library.

![Full CYC engineering workflow: project knowledge, Scout, Build, Verify, Deliver and the recovery paths between them.](docs/assets/cyc-workflow-diagram.svg)

[Open the full-size diagram](docs/assets/cyc-workflow-diagram.svg) · [Step-by-step walkthrough](docs/cyc-workflow.md)

<p align="right"><a href="#readme-top">Back to top ↑</a></p>

## Skills

CYC exposes **one entry skill, 17 supporting methods, and a frontend design specialization inside Design**. The host assistant reads and performs these skills; each method is a focused procedure, not automatically a separate agent.

### Start with understanding

| Skill | What it does and leaves you with |
| --- | --- |
| [**Setup**](methods/cyc-setup/SKILL.md) | Discovers the project's real checks, configures CYC and reports setup results and host-activation evidence. |
| [**Scout**](methods/cyc-scout/SKILL.md) | Makes a focused initial plan: relevant history, files to change, affected consumers and checks to run. |
| [**Frame**](methods/cyc-frame/SKILL.md) | Clarifies the outcome, scope, acceptance criteria and behavior that must remain intact. |
| [**Understand**](methods/cyc-understand/SKILL.md) | Traces how the system behaves or reproduces a failure, separating confirmed causes from open hypotheses. |
| [**Impact**](methods/cyc-impact/SKILL.md) | Finds readers, writers, storage and API consumers a change could affect; records risks, evidence and verification needs. |

### Choose and deliver the change

| Skill | What it does and leaves you with |
| --- | --- |
| [**Explore**](methods/cyc-explore/SKILL.md) | Compares genuinely different approaches or scoped prototypes, then recommends one with trade-offs and limits. |
| [**Design**](methods/cyc-design/SKILL.md) | Defines state, interfaces, compatibility and implementation slices, including the observations that would invalidate the approach. |
| [**Challenge**](methods/cyc-challenge/SKILL.md) | Tests a plan, change or claim against concrete counter-cases and returns supported, actionable findings. |
| [**Build**](methods/cyc-build/SKILL.md) | Implements tested slices, reviews the diff and records changed behavior and deviations from the plan. |
| [**Verify**](methods/cyc-verify/SKILL.md) | Exercises the promised behavior, affected consumers and relevant rejection/recovery paths; retains current evidence and unresolved findings. |
| [**Deliver**](methods/cyc-deliver/SKILL.md) | Produces the final handoff: result, check evidence, a useful visual, working scope and honest limits. |

**[Frontend design](methods/cyc-design/frontend-design/SKILL.md)** specializes web work within this flow: concrete design decisions, meaningful visual material, a rendered signature section, desktop/phone review and executed usability/access checks. Its visual judgment remains review work; a passing build cannot establish design quality.

### Continuity, learning and correction

| Skill | What it does and leaves you with |
| --- | --- |
| [**Context**](methods/cyc-context/SKILL.md) | Retrieves and revalidates component knowledge, then retains verified findings and relevant decisions in indexed project notes. |
| [**Remember**](methods/cyc-remember/SKILL.md) | Keeps task decisions and checkpoints, and reconstructs what was decided, why and what comes next after interruption. |
| [**Error Ledger**](methods/cyc-error-ledger/SKILL.md) | Makes failure history searchable: hypotheses, attempted fixes, outcomes, confirmed causes and regression evidence. |
| [**Correct**](methods/cyc-correct/SKILL.md) | Turns feedback or repeated misses into an explicit missing criterion, a targeted repair and renewed checks. |
| [**Reflect**](methods/cyc-reflect/SKILL.md) | Uses completed outcomes to propose specific improvements to methods or checks, with evidence for each proposal. |
| [**Teach**](methods/cyc-teach/SKILL.md) | Explains a concept through the learner's own code, using worked examples and optional practice. |

**Context** preserves component knowledge; **Remember** preserves task continuity; **Reflect** proposes improvements to the working method. They serve different needs.

[Full method map and examples →](docs/cyc-method-map.md)

<a id="example-tasks"></a>

## Playbooks

A playbook gives a task its sequence and completion criteria. **Describe the outcome through `/cyc`; you do not need to memorize these route names.**

| Playbook | Use it to… |
| --- | --- |
| [**Investigation**](skills/cyc/references/playbooks/investigation.md) | Explain a behavior or cause from evidence and recommend a next step without changing the product. |
| [**Explore**](skills/cyc/references/playbooks/explore.md) | Compare approaches or scoped prototypes before committing to a direction. |
| [**Plan**](skills/cyc/references/playbooks/plan.md) | Break a substantial change into verifiable units, with dependencies, design decisions and risks. |
| [**Feature**](skills/cyc/references/playbooks/feature.md) | Build new or changed behavior and verify its affected consumers. |
| [**Bug fix**](skills/cyc/references/playbooks/bug-fix.md) | Reproduce a defect, repair its cause and establish regression evidence. |
| [**Refactor**](skills/cyc/references/playbooks/refactor.md) | Improve structure while proving preserved behavior. |
| [**Performance**](skills/cyc/references/playbooks/performance.md) | Establish a measured baseline, target a bottleneck and check the resulting change. |
| [**Review**](skills/cyc/references/playbooks/review.md) | Assess existing work and return supported findings worth acting on. |
| [**Verify**](skills/cyc/references/playbooks/verify.md) | Evaluate an executable result against explicit criteria and current evidence. |
| [**Experience**](skills/cyc/references/playbooks/experience.md) | Explore a direction, build the change and verify the connected user journey. |
| [**Teach**](skills/cyc/references/playbooks/teach.md) | Learn a concept through the project's actual code, examples and suitable practice. |
| [**Handoff**](skills/cyc/references/playbooks/handoff.md) | Prepare current state, evidence, decisions and limits for another person or agent. |
| [**Resume**](skills/cyc/references/playbooks/resume.md) | Reconstruct interrupted work, check for drift and identify the next justified step. |
| [**Reflect**](skills/cyc/references/playbooks/reflect.md) | Turn finished outcomes into evidence-backed proposals for improving future work. |
| [**Evaluate**](skills/cyc/references/playbooks/evaluate.md) | Compare a workflow against a baseline using recorded outcomes and disclosed limits. |

<details>
<summary><strong>See every recorded route</strong></summary>

| Playbook | Recorded stages |
| --- | --- |
| `investigation` | Scout → Deliver |
| `explore` | Frame → Understand → Explore → Challenge → Deliver |
| `plan` | Frame → Understand → Impact → Design → Challenge → Deliver |
| `feature` | Scout → Build → Verify → Deliver |
| `bug-fix` | Scout → Build → Verify → Deliver |
| `refactor` | Scout → Build → Verify → Deliver |
| `performance` | Scout → Build → Verify → Deliver |
| `review` | Scout → Challenge → Verify → Deliver |
| `verify` | Scout → Verify → Deliver |
| `experience` | Scout → Explore → Build → Verify → Deliver |
| `teach` | Frame → Understand → Teach → Deliver |
| `handoff` | Understand → Verify → Deliver |
| `resume` | Remember → Understand → Deliver |
| `reflect` | Remember → Reflect → Deliver |
| `evaluate` | Frame → Understand → Explore → Verify → Reflect → Deliver |

These sequences come from the [playbook catalog](catalog/playbooks.json). A stage may use additional supporting methods as the task warrants. The controller records and validates handoffs; it does not automatically launch the skills or establish that the assistant performed them well.

</details>

### Try a different kind of task

```text
/cyc Review this diff for API compatibility, error handling and affected consumers.
Explain the evidence behind the findings. No edits.
```

```text
/cyc Improve this site's complete signup journey. Establish a visual direction,
build a usable mobile layout, and check keyboard, validation and recovery states.
```

Progress updates explain consequential decisions. Final summaries stay brief and link to detailed evidence. Use `expand` for more detail once, or `limit off` for longer replies throughout the conversation. [Response controls](docs/response-standard.md#character-limit-toggle)

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

Downloading the package and activating it in a project are separate steps. [Versions, archives, updates and removal →](docs/installation.md)

</details>

### 2. Connect the checks your team trusts

Reload your AI host, review its hook-trust prompts, then ask:

```text
/cyc Set up CYC for this project. Find the checks we already use in CI,
help me configure verification, and preserve our hooks and conventions.
```

Setup records approved commands in `.cyc/config.json` and reports their results. Installing files alone does not prove verification is meaningful or hooks are active.

### 3. Give it a real task

```text
/cyc Add CSV export to the orders dashboard. Respect the current filters
and access rules. Export all matching orders, not just the visible page.
```

If your host does not expose `/cyc`, select the discovered `cyc` skill or say **“Use the cyc skill to…”**

[Full installation guide →](INSTALL.md)

## Validation status

CYC combines instructions the assistant follows with code that checks recorded work.

| Area | What is established |
| --- | --- |
| **Automated checks** | Exercise controller behavior, original-code test proof, recovery, context and installation. The CI badge links to current results. |
| **Host adapters** | Hook tests use simulated events. Actual prompt/Stop behavior needs confirmation in a fresh host session. |
| **Distribution** | Source checkout and archive routes are available. Registry and marketplace publication remain release work. |

Inspect the methods, `.cyc/config.json` and local `.cyc/runs/` records. Current source hashes and passing commands do not prove every dependency was found or every check was sufficient. These are workflow guardrails, not a security sandbox, tamper-proof attestation or permission to merge or deploy.

Before a team rollout, use a fixed revision and a representative task; inspect the work and a fresh-chat or teammate handoff. Speed, token savings and universal reliability are not established.

[Validation details →](docs/validation.md)

## Documentation

| I want to… | Guide |
| --- | --- |
| Inspect all skills and routes | [Method map](docs/cyc-method-map.md) · [Playbook catalog](catalog/playbooks.json) |
| Install, update or remove CYC | [Installation](docs/installation.md) |
| Configure checks or recover interrupted work | [Onboarding and recovery](docs/onboarding-recovery.md) |
| Share project knowledge | [Context engineering](docs/context.md) |
| Build a usable frontend | [Frontend design](methods/cyc-design/frontend-design/SKILL.md) |
| Reuse checks and recipes | [Project tools](docs/project-tools.md) |
| Inspect the controller and contracts | [Runtime](docs/runtime.md) · [Skill contract](docs/skill-contract.md) |

[Browse all documentation →](docs/README.md)

## Contribute

Have a reproducible bug or an idea? [Open an issue](https://github.com/TheDThompsonDev/cyc-stack/issues) with the host, Node version, steps and observed result.

For source changes, run:

```sh
node --test
npm run check:distribution
```

The local runtime has no third-party dependencies. For method changes, compare a representative task before rollout and retain evidence of improvements and regressions. [Skill-writing guidance](docs/skill-craft.md)

## License

Distributed under the [MIT License](LICENSE).

<p align="right"><a href="#readme-top">Back to top ↑</a></p>
