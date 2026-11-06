import { digest } from './response-gate.mjs';
import { retentionOf } from './context-review.mjs';

// These checks establish recorded process evidence, not the truth of an agent's judgment.
const text = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const requireText = (value, name) => { if (!text(value)) throw new Error(`${name} needs meaningful evidence.`); };
const requireChoice = (value, choices, name) => { if (!choices.includes(value)) throw new Error(`${name} must be ${choices.join(', ')}.`); };
export const reviewPath = state => `.cyc/runs/${state.id}/review.md`;

export function assessmentRequirements(state, stage) {
  if (state.workContractVersion !== 1) return [];
  const keys = ({ scout: ['context', 'approach', 'alignment', 'consumers'], verify: ['semanticReview', 'consumerChecks'], deliver: ['learning', 'errorHistory'] })[stage] ?? [];
  return stage === 'verify' && state.evidenceVersion === 1 ? [...keys, 'criterionChecks'] : keys;
}

export const criterionClauses = state => state.criteria.flatMap(c => (c.clauses ?? [{ id: undefined }]).map(clause => ({ id: c.id, clause: clause.id })));

// Coverage records describe source provenance. They do not attest reviewer independence.
export function reviewCurrent(record, state, sourceHash, files, contextKey) {
  if (!record || record.criteriaHash !== digest(JSON.stringify(state.criteria))) return false;
  if (record.contextMode === 'bounded' && (!record.contextInputs?.bounded || record.contextInputs.key !== contextKey)) return false;
  if (record.sourceHash === sourceHash) return true;
  if (record.contextMode !== 'bounded' || !files) return false;
  const prefixes = [...record.scope, ...record.contextPaths];
  const covered = path => prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
  return [...new Set([...Object.keys(record.files), ...Object.keys(files)])].filter(covered).every(path => record.files[path] === files[path]);
}
export function reviewCoverage(state, review, source) {
  const sourceHash = typeof source === 'string' ? source : source.hash;
  const files = typeof source === 'string' ? undefined : source.files;
  const refs = review?.receipts ?? [];
  const entries = refs.map(id => (state.reviewReceipts ?? []).find(r => r.id === id));
  if (!entries.length) return { status: review?.reviewer === 'self' ? 'self-assessment' : 'unlinked', entries: [] };
  const stale = entries.some(r => !r || r.status !== 'recorded' || !reviewCurrent(r, state, sourceHash, files, typeof source === 'string' ? undefined : source.contextKey));
  const kinds = new Set(entries.filter(Boolean).map(r => r.reviewer));
  return { status: stale ? 'stale' : kinds.size > 1 ? 'mixed' : 'source-linked', entries };
}

export function validateProofReview(state, review) {
  if (state.evidenceVersion !== 1 || !state.testProof?.passed || state.testProof.mode === 'green') return;
  if (!object(review) || !Array.isArray(review.cases) || !review.cases.length) throw new Error('Diagnostic red needs proofReview.cases with a reason review of decisive failures; run prove-red first.');
  if (!['current-proof', state.testProof.receiptPath].includes(review.receipt)) throw new Error('proofReview must reference the current proof receipt.');
  if (new Set(review.cases.map(c => c?.id)).size !== review.cases.length) throw new Error('proofReview case ids must be unique.');
  for (const item of review.cases) {
    if (!state.testProof.failures?.some(f => f.id === item?.id)) throw new Error(`Unknown proof failure ${item?.id}.`);
    requireChoice(item.category, ['behavioral', 'new-interface', 'setup', 'unclassified'], 'Proof category');
    requireText(item.reason, 'Proof reason');
    if (/^<.*>$/.test(item.reason.trim())) throw new Error('Replace the proof reason placeholder with actual evidence.');
    if (item.category === 'behavioral') requireText(item.boundary, 'Existing observable boundary');
    if (item.category === 'behavioral' && state.testProof.failures.find(f => f.id === item.id)?.hint === 'module-load') throw new Error('A module-load failure cannot establish an existing behavioral boundary; classify the absent interface or setup honestly.');
    if (item.category === 'behavioral' && state.testProof.failures.find(f => f.id === item.id)?.error === 'test failed') throw new Error('A generic test-file failure has no decisive behavioral assertion; retain diagnostic uncertainty or provide focused evidence.');
  }
  const decisive = state.playbook === 'bug-fix' ? ['behavioral'] : ['behavioral', 'new-interface'];
  if (!review.cases.some(c => decisive.includes(c.category))) throw new Error('No decisive behavioral proof for this bug fix (features may prove a new interface); setup and unclassified failures remain diagnostic.');
}

