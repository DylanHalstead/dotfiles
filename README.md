# dotfiles

Personal shell and development configuration managed with [GNU Stow](https://www.gnu.org/software/stow/).
The `home/` directory mirrors `$HOME`; Stow links its contents into place.

## Included

- Shell: zsh, bash, Powerlevel10k, and fzf
- Development: Git, GitHub CLI, mise, Neovim, and tmux
- Pi: settings, prompts, skills, extensions, permissions, and account profiles

Credentials, package caches, sessions, generated plugins, and machine-local state
are excluded from Git. Agent skills are declared in `skills-lock.json` and restored
into an ignored cache exposed at `~/.agents/skills/`. The reusable skills live in
[DylanHalstead/skills](https://github.com/DylanHalstead/skills); agent instructions
and Pi prompts remain here. Edit skills in their source repository, publish the
changes, then update the pinned revision and restore the installed copies.

## Install

```bash
git clone git@github.com:DylanHalstead/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap.sh
```

The bootstrap script:

1. Installs GNU Stow with Homebrew on macOS or `apt` on Debian/Ubuntu.
2. Installs TPM.
3. Links the tracked configuration into `$HOME`.
4. Restores agent skills from `skills-lock.json`.
5. Updates Pi packages.
6. Creates isolated Pi account profiles.

Open tmux and press `prefix + I` to install its plugins. Neovim installs its
plugins on first launch. Install the toolchain declared in mise with:

```bash
mise install
```

## Custom behavior

Pi provides `/brainstorm`, `/plan`, `/implement`, `/review`, and `/refactor`
workflows backed by markdown artifacts. `Alt+Shift+B/P/I/R/F` pre-fill those
commands.

Pi uses a trusted-development permission model. Routine tools, test suites, Git
hooks, local services, and authenticated cloud CLIs run directly on the host.
The OS sandbox is installed but disabled by default for compatibility. Hard
denies cover direct credential access and catastrophic host commands, while Git
pushes and Terraform mutations require confirmation even in YOLO mode. Cloud
CLIs may expose short-lived session credentials to their child processes, so
cloud access should use scoped development identities rather than long-lived or
production credentials.

The permission files remain separate because each has one owner:
`pi-permissions.jsonc` configures the permission package,
`sandbox/default.json` configures OS isolation, `guardrails.ts` enforces rules
that survive YOLO, and `yolo.ts` manages session controls and status.

Pi accounts share configuration but keep credentials separate:

```bash
pi                     # work profile by default
pi -p personal         # personal profile for one invocation
pi-profile personal    # create or refresh a profile
```

Shell configuration discovers optional tools at runtime and supports both
macOS and Linux. macOS-only integrations activate only when installed.
Zsh loads executable paths and the default editor from `.zprofile`; `.zshrc`
owns the prompt, plugins, history, keybindings, and interactive tool activation.
Interactive non-login shells also load `.zprofile` to find the same tools.
CLI integrations live in `.config/zsh/integrations.zsh`; Bash and Zsh share the
Pi account helpers in `.pi/profiles.sh`.
LocalStack defaults apply to `localstack` and `awslocal` commands, without setting
the region or emulator options for other programs. Explicit environment values
override those defaults. The `linear` command defaults to team `NA`; set
`LINEAR_TEAM_ID` to select another team.

The tracked Git identity is personal. Override it in a work repository:

```bash
git config --local user.email you@work.com
```

## Manual Stow usage

```bash
stow    -t "$HOME" home  # link
stow -R -t "$HOME" home  # relink
stow -D -t "$HOME" home  # unlink
```
