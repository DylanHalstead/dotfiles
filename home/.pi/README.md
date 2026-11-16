# Pi configuration

Shared Pi configuration for the work and personal accounts. See the
[repository README](../../README.md) for installation.

## Layout

| Path | Purpose |
| --- | --- |
| `agent/APPEND_SYSTEM.md` | Default behavior, tool use, and response style |
| `agent/AGENTS.md` | Engineering standards |
| `agent/settings.json` | Shared settings and installed packages |
| `agent/extensions/` | Local runtime extensions and `guardrails.json` policy |
| `agent/prompts/` | Optional workflow templates, such as `/design` and `/review` |
| `model-scopes.json` | Models available to each account profile |
| `profiles.sh` | Profile selection and shared-resource links |

## Profiles

Run `pi` for the work account or `pi -p personal` for the personal account.
Set `PI_PROFILE` to change the shell default. Each profile keeps its own
`auth.json`; settings, local extensions, and installed packages link to the
shared `agent/` resources.

Use `pi-profile personal` to create or refresh that profile, then start
`pi -p personal` and run `/login`. Profile synchronization refuses to replace
real resource directories; move conflicting directories aside before retrying.
Pi account selection does not select a mise environment.

## Extensions and skills

[Local guardrails](agent/extensions/local-guardrails/README.md) add path grants,
YOLO controls, and command checks to the pinned `@aliou/pi-guardrails` package.
Its README covers usage and limitations.

Inline skills and the model switch guard come from the
[pi-extensions](https://github.com/DylanHalstead/pi-extensions) packages in
`agent/settings.json`. Keep the model switch guard before inline skills so
cancelling a model switch restores the original input.

Skills install at `~/.agents/skills/` from the repository's `skills-lock.json`.
`$skill-name` inserts a file reference; `/skill:name` loads a skill explicitly.
Keep project-specific instructions in the project's own `AGENTS.md`.

## Reload and clipboard

Run `/reload` after changing settings, extensions, skills, or prompts.
Restart Pi after changing shell environment variables.

On WSL, Pi uses the terminal's OSC 52 support for clipboard writes. The terminal
must permit them; set `PI_CLIPBOARD_OSC52=0` to disable Pi's additional clipboard
write. OSC 52 does not provide clipboard reads or image paste. Tmux clipboard
settings live in [`tmux.conf`](../.config/tmux/tmux.conf).
