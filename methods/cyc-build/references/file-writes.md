# Whole-file writes without accidental format changes

Use this only when generating or replacing a text file, especially through PowerShell. Prefer the host's patch tool for a focused change.

Inspect the existing encoding, newline convention, and final newline before writing. Keep them unless changing them is part of the task. A passing behavior test does not detect an accidental encoding or newline change.

PowerShell `Set-Content` can append a platform newline to a string that already contains LF. In the Windows comparison pilot, that produced a mixed final CRLF and `git diff --check` failed in both baseline CYC refactor trials. For a known UTF-8 file, use an explicit writer that writes exactly the intended string, such as Node's `fs.writeFileSync`, or PowerShell `[IO.File]::WriteAllText` with an explicit UTF-8 encoding. These APIs do not decide the file's newline convention for you; preserve it in the string. Do not apply UTF-8 conversion to a file whose existing encoding you have not established.

Before recording Build or generating the controller's test-proof receipt, inspect the diff and run `git diff --check` when Git is available. Repair accidental format churn at that point, then run the relevant behavior checks and proof on the final bytes. Never disable the whitespace check or alter Git settings to hide the problem. Keep an actual failed check in the normal evidence record.

Counter-cases: an existing CRLF file should stay CRLF; a focused patch should not trigger whole-file normalization; binary files are outside this procedure. Passing this check is formatting evidence, not functional verification.
