// Explicit simulated review evidence for controller fixtures, never product claims.
export function fixtureAssessment(state, stage = state.stages[state.stageIndex]) {
  if (state.workContractVersion !== 1) return undefined;
  if (stage === 'scout') return {
    context: { status: 'none', sources: [], evidence: 'Fixture has no relevant component history.', freshness: 'No matched context to revalidate.' },
    approach: { kind: 'extend', evidence: 'Fixture behavior is extended in place.' },
    alignment: { status: 'clear', evidence: 'Fixture requirements have no open product decisions.' },
    consumers: [{ id: 'behavior', description: 'Fixture public behavior.', check: 'Configured behavior command.' }]
  };
  if (stage === 'verify') return {
    // Non-Git bookkeeping fixtures isolate another gate. Dedicated proof tests
    // remove this exemption and require actual original-code receipts instead.
    ...(!state.base && state.sourceCapture?.version === 1 ? { testProof: { status: 'exempt', reason: 'Synthetic controller fixture exercising another gate; original-code proof is tested separately, not claimed here.' } } : {}),
    semanticReview: { reviewer: 'self', intent: 'Simulated fixture intent review.', consumers: 'Simulated fixture consumer review.', conventions: 'Simulated fixture conventions review.', findings: [] },
    consumerChecks: [{ id: 'behavior', result: 'passed', evidence: 'Fixture checks are executed separately by the controller.' }]
  };
  if (stage === 'deliver') return {
    learning: { status: 'none', reason: 'Synthetic fixture; no production knowledge to promote.', artifacts: [] },
    errorHistory: state.failures || state.playbook === 'bug-fix'
      ? { status: 'recorded', reason: 'Synthetic failures represented in the fixture ledger.', artifacts: [state.ledgerPath] }
      : { status: 'none', reason: 'No fixture failure occurred.', artifacts: [] }
  };
}
