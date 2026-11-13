# Reusable investigation tools and verification recipes

CYC discovers project knowledge and repeatable checks from affected paths. Skills use these tools during normal work; the user does not need to request a separate investigation-tool step. Project tools supplement the controller's required checks and preserve their completion rules.

```text
Affected paths → investigate → matching context + evidence + recipes
                                      ↓
                    applicable authorized recipe commands
                                      ↓
                         final required verification
```

## Discover relevant evidence

```text
node .cyc/engine/bin/cyc.mjs investigate --path src/orders src/storage.mjs
node .cyc/engine/bin/cyc.mjs investigate --run RUN_ID
node .cyc/engine/bin/cyc.mjs investigate --path src/orders --kind investigation
```

In the CYC development checkout use `node bin/cyc.mjs`. All commands accept `--project PATH`. Run-associated discovery uses changed paths since run start, or the declared scope if nothing changed. Without paths it uses words from the run's goal; that result is explicitly advisory. Explicit `--path` values take precedence. New and deleted paths can still match records. `--limit N` bounds context and recipe results (default 8, maximum 50), and reports truncation.

Discovery reads the project's own `docs/context/INDEX.md` and `docs/context/recipes.json`; it never searches the installed engine's development context as if it described the application. It executes no project recipes. A matching JSON evidence link is checked with the bundled Context helper, which compares selected file bytes without executing project code. Read the returned records and inspect current boundaries/consumers; declared matches are not a complete dependency graph or proof that a claim is true.

Each manifest is checked once per lookup. Output reports the checked-file count and a bounded list of drifted files, with truncation disclosed, instead of repeating every unchanged file. Use the Context helper directly for full file results. Run-associated path selection is also reused across context and recipe discovery.

`investigate --kind investigation|verification` optionally filters recipes only. Context matching, context limits, warnings and evidence freshness checks remain unchanged, even if no recipes match the selected kind. The filter intersects existing path/goal/run matching before recipe counts and `--limit` truncation; `totalRecipeMatches` and `recipesTruncated` describe the filtered selection. Omitting kind preserves both kinds and their order. The direct API accepts the same option: `investigateProject(projectRoot, { paths: ['src/orders'], kind: 'verification' })`.

The context index uses a Markdown table with `Covers` and `Doc` or `Record` columns, plus optional `Evidence`. Paths are comma-separated; links resolve relative to the index. Supported coverage patterns are literal paths/directories, `*`, `**`, and `?`; `all` means all paths in an index row. Patterns use forward slashes and match case exactly. Brackets in actual framework paths such as src/app/events/[eventId]/route.ts are literal, not character classes; traversal/backslashes/unsupported braces remain rejected. Catch-all reference matching cannot satisfy required focused feature retention. Escaped table pipes are supported; malformed rows are reported. Missing/deleted record links remain visible. Linked/out-of-project paths are not followed. Existing projects without an index or registry fall back to ordinary source investigation and manual check discovery.

Each context match explains its selection: match.kind is path or advisory goal; match.paths lists requested paths and matching Covers patterns; match.words lists goal terms. recordEvidence compares each covered file with the SHA-256 that the newest change record naming the doc gave it (earlier layout: its newest History entry), queried paths first, at most the lookup limit. It reports matches, drifted, missing, invalid or unverified, counts and truncation; reference prose and commit-only bindings stay unverified. Matching bytes never establish dependency coverage or semantic truth; conflicting notes cannot override current code and requirements. Discovery runs no project commands.

## Component context docs

[Project context](context.md) describes the index, component docs and change records with their commands; the [Context method](../methods/cyc-context/SKILL.md) has the layout and restrictions. Read matched docs, not all history. The default folder is docs/context/; configure context.directory before start only to reuse a project-owned equivalent, and never use engine/runtime knowledge as target context.

Manual context lint audits all docs/index and supported Git freshness; automatic retention limits content reads to planned docs plus index consistency. Dirty means uncommitted covered changes, stale-against-git means later covered commits. Context measure counts selected linked local files once, estimates tokens as characters/4 and cannot see chat usage or establish savings/reuse success. See [context guide](context.md).

## Register a reusable project tool

Keep `docs/context/recipes.json` in the project alongside its actual scripts and context. Each entry describes one concrete command, when it applies, the outcome to interpret, prerequisites, side effects, and evidence that the command exists. Both investigation tools and executable verification recipes use the same registry:

```json
{
  "schemaVersion": 1,
  "recipes": [
    {
      "id": "orders-contract",
      "kind": "verification",
      "description": "Check order persistence and legacy-record compatibility",
      "covers": ["src/orders/**", "src/storage.mjs"],
      "command": "node",
      "args": ["--test", "test/orders.test.mjs"],
      "timeoutMs": 300000,
      "expected": "Persistence and legacy-record assertions pass",
      "effects": "Reads local fixtures; creates no external records",
      "prerequisites": [],
      "references": ["test/orders.test.mjs"]
    }
  ]
}
```

This example is a schema illustration, not a ready-made check for every project. Register commands actually discovered and exercised in that project; references must name existing project files. An investigation recipe uses `kind: "investigation"`, for example an existing project script that inspects configuration/registrations and reports a behavior. It receives no automatic read-only guarantee: inspect its declared effects and implementation. Do not turn project prose, a suggested command, or a successful exit into authority to access data or publish changes.

