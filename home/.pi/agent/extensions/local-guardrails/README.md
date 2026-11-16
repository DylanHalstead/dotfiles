# Local guardrails

Extends the pinned `@aliou/pi-guardrails` package with session path grants,
scratch access, and shell checks. Rules live in [`../guardrails.json`](../guardrails.json).

## Usage

- Workspace access is allowed. External paths ask, except read-only inspection
  of common configuration, dependency, runtime, and temporary paths.
- Reference an existing `@file` or `@directory` to grant reads with `read`,
  `grep`, `find`, and `ls`. Quote paths with spaces: `@"/path with spaces"`.
  References do not authorize shell commands or modifications.
- Use Pi's private scratch directory for disposable files.
- `/yolo [on|off]`, `Alt+Shift+Y`, and `--yolo` bypass external-path and cloud
  approval. The red footer badge shows when YOLO is active. Credential blocks
  and Git/Terraform/publishing safeguards remain active.

Recognized AWS, GCloud, and kubectl inspection passes. Mutations and unknown
operations ask; recognized credential output is blocked. External modifications
and Bash file operations in inspection roots, documentation, and active skills
also ask.
Recognized file targets are checked through symlinks; unresolvable targets are
blocked, and escapes from workspace or scratch require approval.

Read grants and YOLO state follow the active branch across reload/resume.
Local path exceptions require TUI/RPC; print/JSON modes use upstream path grants.

Tools run on the host without a sandbox. Arbitrary scripts, dynamic commands,
remote effects, and filesystem races are outside these checks. Grep withholds
protected or ambiguous results, though ripgrep may still open protected files.
Narrow the glob or read an allowed file directly. The JSON policy defines
credential exceptions, including example and LocalStack filenames.

After changes, run `/reload` and check the footer and approval prompts.
