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

The context index uses a Markdown table with `Covers` and `Doc` or `Record` columns, plus optional `Evidence`. Paths are comma-separated; links resolve relative to the index. Supported coverage patterns are literal paths/directories, `*`, `**`, and `?`; `all` means all paths in an index row. Patterns use forward slashes and match case exactly. Escaped table pipes are supported; malformed rows are reported. Missing/deleted record links remain visible. Linked/out-of-project paths are not followed. Existing projects without an index or registry fall back to ordinary source investigation and manual check discovery.

## Component context docs

`docs/context/` holds one doc per component in a fixed layout, and `INDEX.md` is their table of contents: per component the Covers patterns, the doc link, the last AI change (date, run, one line) and the lesson count. The first step of a task reads the index and the matched docs, not every doc. The layout rules are in the [Context method](../methods/cyc-context/SKILL.md) and as the `rules` export of `scripts/context-review.mjs`.

```text
node .cyc/engine/bin/cyc.mjs context review                      # every completed run no doc records yet
node .cyc/engine/bin/cyc.mjs context review --run RUN_ID --write # append this run's entry and refresh INDEX.md
node .cyc/engine/bin/cyc.mjs context review --since 2026-11-01 --write --new billing
node .cyc/engine/bin/cyc.mjs context lint [--doc docs/context/orders.md]
node .cyc/engine/bin/cyc.mjs context measure --path src/orders [--run RUN_ID]
```

`context review` maps each completed run's changed files (the final handoff's artifacts, with their SHA-256) to index rows through the same Covers patterns `investigate` uses, and proposes one entry per matched component doc from the run's own record: the Build summaries, the Deliver `learning` and `errorHistory` reasons, retry reasons, ledger entries that name the run, the test-proof claim or verdict and the verification results, the files, the date and the run ID. A field the run did not record is said to be missing, never invented. The proposal also says which component docs the run touched (`contextDocsTouched`, from the Deliver handoff) and which mapped docs it should have touched. It is read-only without `--write`; with it, the entry and lessons go in newest first, the `Last changed by AI` line is set, the index cells are refreshed (two columns are added to an older index), and the result is linted. It refuses a doc that lacks the layout, never edits a Current view, and does not write to reference rows whose link points outside `docs/context/`. `--new NAME` creates a doc for files no row covers; its Current view is a placeholder the lint reports until someone writes it.

`context lint` names each violated rule with its line, compares every index row with its doc (Covers, last change, lesson count) and with Git: a covered path committed after the doc's last commit is `stale-against-git`, uncommitted edits to covered paths are `dirty`. `context measure` reports characters and estimated tokens (characters divided by four, no tokenizer) for the index plus the matched docs against every doc and against the run records (`state.json` and `review.md`); it cannot see a chat transcript, and a smaller read is not evidence that the next task succeeds with it. See the [context guide](context.md) for current usage and measurement limits.

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

`listRecipes` and `investigateProject` share `validateRecipeKind` and `recipesFor` in `scripts/project-tools.mjs`. Both validate kind at their public boundary and pass it as a separate recipe-helper argument. The context/evidence branch never uses kind. Reusing `selection` preserves explicit path precedence and the run's changed-path → declared-scope → goal fallback. `all` bypasses relevance, never kind. Registry validation still checks every entry before filtering, so an excluded invalid entry cannot be hidden by a kind request. Filtering precedes receipt enrichment and investigation recipe counts/truncation; returned command identities and receipt diagnostics retain their existing meaning.

Reusable checks: `node --test --test-name-pattern "investigate kind|recipe kind" test/project-tools.test.mjs` exercises CLI/API selection, invalid kinds, omission, recipe counts/limits, unchanged context/freshness and unchanged fixture bytes/directories. The existing `project-tools-contract` recipe also covers captured command IDs, receipt states and a disposable installed CLI. Tests live in the development checkout and are not shipped in the engine. The investigate regression checks failed on run-start code (ignored kind, wrong limited recipe and missing validation), then passed after the boundary extension. These checks establish local behavior, not host activation or human acceptance. The earlier list-only scope recorded in TOOLS-002 is superseded by this extension; TOOLS-003 records its regression evidence.
