# Pi configuration

This directory contains shared Pi configuration. Account profiles keep their
credentials and model scopes separate. The repository root `README.md` owns
installation and profile usage.

## Layout

```text
.pi/
├── agent/
│   ├── APPEND_SYSTEM.md     stable behavior, tool use, and output style
│   ├── AGENTS.md            personal engineering standards
│   ├── extensions/          runtime behavior and enforced controls
│   ├── prompts/             user-invoked workflows
│   ├── pi-permissions.jsonc permission policy
│   └── settings.json        shared Pi settings, packages, and extensions
├── model-scopes.json        profile-specific Pi enabledModels scopes
└── profiles.sh              account selection and profile synchronization
```

`profiles.sh` selects the private `auth.json` for each profile and links every
other resource to `agent/`. It reads `model-scopes.json` and passes the selected
profile's `enabledModels` list to Pi through `--models`. Keep profile-specific
billing and availability policy in `model-scopes.json`; keep all shared workflow
settings and package declarations in `agent/settings.json`.

Synchronization rejects real resource directories in a profile instead of merging
links into them. Move those directories aside explicitly before retrying.

Skills are installed at `~/.agents/skills/` from the root `skills-lock.json`.
See the repository root `README.md` for installation and maintenance.

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

Instructions guide model behavior. Rules that must hold belong in permissions
or an extension that enforces them. Tools run on the host without an OS sandbox.

`agent/pi-permissions.jsonc` allows inspection of skills through `~/.agents`,
Node dependencies (`node_modules`), Go modules (`pkg/mod`), and user Ruby gems
without external-directory prompts. Direct `write` and `edit` calls in those
locations still ask; shell commands follow the separate bash policy. Existing
trusted repository and runtime roots retain their permissions. Unlisted external
paths still ask, and `guardrails.ts` keeps its credential-file checks.

## Workflows

Collaboration is the default working style in `APPEND_SYSTEM.md`. Prompt
templates are optional entry points, not a required sequence:

- `/design`: work through a design in conversation; save notes only when asked.
- `/brainstorm`: research alternatives and recommend an approach.
- `/plan`: turn an agreed design or scoped request into execution steps.
- `/implement`: implement a plan or a scoped request without requiring a plan.
- `/review`: inspect changes or existing code and report findings.
- `/refactor`: improve structure while preserving behavior.

The engineering standard owns routing to companion and repository skills.

Inline skills and the model switch guard are installed from the
[`pi-extensions`](https://github.com/DylanHalstead/pi-extensions) npm packages
declared in `agent/settings.json`. Keep the model switch guard before inline
skills so declining a model switch restores the original shorthand text. Do not
add local copies of these extensions; Pi would load both versions.

The inline-skills extension completes `$skill-name` mentions and replaces them
with `@/absolute/path/to/SKILL.md` references on submission. It follows Pi's
file-completion convention, quoting paths containing whitespace or Unicode
separators. It does not read or inject instructions; the model decides whether
to read the referenced file. Use Pi's native `/skill:name` command at the start of a prompt
when you want its instructions loaded explicitly.

## Maintenance

Keep each decision in one place and link to its owner instead of copying it.
Remove stale or conflicting rules when behavior changes. Run `/reload` after
editing settings, extensions, skills, prompts, themes, or context files.
