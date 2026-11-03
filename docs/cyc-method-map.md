# How CYC's full method library relates to its workflow

CYC currently has **one orchestrator (`cyc`), 17 supporting methods and 15 playbooks**. The familiar Scout → Build → Verify → Deliver chain is the recorded route for feature, bug-fix, refactor and performance work. It is not the entire skill library or the route for every task.

Open the [complete method-selection map](assets/cyc-method-library.svg). The [connected implementation flow](cyc-workflow.md) explains forward work, recovery and knowledge handoffs. The selection map's arrows mean “choose methods relevant to this need”; its rows group responsibilities and do not establish an execution order. The runtime distribution includes compact vector diagrams; development bitmap/HTML exports stay in the source checkout.

## Why the earlier view looked like only four skills

The diagram centered the four recorded stages and nested much of the engineering inside Scout. Its previous annotations actually named 12 methods, but omitted Setup, Remember, Explore, Correct and Reflect. That omitted setup, continuity, option comparison, feedback correction and method improvement from the picture.

The instructions also encourage this compression. The [orchestrator](../skills/cyc/SKILL.md) presents a fast Scout/build/verify/deliver flow; [Scout](../methods/cyc-scout/SKILL.md) calls Understand, Impact and Design reference material for when something is genuinely unclear and says not to read them by default.

This creates an instruction tension worth fixing: [Impact](../methods/cyc-impact/SKILL.md) calls for use before substantive changes and when shared state, storage or interfaces are involved. [Design](../methods/cyc-design/SKILL.md) calls for use when adding state, changing a data shape/interface or spanning several files. Those are concrete properties of the task, even when the agent feels confident. This source review establishes the conflicting guidance; it does not measure how often a live agent actually skips a method.

The recommended routing rule is to select a method from its task, risk and evidence triggers, with depth proportional to the change. A small task can need only a few methods; a cross-component change may need many. A stage label should not substitute for performing the applicable method. This diagram update documents the issue; it does not modify orchestration, skill instructions or controller enforcement.

## Every supporting method has a distinct job

Examples below are illustrative, not results from an implemented export feature.

| Method | When it enters | Example and output |
| --- | --- | --- |
| [Setup](../methods/cyc-setup/SKILL.md) | Project configuration or activation is needed | Discover real CI commands, configure the chosen checks and report their initial results and hook status. |
| [Scout](../methods/cyc-scout/SKILL.md) | A bounded engineering task starts | Locate the export path, relevant history, affected consumers and checks; produce the initial plan. |
| [Remember](../methods/cyc-remember/SKILL.md) | Consequential decisions, checkpoints or resumed work | Record why a query was chosen; reconstruct the next step and check drift after interruption. |
| [Teach](../methods/cyc-teach/SKILL.md) | The engineer requests a lesson or practice | Explain pagination using their export code, with practice if appropriate. Ordinary engineering updates remain required without invoking Teach. |
| [Frame](../methods/cyc-frame/SKILL.md) | The outcome, scope or success criteria are unclear | Define “all authorized filtered records across pages” as the target, rather than merely producing a download. |
| [Understand](../methods/cyc-understand/SKILL.md) | Existing behavior or a failure needs explanation | Trace the request through pagination and the query; establish the cause from evidence. |
| [Explore](../methods/cyc-explore/SKILL.md) | An open decision needs distinct options | Compare paged fetch, streaming and queued export against the same criteria; recommend an approach and disclose prototype limits. |
| [Impact](../methods/cyc-impact/SKILL.md) | A substantive change affects data or dependent behavior | Find permission and count consumers sharing the query; name risks, supporting facts and checks. |
| [Design](../methods/cyc-design/SKILL.md) | State, interfaces or the shape of a change need design | Define the export/query boundary and error contract, compare alternatives or cite an established pattern, and plan evaluable slices. |
| [Challenge](../methods/cyc-challenge/SKILL.md) | A consequential plan, review or claim needs scrutiny | Question whether the proposed export bypasses access filtering or whether a download test proves record completeness. |
| [Build](../methods/cyc-build/SKILL.md) | The selected approach needs implementation | Repair retrieval in small tested slices and inspect the resulting diff. |
| [Verify](../methods/cyc-verify/SKILL.md) | A behavior claim needs current evidence | Check exported membership, duplicate handling, access rules and the CSV consumer; retain results and limits. |
| [Deliver](../methods/cyc-deliver/SKILL.md) | The result needs a reviewable handoff | Explain the changed query path, identify checks and disclose unmeasured scale or other remaining limitations. |
| [Context](../methods/cyc-context/SKILL.md) | Before component work and when retaining useful findings | Retrieve and revalidate history; retain verified facts with evidence and limits, identify adopted decisions only with actual acceptance, and label undecided proposals. |
| [Error Ledger](../methods/cyc-error-ledger/SKILL.md) | Before debugging and immediately after failed attempts | Record that a paging fix duplicated rows, its hypothesis and check evidence; preserve the next hypothesis and confirmed resolution. |
| [Correct](../methods/cyc-correct/SKILL.md) | User feedback or repeated misses reveal a missing criterion | “Not just the visible page” changes the target; repair the responsible work and recheck existing as well as newly clarified criteria. |
| [Reflect](../methods/cyc-reflect/SKILL.md) | Outcomes support a reusable method/check improvement | Propose a multi-page check after a repeated omission, with evidence and a counter-case. Apply changes only within authorized scope. |

Context, Remember and Reflect are different: Context preserves component knowledge; Remember preserves decisions and continuity of the task; Reflect proposes improvements to how future work is done. Error Ledger supplies failure history to both investigation and later learning. Correct addresses the current miss and can supply evidence for a later Reflect proposal.

## Routes can use more than four recorded stages

These examples are copied from the current [playbook catalog](../catalog/playbooks.json):

| Playbook | Recorded sequence |
| --- | --- |
| Feature / bug-fix / refactor / performance | Scout → Build → Verify → Deliver |
| Plan | Frame → Understand → Impact → Design → Challenge → Deliver |
| Explore | Frame → Understand → Explore → Challenge → Deliver |
| Experience | Scout → Explore → Build → Verify → Deliver |
| Teach | Frame → Understand → Teach → Deliver |
| Resume | Remember → Understand → Deliver |
| Reflect | Remember → Reflect → Deliver |
| Evaluate | Frame → Understand → Explore → Verify → Reflect → Deliver |

The catalog defines recorded sequences. The active host agent reads and performs the methods; the controller does not automatically invoke them. Some supporting methods are used within stages or across the task rather than appearing as catalog stage names. The present diagram therefore establishes where skills fit, not proof of their invocation or substantive quality in a live run.
