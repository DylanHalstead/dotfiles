# Pi configuration

This directory contains the shared Pi configuration. Account profiles reuse
`agent/` and keep their credentials separate. The repository root `README.md`
owns installation and profile usage.

## Layout

```text
.pi/
├── agent/
│   ├── APPEND_SYSTEM.md     stable behavior, tool use, and output style
│   ├── AGENTS.md            personal engineering standards
│   ├── extensions/          runtime behavior and enforced controls
│   ├── prompts/             user-invoked workflows
│   ├── skills/              detailed guidance loaded by task
│   ├── sandbox/             OS sandbox policy and its local notes
│   ├── pi-permissions.jsonc permission policy
│   └── settings.json        models, packages, theme, and TUI settings
└── profiles.sh              account selection and profile synchronization
```

Repository `AGENTS.md` files own project commands, architecture, and local
conventions. Nested files should hold rules for the code below them. Keep
global files free of repository-specific facts.

## Instruction policy

- Write direct, specific instructions and define observable behavior.
- Keep stable, universal behavior in `APPEND_SYSTEM.md`; keep engineering
  preferences in the global `AGENTS.md`.
- Put project rules near the code they govern and resolve conflicts there.
- Use Markdown headings for structure. Load detailed skills only when the task
  needs them.
- Add examples after a repeated failure shows that an instruction alone does
  not produce the intended result.

Instructions guide model behavior. Rules that must hold belong in permissions,
the sandbox, or an extension that enforces them.

## Maintenance

Keep each decision in one place and link to its owner instead of copying it.
Remove stale or conflicting rules when behavior changes. Run `/reload` after
editing settings, extensions, skills, prompts, themes, or context files.
