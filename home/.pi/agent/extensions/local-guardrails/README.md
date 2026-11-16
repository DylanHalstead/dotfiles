# Local guardrails

Shared additions to the pinned `@aliou/pi-guardrails` package. The package's
file and command rules live in [`../guardrails.json`](../guardrails.json).

## Usage

- Ordinary workspace access is allowed. Other paths ask, except read-only
  inspection of common configuration, dependency, runtime, and temporary paths.
- Reference an existing `@file` or `@directory` to grant session read access.
  Quote paths containing spaces, for example `@"/path with spaces"`. Grants
  apply to `read`, `grep`, `find`, and `ls`, not shell commands or modifications.
- Pi provides a private scratch directory for disposable code and files.
- `/yolo [on|off]`, `Alt+Shift+Y`, and `--yolo` bypass external-path and cloud
  approval. The red footer badge indicates when YOLO is active. Credential
  blocks and Git/Terraform/publishing safeguards remain active.

AWS, GCloud, and kubectl inspection passes; mutations and unknown operations
ask. Recognized credential output is blocked, including in YOLO. External
modifications and recognized Bash file actions in documentation and active
skills also ask. Use read-only tools for inspection.

## Limits

These checks prevent recognizable mistakes; tools still run on the host
without a sandbox. Arbitrary scripts, dynamic command names, remote effects,
and filesystem races are outside their coverage.

Path exceptions work in TUI/RPC. In print/JSON modes, the pinned package blocks
external paths before asking the local delegate. Grants and YOLO state follow
the active session branch and survive reload/resume.

Grep output containing protected files or ambiguous filenames is withheld;
narrow the glob or read an allowed source file directly. This filters output
to the agent, not files opened internally by ripgrep. The JSON policy defines
credential exceptions, including trusted example and LocalStack filenames.

## Maintenance

Run `/reload` after changes and check the footer and approval prompts.
`index.ts` owns paths and session state; `shell-commands.ts` owns Bash checks.
`package-policy.ts` reuses internal package APIs rather than copying policy.
Keep the package pinned and verify the guards when upgrading it.
