# dotfiles

Personal shell and development configuration managed with [GNU Stow](https://www.gnu.org/software/stow/).
The `home/` directory mirrors `$HOME`.

## Configuration

- Shell: Zsh, ohmyzsh, Bash, Powerlevel10k, and fzf.
- Development: Git, GitHub CLI, mise, Neovim, tmux, and terminal themes.
- [Pi](home/.pi/README.md): prompts, extensions, permissions, and account profiles.
- [Agent skills](https://github.com/DylanHalstead/skills): `skills-lock.json` is the portable source of truth; generated copies install at `~/.agents/skills/`. Manage skills from this repository without `--global`.

## Install

Install Oh My Zsh with the theme and plugins listed in `.zshrc`, mise,
fzf 0.48+, tmux 3.2+, and Neovim 0.11+ on PATH. Configure GitHub SSH access:
`.gitconfig` rewrites GitHub HTTPS URLs to SSH.

```bash
git clone git@github.com:DylanHalstead/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap.sh
mise install
mise reshim
```

Execute bootstrap rather than sourcing it. `./bootstrap.sh --dry-run` previews
Stow links without installing, cloning, updating packages, or changing profiles;
Stow must already be installed to check conflicts. Bootstrap stops on failures
but skips skills and Pi packages when their CLIs are missing. Install missing
prerequisites and rerun it to restore skipped resources.

In tmux, press `prefix + I` to install plugins. Neovim installs plugins on first launch.
On WSL, use a maintained Neovim package source or official release if the distro
package is too old. Expose a manual installation through `~/.local/bin`; maintain
its updates outside mise.

## Tool ownership

Keep one installation owner per executable:

| Owner | Tools |
| --- | --- |
| Homebrew on macOS; apt or a maintained application source on WSL | Zsh, Git, gh, Stow, tmux, fzf, Neovim, clipboard helpers |
| Mise | Node (including npm/npx), Ruby, Python, Go, Bun, pnpm, Terraform and related development tools |
| Project manifests and lockfiles | TypeScript, linters, test runners, libraries, and other project dependencies |
| Application installer | Standalone applications such as Pi and Claude Code; npm/pnpm may supply their installation mechanism |

`home/.config/mise/config.toml` supplies fallback toolchains; projects own their
version requirements. Do not also install mise-owned tools with fnm, nvm,
Homebrew, Corepack, or `pnpm runtime`. Update the mise pnpm pin rather than using
pnpm self-update. Leave OS-required runtimes alone.

`home/.config/shell/paths.sh` supplies application paths before mise activation.
Keep global applications outside Node's versioned prefix: prefer `pnpm add -g`
to `npm install -g`. `PNPM_HOME/bin` exposes pnpm 11+ applications; `PNPM_HOME`
retains pnpm 10 applications, which newer pnpm does not list as current global
installs. Migrate those deliberately before deleting the legacy directory.

The pnpm defaults reject package-manager version mismatches instead of downloading
another version, and disable global runtime dispatch. Align project mise pins
with `package.json`. A project's `devEngines.packageManager.onFail` can override
the global mismatch policy.

### Work-only tools

`home/.config/mise/config.work.toml` holds the private `Three-Ships/nad` tool and
`GOPRIVATE`. Personal setup does not install it. With private repository access:

```sh
mise -E work install
mise -E work exec -- nad --help
```

Use `MISE_ENV=work zsh -l` for a work shell. For a machine-wide default, create
`~/.config/mise/miserc.local.toml` containing `env = ["work"]`; local mise config
is ignored by Git. Pi account selection does not select a development toolchain.

### Updating toolchains

After changing tool versions, run `mise install && mise reshim` and open a new
shell. Use `mise doctor` and `command -v node pnpm` to check resolution.
If release-asset changes break installation, update mise through its original
installer (`mise self-update` for standalone installs) and retry.

## Terminal themes

The shared Dracula palette lives in
[`home/.config/alacritty/dracula.toml`](home/.config/alacritty/dracula.toml).
Stow places it at `~/.config/alacritty/dracula.toml` on Unix-like hosts. Keep
an Alacritty host configuration limited to its platform-specific launcher and
font choices, then import the palette:

```toml
import = ["~/.config/alacritty/dracula.toml"]
```

Windows Alacritty configuration remains in
`%APPDATA%\\alacritty\\alacritty.toml`; copy the `[colors]` sections from the
shared palette into that file. Pi, tmux, Ghostty, and the Alacritty palette use
Dracula; tmux does not require a theme plugin.

## WSL terminal and clipboard

Pi and tmux-yank use the outer terminal's OSC 52 clipboard support on WSL,
without requiring `clip.exe`. Use a terminal that permits clipboard writes,
such as Alacritty. Tmux's `set-clipboard on` allows applications to write the
host clipboard. macOS retains tmux-yank's native clipboard selection.
Set `PI_CLIPBOARD_OSC52=0` to disable Pi's additional terminal clipboard write.
OSC 52 does not provide general clipboard reads or image paste.

Other clipboard clients need `xclip` for X11 or `wl-clipboard` for Wayland.
Wayland requires a reachable socket at `$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY`;
fix the WSLg session rather than overriding the runtime directory globally.

If Windows executables fail with `Exec format error`, save your work and run
`wsl --shutdown` from Windows PowerShell, then reopen WSL and try `cmd.exe /c ver`.
Shutdown stops all WSL sessions, including tmux. Persistent failures require
checking WSL interop/binfmt registration or updating WSL on Windows.

Reload tmux with `tmux source-file ~/.config/tmux/tmux.conf`. Open a new shell
and restart Pi to pick up environment changes. Verify `Shift+Enter` inserts a
newline and copy a response into a Windows app. With tmux mouse mode enabled,
use Shift-drag for terminal selection, or tmux copy mode (`prefix + [`, `v`, `y`).

## Shell script checks

```bash
bash -n bootstrap.sh
bash -n home/.pi/profiles.sh
bash -n home/.config/shell/paths.sh
./bootstrap.sh --dry-run
```

## Usage

- Run `pi` for the work account or `pi -p personal` for the personal account.
- Pi runs tools on the host without an OS sandbox; permissions and local guardrails remain active.
- Run `stow -R -t "$HOME" home` from this repository to relink configuration.
- In work repositories, override the personal Git identity with `git config --local user.email you@work.com`.
