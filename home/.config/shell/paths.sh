# Source before mise activation so managed toolchains take precedence.
if [ -z "${HOME:-}" ]; then
  printf 'dotfiles: HOME must be set before loading application paths.\n' >&2
  return 1
fi

if [ -z "${PNPM_HOME:-}" ]; then
  _dotfiles_os="$(uname -s)" || return
  case "$_dotfiles_os" in
    Darwin) PNPM_HOME="$HOME/Library/pnpm" ;;
    *) PNPM_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/pnpm" ;;
  esac
  unset _dotfiles_os
fi
export PNPM_HOME

# pnpm 11+ uses bin/; retain the root for CLIs installed with pnpm 10.
export PATH="$HOME/bin:$HOME/.local/bin:$PNPM_HOME/bin:$PNPM_HOME:$HOME/.bun/bin${PATH:+:$PATH}"
