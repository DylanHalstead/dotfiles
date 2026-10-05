# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

# Login shells already loaded this environment; direct interactive shells need it too.
if [[ ! -o login ]]; then
  source "$HOME/.zprofile"
fi

fpath+=${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions/src

export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="powerlevel10k/powerlevel10k"

plugins=(rails ruby git gh golang postgres docker docker-compose history-substring-search zsh-autosuggestions zsh-syntax-highlighting)

source $ZSH/oh-my-zsh.sh

source "$HOME/.config/zsh/integrations.zsh"

# mise
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate zsh)"
fi

[ -f "$HOME/.fzf.zsh" ] && source "$HOME/.fzf.zsh"

# rails macos dev
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES

[ -f ~/.zsh_secrets ] && source ~/.zsh_secrets

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Keybindings
bindkey -e
bindkey '^p' history-substring-search-up
bindkey '^n' history-substring-search-down

# History
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

# Completion styling
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"

#Aliases
if [[ "$OSTYPE" == darwin* ]]; then
  alias ls='ls -G'
else
  alias ls='ls --color'
fi
alias vim=nvim
alias vi=nvim

# pi profiles — auth-only account switching (see ~/.pi/profiles.sh)
[ -f ~/.pi/profiles.sh ] && source ~/.pi/profiles.sh

# linear
export LINEAR_TEAM_ID="NA"
