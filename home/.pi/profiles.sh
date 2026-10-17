# Pi profiles keep credentials separate while sharing one Pi installation.
# model-scopes.json owns each profile's enabledModels scope.
#
# Usage:
#   pi                     # default profile (PI_PROFILE, or "work")
#   pi -p personal ...     # one-off profile for this invocation
#   PI_PROFILE=personal pi # per-shell default
#   pi-profile personal    # create/refresh a profile dir, then run /login in it
#   pi-profiles-setup      # initialize work/personal profiles and migrate auth
#
# An explicit PI_CODING_AGENT_DIR always wins and bypasses profile handling, so
# every other PI_* env var (PI_CODING_AGENT_SESSION_DIR, PI_PACKAGE_DIR,
# PI_OFFLINE, ...) keeps working untouched.

# Use the terminal clipboard on WSL even when local clipboard helpers fail.
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  export PI_CLIPBOARD_OSC52="${PI_CLIPBOARD_OSC52:-1}"
fi

: "${PI_AGENT_DIR:=$HOME/.pi/agent}"
: "${PI_PROFILES_DIR:=$HOME/.pi/profiles}"
export PI_AGENT_DIR PI_PROFILES_DIR

_pi_profile_validate() {
  case "${1:-}" in
    ''|[!a-zA-Z0-9]*|*[!a-zA-Z0-9_-]*)
      echo "pi profile: use a name starting with a letter or digit, containing only letters, digits, underscores, or hyphens" >&2
      return 2
      ;;
  esac
}

# Refresh shared links without touching credentials or replacing real directories.
# A subshell confines pipefail and failure exits to this operation.
_pi_profile_sync() (
  set -o pipefail
  _pi_profile_validate "${1:-}" || return
  local profile_dir resource_path resource_link
  [ -d "$PI_AGENT_DIR" ] || { echo "pi profile: agent directory not found: $PI_AGENT_DIR" >&2; return 1; }
  profile_dir="$PI_PROFILES_DIR/$1"
  mkdir -p "$profile_dir" || return 1
  find -H "$PI_AGENT_DIR" -maxdepth 1 -mindepth 1 ! -name auth.json -print0 | while IFS= read -r -d '' resource_path; do
    resource_link="$profile_dir/${resource_path##*/}"
    if [ -d "$resource_link" ] && [ ! -L "$resource_link" ]; then
      printf 'pi profile: move existing resource directory aside: %s\n' "$resource_link" >&2
      exit 1
    fi
    ln -sfn "$resource_path" "$resource_link" || exit "$?"
  done
)

# Keep model policy in JSON while Pi receives its native comma-separated scope.
_pi_profile_model_scope() {
  _pi_profile_validate "${1:-}" || return
  local _ppms_file="${PI_PROFILES_DIR%/*}/model-scopes.json"
  [ -f "$_ppms_file" ] || { echo "pi profile: model scopes file not found: $_ppms_file" >&2; return 1; }
  command -v node >/dev/null 2>&1 || { echo "pi profile: node is required to read $_ppms_file" >&2; return 1; }
  node -e '
    const [file, profile] = process.argv.slice(1);
    let scopes;
    try {
      scopes = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
    } catch (error) {
      console.error(`pi profile: cannot read ${file}: ${error.message}`);
      process.exit(1);
    }
    const models = scopes[profile]?.enabledModels;
    if (!Array.isArray(models) || models.length === 0 || !models.every((model) => typeof model === "string" && model.length > 0)) {
      console.error(`pi profile: ${file} needs a non-empty enabledModels array for ${profile}`);
      process.exit(1);
    }
    process.stdout.write(models.join(","));
  ' "$_ppms_file" "$1"
}

# Copy existing credentials to work only when work has none.
pi-profiles-setup() {
  local profile work_auth="$PI_PROFILES_DIR/work/auth.json"
  for profile in work personal; do
    _pi_profile_sync "$profile" || return
  done
  if [ -f "$PI_AGENT_DIR/auth.json" ] && [ ! -e "$work_auth" ] && [ ! -L "$work_auth" ]; then
    (umask 077; cp "$PI_AGENT_DIR/auth.json" "$work_auth") || return
    chmod 600 "$work_auth" || return
    echo "    Migrated existing credentials into the 'work' profile."
  fi
  echo "    Personal account: run  pi -p personal  then /login"
}

pi() {
  if [ -n "${PI_CODING_AGENT_DIR:-}" ]; then
    command pi "$@"
    return
  fi
  local _pi_profile="${PI_PROFILE:-work}" _pi_dir _pi_rc=0 _pi_scope
  if [ "${1:-}" = "-p" ] || [ "${1:-}" = "--profile" ]; then
    [ "$#" -ge 2 ] || { echo "usage: pi --profile <name> [args...]" >&2; return 2; }
    _pi_profile="$2"
    shift 2
  fi
  _pi_profile_validate "$_pi_profile" || return
  _pi_dir="$PI_PROFILES_DIR/$_pi_profile"
  _pi_profile_sync "$_pi_profile" || return
  _pi_scope=$(_pi_profile_model_scope "$_pi_profile") || return
  PI_CODING_AGENT_DIR="$_pi_dir" command pi --models "$_pi_scope" "$@" || _pi_rc=$?
  return "$_pi_rc"
}

pi-profile() {
  [ "$#" -eq 1 ] || { echo "usage: pi-profile <name>" >&2; return 2; }
  _pi_profile_sync "$1" || return
  if [ ! -e "$PI_PROFILES_DIR/$1/auth.json" ]; then
    echo "pi profile '$1' created; run: pi -p $1  then /login" >&2
  else
    echo "pi profile '$1' refreshed" >&2
  fi
}
