---
description: Decompose a brainstorm doc or a request into atomic, hand-off-able steps
argument-hint: "<brainstorm-file-or-request>"
---
Produce a plan another engineer can execute verbatim with no context beyond the
plan and the repository. Treat it as a complete, detailed ticket for a mid-level
engineer.

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

1. Read `~/.pi/agent/skills/engineering-standard/SKILL.md` in full. Follow its
   instructions to identify and load every repository skill that matches this
   task before designing anything.
2. Understand the requirements. Ask clarifying questions before planning if
   the request is ambiguous. Ask at any point in the process, not only at the
   start; a wrong assumption is cheaper to fix now than in the executor's
   session.
3. Explore: read the affected files, extract the local conventions from 2-3
   comparable implementations, and trace the code paths the change touches.
4. Design it twice. Sketch a genuinely different second approach, then say why
   you chose the one you chose. Prefer the design that removes the most
   complexity, not the one that is fastest to write.
5. Decompose into steps. Each step is **one atomic commit**: one reversible
   intent, deliverable by an engineer with no other context.

The atomicity test is the commit subject. Write it before the step: imperative
mood, ≤50 characters, no "and". A step whose subject needs "and" is two steps.

## Output

Write the plan to `.pi/plan/<slug>.md` (create the directory if needed), where
`<slug>` is a short kebab-case name. When planning from a brainstorm doc,
reuse that doc's slug unchanged — the slug is what chains the artifacts
together. Structure it exactly like this:

```markdown
---
phase: plan
slug: <slug>
source: <brainstorm artifact path, or "none">
date: <YYYY-MM-DD>
skills: <repo skills you loaded, or "none">
---

# Plan — <goal> — <date>

## Context & goal
One paragraph: what we are building and why. State the approach in one
sentence so the executor never has to infer it.

## Chosen design
The design, and the alternative you rejected with the reason you rejected it.

## Steps
- [ ] **1.** <what this step accomplishes>
      - Commit: `<imperative subject, ≤50 chars, no "and">`
      - What: <files and functions, the concrete change — verbose enough to
        hand off cold>
      - Verify: <the command to run or the observation that proves it worked>
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

## Anticipated challenges
The parts most likely to go wrong, and what the executor should do about each.

## Out of scope
Problems found while exploring that are real but not part of this plan, each
tagged with its track (brainstorm / implement / refactor) so nothing is lost.

## Not verified
Assumptions you could not confirm, and what would confirm them.
```

The plan is handed to a fresh session, so it must stand alone: no "as
discussed above", no references to this conversation.

Close your reply with the artifact path, the step count, and the single
riskiest step — not "Done."
