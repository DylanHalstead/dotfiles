# Plan: publish standalone Pi extensions from a monorepo

## Goal

Create a public, pnpm-based monorepo for reusable Pi extensions. Move the two
extensions with a general-purpose contract into it:

- `inline-skills` — autocomplete and expand `$skill-name` references in the Pi editor.
- `model-guard` — require confirmation before sending the first prompt after a
  mid-session model switch, with a model-undo command and shortcut.

Publish each as an independent npm package and Pi package-gallery entry. Keep
personal, coupled policy in this dotfiles repository:

- `custom-footer.ts`
- `guardrails.ts`
- `phase-shortcuts.ts`
- `yolo.ts`

The repository is an extension collection, not a runtime framework. Each
published extension must work independently and must not import another
extension package.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Repository shape | One public pnpm workspace with one publishable package per extension | Matches the workspace convention in `hs-email-publications` and `nha-composable`, while keeping installation and versioning independent. |
| Task toolchain | Vite+ project-local CLI (`vp`), pnpm, Oxfmt, Oxlint, Vitest, and TypeScript native preview | This is the requested Vite+ trial. Vite+ supplies workspace-aware task execution and caching without retaining Turbo configuration. |
| Distribution | Source TypeScript npm packages; no bundled `dist/` artifact | Pi loads TypeScript extensions with jiti. Bundling with `vp pack`/tsdown would duplicate a capability Pi already provides and complicate source maps and extension debugging. |
| Package relationship | No runtime dependencies between extension packages | An extension remains installable and releasable by itself; the monorepo shares only development tooling. |
| Release authentication | npm trusted publishing from a protected GitHub Actions environment, using OIDC | Avoids a long-lived npm token in GitHub and generates provenance for a public repository. |
| Release versioning | Manually chosen, independent package versions and package-qualified release tags | Versioning is an intentional maintainer decision, not an inference from commits. This preserves the existing imperative commit style and provides an auditable Git tag, GitHub Release, and npm release for every published version. |
| Footer | Keep private for now | Its layout, Git polling, and YOLO-specific status assumption do not yet form a stable public contract. Do not design a footer-component framework before there are independent consumers. |

## Target layout

Use a repository name such as `pi-extensions` and choose the final public npm
scope before creating the repository. Examples below use `@<scope>`.

```text
pi-extensions/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── publish.yml
├── extensions/
│   ├── inline-skills/
│   │   ├── index.ts
│   │   ├── package.json                 # @<scope>/pi-inline-skills
│   │   ├── README.md
│   │   ├── LICENSE
│   │   └── test/
│   └── model-guard/
│       ├── index.ts
│       ├── package.json                 # @<scope>/pi-model-guard
│       ├── README.md
│       ├── LICENSE
│       └── test/
├── package.json                          # private workspace root
├── pnpm-workspace.yaml
├── vite.config.ts
├── tsconfig.base.json
├── .tool-versions
├── README.md
└── LICENSE
```

`pnpm-workspace.yaml` contains `extensions/*`. The root package is private and
owns only shared tooling, scripts, Node/pnpm versions, and developer
configuration. Each `extensions/*` package owns its source, tests, README,
version, npm manifest, and public behavior.

This mirrors the reference repositories' useful conventions:

- `pnpm-workspace.yaml` declares package boundaries.
- Root configuration centralizes strict compiler and quality-tool defaults.
- Each package retains its own scripts and tests.
- Root commands orchestrate checks across packages.

It intentionally does **not** copy unrelated application, infrastructure,
Turbo remote-cache, or deployment conventions from those repositories.

## Package contract

Every extension package will:

1. Use a scoped public npm name, `type: "module"`, an explicit repository URL,
   `license`, `keywords: ["pi-package"]`, and `publishConfig.access: "public"`.
2. Declare the host-provided Pi packages as `peerDependencies` with `"*"`
   ranges rather than bundling them:
   - `@earendil-works/pi-ai` when used
   - `@earendil-works/pi-coding-agent`
   - `@earendil-works/pi-tui` when used
   - `typebox` only when used
