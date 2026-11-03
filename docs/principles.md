# Engineering principles

Use these questions during Build and the Verify assessment. Connect findings to the requested outcome, an actual caller and evidence. The controller checks recorded state and executed commands; the agent remains responsible for interpreting the change.

## Scope the work around the promised result

Identify the observable outcome and the affected readers and writers before editing. Keep an improvement outside that outcome separate. A newly discovered dependency may require updating the impact map; it does not automatically authorize another feature.

## Explain the failure through its actual path

Trace the input or state to the first incorrect result. A repair should address that path and the legitimate callers it serves. Describe the trigger and consequence before adding a guard, changing an interface or removing a branch.

## Use checks that can detect the missing behavior

For a feature or bug fix, establish that a relevant new test fails on the original and passes on the candidate. For a refactor, establish preserved behavior on both. CYC records this through `run prove-red`; a justified exemption remains an exemption. A passing command with no meaningful assertion cannot establish the requirement.

## Test through the contract people use

Check results, error outcomes, saved state and affected consumers. Include the relevant rejected or recovery case. An internal rearrangement should not break a test unless the arrangement itself is part of the supported contract.

## Extend existing project conventions deliberately

Locate the project's current implementation, configuration and check before adding another. Preserve a useful pattern, or explain the concrete limitation that requires changing it. A second dependency, representation or entry point needs a purpose tied to the task.

## Make shared state and ownership explicit

Identify which operation owns a transition and which consumers read its result. Consider old records, repeated actions and partial failure where applicable. Choose a representation that callers can use correctly without coordinating hidden updates.

## Define input and failure behavior at the interface

State which inputs are accepted and how rejection is reported. Keep failure details that callers need to choose a next action. When an operation can partly succeed, distinguish the confirmed effect from the unknown or failed portion before deciding whether to retry.

## Change callers together with their contract

When replacing a project interface, locate and update its consumers. Keep compatibility only where an actual supported caller requires it. Verify both the new behavior and the existing paths affected by the change.

## Let failed attempts change the investigation

Record the failed check and the assumption it challenges. Before another attempt, identify the new evidence or changed hypothesis that justifies it. CYC's failure and no-progress budgets remain shared across stages; a stage transition does not grant another budget.

## Keep claims attached to current evidence

Name the command or observation and the files it covered. Separate executed results, agent interpretation, unavailable checks and human acceptance. Recheck affected evidence after source changes. A historical success cannot establish today's changed behavior.

## Leave a maintainable result and handoff

A later developer should be able to locate the relevant state, understand why the implementation fits and run the check that protects it. Retain useful reasoning and failed approaches in project context. Keep explanations proportional to the change and preserve meaningful existing documentation.

For state, interface and review decisions, use [architecture and code review](code-quality.md). [Work assessments](work-assessments.md) describe the recorded Scout, Verify and Deliver evidence.
