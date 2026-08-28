# Sandbox network exceptions

`default.json` must remain strict JSON because `@anthropic-ai/sandbox-runtime` loads it with `JSON.parse`; it cannot contain inline comments.

- `tuf-repo-cdn.sigstore.dev` supplies Sigstore's TUF metadata. TFLint uses it to verify TFLint ruleset plugin checksum signatures during `tflint --init`.

## Terraform generated data

`default.json` explicitly allows Terraform's `.terraform` directories below the current project. `terraform init` can use its default data directory and writes `.terraform.lock.hcl` in the environment directory as usual.
