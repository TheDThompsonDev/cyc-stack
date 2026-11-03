# Release and distribution

Maintain one versioned CYC core. The npm installer and host plugins supply that core through different discovery and update mechanisms. Both need real project checks and observed host activation.

## Release status

Public npm metadata, explicit archive selection, release preflight and a manually triggered publishing workflow are prepared. Registry publication, npm account/trusted-publisher configuration and fresh native plugin qualification remain release work. Confirm the current public registry entry before advertising an install command as available.

## Publish npm

1. Confirm ownership of the package name or organization scope. Use a reviewed source state and matching package/plugin versions.
2. Run `node --test` and `npm run check:distribution`. Inspect the packed archive and verify installation from it in a clean project.
3. Configure the npm trusted publisher and GitHub release environment. The publishing workflow requires dispatch on the exact release tag and checks the event reference and checked-out commit before running installation or publication steps.
4. Dispatch the workflow on the tag, initially selecting the pilot channel. For version 0.6.0, the prepared command is:

   ```sh
   gh workflow run publish-npm.yml --ref v0.6.0 -f tag=v0.6.0 -f channel=next
   ```

5. Verify the published artifact, package metadata and documented installation from a clean environment. Promote a reviewed version to the stable channel only after its installation and host trial succeed.

An archive or source checkout is usable before public publication. Preparing `package.json` or running `npm pack` does not publish the package. The publishing workflow's OIDC exchange still needs a real authorized release trial.

## Qualify plugins

Use each host's supported schema, trust UI and installation surface. Check discovery, project activation, a real prompt/completion cycle, rejection/correction, updates and removal. Record the host and runtime versions used.

The repository includes Claude Code, Codex and Cursor adapters. Host capabilities differ. CYC's full lifecycle-hook bundle is not currently eligible unchanged for OpenAI's public directory; use supported manual/local distribution for that bundle. A public skills-only edition would require matching instructions and separate qualification. Verify current platform rules before submission.

## Keep updates predictable

Host plugins use the host's update controls and team policy. Public users cannot be forced to accept publisher updates. A copied project installation must be refreshed with the selected release's installer; updating an npm dependency alone does not refresh its managed engine and skills.

Retain clear release notes, version diagnostics, conflict handling and removal instructions. Project configuration and customized files remain under project ownership. No automatic update checker or scheduler is implemented.

## Public repository history

Cleaning current files does not remove old commits. A clean public history can start from a reviewed source snapshot in a new empty repository while the existing private repository remains available as an archive. Keep `.git`, runtime records, local backups, caches, worktrees and attachments out of that snapshot. Inspect the exact export before its first commit.

Update repository URLs, release workflows and plugin catalog sources together if the public repository address changes. Do not delete the existing remote as part of document cleanup. GitHub supports a reversible [read-only archive](https://docs.github.com/en/repositories/archiving-a-github-repository/archiving-repositories); deletion has separate effects on permissions and forks. [GitHub deletion reference](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository).