3. Declare an explicit Pi manifest:

   ```json
   {
     "pi": { "extensions": ["./index.ts"] }
   }
   ```

4. Restrict the npm tarball with `files` to the extension source, README, and
   license. Do not publish tests, workspace configuration, or unrelated files.
5. Include an npm `prepublishOnly` guard that runs the package's typecheck,
   tests, and a tarball-content check. The root CI runs the full workspace
   verification before publishing.
6. Avoid package-specific configuration until a real consumer need appears.
   Configuration is part of the public API and should not be added merely to
   make the current personal setup configurable.

The repository root README explains the collection, compatibility policy,
development workflow, and links to each package. Each package README is the
single user-facing description for **both** its npm registry page and Pi gallery
page. It must include:

- one-sentence purpose and behavior boundaries;
- installation: `pi install npm:@<scope>/<package>`;
- a minimal usage example and commands/shortcuts it adds;
- compatibility and non-interactive-mode behavior;
- configuration, if any;
- privacy/security behavior and known limitations;
- local-development and contribution instructions.

## Extension migration

### 1. `@<scope>/pi-inline-skills`

Move the implementation from `agent/extensions/inline-skills.ts` with its
existing behavior:

- `$`-triggered autocomplete over loaded Pi skills;
- `$name` expansion into the skill content at user-message submission;
- markdown transformation that renders previously expanded content back to
  `$name` in the transcript;
- normal Pi autocomplete delegation for all non-skill input.

Before release, define and test the public behavior:

- allowed skill-name characters and the behavior for unknown skills;
- no expansion within malformed or escaped references, if an escape rule is
  introduced;
- skill-body read failure reports an actionable error and leaves the input
  unchanged;
- TUI-only autocomplete is not registered in non-TUI modes, while expansion
  remains mode-safe;
- generated skill markup and source path handling preserve multiline input.

The README should frame this as a shorthand for inserting an already-loaded Pi
skill, not as a separate skill loader or a method to bypass Pi's skill and trust
model.

### 2. `@<scope>/pi-model-guard`

Move the implementation from `agent/extensions/model-guard.ts` with its
existing behavior:

- permit freely selecting a model before the first completed turn;
- track an in-session live model change after a turn;
- show the pending switch and provide `ctrl+alt+m` plus `/model-undo`;
- prompt before sending the next interactive, non-empty prompt;
- restore the model and preserve the typed prompt when the user declines;
- retain the original source model across chained switches.

Before release, make the TUI/non-interactive contract explicit and test it:

- no UI calls or terminal-only assumptions in print, JSON, or RPC modes;
- a non-interactive run must never block indefinitely waiting for confirmation;
- model restoration failures leave a clear user-visible result in TUI mode;
- session resume and model-restore events do not create a false pending switch;
- conflicting shortcut behavior is documented.

Do not add a separate model picker or favorites list. Pi's `enabledModels`
setting already owns that behavior.

### 3. Remove duplicate local loading

After each package has passed local integration tests and been published:

1. Install it into the shared Pi configuration with `pi install
   npm:@<scope>/<package>`.
2. Start a fresh Pi session and verify the package loads exactly once.
3. Remove the corresponding local file from `agent/extensions/`.
4. Keep the remaining private extension files and their behavior unchanged.
5. Confirm profile symlinks continue to share the package configuration as
   intended.

Do not remove a local extension before its package installation has been
validated; loading both would register duplicate handlers, commands, and
shortcuts.

## Vite+ and workspace implementation

Use Vite+ as the local, versioned toolchain rather than requiring a globally
installed CLI. Pin Node and pnpm in `.tool-versions`, aligned with the current
pnpm workspace convention in the reference repositories. Add Vite+ and the
shared developer tools at the root.

Root configuration in `vite.config.ts` should own:

- Oxfmt defaults;
- Oxlint defaults;
- Vitest defaults;
- workspace-wide `vp run` tasks and cache behavior;
- any package-specific overrides only when the package genuinely differs.

The root scripts should present a small stable interface:

