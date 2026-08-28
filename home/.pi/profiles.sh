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

# _pi_profile_sync <name>: build/refresh the profile dir. Symlinks every shared
# entry from the agent dir except auth.json; never touches an existing auth.json.
_pi_profile_sync() {
  [ -n "$1" ] || { echo "pi profile: name required" >&2; return 1; }
  _pps_dir="$PI_PROFILES_DIR/$1"
  mkdir -p "$_pps_dir" || return 1
  find "$PI_AGENT_DIR" -maxdepth 1 -mindepth 1 ! -name auth.json -print | while IFS= read -r _pps_entry; do
    ln -sfn "$_pps_entry" "$_pps_dir/${_pps_entry##*/}"
  done
  unset _pps_dir
}

# pi: wrapper that selects a profile config dir before delegating to real pi.
pi() {
  if [ -n "$PI_CODING_AGENT_DIR" ]; then
    command pi "$@"
    return
  fi
  _pi_profile="${PI_PROFILE:-work}"
  if [ "$1" = "-p" ] || [ "$1" = "--profile" ]; then
    _pi_profile="$2"
    shift 2
  fi
  _pi_dir="$PI_PROFILES_DIR/$_pi_profile"
  [ -d "$_pi_dir" ] || _pi_profile_sync "$_pi_profile" || return 1
  PI_CODING_AGENT_DIR="$_pi_dir" command pi "$@"
  _pi_rc=$?
  unset _pi_profile _pi_dir
  return $_pi_rc
}

# pi-profile <name>: create/refresh a profile, then log in if it has no auth yet.
pi-profile() {
  [ -n "$1" ] || { echo "usage: pi-profile <name>" >&2; return 1; }
  _pi_profile_sync "$1" || return 1
  if [ ! -e "$PI_PROFILES_DIR/$1/auth.json" ]; then
    echo "pi profile '$1' created; run: pi -p $1  then /login" >&2
  else
    echo "pi profile '$1' refreshed" >&2
  fi
}
