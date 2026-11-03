import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

// The reply and its packet copy are compared after the same normalization: line endings and the
// trailing whitespace a host or an editor adds, which carry no content.
export const normalize = text => text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
export const digest = value => createHash('sha256').update(value).digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

// The forms the gate recognizes, named in the correction so an agent picks one instead of guessing.
export const visualForms = 'a Markdown table, a mermaid block, an image with alternative text, or a labeled arrow flow of three or more steps (A → B → C; inside a fenced block also with ->, --> or ──►)';

export function hasVisual(text) {
  // Structure detection only. Meaning and accurate rendering need review.
  const table = /^\|[^\n]+\|\s*\n\|(?:\s*:?-{3,}:?\s*\|){2,}\s*\n\|[^\n]+\|/m;
  const diagram = /```mermaid\s*\n(?:flowchart|graph|sequenceDiagram|stateDiagram|classDiagram|erDiagram|gantt|pie|timeline)[\s\S]+?\n```/;
  const picture = /!\[[^\]\n]+\]\((?:<[^>\n]+>|[^)\n]+)\)/;
  // A flow is three or more labeled steps; two words joined by an arrow is a phrase, not a diagram.
  const flow = /^\s*[^\n→]{2,60}\s+→\s+[^\n→]{2,60}(?:\s+→\s+[^\n→]{2,60})+\s*$/m;
  // Inside a fenced block the same shape may be drawn with ->, --> or ──►, which the correction once asked for and the gate refused.
  const fencedFlow = /^[ \t]*[^\s][^\n]{0,58}?[ \t]+(?:->|-->|──►|→)[ \t]+[^\s][^\n]{0,58}?(?:[ \t]+(?:->|-->|──►|→)[ \t]+[^\s][^\n]{0,58}?)+[ \t]*$/m;
  const fenced = [...text.matchAll(/```([^\n]*)\n([\s\S]*?)\n[ \t]*```/g)].some(([, info, body]) => !/^mermaid\b/.test(info.trim()) && fencedFlow.test(body));
  return table.test(text) || diagram.test(text) || picture.test(text) || flow.test(text) || fenced;
}

// The reply's own checks, the same ones the Stop gate applies, on a draft: stateless, so an agent can
// run them before sending instead of learning the count from a rejection. Says how much to cut,
// because an agent cannot count its own reply and round 8's overshoots were all small.
export function checkReply(text, { expanded = false } = {}) {
  const normalized = normalize(String(text ?? ''));
  const characters = [...normalized].length;
  const overBy = expanded ? 0 : Math.max(0, characters - 1000);
  const visual = hasVisual(normalized);
  const issues = [];
  if (overBy > 0) issues.push(`Response has ${characters} characters; maximum is 1000: cut at least ${overBy}. Put detail in an artifact or wait for an expansion request.`);
  if (!visual) issues.push(`Include one compact relevant visual: ${visualForms}.`);
  return { characters, overBy, visual, issues };
}

// The gate checks the reply it actually received. A packet that copies the reply must match it
// exactly; `exactResponse` requires the copy (Cursor finds a session's packet by its text).
export function checkResponse({ response, packet, token, expanded = false, root, exactResponse = false }) {
  const issues = [];
  if (!nonempty(response)) return ['The final response is missing.'];
  const text = normalize(response);
  issues.push(...checkReply(text, { expanded }).issues);
  if (!packet || typeof packet !== 'object') return [...issues, 'Write the session review packet before completion.'];
  if ((exactResponse || packet.response !== undefined) && (typeof packet.response !== 'string' || normalize(packet.response) !== text)) issues.push('The review must cover the exact final response.');
  return [...issues, ...checkPacket({ packet, token, root, text })];
}

// Checks of the review itself. Without the reply text (a preflight before the reply is sent),
// the blocked-handoff prefix is left to the Stop gate, which has the reply.
export function checkPacket({ packet, token, root, text }) {
  const issues = [];
  if (!packet || typeof packet !== 'object') return ['Write the session review packet before completion.'];
  if (!nonempty(token) || packet.token !== token) issues.push('Review token is missing or stale. Use this user request\'s token.');
  if (!['ready', 'blocked'].includes(packet.status)) issues.push('Review status must be ready or blocked.');
  if (!Array.isArray(packet.checks) || packet.checks.length === 0) {
    issues.push('Record at least one task-specific acceptance check with actual evidence.');
  } else {
    for (const check of packet.checks) {
      if (!check || !nonempty(check.criterion) || !nonempty(check.evidence) || !['passed', 'unmet'].includes(check.result)) {
        issues.push('Each check needs a criterion, passed/unmet result, and evidence.');
      } else if (packet.status === 'ready' && check.result !== 'passed') {
        issues.push(`Repair the unmet criterion before claiming readiness: ${check.criterion}`);
      }
    }
  }
  // A packet run finish wrote states the run's record and claims no reread of the reply; the run
  // gate confirms its runs completed in this request. Any other packet carries the affirmation.
  if (packet.writtenBy !== 'run finish') {
    for (const key of ['answersRequest', 'understandable', 'visualAddsInformation', 'limitationsDisclosed']) {
      if (packet.humanReview?.[key] !== true) issues.push(`Complete the human-readiness review: ${key}.`);
    }
  }
  // A blocked handoff names its blocker in the agent's words or by the controller runs that ended
  // short of complete; the run gate confirms those runs belong to this request.
  if (packet.status === 'blocked') {
    const byRuns = Array.isArray(packet.blockedBy) && packet.blockedBy.length > 0;
    if (!nonempty(packet.blocker) && !byRuns) issues.push('A blocked handoff needs its blocker: pass --blocker "<what stops completion>" to cyc packet, or record the run blocked with the controller and rerun cyc packet.');
    else if (text !== undefined && !/^(?:\*\*)?(?:Blocked|Not ready):/i.test(text)) issues.push('A blocked handoff must start with Blocked: or Not ready:.');
    // With recorded blocking runs the controller's record is the blocker, so extra agent text need not be repeated verbatim.
    else if (text !== undefined && nonempty(packet.blocker) && !byRuns && !text.includes(packet.blocker)) issues.push(`A blocked handoff must disclose its exact blocker. Include the review's blocker text: ${packet.blocker}`);
  }
  if (!Array.isArray(packet.artifacts)) {
    issues.push('List current deliverable artifacts and hashes, or [] for conversation-only work.');
  } else {
    for (const artifact of packet.artifacts) {
      try {
        if (!artifact || !nonempty(artifact.path) || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) throw new Error('missing path or SHA-256');
        const realRoot = realpathSync(root);
        const target = realpathSync(resolve(realRoot, artifact.path));
        const rel = relative(realRoot, target);
        if (rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(rel)) throw new Error('artifact outside this project');
        if (!statSync(target).isFile()) throw new Error('artifact is not a file');
        if (digest(readFileSync(target)) !== artifact.sha256) throw new Error('artifact changed after review');
      } catch (error) {
        issues.push(`Artifact review invalid: ${artifact?.path ?? '(missing)'} (${error.message}).`);
      }
    }
  }
  return issues;
}
