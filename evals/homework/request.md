# Homework completion task

This is a tiny JavaScript model for a student's homework app. Add a way to mark an assignment finished. Finished work should disappear from the active list and reduce the remaining count, but stay available in the full assignment list. After saving and loading a new tracker, it must still be finished. Existing saved homework must keep working.

Expose `tracker.markFinished(id)` on the tracker returned by `createTracker`. Assignment records returned by `add`, `list`, and `activeList` should have a boolean `finished` property. Calling `markFinished` twice on the same assignment must be harmless. An unknown identifier must throw an error without altering other assignments.

Preserve the existing `add`, `list`, `activeList`, `remainingCount`, `save`, and `load` entry points, title validation, ordering, and unique identifiers. Save remains an explicit operation. The existing storage adapter interface is `getItem(key)` and `setItem(key, value)`.

Use the candidate project's own source as the investigation evidence. Record the impact map before implementation, explain the accepted approach, implement the change, and verify both the requested behavior and affected existing behavior. Keep changes inside the candidate directory. Do not edit the evaluator or change these requirements.

This task covers a JavaScript model only. It contains no browser interface, actual button, server, or cross-device synchronization. Do not claim those were implemented or verified.
