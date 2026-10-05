# Interactive CLI integrations.
[ -f "$HOME/google-cloud-sdk/completion.zsh.inc" ] && source "$HOME/google-cloud-sdk/completion.zsh.inc"

# LocalStack defaults apply only to the local emulator and its AWS commands.
function localstack {
  ACTIVATE_PRO="${ACTIVATE_PRO:-0}" \
    LAMBDA_RUNTIME_ENVIRONMENT_TIMEOUT="${LAMBDA_RUNTIME_ENVIRONMENT_TIMEOUT:-50}" \
    command localstack "$@"
}

unalias awslocal 2>/dev/null || true
function awslocal {
  AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
    AWS_DEFAULT_REGION="${DEFAULT_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}" \
    command aws --endpoint-url="http://${LOCALSTACK_HOST:-localhost}:4566" --profile=localstack "$@"
}

# Keep the default team on Linear invocations, not in the shell environment.
function linear {
  LINEAR_TEAM_ID="${LINEAR_TEAM_ID:-NA}" command linear "$@"
}

if [ -x /Applications/Windsurf.app/Contents/MacOS/Electron ]; then
  alias surf="/Applications/Windsurf.app/Contents/MacOS/Electron"
fi
