---
description: Behavior-preserving structural improvement of a file, module, or directory
argument-hint: "<target> [goal] [--save]"
---
Restructure existing code without changing what it does.

<scope>
Target: ${1:-(No target was passed. Ask which file, directory, module, class, or function to refactor.)}
Goal: ${@:2}
</scope>

If the goal contains `--save`, remove that marker before interpreting it and
save the report described under Output. Otherwise, report in the reply only.

When the goal above is empty, inspect the target for a concrete structural
problem justified by the engineering standard and say which problem you chose.
If no worthwhile transformation has enough evidence, report that result instead
of forcing a change.

The target defines the blast radius. Read the whole target and its call sites
before editing — unlike a review, you are not limited to recently changed
lines. Read `~/.pi/agent/skills/engineering-standard/SKILL.md` and
`~/.pi/agent/skills/software-design-philosophy/SKILL.md` in full before
restructuring anything. Follow their instructions to identify and load every
repository skill that matches this task. When business invariants or domain
boundaries are central, also read
`~/.pi/agent/skills/domain-driven-design/SKILL.md` in full.

## Rules

- **Behavior-preserving.** Observable behavior, public API, and side effects
  must not change. If you find a bug while refactoring, do not silently fix it
  — name it, and either ask or fix it in a clearly separate commit you flag as
  a fix.
- **Restructure toward depth.** Fewer, better boundaries rather than more,
  thinner ones. Moving complexity from one file to another is not a refactor.
- **Subtract first.** Look for code, state, indirection, and special cases to
  remove before adding an abstraction. Add one only when it removes duplicated
  decisions, hides non-obvious complexity, or makes an invalid state impossible.
- **Small coherent steps.** Keep the code compiling and type-checking between
  steps. One commit per transformation, subject-only, imperative, ≤50
  characters.
- **Stay in the blast radius.** Structural work reaching well beyond the target
  is a separate refactor — record it in "Left alone" with the reason and next
  action, if one is warranted.
- **The artifact never leaks into the code.** No comment, commit message, or
  identifier may mention the refactor report or one of its headings. Someone
  reading this repo later cannot open those files, so a reference to them is a
  dead pointer. Write the reason itself, not where it was decided.
- Never push unless the supplied scope explicitly requests it. Every push still
  requires the interactive confirmation enforced by the global guardrails.

## Verification

Find and run the tests, type-checker, and linter that cover the target, before
and after. Behavior preservation is a claim that needs evidence:

- If tests cover the target, say which ones and that they pass unchanged.
- Before a risky transformation without adequate coverage, add the smallest
  characterization test or equivalence check that pins the behavior being
  preserved. If that is outside scope, limit the transformation to what the
  available evidence supports.
- If coverage is still incomplete, say what could break undetected. Do not
  assume a refactor is safe because it looks safe.
- If a preservation check fails, fix the break introduced by that transformation
  or revert that transformation. Do not weaken the check.

## Output

Present the report in the reply by default. When `--save` was passed, write it
to `.pi/refactor/<slug>.md` (create the directory if needed), where `<slug>` is
the upstream artifact's slug when a review or implementation record sent the
work here, and otherwise a short kebab-case name for the target. Use the
sections below in either destination. Include the YAML
frontmatter only in a saved artifact:

```markdown
---
phase: refactor
slug: <slug>
source: <artifact path that tagged this work, or "none">
date: <YYYY-MM-DD>
skills: <repo skills you loaded, or "none">
---

# Refactor — <target> — <date>

## Transformations
### <plain description of the structural change>
What changed, why it reduces complexity, and the commit subject that carries it.

## Verification
What you ran, what passed, and what is not covered by any test.

## Left alone
Structural problems you deliberately did not touch, why they were excluded,
and the next action if one is warranted.

## Not verified
Behavior you could not prove is unchanged.
```

Close with the transformations applied and anything you could not verify. If
you saved an artifact, include its path.
