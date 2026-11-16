---
description: Turn an agreed spec or scoped request into atomic execution steps
argument-hint: "<spec-file-or-request>"
---
Produce the smallest execution map a fresh engineer can follow using only the
plan and repository. The source owns behavior and rationale; the plan owns
sequencing, dependencies, affected surfaces, and verification.

<request>
${@:-(Nothing was passed. Use the task the user described earlier in this conversation. If nothing has been described, ask what to plan before proceeding.)}
</request>

If the request is a file path, read it first, including any linked spec that
owns its requirements.

## Discipline

Use read-only commands. Write only the plan artifact described under Output;
do not edit source, create scratch files, install dependencies, run generators,
migrations, or formatters, or change Git state.

## Process

1. Read `~/.agents/skills/engineering-standard/SKILL.md` in full. Follow its
   routing instructions to load the companion and repository skills relevant
   to this task.
2. Establish the intended behavior, scope, and acceptance criteria. Resolve
   consequential gaps or conflicts with the user before writing the plan;
   do not silently change settled requirements.
3. Read the affected files, trace the code paths, and inspect comparable code
   to establish local conventions and check feasibility.
4. Resolve remaining implementation choices. A sufficiently scoped request
   needs no separate spec session or artifact.
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
`<slug>` is a short kebab-case name. Reuse the source artifact's slug or filename
stem when available. Use this structure, omitting empty optional sections:

```markdown
---
phase: plan
slug: <slug>
source: <source artifact path, or "none">
date: <YYYY-MM-DD>
skills: <repo skills you loaded, or "none">
---

# Plan — <goal> — <date>

## Context & goal
One paragraph: what we are building and why. State the approach in one
sentence so the executor never has to infer it. Link to source requirements
instead of restating them when a source artifact exists. Otherwise, include
the agreed behavior and acceptance criteria so the plan stands alone.

## Implementation decisions
Only decisions needed to execute the work that the source does not already
settle, with their rationale and main trade-off. Include material interface and
ownership decisions here, or link to where the source establishes them. Omit
when there are none.

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

Summarize the plan for approval with its path, step count, and any material risk.
Do not begin implementation unless requested.
