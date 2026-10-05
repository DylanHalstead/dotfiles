# pi profiles — auth-only isolation across accounts (work, personal, ...).
#
# Each profile is a thin config dir under ~/.pi/profiles/<name> that symlinks
# every shared file from the canonical agent dir (~/.pi/agent) EXCEPT auth.json,
# which is a real per-profile file. Flipping PI_CODING_AGENT_DIR therefore swaps
# only the credentials; settings, extensions, skills, prompts, and permissions
# stay shared. See ~/.pi/agent docs: PI_CODING_AGENT_DIR overrides the config dir.
#
# Usage:
#   pi                     # default profile (PI_PROFILE, or "work")
#   pi -p personal ...     # one-off profile for this invocation
#   PI_PROFILE=personal pi # per-shell default
#   pi-profile personal    # create/refresh a profile dir, then run /login in it
#
# An explicit PI_CODING_AGENT_DIR always wins and bypasses profile handling, so
# every other PI_* env var (PI_CODING_AGENT_SESSION_DIR, PI_PACKAGE_DIR,
# PI_OFFLINE, ...) keeps working untouched.

: "${PI_AGENT_DIR:=$HOME/.pi/agent}"
: "${PI_PROFILES_DIR:=$HOME/.pi/profiles}"
export PI_AGENT_DIR PI_PROFILES_DIR

# Profile names identify direct children of PI_PROFILES_DIR.
_pi_profile_validate() {
  case "${1:-}" in
    ''|[!a-zA-Z0-9]*|*[!a-zA-Z0-9_-]*)
      echo "pi profile: use a name starting with a letter or digit, containing only letters, digits, underscores, or hyphens" >&2
      return 2
      ;;
  esac
}

# _pi_profile_sync <name>: build/refresh the profile dir. Symlinks every shared
# entry from the agent dir except auth.json; never touches an existing auth.json.
_pi_profile_sync() {
  _pi_profile_validate "${1:-}" || return
  local _pps_dir _pps_entry
  [ -d "$PI_AGENT_DIR" ] || { echo "pi profile: agent directory not found: $PI_AGENT_DIR" >&2; return 1; }
  _pps_dir="$PI_PROFILES_DIR/$1"
  mkdir -p "$_pps_dir" || return 1
  find "$PI_AGENT_DIR" -maxdepth 1 -mindepth 1 ! -name auth.json -print | while IFS= read -r _pps_entry; do
    ln -sfn "$_pps_entry" "$_pps_dir/${_pps_entry##*/}"
  done
}

# pi: wrapper that selects a profile config dir before delegating to real pi.
pi() {
  if [ -n "${PI_CODING_AGENT_DIR:-}" ]; then
    command pi "$@"
    return
  fi
  local _pi_profile="${PI_PROFILE:-work}" _pi_dir _pi_rc=0
  if [ "${1:-}" = "-p" ] || [ "${1:-}" = "--profile" ]; then
    [ "$#" -ge 2 ] || { echo "usage: pi --profile <name> [args...]" >&2; return 2; }
    _pi_profile="$2"
    shift 2
  fi
  _pi_profile_validate "$_pi_profile" || return
  _pi_dir="$PI_PROFILES_DIR/$_pi_profile"
  [ -d "$_pi_dir" ] || _pi_profile_sync "$_pi_profile" || return
  PI_CODING_AGENT_DIR="$_pi_dir" command pi "$@" || _pi_rc=$?
  return "$_pi_rc"
}

# pi-profile <name>: create/refresh a profile, then log in if it has no auth yet.
pi-profile() {
  [ "$#" -eq 1 ] || { echo "usage: pi-profile <name>" >&2; return 2; }
  _pi_profile_sync "$1" || return
  if [ ! -e "$PI_PROFILES_DIR/$1/auth.json" ]; then
    echo "pi profile '$1' created; run: pi -p $1  then /login" >&2
  else
    echo "pi profile '$1' refreshed" >&2
  fi
}
