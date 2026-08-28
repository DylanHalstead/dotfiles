# Setup fzf
# ---------
if [ -d "$HOME/.fzf/bin" ] && [[ ! "$PATH" == *"$HOME/.fzf/bin"* ]]; then
  PATH="${PATH:+${PATH}:}$HOME/.fzf/bin"
fi

command -v fzf >/dev/null 2>&1 && eval "$(fzf --bash)"