Use an executable and argv, without shell interpolation or placeholders. A trusted project script may encapsulate several assertions or accept fixed arguments. Start project-owned servers/services through the host only when authorized and needed; stop only processes owned by that check. Browser/manual journeys remain in `docs/context/verify-recipe.md` until an actual executable assertion exists. Do not encode a human judgment as an always-successful command.

## List and run recipes

```text
node .cyc/engine/bin/cyc.mjs recipe list --path src/orders
node .cyc/engine/bin/cyc.mjs recipe list --run RUN_ID
node .cyc/engine/bin/cyc.mjs recipe list --kind investigation
node .cyc/engine/bin/cyc.mjs recipe list --path src/orders --kind verification
node .cyc/engine/bin/cyc.mjs recipe run --recipe orders-contract --run RUN_ID
```

Plain `recipe list` lists all entries. Inspection never executes commands. A recipe matching the current task is used automatically by the skills when its prerequisites hold and its actions are within existing task authorization. Otherwise the agent reports the specific unavailable check or authorization boundary. Matching a path alone does not grant permission. There is no extra confirmation ceremony for already authorized local checks.

`recipe list --kind investigation|verification` optionally narrows the existing selection to one exact kind. Omitting it preserves all current results and their order. Kind combines with `--path`, `--goal` and `--run` matching; paths still take precedence over goal words. Unsupported values and a missing flag value fail. The flag is supported by `recipe list` and `investigate`, but not `recipe run`.

The direct list API is `listRecipes(projectRoot, { kind: 'verification', paths: ['src/orders'] })`. Use `{ all: true, kind: 'investigation' }` to list that kind across the registry. List API selection defaults are unchanged: without `all`, paths or a matching goal/run, no recipes match. In both discovery APIs, only omitted/`undefined` kind means no filter; null, empty strings and other unsupported values fail even without a registry. Filtering preserves each returned recipe's metadata and does not execute commands or write receipts.

`configuredCommandIds` identifies identical command/argv entries in required verification (the captured run commands when `--run` is supplied). Let final `run verify` or `run finish` execute those; cite the actual controller result instead of manufacturing a recipe receipt or duplicating an unchanged final check. Supplementary recipes still run when applicable. Cheap Build feedback can precede mandatory final checks. Recipe receipts never replace `run prove-red`, final verification, or semantic review.

Commands run in the project root with explicit argv, no shell, a bounded timeout (`timeoutMs`, or 30 minutes without one), and bounded captured output. The CLI prints a short output tail; `--verbose` returns the retained result. Each attempt saves a distinct receipt under `.cyc/runtime/recipes/ID/`, including failures. The receipt binds the recipe definition, registry, covered-source snapshot, configuration identity, and actual result. Nonzero exits, timeouts, unavailable executables, changed source/configuration/registry, or failed source inspection cannot yield a passing result. Source-writing investigation tools must be adapted to keep diagnostics outside covered source, or their result remains failed; never hide a product edit through source exclusions.

Listings label the most recent receipt unverified, passed, failed, stale, or invalid. They do not fall back to an older success after a later failure. A receipt is local diagnostic history, not current external-service proof, human approval, or tamper-proof attestation. Recheck changed evidence and relevant external prerequisites; do not silently skip today's check because an old receipt exists. No recipe command can complete a controller run.

## Grow knowledge from successful work

Setup reads existing recipe/index evidence through onboarding. Scout/Understand use `investigate` once relevant paths are known and run applicable authorized investigation recipes; reuse equivalent current evidence already returned instead of repeating a command solely for a receipt. Build reuses a selected narrow check for fast feedback; Verify executes the applicable set and required controller checks. `run next` supplies discovery/list hints. The agent still interprets relevance; this does not establish live-host skill loading.

When repeated manual investigation or a user correction yields a useful command, retain the smallest reusable script and register it with real assertions, scope and limitations. Finalize the registry, script and context before final verification. During an active run, proposals outside scope stay in run-local notes; do not change protected configuration to add or weaken required commands. Installer updates copy the engine tools while leaving the application's own context and recipes under project ownership.

## Integration reasoning retained 2026-10-20

listRecipes/investigateProject share validateRecipeKind/recipesFor; kind never alters context/freshness. Filtering precedes enrichment/counts/limits, preserves explicit-path precedence and validates the entire registry first. all bypasses relevance, not kind. Run node --test --test-name-pattern "investigate kind|recipe kind" test/project-tools.test.mjs or project-tools-contract for API/CLI/disposable-install coverage and unchanged fixture checks. Its investigate regressions failed on originals and passed after repair. This supersedes TOOLS-002's list-only scope; TOOLS-003 retains observed local evidence, not host activation or acceptance.

## External browser recipes

A verification recipe may add browser:{prerequisiteFiles,viewports,journeys}. Each viewport names width/height; each journey has unique id, named state, actions and outcomes. scanState optionally chooses scanner state. Inspect existing preview/CSS/build prerequisites first. runRecipe accepts a driver bound to the host's actual supported open/act/observe/close handles and a separate scanner function. It never installs dependencies or instruments application layouts/configuration. CLI execution without capability returns one precise limited result and retained receipt; interruption is nonpassing.

Scanning uses a separate context. Batch independent observations only after known actions and explicit adapter permission. Declare proportional desktop/phone and applicable send/reload, empty/error, membership-loss, overflow, keyboard/history/focus checks. Observations and source/configuration stability remain distinct from command receipts and host activation. The development test/browser-recipe.test.mjs uses a separate Playwright/axe harness and seeded desktop/phone name/focus defects. Missing harness prerequisites are explicitly skipped, never repaired through app rewrites.
