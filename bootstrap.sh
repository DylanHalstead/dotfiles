#!/usr/bin/env bash
#
# Bootstrap dotfiles on a new machine.
# Usage:  git clone <repo> ~/dotfiles && cd ~/dotfiles && ./bootstrap.sh
#
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 1. Ensure GNU Stow is installed -----------------------------------------
if ! command -v stow >/dev/null 2>&1; then
  echo "==> stow not found, installing..."
  if [[ "$OSTYPE" == darwin* ]]; then
    if command -v brew >/dev/null 2>&1; then
      brew install stow
    else
      echo "ERROR: Homebrew not found. Install it from https://brew.sh then re-run." >&2
      exit 1
    fi
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y stow
  else
    echo "ERROR: no known package manager. Install GNU Stow manually, then re-run." >&2
    exit 1
  fi
fi

# --- 2. Install TPM (tmux plugin manager) ------------------------------------
TPM_DIR="$HOME/.config/tmux/plugins/tpm"
if [[ ! -d "$TPM_DIR" ]]; then
  echo "==> Cloning TPM..."
  git clone https://github.com/tmux-plugins/tpm "$TPM_DIR"
fi

# --- 3. Stow the single 'home' package ---------------------------------------
echo "==> Stowing configs into \$HOME ..."
cd "$DOTFILES_DIR"
stow -t "$HOME" -v home

# --- 4. pi harness packages ---------------------------------------------------
# settings.json (stowed above) already declares the package list; this just
# materialises node_modules for them. Skipped when pi isn't installed.
if command -v pi >/dev/null 2>&1; then
  echo "==> Installing pi packages declared in settings.json ..."
  pi update --extensions
else
  echo "==> pi not found, skipping pi package install."
  echo "    Install with: brew install pi-coding-agent   (then re-run this script)"
fi

# --- 5. pi profiles (auth-only account isolation) ----------------------------
# Build thin per-account config dirs that share everything except auth.json.
# The existing ~/.pi/agent/auth.json (if any) becomes the "work" profile.
if [ -f "$HOME/.pi/profiles.sh" ]; then
  echo "==> Setting up pi profiles (work, personal) ..."
  # shellcheck disable=SC1091
  . "$HOME/.pi/profiles.sh"
  for profile in work personal; do
    _pi_profile_sync "$profile"
  done
  if [ -f "$HOME/.pi/agent/auth.json" ] && [ ! -e "$HOME/.pi/profiles/work/auth.json" ]; then
    cp "$HOME/.pi/agent/auth.json" "$HOME/.pi/profiles/work/auth.json"
    chmod 600 "$HOME/.pi/profiles/work/auth.json"
    echo "    Migrated existing credentials into the 'work' profile."
  fi
  echo "    Personal account: run  pi -p personal  then /login"
fi

cat <<'EOF'

Done. Next steps:
  - Open tmux and press  prefix + I  to install tmux plugins.
  - Open nvim; lazy.nvim will auto-install plugins on first launch.

Prerequisites (install separately, not carried by dotfiles):
  oh-my-zsh, fzf, mise, and any language toolchains (node/fnm, pnpm, bun, go).

The shell configuration discovers optional tools and platform-specific paths at
runtime. ~/.gitconfig uses a personal identity; in work repos set a local override:
  git config --local user.email you@work.com
EOF
