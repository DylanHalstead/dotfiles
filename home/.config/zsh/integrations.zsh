# Interactive CLI integrations.
[ -f "$HOME/google-cloud-sdk/completion.zsh.inc" ] && source "$HOME/google-cloud-sdk/completion.zsh.inc"

# LocalStack awslocal alias.
alias awslocal="AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=\${DEFAULT_REGION:-\$AWS_DEFAULT_REGION} aws --endpoint-url=http://\${LOCALSTACK_HOST:-localhost}:4566 --profile=localstack"

if [ -x /Applications/Windsurf.app/Contents/MacOS/Electron ]; then
  alias surf="/Applications/Windsurf.app/Contents/MacOS/Electron"
fi