// Fields the controller records when the agent leaves them out, limited to what its own record
// shows: nothing reusable was recorded; a run that is not a bug fix had no failed attempt; or the
// project keeps no context history to consult. A bug fix's cause, consumer evidence and review
// findings are judgment, and always come from the agent.
export function derivedAssessment(state, stage, { contextHistory = true } = {}) {
  if (state.workContractVersion !== 1) return {};
  if (stage === 'scout') return contextHistory ? {} : {
    context: { status: 'none', evidence: 'Not given at start: this project has no docs/context/INDEX.md and no ledger, so there was no recorded history to consult.', freshness: 'No recorded history exists to go stale.', sources: [] }
  };
  if (stage === 'deliver') return {
    ...(retentionOf(state)?.disposition === 'required' ? {} : { learning: { status: 'none', reason: 'Not given at finish: no reusable learning was recorded for this run.', artifacts: [] } }),
    ...(state.playbook !== 'bug-fix' && !state.failures ? { errorHistory: { status: 'none', reason: 'Not given at finish: this run recorded no failed attempt.', artifacts: [] } } : {})
  };
  return {};
}

// A fill-in skeleton for the current stage, so agents never need to read the contract docs to
// write a valid assessment. Angle-bracket strings and "a | b" choices are placeholders that
// validation rejects, so a template submitted unedited can never pass.
export function assessmentTemplate(state, stage) {
  const required = assessmentRequirements(state, stage);
  if (!required.length) return null;
  const scoutConsumers = state.handoffs?.findLast(item => item.stage === 'scout' && item.status === 'passed')?.assessment?.consumers ?? [];
  const retention = retentionOf(state);
  const templates = {
    context: { status: 'used | none', evidence: '<what you searched for prior context>', freshness: '<why that context is still current, or why none applies>', sources: ['<project-relative path; [] when status is none>'] },
    approach: { kind: 'reuse | extend | repair | create', evidence: '<existing code you found and why this approach>' },
    alignment: { status: 'clear | confirmed', evidence: '<why the request is unambiguous, or what the user confirmed>' },
    consumers: [{ id: 'direct', description: '<the behavior you are changing>', check: '<how you will verify it>' }],
    semanticReview: { reviewer: 'self | fresh-context | peer', intent: '<does the diff do what was asked, nothing more>', consumers: '<are dependents still correct>', conventions: '<does it match project style>', findings: [] },
    consumerChecks: (scoutConsumers.length ? scoutConsumers : [{ id: 'direct' }]).map(item => ({ id: item.id, result: 'passed', evidence: '<the command or observation that showed it works>' })),
    criterionChecks: criterionClauses(state).map(item => ({ ...item, scenario: '<named scenario for this original outcome/clause>', check: '<configured command id>', receipt: 'current-verification', result: 'passed', origin: 'agent-reported', evidence: '<what this scenario established; not a suite count>' })),
    learning: retention?.disposition === 'required' ? { status: 'recorded', reason: '<actual feature knowledge and limits retained>', artifacts: retention.features.map(f => f.doc), context: retention.features.map(f => ({ id: f.id, currentView: '<Describe capability, contracts, decisions, checks and limits; or author the canonical file and remove this context input.>' })) } : { status: 'none | recorded | pending-acceptance', reason: '<why nothing is reusable, or what was recorded>', artifacts: [] },
    errorHistory: { status: state.playbook === 'bug-fix' || state.failures > 0 ? 'recorded' : 'none | recorded', reason: '<what failed and how it was resolved, or why there was no error>', artifacts: state.playbook === 'bug-fix' || state.failures > 0 ? [state.ledgerPath ?? 'docs/context/error-ledger.md'] : [] }
  };
  return Object.fromEntries(required.map(key => [key, templates[key]]));
}

