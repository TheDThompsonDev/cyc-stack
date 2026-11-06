// Same isolated worker pattern as baseline-worker; owns the existing controller operations.
import { executeOperation } from './runtime.mjs';
const [root, id, operationId] = process.argv.slice(2);
if (root && id && operationId) executeOperation(root, id, operationId);
