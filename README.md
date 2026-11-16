# dotfiles

Personal shell and development configuration managed with [GNU Stow](https://www.gnu.org/software/stow/).
The `home/` directory mirrors `$HOME`.

## What's here

- Shell: Zsh, Oh My Zsh, Bash, Powerlevel10k, and fzf.
- Development: Git, GitHub CLI, mise, [Neovim](home/.config/nvim/README.md), and tmux.
- Terminals: Ghostty, a shared [Dracula palette](home/.config/alacritty/dracula.toml), and terminal clipboard settings.
- [Pi](home/.pi/README.md): shared settings, prompts, extensions, and separate work/personal accounts.
- [Agent skills](https://github.com/DylanHalstead/skills): `skills-lock.json` tracks skills installed at `~/.agents/skills/`.

## Install

Install Oh My Zsh with the theme and plugins listed in `.zshrc`, mise,
fzf 0.48+, tmux 3.2+, and Neovim 0.11+ on PATH. Configure GitHub SSH access:
`.gitconfig` rewrites GitHub HTTPS URLs to SSH.

```sh
git clone git@github.com:DylanHalstead/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap.sh
mise install
mise reshim
```

Execute bootstrap rather than sourcing it. `./bootstrap.sh --dry-run` previews
Stow links without installing or changing configuration. Bootstrap stops on
errors, but skips skills and Pi packages when their CLIs are missing. Install
those prerequisites and rerun.

In tmux, press `prefix + I` to install plugins. Neovim installs plugins on first launch.

## Maintenance

- Run `stow -R -t "$HOME" home` to refresh links.
- Keep OS tools with the platform package manager, development runtimes with mise,
  and project dependencies in project manifests. Prefer `pnpm add -g` for global
  Node applications so they stay outside a versioned Node installation.
- Shared toolchains live in [`config.toml`](home/.config/mise/config.toml).
  After changing versions, run `mise install && mise reshim` and open a new shell.
  Projects own their version requirements.
- Work-only tools live in [`config.work.toml`](home/.config/mise/config.work.toml).
  Use `mise -E work install` and `MISE_ENV=work zsh -l` when needed.
- Manage skills from this repository without `--global`; `skills-lock.json` is
  the portable source of truth.
- In work repositories, override the personal Git identity with
  `git config --local user.email you@work.com`.

Shell checks:

```sh
bash -n bootstrap.sh
bash -n home/.pi/profiles.sh
bash -n home/.config/shell/paths.sh
./bootstrap.sh --dry-run
```
