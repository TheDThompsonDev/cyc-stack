# Release and distribution

Maintain one versioned CYC core. The npm installer and host plugins supply that core through different discovery and update mechanisms. Both need real project checks and observed host activation.

## Release status

The repository is public. Initial probes on November 3, 2026 returned E404 for `npm view cyc-stack`, E401 for `npm whoami`, and no GitHub releases. The maintainer subsequently signed in; authentication alone does not publish or reserve a package name. Recheck the registry for the intended version and channel before publishing. Trusted-publisher configuration and fresh native plugin qualification remain separate release work.

## Build the candidate

From the source checkout:

```sh
npm run check:distribution
node --test
npm run pack:release
npm publish ./release-assets/cyc-stack-0.6.0.tgz --dry-run --ignore-scripts --tag next
```

The builder validates package/plugin/lockfile identity, packs with lifecycle scripts disabled, checks required resources and the 1 MiB unpacked budget, and writes `release-assets/cyc-stack-0.6.0.tgz` plus `SHA256SUMS`. It runs no project installation and never publishes. `--output DIRECTORY` selects a different output folder. A rejected candidate has no release checksum; discard its archive. Checksums establish integrity, not publisher identity or host compatibility.

The archive serves both `npm exec`/`npx` consumers and plugin hosts. It includes root `plugin.json` using the portable Agent Plugins schema, an OpenAI extension selecting the Codex adapter, and existing native compatibility manifests. Setup invokes the existing public `cyc` skill, preserving one public entry point. The inline OpenAI extension replaces the compatibility overlay, so preflight keeps their hook and presentation settings equal. [Official plugin packaging contract](https://developers.openai.com/plugins/build/plugins).

For an offline consumer trial, from an empty target project:

```sh
npm exec --offline --yes --package /absolute/path/cyc-stack-0.6.0.tgz -- cyc init --dry-run
npm exec --offline --yes --package /absolute/path/cyc-stack-0.6.0.tgz -- cyc init
node .cyc/engine/bin/cyc.mjs doctor
```

Use quotes around paths containing spaces. The package-install regression uses an empty npm cache and also checks the archive's plugin resources, checksum, missing-hook rejection, setup diagnosis and distributed controller behavior. It does not prove native host activation.

## First npm publication

The first release needs an npm account authorized to claim `cyc-stack`. Sign in locally through npm's normal browser flow; never paste credentials into chat:

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

Review the candidate and completed checks before publishing that exact archive:

```sh
npm publish ./release-assets/cyc-stack-0.6.0.tgz --access public --tag next --ignore-scripts
npm view cyc-stack@0.6.0 version dist.integrity dist-tags --json
```

Publication creates an immutable package version; a failed name claim requires a deliberate name decision. The local bootstrap does not claim GitHub OIDC provenance. Test `npx cyc-stack@next init` in a clean project after publication, then qualify the native hosts. `npx cyc-stack init` is the stable entry after promotion to `latest`. [npm publication guidance](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/).

## Subsequent npm releases

1. Use `node scripts/bump-version.mjs X.Y.Z` to update npm, portable and native plugin manifests and lockfile, then finish its changelog section. Use a reviewed commit and a new matching tag; do not move an existing release tag.
2. Run the candidate checks above. Both release workflows call the same builder. The npm workflow retains the exact candidate as a workflow artifact before publication; the tag-triggered GitHub workflow attaches the archive and checksum.
3. In the npm package settings, configure a GitHub trusted publisher with owner `TheDThompsonDev`, repository `cyc-stack`, workflow filename `publish-npm.yml`, environment `npm-publish`, and direct `npm publish` allowed. Configure the matching GitHub environment before dispatch. The workflow uses Node 24 and checks npm >=11.5.1. The publisher configuration must complete its first publish within npm's current validity window. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
4. Dispatch the workflow on the tag, initially selecting the pilot channel. For version 0.6.0, the prepared command is:

   ```sh
   gh workflow run publish-npm.yml --ref v0.6.0 -f tag=v0.6.0 -f channel=next
   ```

5. Verify the published artifact, package metadata and documented installation from a clean environment. Promote a reviewed version to the stable channel only after its installation and host trial succeed.

The publishing workflow requires dispatch on the exact release tag and checks the event reference and checked-out commit before publication, binding provenance to that source. An archive or source checkout is usable before registry publication. Preparing `package.json` or running the builder does not publish anything. The workflow's OIDC exchange still needs a real authorized release trial.

## Qualify plugins

Use each host's supported schema, trust UI and installation surface. Check discovery, project activation, a real prompt/completion cycle, rejection/correction, updates and removal. Record the host and runtime versions used.

The repository includes Claude Code, Codex and Cursor adapters. Host capabilities differ. CYC's full lifecycle-hook bundle is not currently eligible unchanged for OpenAI's public directory; use supported manual/local distribution for that bundle. A public skills-only edition would require matching instructions and separate qualification. Verify current platform rules before submission.

[Consumer plugin commands and setup](../../INSTALL.md#install-as-a-plugin) cover repository distribution now. Codex also supports npm-backed marketplace entries after registry publication. For a separate team catalog, an exact-version entry can use:

```json
{
  "name": "cycstack",
  "source": { "source": "npm", "package": "cyc-stack", "version": "0.6.0", "registry": "https://registry.npmjs.org" },
  "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
  "category": "Productivity"
}
```

Place that entry inside the catalog's `plugins` array; keep this repository's existing local source usable before npm publication. Codex downloads npm plugins without executing lifecycle scripts. Node on PATH, hook review/trust, project setup and real-session checks remain necessary. [Official marketplace source formats](https://developers.openai.com/plugins/build/plugins#marketplace-metadata).

## Impact and maintenance checks

Investigated clean source at `41bad41` before implementation. `package.json.files` feeds both npm packing and `scripts/install.mjs`; adding the root manifest does not add a second engine or change project ownership. Portable OpenAI metadata supersedes `.codex-plugin/plugin.json`, so both remain synchronized. CI, tag releases and npm publishing consume the preflight; release workflows now also share `scripts/pack-release.mjs`. Version maintenance updates `package-lock.json` alongside every manifest. No controller, hook protocol or trust state changes belong to this work.

The full original-source control also exposed a pre-existing installed README link failure: root `INSTALL.md` was packed but omitted from the project engine. The installer now copies that guide alongside README and LICENSE, including when an installed engine installs into another project. The existing installed-document link regression remains unchanged and verifies this consumer; ownership hashes, updates and removal apply as for other engine files.

Verify `test/distribution.test.mjs` for rejected missing manifests, identity/overlay/onboarding drift and stale lockfile versions, plus a temporary version bump. Verify `test/package-install.test.mjs` for actual packed-file presence, checksum, rejected missing hook scripts and offline installation. Preserve native host activation and npm account setup as external checks; simulated events do not satisfy them.

## Keep updates predictable

Host plugins use the host's update controls and team policy. Public users cannot be forced to accept publisher updates. A copied project installation must be refreshed with the selected release's installer; updating an npm dependency alone does not refresh its managed engine and skills.

Retain clear release notes, version diagnostics, conflict handling and removal instructions. Project configuration and customized files remain under project ownership. No automatic update checker or scheduler is implemented.

## Public repository history

Cleaning current files does not remove old commits. A clean public history can start from a reviewed source snapshot in a new empty repository while the existing private repository remains available as an archive. Keep `.git`, runtime records, local backups, caches, worktrees and attachments out of that snapshot. Inspect the exact export before its first commit.

Update repository URLs, release workflows and plugin catalog sources together if the public repository address changes. Do not delete the existing remote as part of document cleanup. GitHub supports a reversible [read-only archive](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories); deletion has separate effects on permissions and forks. [GitHub deletion reference](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository).
