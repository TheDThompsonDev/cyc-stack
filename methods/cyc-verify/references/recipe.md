# Project verification recipe

The recipe is the project's codified version of "the check a senior developer does by hand after the tests pass." It lives at `docs/context/verify-recipe.md` in the target project, is committed, and is listed in the context index.

Executable investigation tools and checks are registered in `docs/context/recipes.json` under the [project-tools contract](../../../docs/project-tools.md). `investigate --path ...` finds matching context and recipes; `recipe list` inspects definitions and current diagnostic receipts; `recipe run --recipe ID` executes a selected authorized command. Verify selects relevant recipes automatically. Preserve manual/browser instructions here when they cannot be expressed as real executable assertions. Required controller checks and test proof remain separate.

## Creating it

When applicable checks need discovering, record these steps in run-local notes first. Save a durable recipe only when its path is within authorized scope, before final verification; otherwise retain it as a proposal. Do not require an app recipe for an advisory or document task.

1. Work out how to launch the app (dev server, CLI, simulator) and how to drive it (a browser automation tool or MCP such as Playwright or Chrome DevTools, `curl`, or a simulator tool). If the host ships its own app-verification skill, use it to discover these steps.
2. Exercise the change in the running app. Save the steps that worked, exactly, as the recipe.
3. Add at least one **measurable** check per surface. The more measurable a check, the easier it is to tell pass from fail.

## Format

```markdown
# Verify recipe

## Launch
- `npm run dev` → ready when "Local: http://localhost:3000" prints
- Stop the process started for this check with Ctrl+C. If the port is occupied, identify its owner or choose another port; do not kill an unrelated process.

## Checks

### UI change (any file under src/components/** or src/app/**)
| Check | How | Pass when | Evidence |
| --- | --- | --- | --- |
| Journey works | Open the page, perform the action, reload | Expected state visible after reload | Screenshot before and after |
| No console errors | Read the browser console during the journey | Zero errors, zero new warnings | Console log |
| Layout shift | Chrome DevTools performance trace on page load | CLS < 0.1 | Trace score |
| Accessibility | axe scan of the page | Zero serious or critical violations | axe report |

### API change (server/**)
| Check | How | Pass when | Evidence |
| --- | --- | --- | --- |
| Contract | `curl -s localhost:3000/api/x`, parsed as JSON | Shape matches the schema; old fields still present | Response body |
| Latency | 20 sequential requests | p95 < 200 ms | Timing output |

## On failure
- Layout shift: find the element that moved in the trace, reserve its space (size attributes, skeleton), rerun the trace.
- Console error: treat it as a bug; search the error ledger first.

## Promoted to controller commands
- `npm run test:e2e` (journey), `npm run a11y` (axe). These run in `run verify`.
```

## Growing it

- **Whenever the user checks something by hand and tells the agent what to fix, add that check to the recipe.** That correction was a missing verification step.
- **Propose useful scriptable checks as controller commands** in `.cyc/config.json` (`verification.commands`). During an active run, retain the proposal in `.cyc/runs/<runId>/proposed-checks.json`; the controller protects configuration mid-run. Apply authorized proposals as a subsequent scoped change with its own verification. Checks that need judgment or a browser tool stay as recipe steps.
- Keep each check tied to when it applies (the paths or change type), so a backend fix doesn't trigger a layout trace.
- When a check stops applying, remove it with a note in the context doc. A recipe full of irrelevant checks gets skipped.
