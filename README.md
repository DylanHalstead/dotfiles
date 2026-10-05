# dotfiles

Personal shell and development configuration managed with [GNU Stow](https://www.gnu.org/software/stow/).
The `home/` directory mirrors `$HOME`.

## Configuration

- Shell: Zsh, ohmyzsh, Bash, Powerlevel10k, and fzf.
- Development: Git, GitHub CLI, mise, Neovim, and tmux.
- [Pi](home/.pi/README.md): prompts, extensions, permissions, and account profiles.
- [Agent skills](https://github.com/DylanHalstead/skills): pinned in `skills-lock.json` and installed at `~/.agents/skills/`.

## Install

Install Oh My Zsh, mise, and fzf for the shell setup.

```bash
git clone git@github.com:DylanHalstead/dotfiles.git ~/dotfiles
cd ~/dotfiles
./bootstrap.sh
mise install
```

In tmux, press `prefix + I` to install plugins. Neovim installs its plugins on first launch.

## Usage

- Run `pi` for the work account or `pi -p personal` for the personal account.
- Pi runs tools on the host with the OS sandbox disabled by default.
- Run `stow -R -t "$HOME" home` from this repository to relink configuration.
