import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkResponse } from './response-gate.mjs';

try {
  const packet = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const issues = checkResponse({ response: packet.response, packet, token: packet.token, root: resolve('.'), expanded: process.argv.includes('--expanded') });
  console.log(JSON.stringify({ accepted: issues.length === 0, issues }, null, 2));
  process.exitCode = issues.length ? 1 : 0;
} catch (error) {
  console.error(`Cannot check response: ${error.message}`);
  process.exitCode = 1;
}
