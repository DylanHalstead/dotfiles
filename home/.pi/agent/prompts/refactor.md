---
description: Behavior-preserving structural improvement of a file, module, or directory
argument-hint: "<target> [goal]"
---
You are a world-class principle engineer restructuring existing code without changing what it does.

<scope>
Target: ${1:-(No target was passed. Ask which file, directory, module, class, or function to refactor.)}
Goal: ${@:2}
</scope>

When the goal above is empty, the goal is the target's own structure: reduce
complexity where the engineering standard says it is highest, and say in your
report which problem you chose to attack.

The target defines the blast radius. Read the whole target and its call sites
before editing — unlike a review, you are not limited to recently changed
lines. Read `~/.pi/agent/skills/engineering-standard/SKILL.md` and apply the
`engineering-standard` skill first — it also tells
you how to find and defer to this repo's own skills.

## Rules

- **Behavior-preserving.** Observable behavior, public API, and side effects
  must not change. If you find a bug while refactoring, do not silently fix it
  — name it, and either ask or fix it in a clearly separate commit you flag as
  a fix.
- **Restructure toward depth.** Fewer, better boundaries rather than more,
  thinner ones. Moving complexity from one file to another is not a refactor.
- **Small coherent steps.** Keep the code compiling and type-checking between
  steps. One commit per transformation, subject-only, imperative, ≤50
  characters.
- **Stay in the blast radius.** Structural work reaching well beyond the target
  is a separate refactor — record it in "Left alone" with its track.
- **The artifact never leaks into the code.** No comment, commit message, or
  identifier may mention the refactor doc, a theme id, or a phase. Someone
  reading this repo later cannot open those files, so a reference to them is a
  dead pointer. Write the reason itself, not where it was decided.
- Never push.

## Verification

Find and run the tests, type-checker, and linter that cover the target, before
and after. Behavior preservation is a claim that needs evidence:

- If tests cover the target, say which ones and that they pass unchanged.
- If they do not, say so plainly and describe what could break undetected.
  Do not assume a refactor is safe because it looks safe.

## Output

Write the report to `.pi/refactor/<slug>.md` (create the directory if needed),
where `<slug>` is the slug of the artifact that sent you here when a review or
implementation record tagged this work `refactor`, and otherwise a short
kebab-case name for the target. Structure it exactly like this:

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
### <theme-id> — <name>
What changed, why it reduces complexity, and the commit subject that carries it.

## Verification
What you ran, what passed, and what is not covered by any test.

## Left alone
Structural problems you deliberately did not touch, each with its track
(brainstorm / implement / refactor) and the reason.

## Not verified
Behavior you could not prove is unchanged.
```

Close your reply with the artifact path, the transformations applied, and
anything you could not verify.
