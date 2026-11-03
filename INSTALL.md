# Install CYC Stack

Choose one route. All routes use the same CYC methods and project context. Full local workflows need Node.js 20+ and a supported AI host; Claude project hooks also need Bash, including Git Bash on Windows.

**Release status:** this checkout prepares the npm and plugin distributions. Registry publication and native-host qualification remain pending. The npm registry examples below require a published version; while the repository is private, use an authenticated checkout or an approved archive.

## Install with npm

After publication, run from the application project root:

```sh
npx cyc-stack init
```

No flags are required. npm may ask before downloading the package. Installation adds CYC's engine, one public `cyc` skill and host hooks. CYC detects hosts from existing project files; if none are detected, it sets up all three supported hosts. It preserves existing project instructions and unrelated hooks, and refuses conflicts with unowned or customized files.

To keep CYC as a dependency in `package.json`, use:

```sh
npm install cyc-stack
npx cyc-stack init
```

`npm install` downloads the package; `init` sets up the project's AI integration. The one-command route above does both without adding a dependency to `package.json`. Applications can use any language; verification uses their own checks. After installation, [finish project setup](#finish-project-setup).

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

The public URL becomes generally accessible when the repository is public. Teams can replace `main` with their approved tag or commit. The agent needs its normal command and filesystem capabilities; CYC does not connect to it through a separate service.

Agent procedure: follow [agent-guided installation](docs/installation.md#agent-guided-installation).

An isolated copy of `skills/cyc` is insufficient: its methods and CLI are part of the same distribution. Use the installer or a complete plugin bundle.

## Install as a plugin

Install the native plugin, then ask **“Use CYC to set up this project.”** Plugin installation makes methods available; project activation and check configuration happen separately. Your host owns plugin files and updates. The existing `activate` command creates project config and ignore rules; it does not install Node or prove hooks are active.

For **Claude Code**, the repository includes a marketplace. Once the source is accessible and the host integration qualified:

```sh
claude plugin marketplace add TheDThompsonDev/cyc-stack
claude plugin install cycstack@cycstack
```

For **Codex desktop**, use a supported manual/local repository marketplace install of the full bundle. The repository catalog is `.agents/plugins/marketplace.json`; the compatibility manifest is `.codex-plugin/plugin.json`. CYC's lifecycle-hook plugin cannot currently be listed unchanged in OpenAI's public directory. Installing a skills-only listing on the web would not deploy local hooks. [OpenAI distribution limits](https://developers.openai.com/plugins/build/plugins#bundled-mcp-servers-and-lifecycle-hooks).

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

For npm, select the desired published version and rerun its installer. Updating the dependency alone does not refresh `.cyc/engine` or the copied skills. Preview changes, finish or stop active work under the existing recovery rules, update, then reload the host. CYC does not yet provide an automatic update checker or scheduler.

To remove a project installation, preview first:

```sh
node .cyc/engine/bin/cyc.mjs uninstall --dry-run
node .cyc/engine/bin/cyc.mjs uninstall
```

Then remove the npm development dependency if you added it. Customized files and run records can be retained; inspect the command report. Plugin removal uses the host's own controls and does not imply deletion of project context or local evidence.

## Before registry publication

Use a reviewed checkout with repository access:

```sh
node /path/to/cycstack/bin/cyc.mjs init --project /path/to/application --dry-run
node /path/to/cycstack/bin/cyc.mjs init --project /path/to/application
```

Quote paths containing spaces. An approved packed archive is another option; see [offline installation](docs/installation.md#private-repositories-and-npm-git-fetch-failures). These paths use the real installer while publication is pending.
