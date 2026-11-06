# Install CYC Stack

**Install from your project's terminal, then use CYC in your AI chat.** CYC Stack is [published on npm](https://www.npmjs.com/package/cyc-stack). The npm route needs Node.js 20+ and Claude Code, Codex or Cursor. Claude project hooks also need Bash, including Git Bash on Windows.

The steps below use the latest published release. For team rollouts, [pin a version](docs/installation.md#optional-npm-controls) and verify hook behavior in your host. A published package alone does not establish host activation.

## Install with npm

### 1. Install in your project

Open a terminal in your existing project's root and run:

```sh
npx cyc-stack@latest init
```

Accept npm's download prompt if it appears. Add `--dry-run` to preview changes before installing. No source checkout or global installation is needed, and the command does not add a dependency to your application's `package.json`.

Interactive terminals show a short installation summary, setup notes and the next step. Add `--json` for the complete structured result; piped output and `--verbose` continue to use JSON. Previews and conflicts are labeled explicitly.

Installation adds CYC's engine, one public `cyc` skill and host hooks. CYC detects hosts from existing project files; if none are detected, it sets up all three supported hosts. It preserves existing project instructions and unrelated hooks, and refuses conflicts with unowned or customized files.

### 2. Set up CYC in your AI chat

Reload your AI host in this project and review any hook-trust prompts. Then paste this into the chat:

```text
/cyc Set up CYC for this project. Find the checks we already use in CI,
help me configure verification, and preserve our hooks and conventions.
```

CYC helps configure the project's actual checks and reports what was verified. [Setup diagnostics](#finish-project-setup) distinguish installed files, configured checks and real hook activation.

### 3. Give it a task

In the same AI chat, describe the result you want. For example:

```text
/cyc Fix the checkout form so a failed payment preserves the customer's
inputs, shows a useful error, and lets them retry. Verify the recovery flow.
```

Replace the example with your own task. `/cyc` belongs in the AI host, not the terminal. If the command is unavailable, select the discovered `cyc` skill or ask **“Use the cyc skill to…”**

<details>
<summary><strong>Optional: save CYC as a development dependency</strong></summary>

To keep CYC as a dependency in `package.json`, use:

```sh
npm install --save-dev cyc-stack
npx cyc-stack init
```

`npm install` downloads the package; `init` sets up the project's AI integration. Applications can use any language; verification uses their own checks.

</details>

Previewing changes, choosing a host, saving a development dependency and selecting an approved version are [optional install controls](docs/installation.md#optional-npm-controls).

## Ask your agent

Give your agent this request in the project where you want CYC:

```text
Install CYC Stack in this project. Follow its INSTALL.md at
https://github.com/TheDThompsonDev/cyc-stack/blob/main/INSTALL.md
or the reviewed local checkout I provide. Preview the local changes,
preserve our instructions and unrelated hooks, then configure our real
project checks and tell me whether this host actually loaded the hooks.
```

Teams can replace `main` with their approved tag or commit. The agent needs its normal command and filesystem capabilities; CYC does not connect to it through a separate service.

Agent procedure: follow [agent-guided installation](docs/installation.md#agent-guided-installation).

An isolated copy of `skills/cyc` is insufficient: its methods and CLI are part of the same distribution. Use the installer or a complete plugin bundle.

## Install as a plugin

Install the native plugin, then ask **“Use CYC to set up this project.”** Plugin installation makes methods available; project activation and check configuration happen separately. Your host owns plugin files and updates. The existing `activate` command creates project config and ignore rules; it does not install Node or prove hooks are active.

For **Claude Code**, the repository includes a marketplace. Once the source is accessible and the host integration qualified:

```sh
claude plugin marketplace add TheDThompsonDev/cyc-stack
claude plugin install cycstack@cycstack
```

For **Codex desktop**, register the public repository marketplace using a current Codex CLI:

```sh
codex plugin marketplace add TheDThompsonDev/cyc-stack
```

Restart the desktop app, open its plugin browser, select the **CYC Stack** marketplace and install **CYC Stack**. Review and trust its hooks through the host UI, then run setup. If your client lacks this marketplace command, use the [manual repository marketplace flow](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually).

The repository catalog is `.agents/plugins/marketplace.json`. Root `plugin.json` is the portable manifest; `.codex-plugin/plugin.json` remains the compatibility fallback. The same npm archive contains both. CYC's lifecycle-hook plugin cannot currently be listed unchanged in OpenAI's public directory. Installing a skills-only listing on the web would not deploy local hooks. [OpenAI distribution limits](https://developers.openai.com/plugins/build/plugins#bundled-mcp-servers-and-lifecycle-hooks).

For **Cursor**, use its native plugin flow with `.cursor-plugin/plugin.json`; the full bundle includes rules and Cursor-specific hooks. Local import can be restricted by team policy. Official marketplace listing is a separate review step. [Cursor plugin installation](https://cursor.com/docs/plugins).

The discovered invocation can be namespaced, such as a plugin's `cyc` command. You can always ask the host to use the discovered CYC skill by name. Do not install both routes just to obtain the same methods. If both exist, verify which integration owns the hooks; plugin hooks defer to a project installation for that host.

## Finish project setup

Reload the host and review any hook-trust prompt through its normal UI. Ask CYC to find and configure the project's existing checks. For project installations:

```sh
node .cyc/engine/bin/cyc.mjs doctor
node .cyc/engine/bin/cyc.mjs onboard
```

`doctor` checks files and configuration. `onboard` separates remaining setup steps; inspection runs no project checks. Passing diagnostics alone does not establish native hook activation. For plugin installs, the agent resolves these CLI commands from the plugin's own directory.

Local run/check records support verification and recovery in the target project. No adoption analytics system is required. Review [installation details](docs/installation.md) for file ownership, retained records, updates and removal.

## Updates and removal

Plugins use their host's update controls. Enable automatic marketplace updates where the host and team allow them. A team can keep an approved version; a publisher cannot force updates onto arbitrary public installations.

For npm, finish or stop active work under the existing recovery rules. From the target project root, preview the latest release:

```sh
npx cyc-stack@latest init --dry-run
```

Then apply it and reload your AI host:

```sh
npx cyc-stack@latest init
```

Teams can substitute an approved exact version. Updating an npm dependency alone does not refresh `.cyc/engine` or the copied skills. Valid project configuration and local run records are preserved. Customized managed files cause a conflict; back up and merge those customizations before retrying. CYC does not yet provide an automatic update checker or scheduler.

To remove a project installation, preview first:

```sh
node .cyc/engine/bin/cyc.mjs uninstall --dry-run
node .cyc/engine/bin/cyc.mjs uninstall
```

Then remove the npm development dependency if you added it. Customized files and run records can be retained; inspect the command report. Plugin removal uses the host's own controls and does not imply deletion of project context or local evidence.

<a id="before-registry-publication"></a>

## Install without npm

Use a reviewed checkout with repository access:

```sh
node /path/to/cycstack/bin/cyc.mjs init --project /path/to/application --dry-run
node /path/to/cycstack/bin/cyc.mjs init --project /path/to/application
```

Quote paths containing spaces. An approved packed archive is another option; see [offline installation](docs/installation.md#private-repositories-and-npm-git-fetch-failures). These are alternatives to the published npm package.
