# CYC Stack

**AI coding work your team can pick up and verify.**

CYC Stack helps enterprise teams turn individual AI coding sessions into **shared engineering knowledge**. Architectural decisions, integration constraints, failed approaches and verification checks stay connected to the code they describe, ready for the next developer, chat or change.

**Context engineering drives the workflow:** retrieve the knowledge relevant to a task, recheck it against current code, apply the team's standards, and retain what the work teaches. Your team gets a consistent way to plan, build, verify and hand off work across supported AI tools.

**Claude Code · Codex · Cursor** — one entry point: `/cyc`

[Team context](#context-engineering-for-enterprise-teams) · [Get started](#get-started) · [Example tasks](#example-tasks) · [Documentation](#documentation)

> **Pilot · v0.6.0**
>
> Project installation and host adapters are implemented. Live host qualification and registry/marketplace publication remain pending. [Validation status](#validation-status)

## Context engineering for enterprise teams

As developers, services and AI tools change, teams need a shared way to retain engineering knowledge and apply it to the next task.

| What your team needs | How CYC supports it |
| --- | --- |
| **Continuity across people and chats** | Versioned component notes retain decisions, constraints and failed approaches. An index points the assistant to the context relevant to the affected code. |
| **Context that stays useful as code changes** | The workflow rechecks saved knowledge against current code and dependencies, then retains new findings for later work. |
| **Consistent engineering practices across tools** | Shared methods guide supported assistants through impact analysis, implementation, verification and handoff using your project's conventions and checks. |
| **Evidence a teammate can review** | Change records connect the request to affected behavior, test results, source state and unresolved limits. |

Your team owns the context, verification commands and review process. Context changes can be reviewed alongside code, using your existing Git, CI and merge controls.

[Explore project context](docs/context.md) · [Engineering standards](docs/code-quality.md)

![CYC engineering workflow: shared project knowledge informs Scout, Build, Verify and Deliver. Each stage produces evidence; failed checks return to the responsible work, and useful findings feed future tasks.](docs/assets/cyc-workflow-diagram.svg)

[Open the diagram at full size](docs/assets/cyc-workflow-diagram.svg) · [Follow the workflow step by step](docs/cyc-workflow.md)

## Get started

**You need:** Node.js 20+, a supported AI host, and the GitHub CLI for the checkout route below. Your application can use any language. Claude project hooks also need Bash, including Git Bash on Windows.

### 1. Install into an existing project

Use a source checkout while registry publication is pending. From a separate tools directory:

```sh
gh repo clone TheDThompsonDev/cyc-stack cyc-source
node cyc-source/bin/cyc.mjs init --project "/path/to/your-project" --dry-run
node cyc-source/bin/cyc.mjs init --project "/path/to/your-project"
```

Replace the target path with your project directory. Review the preview before applying it. The installer adds the local engine, one `cyc` skill and host hooks while preserving existing project instructions and unrelated hooks.

<details>
<summary><strong>Other installation routes</strong></summary>

**Ask your agent:** follow the [agent-guided installation procedure](docs/installation.md#agent-guided-installation).

**Native plugin:** use the [host installation and activation guide](INSTALL.md#install-as-a-plugin).

**npm, after publication:** run this from your application's root:

```sh
npx cyc-stack init
```

To save the package as a dependency, use `npm install cyc-stack` first. Downloading the package and activating it in a project are separate steps.

[Versions, offline archives, updates and removal →](docs/installation.md)

</details>

### 2. Connect your project's checks

Reload your AI host, review its hook-trust prompts, then ask:

```text
/cyc Set up CYC for this project. Find the checks we already use in CI,
help me configure verification, and preserve our existing hooks and conventions.
```

Setup records approved commands in `.cyc/config.json` and reports their results. Installing files alone does not establish meaningful verification or prove that hooks are active.

If your host does not expose `/cyc`, select the discovered `cyc` skill or say **“Use the cyc skill to…”**

### 3. Try one bounded task

```text
/cyc Add CSV export to the orders dashboard. Respect the current filters
and access rules. Export all matching orders, not just the visible page.
```

Start with a real bug, small feature or focused review. State the outcome and the behavior that must remain intact.

[Full setup and installation guide →](INSTALL.md)

## How it works

The common implementation route follows four stages:

| Stage | What happens |
| --- | --- |
| **Scout** | Define success, inspect the code and relevant history, trace impact, and choose an approach. |
| **Build** | Implement tested slices, review changes, and retain useful decisions. |
| **Verify** | Run configured checks, review affected behavior, and establish applicable original-code test proof. |
| **Deliver** | Leave the result, evidence, limits and context pointers for review. |

Failed checks return to the responsible work within a shared retry budget. Other tasks, such as investigation or planning, use a different route.

[Step-by-step explanation](docs/cyc-workflow.md) · [All methods](docs/cyc-method-map.md)

## Example tasks

Use the same `/cyc` entry point and describe the job.

| Task | Example request |
| --- | --- |
| **Fix a bug** | “Totals stay stale after cancellation. Reproduce it, trace the API and cache updates, and fix the cause.” |
| **Build a feature** | “Add an optional department filter. Preserve the response format, existing callers and access rules.” |
| **Design a website** | “Build a café site with a distinct identity, meaningful imagery and a working pickup preview. Check desktop, phone and keyboard use.” |
| **Refactor** | “Simplify these permission checks while proving unauthorized requests remain blocked.” |
| **Investigate** | “Find the import bottleneck using logs and profiling. Recommend a next step; no code changes yet.” |
| **Review** | “Review this diff for compatibility, error handling and affected consumers. Prioritize supported findings.” |
| **Learn a codebase** | “Trace an order through billing, retries and failures. Explain the design choices; no edits.” |

The assistant should explain consequential decisions as the work happens. The default final summary is brief, with links to detailed evidence. Use `expand` for more detail once or `limit off` for longer replies throughout the conversation. [Response controls](docs/response-standard.md#character-limit-toggle)

## What the checks establish

CYC combines **instructions the assistant follows** with **code that checks recorded work**.

| Checked in code | Still requires judgment |
| --- | --- |
| Stage records, artifact hashes and source freshness | Whether the important dependencies were found |
| Configured command results and failure budgets | Whether the checks exercise the requested behavior |
| Delivery and installation consistency | Whether the explanation is useful and the host integration is active |

Inspect the methods, `.cyc/config.json` and local `.cyc/runs/` records. These are workflow guardrails, not a security sandbox or proof that an agent's judgment is correct. Passing checks does not authorize a merge or deployment.

## Validation status

| Area | Current boundary |
| --- | --- |
| **Automated checks** | Cover controller behavior, original-code test proof, recovery, context and installation. |
| **Host adapters** | Hook tests use simulated events. Confirm actual prompt/Stop behavior in a fresh host session. |
| **Distribution** | Source checkout and archive routes are available; registry and marketplace publication remain release work. |

Before a team rollout, use a fixed CYC revision and a representative task. Inspect the result, verification and a fresh-chat or teammate handoff. Speed, token savings and universal reliability are not established.

[Validation details →](docs/validation.md)

## Documentation

| I want to… | Read |
| --- | --- |
| Install, update or remove CYC | [Installation guide](docs/installation.md) |
| Configure checks or recover interrupted work | [Onboarding and recovery](docs/onboarding-recovery.md) |
| Understand the methods and workflow | [Engineering workflow](docs/cyc-workflow.md) · [Method map](docs/cyc-method-map.md) |
| Build a usable frontend | [Frontend design method](methods/cyc-design/frontend-design/SKILL.md) |
| Share project knowledge | [Project context](docs/context.md) |
| Reuse project checks and recipes | [Project tools](docs/project-tools.md) |
| Inspect the controller and evidence contracts | [Runtime reference](docs/runtime.md) · [Skill contract](docs/skill-contract.md) |

[Browse all documentation →](docs/README.md)

## Develop CYC

The local runtime has no third-party dependencies. From a source checkout:

```sh
node --test
npm run check:distribution
node bin/cyc.mjs help
npm pack --ignore-scripts
```

`npm pack` creates a local archive. It does not publish the package.

Change a method, try it on a representative task, and compare the outcome before rolling it into projects. Keep evidence of both improvements and regressions.

## License

[MIT](LICENSE)
