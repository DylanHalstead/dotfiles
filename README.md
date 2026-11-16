# dotfiles

Personal shell and development configuration managed with [GNU Stow](https://www.gnu.org/software/stow/).
The `home/` directory mirrors `$HOME`.

See [Pi](home/.pi/README.md) for accounts and prompt workflows,
[Neovim](home/.config/nvim/README.md) for editor setup, and
[agent skills](https://github.com/DylanHalstead/skills) for reusable agent guidance.

## Install

Install Oh My Zsh with the theme and plugins in [`home/.zshrc`](home/.zshrc),
mise, fzf 0.48+, and tmux 3.2+. Check the Neovim prerequisites linked above.
Configure GitHub SSH access; `.gitconfig` rewrites GitHub HTTPS URLs to SSH.

```sh
git clone git@github.com:DylanHalstead/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap.sh
mise install
mise reshim
```

`./bootstrap.sh --dry-run` previews Stow links without changing configuration.
Bootstrap skips skill restoration without `npx` and Pi packages without `pi`;
install the missing CLI and rerun.

In tmux, press `prefix + I` to install plugins. Neovim installs plugins on first launch.

## Maintenance

- Run `stow -R -t "$HOME" home` to refresh links.
- Use the platform package manager for OS tools, mise for runtimes, and
  `pnpm add -g` for global Node applications outside versioned Node installations.
  Projects own their dependencies and runtime requirements.
- Shared runtime defaults live in [`config.toml`](home/.config/mise/config.toml).
  After changing them, run `mise install && mise reshim` and open a new shell.
- Work-only tools live in [`config.work.toml`](home/.config/mise/config.work.toml).
  Use `mise -E work install` and `MISE_ENV=work zsh -l` when needed.
- Manage skills from this repository without `--global`. `skills-lock.json`
  tracks the skills restored to `~/.agents/skills/`.
- In work repositories, override the personal Git identity with
  `git config --local user.email you@work.com`.

Shell checks:

```sh
bash -n bootstrap.sh
bash -n home/.pi/profiles.sh
bash -n home/.config/shell/paths.sh
./bootstrap.sh --dry-run
```
