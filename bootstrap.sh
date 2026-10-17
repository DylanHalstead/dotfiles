#!/usr/bin/env bash

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  printf 'ERROR: execute bootstrap.sh with Bash; do not source it.\n' >&2
  return 2
fi

set -Eeuo pipefail
# Report location and status, not command text that could contain credentials.
trap 'printf "ERROR: bootstrap failed at %s:%s (exit %s)\n" "${BASH_SOURCE[0]}" "$LINENO" "$?" >&2' ERR

usage() {
  printf 'Usage: %s [--dry-run | --help]\n' "$0"
}

if (( $# > 1 )); then
  usage >&2
  exit 2
fi
case "${1:-}" in
  --help|-h) usage; exit 0 ;;
  --dry-run|'') ;;
  *) usage >&2; exit 2 ;;
esac

if [[ -z "${HOME:-}" || ! -d "$HOME" || ! -w "$HOME" ]]; then
  printf 'ERROR: HOME must name an existing writable directory.\n' >&2
  exit 1
fi

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DOTFILES_DIR"
TPM_DIR="$HOME/.config/tmux/plugins/tpm"
if [[ ( -e "$TPM_DIR" || -L "$TPM_DIR" ) && ! -x "$TPM_DIR/tpm" ]]; then
  printf 'ERROR: incomplete TPM installation at %s; move it aside and retry.\n' "$TPM_DIR" >&2
  exit 1
fi

if [[ "${1:-}" == --dry-run ]]; then
  printf '%s\n' 'Dry run: Stow link preview only; no installs, updates, or profile changes.'
  if command -v stow >/dev/null 2>&1; then
    stow --simulate --verbose -t "$HOME" home
  else
    printf '%s\n' 'Stow is missing; install it to preview link conflicts.'
  fi
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  printf 'ERROR: Git is required; install it with your platform package manager.\n' >&2
  exit 1
fi

if ! command -v stow >/dev/null 2>&1; then
  printf '==> stow not found, installing...\n'
  if [[ "$OSTYPE" == darwin* ]]; then
    if command -v brew >/dev/null 2>&1; then
      brew install stow
    else
      printf 'ERROR: Homebrew not found. Install it from https://brew.sh then re-run.\n' >&2
      exit 1
    fi
  elif command -v apt-get >/dev/null 2>&1; then
    if ! command -v sudo >/dev/null 2>&1; then
      printf 'ERROR: sudo is required to install Stow with apt; install Stow manually.\n' >&2
      exit 1
    fi
    sudo apt-get update
    sudo apt-get install -y stow
  else
    printf 'ERROR: no known package manager. Install GNU Stow manually, then re-run.\n' >&2
    exit 1
  fi
fi

# Reject link conflicts before cloning or updating user resources.
printf '==> Checking Stow link conflicts...\n'
stow --simulate -t "$HOME" home

if [[ ! -d "$TPM_DIR" ]]; then
  printf '==> Cloning TPM...\n'
  git clone https://github.com/tmux-plugins/tpm "$TPM_DIR"
fi

printf '==> Stowing configs into $HOME ...\n'
stow -t "$HOME" -v home

# Activate after application paths so mise-owned tools take precedence.
# shellcheck disable=SC1091
. "$HOME/.config/shell/paths.sh"
if command -v mise >/dev/null 2>&1; then
  # Capture first so eval cannot mask an activation failure.
  mise_shell_code="$(mise activate bash --shims)"
  eval "$mise_shell_code"
fi

# experimental_install restores skills-lock.json from the current directory.
if command -v npx >/dev/null 2>&1; then
  printf '==> Restoring agent skills from skills-lock.json ...\n'
  npx --yes skills@1.7.2 experimental_install
else
  printf '==> npx not found, skipping agent skill restore.\n'
fi

# Pi reads package declarations from settings.json.
if command -v pi >/dev/null 2>&1; then
  printf '==> Installing pi packages declared in settings.json ...\n'
  pi update --extensions
else
  printf '%s\n' \
    '==> pi not found, skipping pi package install.' \
    '    Install with: pnpm add -g --ignore-scripts @earendil-works/pi-coding-agent' \
    '    Then re-run this script.'
fi

if [ -f "$HOME/.pi/profiles.sh" ]; then
  printf '==> Setting up pi profiles (work, personal) ...\n'
  # shellcheck disable=SC1091
  . "$HOME/.pi/profiles.sh"
  pi-profiles-setup
fi

cat <<'EOF'

Done. Next steps:
  - Run `mise install && mise reshim`, then open a new shell.
  - In tmux, press prefix + I to install plugins.
  - Open nvim to install editor plugins.

See README.md for prerequisites and work-only setup.
EOF
