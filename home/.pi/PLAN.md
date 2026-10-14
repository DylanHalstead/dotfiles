# Plan: publish standalone Pi extensions from a monorepo

## Goal and ownership

The public repository is
[DylanHalstead/pi-extensions](https://github.com/DylanHalstead/pi-extensions),
with a local checkout at `/Users/dylan/repos/pi-extensions`.

Publish independently installable npm packages:

- `@dylanhalstead/pi-inline-skills`: autocomplete `$skill-name` mentions and
  replace them with file references to discovered Pi skills.
- `@dylanhalstead/pi-model-switch-guard`: confirm the first interactive prompt
  after a mid-session model switch, with `/model-undo` and `ctrl+alt+m`.

The npm scope is proposed but ownership must be confirmed before publication.
A GitHub account does not establish ownership of the corresponding npm scope.

Keep `custom-footer.ts`, `guardrails.ts`, `phase-shortcuts.ts`, and `yolo.ts`
local. The extension collection is not a runtime framework.

## Settled design

- Use a public pnpm workspace with MIT licensing.
- Use project-local Vite+ for Oxfmt, Oxlint, type checking, Vitest, and task
  execution. Do not add Lerna, Turbo, or Changesets initially.
- `extensions/*` contains Pi extensions. Add reusable libraries under
  `packages/*` only when actual consumers need the same stable capability.
  No placeholder library is needed.
- Extensions may depend on libraries, never on other extensions. Libraries
  expose capabilities without registering Pi behavior on import.
- Ship TypeScript Pi entrypoints without a bundled `dist/` artifact.
  Compiled JavaScript/declarations become necessary only for ordinary library
  exports.
- Colocate package `*.test.ts` files beside source and test each extension's
  contract independently. Shared factories live in `tests/fixtures/`, not
  `__mocks__`; they do not reproduce Pi's input dispatcher. Exclude tests from
  published tarballs. Each package owns its manifest, version, source, tests,
  and README. Maintain one root MIT `LICENSE`; pnpm packs the notice into each
  workspace package automatically. Publish those tarballs with npm, not package
  directories. Validate the packed notice against the root file.
- Declare host-provided Pi modules as `*` peers and pin development copies
  at the workspace root. Document the tested Pi version rather than claiming
  every host release is supported.
- Each committed package manifest owns its independent version. Stable
  package-qualified tags execute one release and must match that version;
  publishing never rewrites the manifest. GitHub Actions owns Bash/jq/curl
  release validation and npm OIDC publishing from a protected environment.
  GitHub Releases hold version history. A retry may skip npm publishing only
  when the existing artifact has identical name, version, and tarball integrity.
- Bootstrap first publication through an authenticated owner publish; npm
  trusted publishing requires an existing registry package. Do not store an
  npm write token in GitHub.

The new repository owns the detailed maintenance instructions:
[Contribution and release guide](https://github.com/DylanHalstead/pi-extensions/blob/main/CONTRIBUTING.md).
Each extension README owns its public contract.

## Export contracts

### Inline skills

Preserve discovered-skill lookup, shorthand completion, multiline substitution,
and the wrapped autocomplete provider's triggers and non-skill behavior.

Replace known `$name` mentions with `@/absolute/path/to/SKILL.md` references
without reading or injecting instructions. Match Pi file-completion quoting for
paths containing whitespace or Unicode separators. Preserve surrounding text,
punctuation, and images. Do not hide the resulting references in the transcript.
Malformed word-like suffixes must not match a shorter valid prefix.

The model decides whether to read and use a referenced skill. Pi's native
`/skill:name` remains the explicit loading mechanism. TUI autocomplete is
terminal-only; reference substitution remains available in other modes. Source
paths enter the prompt and transcript. This is not a skill loader or trust system.

### Model switch guard

Preserve free selection before the first turn starts, pending-switch status,
confirmation, undo, and the original source model across chained switches.

A failed restoration must not clear protection or report success. A failed
confirmation must not send the prompt. Reconstruct turn state from the active
branch on session starts and tree navigation; ignore model-restore events.

Automatic guarding and undo are TUI-only initially. RPC, JSON, and print modes
must not wait for dialogs, consume input, or change models.

Pi passes input transformations to later handlers without exposing the original
pre-transformation text. Model guard restores the text it receives: shorthand
if loaded first, transformed text if other handlers run earlier. Configure the
guard before input-transforming extensions to preserve original editor text;
Pi 1.1.0 has no package-declared handler priority. Verify loading order in real
Pi rather than a simulated cross-extension chain. Pi's editor API cannot restore
image attachments; declining must warn the user to reattach them.

## Implementation and migration gates

1. **Prepare the workspace and packages.**
   Establish reproducible installation, static checks, colocated behavior tests,
   tarball validation, isolated packed-artifact loading, CI, and release
   validation. Review the extracted code before publication.

2. **Validate real Pi behavior.**
   Use a disposable agent directory to avoid duplicate local loading. Verify
   terminal autocomplete and completion delegation, model dialogs, undo,
   restoration failures, session navigation, guard-first loading, and image
   warnings. Automated registration tests do not replace these TUI checks.

3. **Publish.**
   Confirm npm scope ownership, commit/push the verified source, and wait for
   GitHub CI. Complete the first authenticated publication and bootstrap
   release record using its normal package-qualified tag; the workflow validates
   the already-published artifact and creates the GitHub Release. Configure
   protected environments/tag rules and each npm package's trusted publisher
   before subsequent OIDC releases.

4. **Install published packages into dotfiles.**
   Install each independently with `pi install npm:...`. Start a fresh session,
   verify it loads exactly once, then remove the matching standalone file.
   Validate shared profile symlinks and leave all private extensions unchanged.
   Do not activate a packaged extension alongside its local duplicate.

5. **Reassess future shared code only after actual use.**
   Extract a library when multiple consumers share a meaningful contract.
   Keep the footer private until it has an independent, stable public contract;
   do not introduce a footer framework speculatively.

## Completion criteria

- Reproducible pnpm installation and green GitHub CI.
- Independent npm packages with Pi manifests, source-only tarballs, colocated
  tests, READMEs, the inherited root MIT notice, and isolated loading checks.
- Real TUI integration verified before release.
- npm installation and Pi gallery discovery verified for each package.
- Subsequent releases use package-qualified tags, protected GitHub environments,
  and npm OIDC with no GitHub npm write token.
- Dotfiles loads each published extension once, with the corresponding local
  standalone file removed only after validation.
- Private extensions remain local and unchanged.