```text
pnpm format          format workspace source
pnpm format:check    verify formatting
pnpm lint            lint workspace source
pnpm typecheck       typecheck all packages
pnpm test            run unit tests
pnpm verify          format check + lint + typecheck + test + package smoke checks
```

Use `vp` under those scripts so local development and CI use the same tool.
Use Vite Task for workspace-wide, cacheable orchestration. Keep individual
package scripts where each package owns the work; do not create wrapper layers
that merely forward commands.

Do not use `vp pack` for these initial packages. Vite+ uses tsdown for library
artifacts, but Pi's documented package model loads `.ts` extension entrypoints
directly. Add a build step only if Pi changes that contract or a package later
exports a normal Node/browser library alongside its Pi resource.

Tests should be behavior-focused and local to each package. Use lightweight Pi
API/context fixtures for unit tests, plus a manual Pi integration smoke test
for extension lifecycle and TUI behavior. Add a package tarball test that
checks the `files` allowlist and verifies the manifest's extension entrypoint
is present.

## CI and publishing

### Pull request and main CI

Create `.github/workflows/ci.yml`:

1. Run on pull requests and pushes to `main` when workspace source,
   configuration, lockfile, or workflow files change.
2. Check out the repository.
3. Set up pinned pnpm and Node from `.tool-versions`.
4. Install with `pnpm install --frozen-lockfile`.
5. Restore Vite Task's `node_modules/.vite/task-cache` after dependency setup;
   Vite+ documents this location and ordering.
6. Run `pnpm verify`.
7. Save the Vite Task cache only after a successful check.
8. Run a dependency audit as a separate visible step or scheduled workflow;
   do not make a toolchain experiment silently widen dependency-update scope.

This uses Vite+'s local task cache first. Do not add a second remote cache
provider until CI duration demonstrates that GitHub Actions cache is
insufficient for this two-package repository.

### Tagged releases and publishing

Do not infer releases from commit messages. These packages retain the existing
imperative commit style; a maintainer explicitly decides when an extension
change deserves a versioned release and selects its semver bump.

The release preparation change updates exactly one extension package's
`package.json` version. It may be part of the feature PR or a small follow-up
release PR. No generated or hand-maintained `CHANGELOG.md` is required.

After that version change has merged to `main`, create and push an immutable,
package-qualified tag for the exact version:

```text
pi-inline-skills-v0.1.0
pi-model-guard-v0.1.0
```

Package-qualified tags permit both independently versioned packages to publish
`0.1.0` without ambiguity. Protect the tag namespace so only maintainers can
create release tags.

Create one `.github/workflows/publish.yml`, triggered only by matching tag
pushes. It parses the package name and version from the tag, maps the name
through an explicit allowlist to its workspace directory, and fails unless:

- the tag maps to exactly one workspace package;
- the tag version exactly equals that package's committed `package.json`
  version;
- the tagged commit is reachable from `main`;
- npm does not already contain that immutable package version.

The workflow must:

1. Require a protected GitHub Environment such as `npm-publish` for the publish
   job.
2. Grant `contents: write` to create the GitHub Release and `id-token: write`
   for npm OIDC; do not grant an npm package token.
3. Use a GitHub-hosted runner and current npm/Node compatible with npm trusted
   publishing.
4. Install from the lockfile, run package-filtered verification, and run a
   dry-run tarball inspection before publishing.
5. Publish only the package selected by the tag with public access.
6. Create a GitHub Release from that same tag after the npm publish succeeds.

GitHub Releases are the public version history. A release body should be short:
the package and version, plus links to the relevant PRs when user-facing context
helps. PR descriptions remain the detailed rationale and verification record.
GitHub's built-in generated release notes use PR titles and labels, not PR
bodies, and are not reliably package-path aware when multiple package tags
interleave; do not treat generated notes as a package changelog.

Before the first release of each package, configure npm trusted publishing for
that individual package, bound to this GitHub repository and the exact
`publish.yml` filename. This is a one-time npm-side setup. OIDC trusted
publishing avoids an `NPM_TOKEN`; public repository publishes receive npm
provenance automatically.

