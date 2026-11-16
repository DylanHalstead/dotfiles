# Local guardrails

Adds path permissions and shell checks to the pinned `@aliou/pi-guardrails`
package. [guardrails.json](../guardrails.json) owns the policy, including
credential exceptions for example and LocalStack filenames.

## Path access

Workspace and private scratch access are allowed. External paths ask, except
read-only inspection of common configuration, dependency, runtime, and temporary
paths.

Reference an existing `@file` or `@directory` to grant reads with `read`, `grep`,
`find`, and `ls`. Quote paths with spaces: `@"/path with spaces"`. These grants
do not authorize shell commands or modifications. External modifications and
Bash file operations in inspection roots, documentation, and active skills ask
for approval.

Read grants follow the active branch across reload and resume. Local path
exceptions work in TUI/RPC; print/JSON modes use upstream path grants.

## Shell approvals and YOLO

Recognized AWS, GCloud, and kubectl inspection passes. Mutations and unknown
operations ask; recognized credential output is blocked.

`/yolo [on|off]`, `Alt+Shift+Y`, or `--yolo` bypass external-path and cloud
approval. Credential blocks and Git, Terraform, and publishing safeguards remain
active. The red footer badge shows when YOLO is on; its state follows the active
branch across reload and resume.

## Limits

Tools run on the host without a sandbox. Arbitrary scripts, dynamic commands,
remote effects, and filesystem races are outside these checks.

Recognized file targets are checked through symlinks. Unresolvable targets are
blocked; escapes from workspace or scratch require approval.

Grep withholds protected or ambiguous results, though ripgrep may still open
protected files. Narrow the glob or read an allowed file directly.
