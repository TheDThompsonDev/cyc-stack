# Performance

Use to make something measurably faster or cheaper. Stages: [scout](../../../../methods/cyc-scout/SKILL.md) → [build](../../../../methods/cyc-build/SKILL.md) → [verify](../../../../methods/cyc-verify/SKILL.md) → [deliver](../../../../methods/cyc-deliver/SKILL.md).

In the scout pass, measure a baseline with a repeatable command and find where the time actually goes (profile or trace, not guesswork). Pick the change the measurement points to. After building, rerun the same measurement under the same conditions and report baseline, result, and delta. Verify that behavior is unchanged with the configured checks. A change that doesn't move the measurement gets reverted.

**Acceptance:** a measured improvement under the same conditions as the baseline, with the command, sample size, and run-to-run variation reported, and every configured check passing. A delta within that variation is not an improvement.
