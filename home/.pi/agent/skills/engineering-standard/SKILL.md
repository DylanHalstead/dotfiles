---
name: engineering-standard
description: "Applies the house engineering standard to software work: repository conventions, scope control, local patterns, readability, idiomatic code, performance, scalability, and evidence-based findings. Use for any request to plan, implement, review, evaluate, or refactor code. Load relevant repository skills alongside it."
---

# Engineering standard

Apply this whenever you design, write, or judge code. Scale the process to the
task's uncertainty and risk. A mechanical change needs local context and a
focused check; a material design needs alternatives and broader verification.

## Conventions

When guidance conflicts, follow this order:

1. Explicit project instructions in `AGENTS.md`, `CLAUDE.md`, project skills,
   lint, formatter, and compiler configuration.
2. Patterns established in the codebase for names, modules, errors, logs,
   tests, and dependencies.
3. Idioms of the language, framework, and standard library in use.
4. General best practices.

Safety rules and explicit user authorization remain global constraints.

## Use the repository's skills

Load each available repository skill whose description covers a concern in
scope. Defer to the skill that owns that concern instead of restating its rules
through this standard.

Keep findings clean:

- **One finding, one owner.** Report an overlapping concern once under the
  skill that best owns it.
- **Name what you used.** List loaded skills in a persisted artifact so a
  reader can trace the judgment.

For a material change, read two or three comparable implementations to learn
the local pattern. For a small or mechanical change, inspect only enough nearby
code to establish the convention. Name representative files when the pattern
supports a design decision. Do not call a generic best practice an improvement
when it fights a sound local convention.

Read `~/.pi/agent/skills/software-design-philosophy/SKILL.md` in full for
substantial feature work, structural refactors, or changes to module boundaries,
APIs, abstractions, or architecture. Read
`~/.pi/agent/skills/domain-driven-design/SKILL.md` in full when business
invariants or domain boundaries are central to the task.

## Scope and design

Every changed line must trace to the request. Fix the root cause and inspect
other callers of the shared behavior before patching one symptom. Do not mix
unrelated cleanup into the change. Remove imports, variables, and functions
that your change makes dead; report pre-existing dead code instead of expanding
the diff.

For a material design decision, compare an alternative built around a
different constraint and prefer the option that removes the most complexity.
Do not manufacture a second design for a local fix whose shape follows an
established pattern.

Add an abstraction only when it enforces an invariant, hides non-obvious
complexity, or removes duplication callers would otherwise get wrong. Prefer a
simple interface over a simple implementation and keep side effects visible in
names and orchestration.

Comments explain contracts, rationale, invariants, assumptions, and non-obvious
trade-offs. They must make sense without this conversation, a plan, or a review
thread. Do not restate code. Document a deliberate simplification when it has a
known ceiling, including what would force a more complex design.

## Quality bars

Hold changed code to all four. When they conflict, state the trade-off.

- **Readable:** Make code obvious on a first read. Use precise names, explicit
  data flow, and early returns over deep nesting. Avoid clever code without a
  comment that earns it.
- **Idiomatic:** Follow this codebase and its language rather than translating
  patterns from another ecosystem. Prefer the standard library and platform
  constructs already in use.
- **Performant:** Avoid needless allocation, repeated work, and avoidable I/O.
  Start independent async work concurrently and await it late. Match data
  structures to access patterns.
- **Scalable:** Check behavior as input, data volume, and concurrency grow.
  Look for accidental quadratic scans, unbounded caches and buffers, N+1
  queries, missing pagination or backpressure, and unsafe shared state.

Performance claims need evidence. Point to a round trip, allocation, scan, lock,
or measurement. Do not sacrifice clarity for an unmeasured hot path.

## Domain modeling

Do not apply DDD by default. Read
`~/.pi/agent/skills/domain-driven-design/SKILL.md` in full when the work changes
business rules, invariants, model boundaries, or service boundaries. Skip it
for scripts, infrastructure glue, and CRUD with no meaningful domain invariant.

## Review findings

Report a concern only when you can show a reachable failure, violated
requirement, regression, or material risk. State the relevant code path and the
evidence that supports the claim. Keep honest uncertainty visible: identify
what runtime value, test, or contract would confirm a plausible concern.

After verifying findings, check whether several share one root cause. Merge
them when one coordinated change would fix them; otherwise, keep them separate.
Do not create a category solely to group unrelated findings.

For broad static audits or refactor planning, report a systemic pattern only
when it has at least two concrete instances and changes the remediation. Give
the pattern a plain name, cite representative locations, explain the shared
cost, and propose the coordinated fix. A single severe finding remains a
finding.

Order findings by merge impact and then blast radius. Lead with the findings
that reduce the most risk or complexity.

## Honest uncertainty

Say what you did not check. “Not covered by tests,” “could not verify without
running the migration,” and “depends on a runtime value I did not trace” are
complete findings. Do not write confident conclusions about code you did not
inspect.
