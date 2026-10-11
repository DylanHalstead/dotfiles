---
description: Turn an agreed design or scoped request into atomic execution steps
argument-hint: "<design-file-or-request>"
---
Produce the smallest execution map a fresh engineer can follow using only the
plan and repository. The source owns behavior and rationale; the plan owns
sequencing, dependencies, affected surfaces, and verification.

<request>
${@:-(Nothing was passed. Use the task the user described earlier in this conversation. If nothing has been described, ask what to plan before proceeding.)}
</request>

If the request above is a file path, read that file first and treat it as the
`<context>` for this plan.

## Discipline

This is a planning pass. Produce no changes of any kind. Specifically, do not:

- write or edit any source file
- run shell redirects (`>`, `>>`, `tee`) or heredocs that create files
- create temp files, scratch files, or scaffolding "to test an idea"
- run migrations, installs, generators, or formatters
- commit, stage, or stash anything

The only file you write is the plan artifact described under Output. Read,
search, and run read-only commands freely.

## Process

1. Read `~/.agents/skills/engineering-standard/SKILL.md` in full. Follow its
   routing instructions to load the companion and repository skills relevant
   to this task.
2. Understand the requirements. Ask clarifying questions before planning if
   the request is ambiguous. Ask at any point in the process, not only at the
   start; a wrong assumption is cheaper to fix now than in the executor's
   session.
3. Explore: read the affected files, trace the code paths the change touches,
   and inspect enough comparable code to establish the local conventions.
4. If material design choices remain unresolved, investigate and discuss them
   with the user before writing the plan. Otherwise, plan directly from the
   agreed design or sufficiently scoped request. Do not require a separate
   design session.
5. Decompose into steps. Prefer narrow vertical slices that leave the repository
   coherent over separate layer-by-layer tasks. For a wide migration that
   cannot land as vertical slices, use expand-contract: add the new form,
   migrate callers in safe batches, verify, then remove the old form. Each step
   is **one atomic commit**: one reversible intent, deliverable by an engineer
   with no other context.

The atomicity test is the commit subject. Write it before the step: imperative
mood, ≤50 characters, no "and". A step whose subject needs "and" is two steps.

## Output

Write the plan to `.pi/plan/<slug>.md` (create the directory if needed), where
`<slug>` is a short kebab-case name. When planning from an existing design or
brainstorm artifact, reuse its slug if it has one. Structure it exactly like
this:

```markdown
---
phase: plan
slug: <slug>
source: <design or brainstorm artifact path, or "none">
date: <YYYY-MM-DD>
skills: <repo skills you loaded, or "none">
---

# Plan — <goal> — <date>

## Context & goal
One paragraph: what we are building and why. State the approach in one
sentence so the executor never has to infer it. Link to source requirements
instead of restating them when a source artifact exists.

## Chosen design
The design and its material constraints. For each material choice, include the
closest viable alternative and why it lost, or the evidence that eliminated
other approaches.

## Steps
- [ ] **1.** <what this step accomplishes>
      - Commit: `<imperative subject, ≤50 chars, no "and">`
      - What: <source criterion or behavior, affected files and functions, and
        the concrete change — enough to execute cold without rewriting the
        source>
      - Verify: <the command or observation and the reachable behavior or
        failure it proves>
      - Depends on: <step numbers, or "none">

(repeat per step)

## Critical files
The files most central to this change, each with one line on its role.
For a pattern repeated across many files, describe the pattern once and list
two or three representative paths.

## End-to-end verification
How to confirm the whole change works once every step is done — the command
to run, the test suite that covers it, or the concrete thing to exercise and
what correct looks like. Per-step Verify proves a step landed; this proves
the feature works.

## Risks and decisions
Only concrete risks that could change execution, and the evidence or decision
that resolves each. Omit this section when there are none.

## Out of scope
Relevant problems deliberately excluded from this plan, why they are excluded,
and the next action if one is warranted.

## Not verified
Assumptions you could not confirm, and what would confirm them.
```

The plan is handed to a fresh session, so it must stand alone: no "as
discussed above", no references to this conversation.

Close your reply with the artifact path, the step count, and the single
riskiest step — not "Done."
