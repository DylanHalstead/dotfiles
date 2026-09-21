---
description: Review a branch diff, path, or module in a find-then-verify pass
argument-hint: "[--save] [target]"
---
Review code and produce findings that survive adversarial re-examination — not
a list of everything you noticed.

<scope>
Target: ${@:-this branch's changes vs the default branch}
</scope>

Establish the scope and review kind before reviewing:

- **No target given — change review.** Review this branch's changes. First use
  `gh` to inspect the upstream PR, if one exists: read its description for
  change intent and use its base branch for the range. Otherwise find the
  default branch (`git symbolic-ref refs/remotes/origin/HEAD`, falling back to
  `main` then `master`). Work from `git diff <merge-base>...HEAD`. Report which
  range you used.
- **A path — static audit.** Review that file, directory, or module in full,
  including its call sites. You are not limited to recently changed lines.
- **A plan file — change review.** For a path under `.pi/plan/`, read it, review
  the branch changes it produced, and add one question to the pass: did the
  change deliver what the plan specified? A checked step that did not fully
  land is a finding.
- **The repository — static audit.** Do not try to read everything. Start from
  entry points, module boundaries, and the highest-traffic paths, then follow
  the evidence. Say what you sampled and what you deliberately skipped.

## Discipline

This is a read-only pass. Describe the fixes; do not apply them. Do not write
or edit source files, use shell redirects or heredocs, create temp or scratch
files, or commit anything. Write a review artifact only when the target
contains `--save`; remove that marker before establishing scope. Running the
existing tests and type-checker is encouraged.

Read `~/.pi/agent/skills/engineering-standard/SKILL.md` in full. Follow its
instructions to identify and load every repository skill that matches this task
before judging anything. When the review covers substantial feature work,
structural refactoring, or material API, module, abstraction, or architecture
changes, also read
`~/.pi/agent/skills/software-design-philosophy/SKILL.md` in full. When business
invariants or domain boundaries are central, also read
`~/.pi/agent/skills/domain-driven-design/SKILL.md` in full. Repository skills
matter most here: a repository that
ships its own review skill has already decided what its reviews are about, and
that decision outranks this checklist.

## Pass 1 — find

For a change review, scan every hunk line by line and read each enclosing
function: a change is often correct in isolation and wrong in context. Bugs in
untouched lines of touched code are in scope. For a static audit, inspect the
selected code and its callers against the same checklist; do not invent a diff.

Probe each line against this checklist, and say what you are checking for
rather than skimming for a general feeling of wrongness:

- inverted or off-by-one conditionals; boundary values
- null / undefined dereference, and optional chaining that hides a real bug
- missing `await`, unhandled rejection, fire-and-forget async
- falsy-zero and empty-string confusion in truthiness checks
- copy-paste slips: the wrong variable, index, or field in a repeated block
- swallowed exceptions and errors turned into silent defaults
- resource leaks: unclosed handles, unbounded growth, missing cleanup
- concurrency: shared mutable state, races, missing idempotency
- security: injection, unvalidated input crossing a boundary, secrets in logs

Collect candidates. Do not filter yet.

## Pass 2 — verify

Re-examine each candidate adversarially: try to prove it is not a bug. Classify
each one and keep the evidence.

- **CONFIRMED** — you can name the inputs or state that trigger it and the
  wrong output or failure that results. State them.
- **PLAUSIBLE** — the mechanism is real but the trigger is uncertain. State
  what evidence would confirm or refute it.
- **REFUTED** — quote the code that guards against it. Drop it.

Only CONFIRMED and PLAUSIBLE candidates reach the synthesis pass. A candidate
you cannot substantiate costs the author more than it saves.

## Pass 3 — write the review

Write findings as [Conventional Comments](https://conventionalcomments.org/).
The internal certainty labels guide reasoning; do not expose them in the final
review.

Map candidates to comments:

- A confirmed problem that must be fixed before merge becomes
  `issue (blocking)`.
- A confirmed problem that does not block merge becomes `issue`.
- A plausible concern whose trigger or contract remains uncertain becomes a
  `question`. State what would confirm or dismiss it.
- An improvement with no demonstrated defect becomes
  `suggestion (non-blocking)`.
- A minor preference with practical value becomes `nitpick`. Omit formatter
  output and taste with no concrete impact.
- A refuted candidate is omitted.

Comment on the code, not the author. Lead with the observed behavior or risk,
then explain the trigger and impact. Explain why when it is not obvious. Give a
concrete direction for a fix without requiring the exact implementation unless
the contract leaves only one sound choice.

After writing the comments, check whether several share one root cause. Merge
them when one coordinated change would fix them. Otherwise, keep them separate.
Do not manufacture a pattern or repeat findings under a second taxonomy.

## Output

Present the review in the reply by default. When the target contains `--save`,
write it to `.pi/review/<slug>.md` (create the directory if needed), where
`<slug>` is the upstream artifact's slug when reviewing from one, and otherwise
the branch name or a short kebab-case name for the target. Use the sections
below in either destination. Include the YAML frontmatter only in a saved
artifact:

```markdown
---
phase: review
slug: <slug>
source: <plan file path, or "none">
date: <YYYY-MM-DD>
skills: <repo skills you loaded, or "none">
---

# Review: <target>

**Verdict:** approve | comment | request changes

<One or two sentences explaining the merge decision.>

## Findings

### `<file>:<line>`

**issue (blocking): <concise consequence or required change>**

<Observed behavior, triggering state, and concrete impact.>

**Suggestion:** <a sound direction for the fix>

### `<file>:<line>`

**question: <the unresolved contract or behavior>**

<Why the concern is credible and what evidence would settle it.>

(repeat in merge-impact order; use the appropriate Conventional Comment label)

## Systemic Pattern

<Include only when at least two findings share one root cause and one
coordinated change would address them. Cite representative locations.>

## Not Verified

<Untested paths, code not read, or behavior that depends on runtime state not
traced.>
```

Omit empty sections. Do not add praise to fill space. Mention good work only
when it teaches a useful practice or affects the verdict. Mark a problem as
pre-existing in its comment when the change makes it worse; do not create a
separate inventory of unrelated debt.

Close with the verdict and the single most serious finding. If you saved an
artifact, include its path.
