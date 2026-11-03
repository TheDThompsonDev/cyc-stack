// Presentation only: the controller owns transitions and completion decisions.
// Historical observations must never be promoted to current verification here.
export function recoveryGuidance(state, { sourceHash, guardIssues, inspectionError, lastCheck, engineVersion, workspaceOperation }) {
  const stage = state.stages[state.stageIndex] ?? null;
  const issues = guardIssues.protectedChanges.length || guardIssues.outOfScope.length;
  const expired = Boolean(state.limits.maxDurationMs && Date.now() - Date.parse(state.startedAt) >= state.limits.maxDurationMs);
  const exhausted = state.failures >= state.limits.maxAttempts || state.noProgress >= state.limits.maxNoProgress || expired;
  const engineChanged = Boolean(state.engineVersion && state.engineVersion !== engineVersion);
  const activeEvidence = state.status === 'complete' || (state.status === 'running' && !exhausted);
  const current = Boolean(activeEvidence && !inspectionError && !issues && !engineChanged && state.verification?.passed && state.verification.sourceHash === sourceHash);
  const lastEvent = state.history.findLast(item => ['attempt-failed', 'retry', 'blocked', 'guard-halt', 'exhausted', 'pause', 'resume', 'stop'].includes(item.type));
  const verificationStatus = !state.requiresChecks ? 'not-required' : workspaceOperation ? 'unverified' : current ? 'passed' : activeEvidence && state.verification?.passed ? 'stale' : 'unverified';
  const staleHandoffs = sourceHash ? ['verify', 'deliver'].filter(name => {
    const handoff = state.handoffs.findLast(item => item.stage === name && item.status === 'passed');
    return handoff && handoff.sourceHash !== sourceHash;
  }) : [];
  let nextAction;
  const action = (kind, instruction) => { nextAction = { kind, instruction }; };
  if (workspaceOperation?.publicationFailure) action('inspect-operation-commit',
    `A controller outcome could not be published (${workspaceOperation.publicationFailure.stateCommitted ? 'run state was saved; generated review may be stale' : 'run state was not saved; earlier passing fields are not current evidence'}): ${workspaceOperation.publicationFailure.reason}. Preserve both locks and current files${workspaceOperation.backupPath ? ` plus candidate backup at ${workspaceOperation.backupPath}` : ''}. Confirm the owning operation stopped, inspect the retained record/manifest, compare and merge deliberately before operator cleanup. Do not trust an old review, resume automatically or reset the budget.`);
  else if (state.status === 'halted' && state.proofRecovery) action('inspect-proof-restore',
    `Proof halted after a source conflict or restoration failure. Preserve current files and candidate versions in ${state.proofRecovery.backupPath}. Inspect manifest.json and the listed conflicts, compare and merge deliberately; do not overwrite either version blindly. This run cannot resume or receive an automatic fresh budget.${state.proofRecovery.preservationError ? ` ${state.proofRecovery.preservationError}` : ''}`);
  else if (workspaceOperation) action('wait-workspace',
    `Another CYC operation owns this working folder (${workspaceOperation.operation ?? 'unknown'}${workspaceOperation.pid ? `; PID ${workspaceOperation.pid}` : ''}). Wait for it to finish, then inspect current files again. The next controller operation reclaims ${workspaceOperation.path} only if its process has ended on this machine and it records no commit in progress, test proof or failed publication; any other stale lock requires operator inspection. Do not remove an active lock or treat temporary source as the candidate.${workspaceOperation.reclaimGuard ? ` A reclaim guard at ${workspaceOperation.reclaimGuard.path}${workspaceOperation.reclaimGuard.pid ? ` from PID ${workspaceOperation.reclaimGuard.pid} (${workspaceOperation.reclaimGuard.alive ? 'still running' : 'no longer running'})` : ''} blocks automatic reclaim; once no CYC process is running in this project, remove it.` : ''}${workspaceOperation.backupPath && workspaceOperation.phase !== 'restored' ? ` If inspection confirms the owner stopped, preserve the locks, current files and candidate backup at ${workspaceOperation.backupPath}; read manifest.json, compare and merge deliberately before any lock cleanup. No automatic rollback or budget reset.` : ''}`);
  else if (state.status === 'complete') action('review-complete', 'This run is complete as recorded. Review its evidence against current files; later changes need a separately scoped task, not a reset of this run.');
  else if (['exhausted', 'halted', 'stopped'].includes(state.status) || exhausted) action('review-terminal',
    `${expired ? 'The configured time budget has elapsed.' : 'This run cannot continue within its recorded state or budget.'} Review the existing changes, failure receipt and review document. Explain the unresolved issue and needed decision; do not retry, resume or automatically start a fresh budget.`);
  else if (inspectionError) action('inspect-workspace', `Current source could not be inspected: ${inspectionError} Resolve that inspection problem before advancing.`);
  else if (issues) action('review-guard', 'Protected files or paths outside the agreed scope changed. Inspect those changes with the existing work preserved. Do not automatically undo user edits, alter the scope or resume this run.');
  else if (engineChanged) action('reload-engine', `This run started with CYC ${state.engineVersion}; the current engine is ${engineVersion}. Stop the old run, reload host skills, and explicitly decide how to continue in a new run with the old evidence retained.`);
  else if (state.status === 'blocked') {
    const blocker = state.history.findLast(item => item.type === 'blocked')?.reason ?? state.handoffs.at(-1)?.summary ?? 'The recorded prerequisite remains unresolved.';
    action('resolve-blocker', `${blocker} Once the prerequisite is actually resolved, use run resume for this run and re-establish verification; resuming does not reset its budget.`);
  } else if (state.status === 'paused') action('resume', 'Compare the retained checkpoint and current diff, preserving edits. When continuing this task, use run resume for this run. It retains the failure budget and invalidates previous verification.');
  else if (state.requiresChecks && !state.commands.length) action('configure-checks', 'This run captured no verification commands. Preserve and stop it, inspect the project checks through onboarding, and configure approved commands before explicitly starting a new run. Do not change configuration beneath this run or invent a passing check.');
  else if (staleHandoffs.length) action('refresh-review', `The recorded ${staleHandoffs.join(' and ')} handoff no longer matches current source. Retry the affected review stage with a reason, rerun applicable checks and refresh the handoff before completion. Passing commands alone do not refresh a stale review.`);
  else if (lastCheck?.sourceStable === false && !state.verification && lastEvent?.type !== 'resume') action('inspect-source-change',
    'Configured checks changed covered project files. Inspect changedPaths in the retained receipt, finalize intended generated files, and select a non-mutating verification approach through the normal project configuration process. Do not count passing command exits as verification of a stable candidate.');
  else if (lastCheck && lastCheck.status !== 'passed' && !state.verification && lastEvent?.type !== 'resume') {
    const failed = lastCheck.failedChecks ?? [];
    const missing = failed.filter(check => check.errorCode === 'ENOENT');
    const timedOut = failed.filter(check => check.errorCode === 'ETIMEDOUT');
    action('inspect-check', missing.length ? `The executable could not be started for: ${missing.map(item => item.id).join(', ')}. Inspect the recorded executable and project setup instructions; do not infer a product defect or invent a replacement command.`
      : timedOut.length ? `Checks timed out: ${timedOut.map(item => item.id).join(', ')}. Inspect the receipt and the expected service or workload before changing a timeout or retrying.`
        : 'Inspect the last check receipt and reproduce the failure. Separate the observed result from its suspected cause; repair within scope or name the missing prerequisite. Do not classify an ordinary failing exit as an environment problem without evidence.');
  } else if (lastEvent?.type === 'attempt-failed' && state.handoffs.at(-1)?.status === 'failed') action('inspect-failure',
    `Inspect the failed ${state.handoffs.at(-1).stage} handoff: ${state.handoffs.at(-1).summary} Use its recorded evidence to choose the next hypothesis before retrying; retain the shared failure budget.`);
  else if (state.requiresChecks && !current && ['verify', 'deliver', null].includes(stage)) action('verify',
    'Current files do not have passing executable evidence. If a Verify handoff already passed, retry the affected stage with a reason first; then run verification and refresh the semantic review. Preserve the existing failure budget.');
  else action('continue', stage ? `Continue the ${stage} stage with the original criteria. Inspect the existing handoff and current diff before editing; a stage result is not task completion.` : 'All stages are recorded. Use run complete to let the controller check freshness and completion conditions.');
  return {
    runId: state.id, status: state.status, goal: state.goal, stage, criteria: state.criteria,
    remainingAttempts: Math.max(0, state.limits.maxAttempts - state.failures),
    remainingUnchangedFailures: Math.max(0, state.limits.maxNoProgress - state.noProgress),
    expired, engineChanged, guardIssues, staleHandoffs, inspectionError: inspectionError ?? null,
    verification: { status: verificationStatus, detail: current ? 'Configured commands passed on current covered source; task criteria and semantic review still govern completion.' : 'Historical results are retained for diagnosis, not current completion evidence.' },
    lastCheck, lastEvent: lastEvent ?? null,
    ...(state.proofRecovery ? { proofRecovery: state.proofRecovery } : {}),
    ...(workspaceOperation ? { workspaceOperation } : {}),
    previousHandoff: state.handoffs.at(-1) ? { stage: state.handoffs.at(-1).stage, status: state.handoffs.at(-1).status, summary: state.handoffs.at(-1).summary, nextAction: state.handoffs.at(-1).nextAction } : null,
    reviewPath: `.cyc/runs/${state.id}/review.md`,
    acceptedFailures: state.acceptedFailures ?? [],
    preservation: 'Recovery inspection changed no source files, run state, receipts or budgets. Existing files remain in place; this is not a backup or a claim that earlier commands had no side effects.',
    nextAction
  };
}
