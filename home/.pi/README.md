# Pi

## Accounts

`pi` uses the work account; `pi -p personal` uses the personal account. Set
`PI_PROFILE` to change the default. Accounts have separate credentials and share
settings, prompts, skills, and extensions.

After [installation](../../README.md#install), run `pi -p personal` and `/login`
to connect the personal account. `pi-profile personal` refreshes its shared
links without replacing credentials or real directories. Account selection does
not change the mise environment.

## Prompt workflow

Use `/spec` to work through a problem and agree on behavior, scope, and acceptance
criteria. Research and design happen in that discussion. It stops before
execution planning unless you ask to continue. Save the spec only when useful
for approval or a handoff.

`/plan` turns the agreed result into atomic, verifiable steps. `/implement`
executes those steps and checks the result against the requirements. Both also
accept a scoped request; `/implement` can work directly from a spec.

- `/brainstorm` investigates alternatives when you want a research pass.
- `/review` checks code and reports findings without editing it.
- `/refactor` changes code structure while preserving behavior.

These commands are optional. A clear request to build or fix something can go
straight to implementation. Ask for a spec or plan when you want to review it
before proceeding.

Saved specs default to `.pi/spec/<slug>.md`; plans use `.pi/plan/<slug>.md` and
carry execution progress. The spec owns requirements and decisions; the plan
links to it without repeating them. Reuse the slug across artifacts.

See the [prompt templates](agent/prompts/) for arguments and saving options,
and [local guardrails](agent/extensions/local-guardrails/README.md) for path
permissions and YOLO controls.
