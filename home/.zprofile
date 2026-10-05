# Login shell environment. Interactive non-login shells reuse this file.
if command -v brew >/dev/null 2>&1; then
  eval "$(brew shellenv)"
elif [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

typeset -U path PATH
path=("$HOME/bin" "$HOME/.local/bin" $path)
export PATH
export EDITOR='nvim'

# Google Cloud SDK executables.
[ -f "$HOME/google-cloud-sdk/path.zsh.inc" ] && source "$HOME/google-cloud-sdk/path.zsh.inc"

# Homebrew PostgreSQL tools.
if command -v brew >/dev/null 2>&1; then
  if libpq_prefix="$(brew --prefix libpq 2>/dev/null)" && [[ -d "$libpq_prefix/bin" ]]; then
    path=("$libpq_prefix/bin" $path)
  fi
  unset libpq_prefix
fi
