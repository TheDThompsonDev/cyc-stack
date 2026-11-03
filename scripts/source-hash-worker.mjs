// A worker thread for full-content source snapshots; see parallelReads in source-snapshot.mjs.
import { workerData } from 'node:worker_threads';
import { readJobs } from './source-snapshot.mjs';

readJobs(workerData);
