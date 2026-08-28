# dotfiles

Personal dotfiles managed with [GNU Stow](https://www.gnu.org/software/stow/).
Everything lives in a single `home/` package whose contents mirror `$HOME`; running
`stow` creates symlinks from `~` (and `~/.config`) back into this repo.

## What's included

| Tool         | Path                              |
| ------------ | --------------------------------- |
| zsh          | `home/.zshrc`, `home/.p10k.zsh`, `home/.fzf.zsh` |
| bash         | `home/.bashrc`, `home/.bash_logout`, `home/.fzf.bash` |
| shell login  | `home/.profile`                   |
| git          | `home/.gitconfig`, `home/.config/git/ignore` |
| tmux         | `home/.config/tmux/tmux.conf`     |
| nvim         | `home/.config/nvim/` (customized NvChad) |
| gh           | `home/.config/gh/config.yml`      |
| mise         | `home/.config/mise/config.toml`   |
| astro        | `home/.config/astro/config.json`  |
| ccstatusline | `home/.config/ccstatusline/settings.json` |
| pi           | `home/.pi/agent/` (see [pi harness](#pi-harness)) |

**Not tracked:** `gh/hosts.yml` (auth token), `tmux/plugins/` (reinstalled via TPM),
most of `~/.pi` (see below), and the tools themselves (oh-my-zsh, fzf, mise,
node/pnpm/bun, go) — install those separately.

## pi harness

The steering, policy, and workflow files under `home/.pi/agent/` are tracked;
credentials and machine state are not.

**Config**

- `settings.json` — theme/UI prefs and the `packages` array. It's a symlink
  into this repo, so `pi install`/`pi remove` edit the tracked file directly
  and leave a diff.
- `AGENTS.md` — always in context: tool preferences, communication style, the
  code-minimalism ladder, and commit-message rules.

**Permissions, in three layers.** Each does something the others cannot:

1. `sandbox/default.json` — OS-level containment via
   [`@oddsjam/pi-sandbox`](https://github.com/oddsjam/pi-sandbox) (Anthropic's
   sandbox-runtime underneath). Decides which paths and domains exist at all.
   `/sandbox` inspects and edits it; `projects.json` is per-machine and
   gitignored.
2. `pi-permissions.jsonc` — intent gate for `pi-permission-system`:
   allowlists the read-only/lint/test commands these repos use, asks for
   anything unrecognised, hard-denies destructive operations. Read the
   comments in the file before editing — matcher precedence and a couple of
   repo-specific traps are non-obvious. `/yolo` (`extensions/yolo.ts`)
   auto-approves its "ask" rules for a session; denials still hold.
3. `extensions/guardrails.ts` — the two rules that must survive `/yolo`:
   secrets stay unreadable, and `git push` always confirms (force-push is
   refused).

**Workflow.** Five phases, each a prompt template that writes a markdown
artifact the next phase consumes:

```
/brainstorm <topic>      → .pi/brainstorm/<slug>.md
/plan <file-or-request>  → .pi/plan/<slug>.md
/implement <plan-file>   → atomic commits, boxes checked
/review [target]         → .pi/review/<slug>.md
/refactor <target> [goal] → .pi/refactor/<slug>.md
```

`Alt+Shift+B/P/I/R/F` pre-fill each command (`extensions/phase-shortcuts.ts`,
which stays clear of the plain-Alt editor motions). The
shared bar they are all held to lives once, in the `engineering-standard`
skill under `skills/`; a repo can add its own `.pi/principles.md`.

Not tracked, by design: `auth.json`, `trust.json`, `models-store.json`,
`sessions/`, `npm/`, `sandbox/projects.json`, extension-local
`config.json`/`logs/`, `web-search.json`, `config/`.

## Install on a new machine

```bash
git clone <repo-url> ~/dotfiles
cd ~/dotfiles
./bootstrap.sh
```

`bootstrap.sh` installs Stow (brew on macOS, apt on Debian/Ubuntu), clones TPM, and
symlinks everything. Then open tmux and press `prefix + I` to install tmux plugins;
nvim auto-installs its plugins on first launch.

## Manual stow / unstow

```bash
cd ~/dotfiles
stow   -t "$HOME" home   # create symlinks
stow -D -t "$HOME" home   # remove symlinks
stow -R -t "$HOME" home   # restow (after adding files)
```

## Platform support

The bootstrap supports macOS with Homebrew and Debian/Ubuntu with `apt`. Shell
configuration uses `$HOME` and discovers Homebrew and installed tools at runtime,
so the same files work on both platforms. macOS-only integrations such as
Windsurf and Homebrew `libpq` activate only when installed.

`~/.gitconfig` uses the personal identity in this repository. Override it in a
work repository with `git config --local user.email you@work.com`.
