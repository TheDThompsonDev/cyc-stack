# Installing CYC in an existing project

CYC's project installer adds skill copies and response-hook configuration to an existing project. It does not change global settings, install a marketplace, rewrite project instructions, edit the application's package.json, or execute the application's scripts. Node.js 20 or later is required on the machine running the AI tool; the target project can use any language.

CYC is [published on npm](https://www.npmjs.com/package/cyc-stack). The package and source checkout carry a top-level [INSTALL.md](../INSTALL.md) guide covering installation, AI-chat setup and a first task. A reviewed checkout or archive also works. Downloading the npm package does not activate a project: `init` performs that explicit step, while a complete native plugin uses project activation through its Setup method.

Run `npx cyc-stack@latest init` from the target project root to install the latest published release. No flags are required. npm may ask before downloading the package. To save a development dependency in `package.json`, run `npm install --save-dev cyc-stack`, then `npx cyc-stack init`. Downloading the package alone does not set up project integration. After installation, reload your AI host and ask `/cyc` to set up the project's checks.

For a source checkout, use `node bin/cyc.mjs init --project PATH` from the reviewed CYC checkout. Hosts are auto-detected from `CLAUDE.md`/`.claude/`, `AGENTS.md`/`.agents/`/`.codex/`, and `.cursor/`/`.cursorrules`; with no signal, all three are set up. Use `--hosts` to choose explicitly and `--dry-run` to inspect the plan:

```text
node bin/cyc.mjs init --project "/absolute/path/to/project" --hosts claude,codex,cursor --dry-run
node bin/cyc.mjs init --project "/absolute/path/to/project"
node bin/cyc.mjs doctor --project "/absolute/path/to/project"
node bin/cyc.mjs uninstall --project "/absolute/path/to/project" --dry-run
```

The plugin route is an alternative: install the `cycstack` plugin from the host marketplace (see the README), then run `cyc activate` in a project (`/cyc set up this project` handles this). Activation writes only `.cyc/config.json` and `.cyc/.gitignore`; the plugin supplies skills, hooks, and the engine. Plugin hooks do nothing in projects without `.cyc/config.json` and defer to a project install when one exists. Once installed, the project-local CLI is `.cyc/engine/bin/cyc.mjs`. The underlying supported API is:

```js
import { installProject, doctorProject, uninstallProject } from './scripts/install.mjs';

installProject('/absolute/path/to/project', {
  hosts: ['codex', 'claude'],
  dryRun: true,
});
installProject('/absolute/path/to/project', { hosts: ['codex', 'claude'] });
doctorProject('/absolute/path/to/project');
uninstallProject('/absolute/path/to/project', { dryRun: true });
```

These functions return JSON-friendly objects. Inspect `ok` before proceeding. Installation results include planned `changes`, `conflicts`, `warnings`, and an `error` when applicable. A dry run performs validation and reports changes without writing them. Hosts default to both supported integrations. Adding a host preserves previously installed hosts.

## Optional npm controls

Interactive `init`/`install` output summarizes the outcome, project, hosts and file counts, keeps setup warnings and conflicts visible, and points to the next step in your AI host. A preview says no files changed; an unchanged install says it is up to date. Notes produced while planning are explicitly qualified in previews and failed installs, since a planned migration may not have been applied. Neither installation nor that summary establishes host trust or real-session activation.

Use `--json` for the complete structured installer result. Redirected/piped output remains JSON automatically, preserving existing automation, and `--verbose` retains its existing detailed JSON behavior. Other command output and the installer API are unchanged. For example: `npx cyc-stack@latest init --json`.

These options are for specific needs; the normal install requires none of them.

| Need | Command |
| --- | --- |
| Preview local file changes | `npx cyc-stack@latest init --dry-run` |
| Install only one host | `npx cyc-stack@latest init --hosts codex` |
| Select a nested project instead of its CYC-enabled parent | `npx cyc-stack@latest init --project .` |
| Select an approved published version | `npx cyc-stack@0.6.0 init` |
| Follow the optional `next` channel | `npx cyc-stack@next init` |
| Save as a development dependency | `npm install --save-dev cyc-stack`, then `npx cyc-stack init` |

`@latest` explicitly selects npm's `latest` tag; it is not a guarantee of production qualification. An unversioned command can use a package already installed in the project. For exact dependency pinning, add `--save-exact` to `npm install`. In automation, npm's `--yes` option goes before the package name to suppress its download prompt. These controls do not replace host reload, trust or project check configuration.

## Agent-guided installation

Ask your agent to install CYC in the target project from a reviewed checkout, archive or published npm version, preserving existing instructions and hooks. The source/package INSTALL.md gives a pasteable request and route selection; this procedure is also available in a project-installed engine.

For an agent performing this request:

1. Read the target project's instructions. Use the requested project and release, whether a published npm version or a supplied reviewed checkout/archive. Do not treat a registry error as permission to alter credentials, visibility or global settings.
2. Preview with the selected CLI's `init --dry-run`, using `--project` for a different existing target directory. Explain the proposed changes and continue within the user's installation authorization. Resolve reported conflicts without deleting or taking ownership of existing files.
3. Complete `init`, then follow [project setup](../methods/cyc-setup/SKILL.md). Find checks in the project's CI and configuration, explain which behavior they exercise, and use the project's authorization rules before running them. Do not invent always-passing checks.
4. Keep installed files, configured checks, executed checks and real host activation distinct. Missing trust or prompt/Stop observations remain unverified. Use supported host controls; never simulate callbacks or edit trust/state to claim activation.


An isolated skill folder does not contain the methods and CLI it references. Use the project installer or a complete qualified native plugin.

## What is installed

| Project location | Purpose |
| --- | --- |
| `.cyc/engine/` | A project-local copy of CYC's scripts, CLI, catalog, documentation, original skills, and small homework evaluation fixture, with an ESLint config that ignores it |
| `.cyc/config.json` | Editable verification configuration and loop limits |
| `.cyc/install-manifest.json` | Installed version, ownership hashes and exact hook entries used for updates and removal |
| `.cyc/.gitignore` | Keeps `runtime/` and `runs/` records out of ordinary Git tracking |
| `.agents/skills/cyc/` | Single orchestrator entry for Codex and Cursor |
| `.claude/skills/cyc/` | Single orchestrator entry for Claude Code |
| `.codex/hooks.json` | CYC's entries merged into `UserPromptSubmit` and `Stop` |
| `.claude/settings.json` | CYC's entries merged into `UserPromptSubmit` and `Stop` |
| `scripts/claude-hooks/cyc.mjs` | Managed Claude launcher that invokes the copied engine |
| `.cursor/hooks.json` | CYC's entries merged into `beforeSubmitPrompt`, `afterAgentResponse`, and `stop` (Cursor host) |
| `.cursor/rules/cyc-delivery.mdc` | Always-applied rule that tells the Cursor agent the gate protocol, because Cursor hooks cannot inject per-request context |

Only CYC-owned files are updated. Existing instructions, application dependencies, and unrelated hooks remain intact. Installed Markdown skills have relative links to CYC's docs, catalog, scripts, and CLI rewritten to the copied engine. The npm archive and project installer share the explicit release selection in `package.json`: the standard engine, skills/playbooks, operational documentation, engineering examples and compact SVG diagrams. Development tests, evaluation fixtures/results, historical reports, bitmap/HTML exports and release/diagram generators stay in the source checkout. No application code needs to use JavaScript; Node runs CYC's local checks and hooks, while verification invokes your project's own commands.

Updating an older full installation removes obsolete CYC-owned payload only when its bytes still match the recorded ownership hash. Modified obsolete files, project configuration and run records are preserved. Dry-run reports removals and preservation warnings before any change. Preserved customized leftovers can make an existing installation larger than a fresh one; review those files individually.

The default project configuration has schema version 1, no verification commands, and limits of three failed attempts and two consecutive attempts without progress. There is no wall-clock deadline by default: long tasks may take as long as they need, and the loop is bounded by failures, not time. Set `limits.maxDurationMs` to opt into one. These are execution bounds, not a guarantee of success. Configure suitable project checks deliberately; the installer never guesses and runs scripts from an unfamiliar repository.

CYC's installed files stay out of the project's own lint. ESLint flat config lints dot-folders, so it reaches `.cyc/engine`, and the Claude launcher sits in the project's `scripts/`. Each installed script therefore starts with `/* eslint-disable */` (after any shebang). `.cyc/engine/eslint.config.mjs` ignores the whole engine for ESLint 10, which reads the config nearest each file; that also avoids "unused eslint-disable directive" warnings under `--max-warnings 0`. The launcher uses no import declarations, `import.meta`, or top-level `await`. A linter that parses `.mjs` as a classic script can therefore still parse it at `ecmaVersion` 2020 or later; its dynamic `import()` is ES2020 syntax. No comment can suppress a parse error. ESLint's parser (espree 9.6) was checked at 5, 2015, 2019, 2020 and latest. Some projects may still need `.cyc/` and `scripts/claude-hooks/` in their own ignores:
- a linter that parses `.mjs` as a script below ES2020;
- one that needs type information for every file;
- `--max-warnings 0` where a file's header suppresses nothing. ESLint reports that as an unused directive; ESLint 10's engine config avoids it for `.cyc/engine` but not for the launcher.

Hook commands use `node` on PATH. Claude invokes `node "$CLAUDE_PROJECT_DIR/scripts/claude-hooks/cyc.mjs"` through Bash (Git Bash required on Windows). The launcher resolves the engine relative to its own location, preserving nested-directory and relocated-clone behavior. Codex and Cursor retain an inline bootstrap that locates the copied engine from the host event. No installer-specific Node or project paths are embedded. Host trust/reload is still required. `doctor` reports the installed version and checks installed command definitions and file hashes. Tests exercise simulated events, not live host activation. Claude's shell setting follows the [official hook command contract](https://code.claude.com/docs/en/hooks).

## Updating, conflicts, and removal

Run installation again to update from the current distribution. An unchanged distribution produces no file changes. A skill or engine file edited since installation is a conflict: the installer reports it and writes nothing. Move or merge that customization deliberately before retrying; it will not be silently overwritten. Valid changes to `.cyc/config.json` are preserved.

Installation builds and validates the complete operation plan before writing. Ordinary write failures trigger rollback to the previous file contents. This is an in-process rollback, not a filesystem transaction: abrupt termination or power loss can leave a partial operation. Inspect the manifest and run doctor before retrying; do not erase custom files to force an update.

Uninstall removes only files whose contents still match their ownership hashes, and only hook entries that still exactly match CYC's entries. Before writing, it checks whether any remaining hook command references `.cyc/engine` or the managed Claude launcher, including customized or duplicated entries. Such a dependency is an atomic conflict: uninstall leaves the entire installation unchanged and reports the affected configuration. Remove or adapt the retained reference deliberately, then retry. Independent customized hooks remain intact.

Modified files, unrelated hook entries, and runtime/run records are preserved and reported. When retained record directories exist, `.cyc/.gitignore` is also kept so those records remain excluded from ordinary Git tracking. Existing tracked files and explicit force-adds are outside that protection. Empty directories may remain. After uninstall, retained files are no longer managed; a later install reports collisions rather than claiming ownership.

Destination symlinks and junctions are refused. The installer also rejects corrupt configuration and unsafe manifest paths before mutating files. Do not run install/update concurrently with another installer or editor changing the same integration files.

## Activation and diagnosis

`doctorProject` checks the Node runtime, project config, installation manifest, distribution hashes, and the structural presence of both response-hook events for installed hosts. A failing `<host> hooks` check says which repair applies: the entry is missing from an event (rerun init), it was modified by hand (rerun init, or keep the edit and expect the notice), or it is out of date because the engine's entry changed since the install (rerun init). It does not execute project verification commands or prove that the host has loaded or trusted those hooks.

Reload the host and use its hook trust/activation flow where required. Validate a real session with a deliberately invalid response, then a valid review-backed response. Hook tests using simulated events do not establish real-session activation. Skill discovery, plugin command prefixes, and host UI behavior must also be checked in the actual supported host version.

Confirm fresh prompt state and the post-turn Stop decision in the invocation you actually use. Installation or a manually checked packet is insufficient. A successful acceptance does not establish that rejection/correction, interactive trust or another host works. See [validation](validation.md).

Setup now makes missing hook observations actionable: `onboard --host codex --session ID --token TOKEN` uses the current injected gate token to distinguish a prompt awaiting completion from an accepted Stop. Missing, old or mismatched evidence is not successful setup even when project checks pass. The [setup diagnostic contract](onboarding-recovery.md) explains readiness and the first-task transition. Review/trust the exact definitions through the host UI; the [official OpenAI hooks documentation](https://learn.chatgpt.com/docs/hooks) describes Codex's project and per-definition trust requirements. Installing files does not grant that trust.

Plugin manifests and marketplaces are included for all three hosts: `.claude-plugin/` (Claude Code), root `plugin.json` with `.codex-plugin/` compatibility plus `.agents/plugins/marketplace.json` (Codex), and `.cursor-plugin/` (Cursor). Each points at its own hook file in `hooks/`, because the hosts use different event names and plugin-root variables. File presence is not proof of native-host installation or activation. Repository/manual distribution and official public directory listings have separate requirements; public repository visibility alone does not establish either. OpenAI currently excludes lifecycle-hook plugins from its public directory and directs them to manual installation in Codex desktop. See [OpenAI's hook distribution limits](https://developers.openai.com/plugins/build/plugins#bundled-mcp-servers-and-lifecycle-hooks). CYC's current full plugin includes hooks, and fresh real-host qualification remains pending.

Cursor differences: its prompt hook cannot inject context and its stop hook does not receive the final text. The Cursor adapter captures the text from `afterAgentResponse`, the rule file supplies the protocol, and each conversation picks its own session tag and writes `.cyc/runtime/cursor-<tag>.review.json` with token `cursor`. The hook finds its packet by freshness (written after the current request began) and an exact match with the captured response, so parallel Cursor chats in one folder never share or overwrite a packet. Claude and Codex hooks detect when Cursor runs them as third-party hooks and stay silent so the Cursor adapter owns the session.

Project-install hooks are portable across clone locations when Node is on PATH. Legacy installations must be updated once to replace absolute commands. A new machine must still trust and load the hooks.

## Impact investigation for this installer

| Area inspected | Connection and treatment | Verification |
| --- | --- | --- |
| Existing `.codex/hooks.json` and `.claude/settings.json` | Both call `scripts/response-hook.mjs` with a host argument; add an explicit target root and merge exact owned entries | Seed unrelated hook entries and confirm install/update/uninstall preservation |
| `scripts/response-hook.mjs` | Runtime previously derived from its source location; portable copies require root resolution independent of engine location | Root coordinator adapts `--project`; integration tests check copied hooks in a temporary target |
| Skill discovery folders | Copy the same skills for each host; relative documentation links require adjustment | Check installed copies and link targets; do not claim host discovery from file presence |
| `.cyc/config.json` and ownership manifest | Durable editable config and installation bookkeeping | Invalid schemas, path traversal, file modification, and idempotence tests |
| Existing `AGENTS.md`, `CLAUDE.md`, package.json | User-owned instructions and application configuration are outside installation scope | Seed content and confirm unchanged bytes |
| Target filesystem | Partial writes or symlink traversal could damage unrelated files | Up-front collision checks, rollback, temp project tests, junction refusal |

The investigated source is the working tree used for this implementation. Host activation and compatibility beyond simulated/file-level checks remain external verification gaps. This installer is a distribution mechanism, not an automatic whole-project dependency analyzer.


## Existing project conventions

Existing Stop hooks are preserved, with an installation warning to review presentation ownership. Set `delivery.presentation` to `"project"` to delegate reply-format checks to existing project rules while retaining CYC run-completion checks. Set `context.ledgerPath` to reuse an existing ledger. Updates preserve these configuration choices. Do not remove an unrelated hook automatically.

After updating, reload the host so the conversation does not mix previously loaded skills with the new engine. For repeatable trials, pin the selected full Git commit in the GitHub install command and record the installed manifest version. Qualify the exact revision used; an older release tag installs the behavior at that tag.


## Private repositories and npm Git fetch failures

GitHub archive fetching through npm may not share the credentials used by Git or the GitHub CLI. A private repository can return HTTP 404, followed by a Git packing error. Do not change repository visibility or clear global caches to work around this.

Use an authenticated checkout of the desired commit and invoke its installer directly. This avoids npm's GitFetcher entirely. In a separate tools directory, clone once, check out the exact published commit, and record it:

```text
gh repo clone TheDThompsonDev/cyc-stack cyc-source
git -C cyc-source checkout --detach <full-commit-sha>
git -C cyc-source rev-parse HEAD
```

If any command fails, stop before installing. Use a new clone directory to avoid disturbing existing local work. Then run:

```text
node <cyc-checkout>/bin/cyc.mjs init --project <target-project> --dry-run
node <cyc-checkout>/bin/cyc.mjs init --project <target-project>
node <target-project>/.cyc/engine/bin/cyc.mjs doctor
```

For an npm-based distribution, pack that authenticated checkout once with `npm pack --ignore-scripts`. Copy the resulting archive to the target machine, then invoke its explicit binary:

```text
npm exec --offline --yes --package "/absolute/path/cyc-stack-X.Y.Z.tgz" -- cyc init --dry-run
npm exec --offline --yes --package "/absolute/path/cyc-stack-X.Y.Z.tgz" -- cyc init
node .cyc/engine/bin/cyc.mjs doctor
```

Run these from the target project root. Both preview and installation use the same archive. There are no runtime npm dependencies. Our packaging regression test uses an empty npm cache and offline installation, checking dry-run, install, bundled methods, and doctor.

Future tagged releases built with the updated release workflow attach this `.tgz` and `SHA256SUMS`. They can be downloaded through authenticated `gh release download <tag> --repo TheDThompsonDev/cyc-stack --pattern "*.tgz" --pattern SHA256SUMS`. Compare the archive's SHA-256 with the downloaded checksum before installation. This is an integrity check, not an independent signature. These assets do not exist until that release workflow runs; no release was published by this repair.

Keep custom preferences in `.cyc/config.json`. For example, `"delivery": { "defaultCharacterLimitEnabled": false }` preserves an unlimited new-session default without editing managed hook files. Back up and reconcile existing managed-file modifications before updating; the installer intentionally refuses to overwrite them.


## One public entry point

Use `/cyc` with an ordinary task, including setup. Plugin hosts may namespace it as `/cycstack:cyc`. Only the parent lives under `skills/`; supporting instructions live under `methods/`, outside host skill discovery. Project installs copy those methods under `.cyc/engine/methods/` and rewrite parent links to them. The orchestrator loads methods by path when needed; users do not choose a skill.

An update removes unchanged CYC-owned legacy supporting entries from `.claude/skills` and `.agents/skills`. Customized legacy entries cause an atomic conflict so their changes can be preserved and deliberately migrated; unrelated user skills are untouched. Reload the host after updating to remove previously loaded menu entries. Live menu rendering still requires host verification.


<a id="npm-publication-preparation"></a>

## npm publication maintenance

CYC is published on npm. For future releases, the source includes public package metadata, an INSTALL.md entry guide, and an offline release preflight. In the CYC source checkout, run `npm run check:distribution`; add the desired tag to `node scripts/check-distribution.mjs` to check version agreement. This tooling is development-only and does not ship inside the local engine.

The source workflow `.github/workflows/publish-npm.yml` is manually invoked for an existing release tag and defaults to the `next` channel. It uses Node 24, validates publishing-tool versions, runs tests, packs the candidate and uses npm OIDC. Package ownership, the exact npm trusted-publisher repository/workflow/environment binding and any required `npm-publish` environment reviewers must be configured by the maintainer. The repository is public; registry publication still requires an authorized npm account. This preparation does not publish anything. Registry install examples require an actual published release.


For npm provenance to identify the packaged commit, dispatch the workflow from the same tag supplied in its input. The workflow checks out the immutable event SHA and rejects a different dispatch ref or checkout HEAD. After account configuration and release approval, a maintainer can use:

```sh
gh workflow run publish-npm.yml --ref v0.6.0 -f tag=v0.6.0 -f channel=next
```

This is a publication action, not an installation command; do not run it as part of consumer setup.