Do not add Release Please or Changesets initially. Revisit release automation
only if external consumers and release frequency make explicit version decisions
or short GitHub Release notes a demonstrated burden.

## Implementation order

1. **Create the repository and baseline workspace.**
   - Choose repository URL, npm scope, license, Node/pnpm versions, and
     visibility.
   - Scaffold the pnpm workspace and Vite+ root configuration.
   - Add strict shared TypeScript defaults following the reference repositories:
     `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
     `isolatedModules`, `verbatimModuleSyntax`, declarations, and Node types.
   - Establish `pnpm verify` and CI before moving extension code.

2. **Extract and harden inline skills.**
   - Port source without changing its intended behavior.
   - Add focused tests, package manifest, README, tarball validation, and local
     Pi smoke test.
   - Publish `0.1.0`, install it into Pi, then remove the local duplicate.

3. **Extract and harden model guard.**
   - Port source without introducing a model-picker feature.
   - Add mode/lifecycle tests, manifest, README, tarball validation, and local
     Pi smoke test.
   - Publish `0.1.0`, install it into Pi, then remove the local duplicate.

4. **Document ongoing release and maintenance work.**
   - Add a short contributor section covering explicit semver decisions,
     package version updates, package-qualified tag creation, GitHub Releases,
     and npm trusted-publisher onboarding.
   - Verify npm pages, Pi gallery discovery, `pi install`, `pi list`, and
     `pi update` for each package.

5. **Reassess the footer only after real use.**
   - Record repeated requirements from actual users.
   - If a public contract emerges, publish one configurable footer package that
     treats extension statuses generically.
   - Do not make a custom-component framework unless multiple independent
     footer packages need a shared, stable composition contract.

## Completion criteria

- The public monorepo has a green CI workflow and reproducible pnpm install.
- `pi-inline-skills` and `pi-model-guard` each have an independent npm package,
  Pi manifest, README, license, tests, and package-content validation.
- Both packages can be installed separately with `pi install npm:...` and are
  discoverable through the `pi-package` keyword.
- Both packages publish through an OIDC trusted-publishing GitHub workflow
  triggered by their package-qualified tags; no npm write token is stored in
  GitHub secrets.
- The shared Pi setup loads the published versions once each.
- `inline-skills.ts` and `model-guard.ts` are removed from the local dotfiles
  extension directory only after that validation.
- The footer, guardrails, YOLO, and phase shortcuts remain local and unchanged.

## Research basis

- Pi packages are ordinary npm packages. Their `pi` manifest declares resources,
  `pi-package` enables gallery discovery, host Pi libraries are peer
  dependencies, and Pi loads TypeScript extensions directly without a build:
  [Pi Packages](https://pi.dev/docs/latest/packages) and the local Pi package
  documentation.
- Vite+ provides workspace-aware `vp run`, dependency ordering, task caching,
  Oxfmt, Oxlint, Vitest, and tsdown. Root `vite.config.ts` owns shared monorepo
  configuration; its GitHub Actions guidance caches
  `node_modules/.vite/task-cache` after dependency setup:
  [Vite+ monorepos](https://viteplus.dev/guide/monorepo),
  [Vite Task](https://viteplus.dev/guide/run), and
  [GitHub Actions cache](https://viteplus.dev/guide/github-actions-cache).
- Vite+'s `vp pack` is tsdown library packaging. It is intentionally excluded
  from the initial design because Pi's documented extension-loading model is
  source TypeScript:
  [Vite+ pack](https://viteplus.dev/guide/pack).
- npm trusted publishing for GitHub Actions needs `id-token: write`, a
  GitHub-hosted runner, and an npm trusted-publisher association per package;
  it removes long-lived tokens and publishes provenance for public packages:
  [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
- GitHub-generated release notes group merged PRs by title and labels, not PR
  descriptions. They are therefore a useful repository-level summary but not a
  reliable per-package changelog for interleaved monorepo releases:
  [GitHub generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes).