// Accept common spellings of the same structure, in place. Evidence is never filled in: every
// reason, finding, and check result still has to come from the agent.
function normalizeAssessment(assessment) {
  const canonical = paths => Array.isArray(paths) ? paths.map(path => typeof path === 'string' ? path.replaceAll('\\', '/').replace(/^\.\//, '') : path) : paths;
  const { context, semanticReview, consumerChecks, learning, errorHistory } = assessment;
  if (object(context)) {
    if (context.status === 'none' && context.sources === undefined) context.sources = [];
    context.sources = canonical(context.sources);
    // "none" says no matched history exists; files listed with it are what was read while
    // looking, not history sources. Keep the claim and record them as read.
    if (context.status === 'none' && Array.isArray(context.sources) && context.sources.length) {
      context.read = [...new Set([...(Array.isArray(context.read) ? context.read : []), ...context.sources])];
      context.sources = [];
    }
    if (Array.isArray(context.read)) context.read = [...new Set(canonical(context.read))];
  }
  for (const entry of [learning, errorHistory]) {
    if (!object(entry)) continue;
    if (entry.status === 'none' && entry.artifacts === undefined) entry.artifacts = [];
    entry.artifacts = canonical(entry.artifacts);
  }
  const findings = (Array.isArray(semanticReview?.findings) ? semanticReview.findings : []).filter(object);
  const taken = new Set(findings.map(finding => finding.id));
  let next = 1;
  for (const finding of findings) {
    // An id is only a label, so an unused one is supplied. Status and evidence still come from the agent.
    if (finding.id === undefined) { while (taken.has(`f${next}`)) next += 1; finding.id = `f${next}`; taken.add(finding.id); }
    // "dismissed: out of scope" states the status, then its evidence. Only a status word set off by
    // a colon or a spaced dash counts, so "Fixed-width output still misaligns" names no status.
    // Any other resolution is the agent's evidence; a missing status is still refused.
    const spelled = typeof finding.resolution === 'string' ? /^\s*(resolved|fixed|dismissed|open)\s*(?::|\s[-–—]|$)\s*/i.exec(finding.resolution) : null;
    if (finding.status === undefined && spelled) {
      finding.status = spelled[1];
      const rest = finding.resolution.slice(spelled[0].length).trim();
      if (rest) finding.evidence ??= rest;
    } else if (typeof finding.resolution === 'string' && finding.resolution.trim()) finding.evidence ??= finding.resolution.trim();
    if (typeof finding.status === 'string' && /^(?:resolved|fixed|dismissed|open)$/i.test(finding.status.trim())) finding.status = finding.status.trim().toLowerCase();
    if (finding.status === 'fixed') finding.status = 'resolved';
    finding.evidence ??= finding.reason;
  }
  for (const check of Array.isArray(consumerChecks) ? consumerChecks : []) if (object(check) && check.result === 'pass') check.result = 'passed';
}

const findingShape = 'Each finding is {"id": "...", "status": "resolved | dismissed | open", "evidence": "..."}.';

export function validateAssessment(state, packet, fingerprint, { proofPending = false } = {}) {
  const required = assessmentRequirements(state, packet.stage);
  if (packet.status !== 'passed' || !required.length) return [];
  const assessment = packet.assessment;
  if (!object(assessment)) throw new Error(`Passing ${packet.stage} needs an assessment: ${required.join(', ')}. Use --assessment FILE or packet.assessment.`);
  normalizeAssessment(assessment);
  const missing = required.filter(key => !(key in assessment));
  if (missing.length) throw new Error(`Assessment is missing ${missing.join(', ')}. Run next returns a fill-in assessmentTemplate.`);
  const placeholder = findPlaceholder(assessment);
  if (placeholder) throw new Error(`Replace the template placeholder at ${placeholder} with real evidence.`);
  const artifacts = [];
  const files = (paths, name, requiredFile = false) => {
    if (!Array.isArray(paths) || paths.some(path => !text(path)) || new Set(paths).size !== paths.length || (requiredFile && !paths.length)) throw new Error(`${name} needs ${requiredFile ? 'at least one' : 'an array of unique'} project-relative artifact path${requiredFile ? '' : 's'}.`);
    for (const path of paths) {
      if (path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) throw new Error('Assessment paths must be canonical project-relative paths using forward slashes.');
      if (path.replaceAll('\\', '/') === reviewPath(state)) throw new Error('The generated review cannot be its own assessment evidence.');
      artifacts.push(fingerprint(path));
    }
  };
  if (packet.stage === 'scout') {
    const { context, approach, alignment, consumers } = assessment;
    requireChoice(context?.status, ['used', 'none'], 'context.status');
    requireText(context.evidence, 'Context lookup');
    requireText(context.freshness, 'Context freshness');
    files(context.sources, 'context.sources', context.status === 'used');
    if (context.status === 'none' && context.sources.length) throw new Error('No-context assessment cannot list used sources.');
    // Read files are not fingerprinted (the build changes them), but they stay inside the project.
    const projectRelative = path => text(path) && !path.startsWith('/') && !/^[a-zA-Z]:/.test(path) && path.split('/').every(part => part && part !== '.' && part !== '..');
    if (context.read !== undefined && (!Array.isArray(context.read) || !context.read.every(projectRelative))) throw new Error('context.read needs an array of project-relative paths using forward slashes, with no "..".');
    requireChoice(approach?.kind, ['reuse', 'extend', 'repair', 'create'], 'approach.kind');
    requireText(approach.evidence, 'Existing functionality and chosen approach');
    requireChoice(alignment?.status, ['clear', 'confirmed', 'needs-input'], 'alignment.status');
    requireText(alignment.evidence, 'Developer alignment');
    if (alignment.status === 'needs-input') throw new Error('Unresolved developer alignment must be recorded blocked, not passed.');
    if (!Array.isArray(consumers) || !consumers.length || new Set(consumers.map(item => item?.id)).size !== consumers.length) throw new Error('Scout needs unique consumers, including the directly affected behavior.');
    for (const consumer of consumers) {
      if (!/^[a-zA-Z0-9_-]+$/.test(consumer?.id ?? '')) throw new Error('Consumer needs a stable id.');
      requireText(consumer.description, 'Consumer description');
        requireText(consumer.check, 'Consumer check');
        if (consumer.journey !== undefined) {
          requireText(consumer.journey.name, 'Journey name'); requireText(consumer.journey.writer, 'Authoritative writer entrypoint');
          if (!Array.isArray(consumer.journey.operations) || consumer.journey.operations.length < 2 || consumer.journey.operations.some(op => !text(op))) throw new Error('Protected journey needs named subsequent read/write operations.');
        }
    }
  }
  if (packet.stage === 'verify') {
    const { semanticReview, consumerChecks } = assessment;
    requireChoice(semanticReview?.reviewer, ['self', 'fresh-context', 'peer'], 'semanticReview.reviewer');
    for (const axis of ['intent', 'consumers', 'conventions']) requireText(semanticReview[axis], `Semantic review ${axis}`);
    if (!Array.isArray(semanticReview.findings)) throw new Error('Semantic review needs findings (an empty array means no findings).');
    const findingKey = item => state.evidenceVersion === 1 ? JSON.stringify([item?.reviewId ?? null, item?.id]) : item?.id;
    if (new Set(semanticReview.findings.map(findingKey)).size !== semanticReview.findings.length) throw new Error(`Review finding ids must be unique within their receipt scope. ${findingShape}`);
    for (const finding of semanticReview.findings) {
      try {
        requireText(finding?.id, 'Finding id');
        requireChoice(finding.status, ['resolved', 'dismissed', 'open'], `Finding ${finding.id} status`);
        requireText(finding.evidence, `Finding ${finding.id} resolution or dismissal`);
      } catch (error) { throw new Error(`${error.message} ${findingShape}`); }
      if (finding.status === 'open') throw new Error('Open semantic review findings prevent passing verification.');
    }
    const scout = state.handoffs.findLast(item => item.stage === 'scout' && item.status === 'passed');
    if (!Array.isArray(consumerChecks) || new Set(consumerChecks.map(item => item?.id)).size !== consumerChecks.length) throw new Error('Consumer checks must have unique ids.');
    for (const consumer of scout?.assessment?.consumers ?? []) {
      if (!consumerChecks.some(item => item?.id === consumer.id)) throw new Error(`Missing check for affected consumer ${consumer.id}.`);
    }
    for (const check of consumerChecks) {
      requireText(check?.id, 'Consumer check id');
      requireText(check.evidence, 'Consumer check result');
      if (check.result !== 'passed') throw new Error(`Consumer ${check.id} is not verified; repair or record a blocked handoff.`);
    }
    if (state.evidenceVersion === 1) {
      const checks = assessment.criterionChecks;
      if (!Array.isArray(checks)) throw new Error('criterionChecks needs original outcome/clause scenarios.');
      const key = c => JSON.stringify([c?.id, c?.clause ?? null]);
      const expected = criterionClauses(state);
      if (new Set(checks.map(key)).size !== checks.length) throw new Error('Duplicate criterion/clause check.');
      for (const c of expected) if (!checks.some(item => key(item) === key(c))) throw new Error(`Missing scenario for ${c.id}${c.clause ? `/${c.clause}` : ''}.`);
      for (const check of checks) {
        if (!expected.some(c => key(c) === key(check))) throw new Error(`Unknown criterion/clause ${check?.id}/${check?.clause}.`);
        requireText(check.scenario, 'Criterion scenario'); requireText(check.evidence, 'Scenario observation');
        if (!state.commands?.some(c => c.id === check.check)) throw new Error(`Unknown configured check ${check.check}.`);
        if (check.result !== 'passed') throw new Error(`Criterion ${check.id} is unverified; repair or record a blocked handoff.`);
        if (check.origin !== 'agent-reported') throw new Error('Scenario results are agent-reported; command success alone does not establish a named assertion.');
        requireText(check.receipt, 'Scenario receipt');
      }
      for (const consumer of scout?.assessment?.consumers ?? []) if (consumer.journey && !checks.some(c => c.scenario === consumer.journey.name && c.consumers?.includes(consumer.id))) throw new Error(`Protected journey ${consumer.journey.name} is unverified; supply its named scenario observation, not a suite count.`);
      if (semanticReview.reviewer !== 'self' && !semanticReview.receipts?.length) throw new Error('Fresh/peer review needs source-linked review receipts, not a reviewer label alone.');
      if (semanticReview.receipts !== undefined && (!Array.isArray(semanticReview.receipts) || new Set(semanticReview.receipts).size !== semanticReview.receipts.length)) throw new Error('Review receipts need unique ids.');
      // The runtime performs source and receipt-byte checks with the actual snapshot.
      if (!proofPending && assessment.testProof?.status !== 'exempt') validateProofReview(state, assessment.proofReview);
    }
  }
  if (packet.stage === 'deliver') {
    if (retentionOf(state)?.disposition === 'required' && assessment.learning?.status !== 'recorded') throw new Error('Required feature context cannot be skipped by learning:none or pending-acceptance. Retain a restricted scope as incomplete instead.');
    for (const name of ['learning', 'errorHistory']) {
      const entry = assessment[name];
      requireChoice(entry?.status, name === 'learning' ? ['recorded', 'none', 'pending-acceptance'] : ['recorded', 'none'], `${name}.status`);
      requireText(entry.reason, `${name} disposition`);
      files(entry.artifacts, `${name}.artifacts`, entry.status !== 'none');
      if (entry.status === 'none' && entry.artifacts.length) throw new Error(`${name}: none cannot list recorded artifacts.`);
      if (entry.status === 'pending-acceptance' && entry.artifacts.some(path => !path.replaceAll('\\', '/').startsWith(`.cyc/runs/${state.id}/`))) throw new Error('Pending learning belongs in this run directory until acceptance; do not present it as established project knowledge.');
    }
    const history = assessment.errorHistory;
    if ((state.playbook === 'bug-fix' || state.failures > 0) && history.status !== 'recorded') throw new Error(`Bug fixes and runs with recorded failures need error-history evidence: set errorHistory.status to "recorded", give the cause and fix in reason, and list ${state.ledgerPath} in artifacts after adding the entry there.`);
    if (history.status === 'recorded' && !history.artifacts.includes(state.ledgerPath)) throw new Error(`Error history must reference the selected ledger: ${state.ledgerPath}.`);
  }
  return artifacts;
}

function findPlaceholder(value, path = 'assessment') {
  if (typeof value === 'string') return /^<[\s\S]*>$/.test(value.trim()) ? path : null;
  if (Array.isArray(value)) { for (const [index, item] of value.entries()) { const found = findPlaceholder(item, `${path}[${index}]`); if (found) return found; } return null; }
  if (value && typeof value === 'object') { for (const [key, item] of Object.entries(value)) { const found = findPlaceholder(item, `${path}.${key}`); if (found) return found; } }
  return null;
}

const safe = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|').replaceAll('`', '\\`').replaceAll('\r', '').replaceAll('\n', ' ');

export function renderReview(state, currentSourceHash, artifactIssues = [], currentFiles, contextKey) {
  const passed = stage => state.handoffs.findLast(item => item.stage === stage && item.status === 'passed');
  const scout = state.workContractVersion === 1 ? passed('scout')?.assessment : null;
  const verification = passed('verify');
  const delivery = passed('deliver');
  const current = state.verification?.passed && state.verification.sourceHash === currentSourceHash;
  const semanticCurrent = verification?.sourceHash === currentSourceHash;
  const evidenceCurrent = (delivery ?? verification)?.sourceHash === currentSourceHash && !artifactIssues.length && (!state.requiresChecks || current);
  const lines = [
    '# Change review', '', safe(state.goal), '',
    `Run: ${safe(state.id)} · Status: ${safe(state.status)} · Playbook: ${safe(state.playbook)}`,
    `Contract: ${state.workContractVersion === 1 ? 'implementation assessments v1' : 'legacy/advisory handoffs; implementation assessments not required'}`,
    `Current covered source: ${safe(currentSourceHash)}`, '',
    `Delivery evidence: ${evidenceCurrent ? 'current' : 'not yet established or stale'}. Recorded run status is historical when evidence is stale.`, '',
    'Generated from recorded evidence. Agent assessments are self-reported; this document does not establish human approval or authorize publication. Refresh with `cyc run review --run ID` after external changes. Reuse this document for developer review and an authorized PR.', '',
    '## Outcome and criteria', '', '| Criterion | Result | Evidence |', '| --- | --- | --- |'
  ];
  for (const criterion of state.criteria) {
    const result = (delivery ?? verification)?.criteria.find(item => item.id === criterion.id);
    lines.push(`| ${safe(criterion.description)} | ${safe(result ? (!evidenceCurrent ? 'stale / unverified' : result.result) : 'unverified')} | ${safe(result?.evidence ?? 'Not yet established')} |`);
    for (const clause of criterion.clauses ?? []) {
      const check = verification?.assessment?.criterionChecks?.find(c => c.id === criterion.id && c.clause === clause.id);
      lines.push(`| ${safe(criterion.id)}/${safe(clause.id)}: ${safe(clause.description)} | ${check && evidenceCurrent ? safe(check.result) : 'unverified'} | ${check ? `${safe(check.scenario)} — ${safe(check.evidence)} (agent-reported)` : 'No scenario evidence recorded'} |`);
    }
  }
  lines.push('', '## Context, approach, and alignment', '');
  if (scout) {
    lines.push(`- Context (${safe(scout.context.status)}): ${safe(scout.context.evidence)}`, `- Freshness: ${safe(scout.context.freshness)}`, `- Sources: ${scout.context.sources.map(safe).join(', ') || 'none'}${scout.context.read?.length ? `; read: ${scout.context.read.map(safe).join(', ')}` : ''}`, `- Approach (${safe(scout.approach.kind)}): ${safe(scout.approach.evidence)}`, `- Alignment (${safe(scout.alignment.status)}): ${safe(scout.alignment.evidence)}`);
  } else lines.push('No current Scout assessment recorded.');
  lines.push('', '## Changes', '');
  for (const handoff of state.handoffs.filter(item => item.stage === 'build' && item.status === 'passed')) lines.push(`- ${safe(handoff.summary)}`, ...handoff.artifacts.map(item => `  - ${safe(item.path)} (${safe(item.sha256)})`));
  const preexisting = (state.acceptedFailures ?? []).filter(item => state.verification?.acceptedPreexistingFailures?.includes(item.id));
  lines.push('', '## Verification and semantic review', '', `Configured checks: ${!state.requiresChecks ? 'not required for this advisory route' : current ? `passed on current covered source${preexisting.length ? `, with ${preexisting.length} accepted pre-existing failure${preexisting.length > 1 ? 's' : ''}` : ''}` : 'not current and passing'}.`);
  for (const result of state.verification?.results ?? []) {
    const accepted = preexisting.find(item => item.id === result.id);
    lines.push(`- ${safe(result.id)}: ${result.passed ? 'passed' : accepted ? `failed, as it did on the run-start code; accepted: ${safe(accepted.reason)}` : 'failed'} (exit ${safe(result.exitCode)}); ${safe([result.command, ...result.args].join(' '))}`);
  }
  const proof = state.testProof;
  if (state.sourceCapture?.version === 1) lines.push(`Run-start recovery record: ${state.base ? 'Git base plus ' : ''}${safe(state.sourceCapture.files.length)} captured originals, ${safe(state.sourceCapture.bytes)} stored bytes. Capture follows selected source and task scope; it is not a checkout backup.`);
  const exemption = verification?.assessment?.testProof;
  if (state.proofRecovery) lines.push(`Test proof: halted after a source conflict or restoration failure. Candidate backup: ${safe(state.proofRecovery.backupPath)}. Preserve current files; compare and merge deliberately.`);
  else if (exemption?.status === 'exempt') lines.push(`Test proof: exempt. ${safe(exemption.reason)}`);
  else if (proof) lines.push(`Test proof (${proof.mode === 'green' ? 'must pass on the original code' : 'must fail on the original code'}): ${proof.passed ? 'proven' : 'not proven'}. ${safe(proof.verdict)} Tests: ${Object.keys(proof.testFiles).map(safe).join(', ')}.${proof.claim ? ` Claim a reply may make: ${safe(proof.claim)}` : ''}`);
  else if (state.sourceCapture?.version === 1) lines.push('Test proof: not yet established; run-start originals are available through Git and/or captured source.');
  else if (['bug-fix', 'feature', 'refactor'].includes(state.playbook) && state.base === null) lines.push('Test proof: unavailable (this older run has no Git base or run-start source capture).');
  const assessment = state.workContractVersion === 1 ? verification?.assessment : null;
  if (assessment) {
    const coverage = reviewCoverage(state, assessment.semanticReview, { hash: currentSourceHash, files: currentFiles, contextKey });
    if (coverage.entries.length && artifactIssues.length) coverage.status = 'unverified (receipt/evidence unavailable)';
    const reviewers = coverage.entries.length ? [...new Set(coverage.entries.filter(Boolean).map(r => r.reviewer))].join(' + ') : assessment.semanticReview.reviewer;
    lines.push(`Semantic review: ${coverage.status === 'self-assessment' ? (semanticCurrent ? 'current' : 'stale') : coverage.status}; reviewer: ${safe(reviewers)}; provenance: agent-reported. Final assessment: ${semanticCurrent ? 'current' : 'stale'}.`);
    for (const receipt of coverage.entries) lines.push(receipt ? `- Review ${safe(receipt.id)}: ${safe(receipt.reviewer)}, ${receipt.sourceHash === currentSourceHash ? 'matching source' : 'stale source'}; scope: ${safe(receipt.scope.length ? receipt.scope.join(', ') : 'whole covered source')}; identity: ${safe(receipt.identity ?? 'unknown')}; evidence: ${safe(receipt.path)}.` : '- Review receipt missing.');
    if (state.evidenceVersion === 1) {
      lines.push(`Original requirements: ${safe(state.requirements.sha256)}. Scenario observations below are agent-reported, not automatically verified named runner results.`);
      for (const criterion of state.criteria) for (const clause of criterion.clauses ?? []) lines.push(`- Original clause ${safe(criterion.id)}/${safe(clause.id)}: ${safe(clause.description)}`);
      for (const check of assessment.criterionChecks ?? []) lines.push(`- Outcome ${safe(check.id)}${check.clause ? `/${safe(check.clause)}` : ''}: ${evidenceCurrent ? safe(check.result) : 'stale / unverified'} — ${safe(check.scenario)}; check ${safe(check.check)}, receipt ${safe(check.receipt)}; ${safe(check.evidence)}`);
    }
    for (const failure of proof?.failures ?? []) {
      const reason = assessment.proofReview?.cases?.find(c => c.id === failure.id);
      lines.push(`- Baseline failure ${safe(failure.id)}: ${safe(failure.name)} — ${safe(reason?.category ?? 'unclassified')}; hint: ${safe(failure.hint)}. ${safe(reason?.reason ?? 'No semantic reason review recorded.')} ${reason?.boundary ? `Boundary: ${safe(reason.boundary)}.` : ''}`);
    }
    for (const axis of ['intent', 'consumers', 'conventions']) lines.push(`- ${axis}: ${safe(assessment.semanticReview[axis])}`);
    for (const check of assessment.consumerChecks) lines.push(`- Consumer ${safe(check.id)}: ${safe(check.result)} — ${safe(check.evidence)}`);
    if (!assessment.semanticReview.findings.length) lines.push('- No semantic findings recorded.');
    for (const finding of assessment.semanticReview.findings) lines.push(`- ${finding.reviewId ? `${safe(finding.reviewId)}/` : ''}${safe(finding.id)} (${safe(finding.status)}): ${safe(finding.evidence)}`);
  } else lines.push('No passing semantic-review assessment recorded.');
  lines.push('', '## Learning and error history', '');
  lines.push(`Project ledger lookup: ${safe(state.projectLedgerPath ?? state.ledgerPath ?? 'not captured')}. Error history target: ${safe(state.ledgerPath ?? 'not captured')}.`);
  if (state.ledgerNote) lines.push(`Run-local history: ${safe(state.ledgerNote)} This does not claim the shared project ledger was updated.`);
  for (const name of ['learning', 'errorHistory']) {
    const entry = state.workContractVersion === 1 ? delivery?.assessment?.[name] : null;
    lines.push(entry ? `- ${name} (${safe(entry.status)}): ${safe(entry.reason)}${entry.artifacts.length ? ` — ${entry.artifacts.map(safe).join(', ')}` : ''}` : `- ${name}: not yet recorded.`);
  }
  if (delivery) lines.push(`- Context docs touched: ${delivery.contextDocs?.length ? delivery.contextDocs.map(safe).join(', ') : 'none'}. ${retentionOf(state) ? 'Canonical retention was checked under this run’s actual contract.' : `Historical catch-up requires a new scoped update: cyc context review --run ${safe(state.id)} --write --update-run UPDATE_ID.`}`);
  lines.push('', '## Recovery, remaining risks, and decisions', '');
  for (const conflict of state.proofRecovery?.conflicts ?? []) lines.push(`- Proof conflict ${safe(conflict.path)}: ${safe(conflict.reason)}${conflict.savedUnexpected ? ` Unexpected bytes saved at ${safe(conflict.savedUnexpected)}.` : ''}${conflict.preservationError ? ` ${safe(conflict.preservationError)}` : ''}`);
  if (state.proofRecovery?.preservationError) lines.push(`- Proof recovery record: ${safe(state.proofRecovery.preservationError)}`);
  for (const issue of artifactIssues) lines.push(`- Stale artifact: ${safe(issue)}`);
  for (const event of state.history.filter(item => ['attempt-failed', 'retry', 'blocked', 'exhausted', 'guard-halt', 'stopped', 'paused'].includes(item.type))) lines.push(`- ${safe(event.type)}: ${safe(event.reason ?? event.action ?? JSON.stringify({ protectedChanges: event.protectedChanges, outOfScope: event.outOfScope }))}`);
  for (const handoff of state.handoffs.filter(item => item.status !== 'passed')) {
    lines.push(`- ${safe(handoff.status)} at ${safe(handoff.stage)}: ${safe(handoff.summary)}`);
    const findings = handoff.assessment?.semanticReview?.findings;
    if (Array.isArray(findings)) for (const finding of findings) lines.push(`  - ${safe(finding?.id)} (${safe(finding?.status)}): ${safe(finding?.evidence)}`);
    if (handoff.nextAction) lines.push(`  - Next: ${safe(handoff.nextAction)}`);
  }
  lines.push(`- ${safe(delivery?.summary ?? 'No passing delivery recorded.')}`);
  if (delivery?.nextAction) lines.push(`- Next decision: ${safe(delivery.nextAction)}`);
  lines.push('- Publication and merge approval remain governed by the user and project.', '');
  return lines.join('\n');
}
