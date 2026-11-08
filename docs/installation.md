# Installing CYC in an existing project

CYC installs project-local skills/engine/hooks, preserving application instructions/package.json/dependencies and unrelated hooks. No global changes or application-script execution. The AI host needs Node.js 20+; applications may use any language.

Follow [INSTALL.md](../INSTALL.md) for the [published npm package](https://www.npmjs.com/package/cyc-stack), route selection and setup request. From the target root:

~~~text
npx cyc-stack@latest init
~~~

Reload and ask /cyc to configure checks; download alone does not activate CYC. From a reviewed checkout:

~~~text
node bin/cyc.mjs init --project "/absolute/path/to/project" --hosts claude,codex,cursor --dry-run
node bin/cyc.mjs init --project "/absolute/path/to/project"
node bin/cyc.mjs doctor --project "/absolute/path/to/project"
node bin/cyc.mjs uninstall --project "/absolute/path/to/project" --dry-run
~~~

CLI detection uses CLAUDE.md/.claude, AGENTS.md/.agents/.codex and .cursor/.cursorrules; no signals selects all three. --hosts overrides selection. Installed CLI: .cyc/engine/bin/cyc.mjs.

A complete cycstack plugin supplies engine/skills/hooks. cyc activate or /cyc set up this project writes only .cyc/config.json/.cyc/.gitignore. Hooks ignore unactivated projects and defer to project installs.

scripts/install.mjs exports installProject(target,{hosts,dryRun}), doctorProject(target), uninstallProject(target,{dryRun}). API hosts default to codex/claude and retain existing hosts. Inspect JSON ok/changes/conflicts/warnings/error. dryRun validates without writes. Source reference: docs/maintainers/installation-reference.md.

## Optional npm controls

Interactive init/install shows outcome, project, hosts, changes, warnings/conflicts and next action. Previews/failed plans qualify unapplied migrations; unchanged installs report up to date. --json/--verbose exposes details; piped output stays JSON. Other commands/API stay unchanged.

| Need | Command |
| --- | --- |
| Preview | npx cyc-stack@latest init --dry-run |
| One host | npx cyc-stack@latest init --hosts codex |
| Exact nested root | npx cyc-stack@latest init --project . |
| Approved version/channel | npx cyc-stack@0.6.0 init or npx cyc-stack@next init |
| Dependency | npm install --save-dev cyc-stack; npx cyc-stack init |

@latest selects a tag, not qualification. Unversioned commands may use project packages; --save-exact pins. npm --yes precedes the package name. Reload/trust/check setup still apply.

## Agent-guided installation

1. Read target instructions; use the requested project/reviewed release. Registry errors authorize no credential, visibility or global changes.
2. Preview init --dry-run with --project when needed. Explain/proceed within installation authorization; resolve conflicts without deleting or claiming existing files.
3. Install; follow [project setup](../methods/cyc-setup/SKILL.md). Find meaningful CI/config checks, explain coverage and honor execution authorization. No always-passing substitutes.
4. Distinguish installed files, configured/executed checks and activation. Use supported trust controls; missing prompt/Stop observations stay unverified. Never simulate callbacks or edit trust/state to claim activation.

An isolated skill lacks its methods/CLI; use the installer or complete qualified plugin.

## What is installed

| Location | Purpose |
| --- | --- |
| .cyc/engine/ | Runtime/CLI, methods/catalog/docs/skills, compact SVGs and ESLint config |
| .cyc/config.json | Checks/limits |
| .cyc/install-manifest.json | Version, ownership hashes/exact hooks |
| .cyc/.gitignore | Excludes runtime/ and runs/ |
| .agents/skills/cyc/ | Codex/Cursor entry |
| .claude/skills/cyc/ | Claude entry |
| .codex/hooks.json | UserPromptSubmit/Stop |
| .claude/settings.json | UserPromptSubmit/Stop |
| scripts/claude-hooks/cyc.mjs | Claude launcher |
| .cursor/hooks.json | beforeSubmitPrompt/afterAgentResponse/stop |
| .cursor/rules/cyc-delivery.mdc | Cursor protocol |

package.json selects npm/copied payload; skill links target the engine. Tests/evaluations/reports and bitmap/HTML generators/exports stay source-only. Verification uses project commands.

Defaults: schema 1, no checks, three failures/two consecutive no-progress attempts, no wall-clock deadline. limits.maxDurationMs opts into time bounds. Configure meaningful checks; installation neither guesses/runs unfamiliar scripts nor guarantees success.

Scripts carry eslint-disable after shebangs; ESLint 10's nearest engine config ignores the engine. The Claude launcher avoids static imports/import.meta/top-level await; dynamic import needs ES2020. Comments cannot fix parsing. Project ignores may remain necessary for below-ES2020 script parsers, type-aware linting or unused-disable launcher warnings under --max-warnings 0.

Hooks need node on PATH. Claude uses node "$CLAUDE_PROJECT_DIR/scripts/claude-hooks/cyc.mjs" through Bash (Git Bash on Windows), then relative engine resolution. Codex/Cursor bootstrap from host events. No machine-specific paths; trust/reload remains required. [Claude hook contract](https://code.claude.com/docs/en/hooks).

## Updating, conflicts, and removal

Reinstall the selected distribution; unchanged files stay untouched. Modified owned skills/engine files cause a no-write conflict: reconcile deliberately. Valid config stays. Obsolete payload is removed only on matching ownership hashes; modified leftovers/records remain and may exceed fresh-install size.

Preflight validates the full plan. Ordinary write failures restore prior bytes; abrupt termination/power loss may leave partial work. Inspect manifest/doctor before retrying; rollback is not a filesystem transaction.

Uninstall removes matching owned files/exact hooks only. Retained/custom/duplicate hooks referencing engine/launcher cause an atomic conflict leaving everything unchanged; adapt deliberately. Other customizations/records remain, including .cyc/.gitignore with records. Tracked files/force-adds are outside that protection. Empty directories may remain; later installs treat unmanaged leftovers as collisions.

Corrupt config, unsafe manifests and destination symlinks/junctions reject before writes. Avoid concurrent integration-file installers/editors.

## Activation and diagnosis

doctorProject checks Node/config/manifest/hashes/hook structure, not verification or loaded/trusted hooks. Notices distinguish missing, edited and outdated entries; rerun init or retain a deliberate edit with its notice.

Reload/trust exact definitions. Observe fresh prompt state, invalid-response rejection/correction and valid review-backed Stop in the actual host/version/invocation. Installation, simulated callbacks, manual packets or one acceptance prove no other outcome/host. See [validation](validation.md).

onboard --host codex --session ID --token TOKEN uses the current injected token to distinguish pending prompt from accepted Stop. Missing/stale/mismatched observations stay unready despite passing checks. See [setup diagnostics](onboarding-recovery.md) and [OpenAI hooks guidance](https://learn.chatgpt.com/docs/hooks).

Resources include .claude-plugin, root plugin.json/.codex-plugin compatibility/.agents/plugins/marketplace.json, and .cursor-plugin with host-specific hook events/variables. Files/public visibility/manual distribution prove no activation or directory listing. Full CYC includes hooks; fresh native qualification remains pending. [OpenAI distribution limits](https://developers.openai.com/plugins/build/plugins#bundled-mcp-servers-and-lifecycle-hooks) direct directory-excluded hook plugins to manual desktop installation.

Cursor prompt cannot inject context; stop lacks reply text. afterAgentResponse captures it, and the rule supplies protocol. Each conversation chooses a tag and writes .cyc/runtime/cursor-<tag>.review.json, token cursor. Freshness after request start/exact reply match isolates parallel chats. Claude/Codex third-party hooks stay silent under Cursor.

Relative commands survive relocation with Node on PATH. Update legacy absolute-command installs once; new machines still need trust/loading.

## Impact investigation for this installer

The source reference holds the full investigation. Temporary-project/simulated tests cover preservation, links, schema/ownership, collision, rollback and linked-path rejection; no live activation/dependency-discovery claim.

## Existing project conventions

Keep unrelated Stop hooks. delivery.presentation:"project" delegates formatting but retains completion checks; context.ledgerPath reuses a ledger. Updates preserve valid config, including delivery.defaultCharacterLimitEnabled:false for unlimited new-session replies. Avoid managed-hook edits.

Reload to avoid mixed old/new code. Pin/record full commit and manifest version; old tags retain old behavior.

## Private repositories and npm Git fetch failures

npm archive auth can differ from Git/gh and return 404/packing errors. Do not change visibility or clear global caches. In a new authenticated clone, stop on failed commands:

~~~text
gh repo clone TheDThompsonDev/cyc-stack cyc-source
git -C cyc-source checkout --detach <full-commit-sha>
git -C cyc-source rev-parse HEAD
~~~

Use that checkout's CLI init --project <target-project> --dry-run, then init and target doctor. Alternatively npm pack --ignore-scripts once, using the same archive from the target root:

~~~text
npm exec --offline --yes --package "/absolute/path/cyc-stack-X.Y.Z.tgz" -- cyc init --dry-run
npm exec --offline --yes --package "/absolute/path/cyc-stack-X.Y.Z.tgz" -- cyc init
~~~

No runtime npm dependencies. Tagged workflows attach .tgz/SHA256SUMS only after running; fetch with gh release download <tag> --repo TheDThompsonDev/cyc-stack --pattern "*.tgz" --pattern SHA256SUMS. Compare SHA-256: integrity, not independent signature. Reconcile managed customizations before updates.

## One public entry point

Use /cyc (possibly /cycstack:cyc) for tasks/setup. Only the parent skill is discoverable; .cyc/engine/methods loads by path.

Updates remove unchanged legacy skills. Customized .claude/skills/.agents/skills entries require atomic conflict resolution and deliberate migration; unrelated skills stay. Reload clears old entries; actual menus need host verification.

<a id="npm-publication-preparation"></a>

## npm publication maintenance

Source-only publishing is not consumer setup. npm run check:distribution validates metadata/optional tag versions. Manual publish-npm.yml uses Node 24, validates tools, tests/packs and npm OIDC. Maintainers authorize ownership, exact trusted-publisher repository/workflow/environment binding and npm-publish reviewers.

Dispatch with matching existing input tag, event SHA/ref and checkout HEAD:

~~~text
gh workflow run publish-npm.yml --ref v0.6.0 -f tag=v0.6.0 -f channel=next
~~~

Default next; authorized npm account/published release required. Preparation publishes nothing.
