---
name: engineering-standard
description: The house standard for designing, writing, and critiquing code — convention precedence, A Philosophy of Software Design principles and red flags, the readable/idiomatic/performant/scalable quality bars, and the themed-findings report format. Load before planning a change, implementing one, reviewing a diff, or refactoring a module.
---

# Engineering standard

Apply this whenever you design, write, or judge code. Each phase uses it in
its own mode: planning designs twice and prefers the design that removes the
most complexity; implementation holds new code to the quality bars; review
and refactor critique against the whole thing.

## Conventions (precedence order)

When guidance conflicts, the earlier item wins:

1. Explicit project instructions — AGENTS.md / CLAUDE.md, `.pi/principles.md`,
   lint, formatter, and compiler configs.
2. Repo-specific skills — any skill the repository itself ships. Pi discovers
   these from `.pi/skills/` and `.agents/skills/`, walking up from the working
   directory, and lists them in your system prompt.
3. Patterns already established in this codebase — how *this* repo names things,
   structures modules, handles errors, logs, tests, and wires dependencies.
4. Idioms of the language, framework, and standard library actually in use.
5. General best practices.

## Use the repo's own skills

Before judging anything, scan the skills available in this session and load
every one whose description covers a concern in scope — the repo's framework,
its UI or accessibility conventions, its review pillars, its domain
boundaries. A repo skill outranks this standard for the concern it owns:
defer to it rather than re-deriving that judgment from first principles here.

Two rules keep the results clean:

- **One finding, one owner.** When several skills cover overlapping ground,
  decide which one owns the concern and file the finding once under it. The
  same issue reported through three lenses reads as three problems.
- **Name what you used.** List the skills you loaded in your artifact. A
  reader who disagrees with a finding needs to know which authority produced
  it, and a reader who sees no repo skills listed needs to know whether the
  repo ships none or you missed them.

Before proposing anything, identify the stack and read 2-3 comparable existing
implementations to extract the local pattern. Say which file you learned it from.
A "best practice" that fights the codebase is a defect, not an improvement. If a
local pattern is genuinely harmful, do not quietly deviate — name it as its own
themed finding and argue for changing it deliberately.

## Design principles (A Philosophy of Software Design)

The enemy is complexity: change amplification (one decision forces edits in many
places), cognitive load (how much you must know to make a change), and unknown
unknowns (you cannot tell what a change will break). Judge every choice by
whether it reduces those.

Red flags — name them when you see them:

- Shallow module — interface nearly as complex as the implementation
- Information leakage — one design decision reflected across several modules
- Temporal decomposition — structure mirrors execution order, not abstraction
- Pass-through method — adds nothing but another hop and signature
- Repetition — the same decision expressed in several places
- Special-general mixture — special cases tangled into general-purpose code
- Comment repeats code — restates the "what" instead of the non-obvious "why"
- Vague name — too generic to convey meaning (data, info, manager, handle, util),
  or a generic verb on a public method (`call`, `do`, `process`) where the
  action has a name (`Extract`); in a domain, also a technical name where a
  domain term exists (`DataProcessor` for `ClaimAdjudicator`)
- Hard to describe — the interface needs a long explanation
- Non-obvious code — cannot be understood in a quick read

Principles to apply:

- Modules should be deep: simple interface, powerful implementation.
- Prefer a simple interface over a simple implementation; pull complexity
  downward, into the module, away from its callers.
- Different layers should have different abstractions. A layer that just
  forwards is not earning its place.
- Somewhat general-purpose interfaces are usually deeper than special-purpose.
- Define errors out of existence — design so the error case cannot arise, rather
  than adding another exception for the caller to handle.
- Design it twice: consider a genuinely different alternative before committing.
- Comments describe what the code cannot: rationale, invariants, units,
  boundaries, and the reason behind a non-obvious choice.
- A deliberate simplification with a known ceiling — a global lock, an O(n²)
  scan over a set assumed small, a naive heuristic — carries a comment naming
  the ceiling and what would force the upgrade. Undocumented, it reads as an
  oversight and the next reader either fixes it or trips over it.
- Design for ease of reading, not ease of writing.
- Complexity is incremental — small degradations are how systems rot, so treat
  them as real findings rather than noise.

## Domain modeling

Apply when a change touches business rules or the structure of a system that
encodes them. Skip it for scripts, glue, and CRUD with no invariant to protect
— naming a thing after the domain does not require inventing a domain.

- Ubiquitous language — name types, methods, and events after concepts a domain
  expert would recognize (`policy.underwrite()`, `OrderPlaced`), not technical
  scaffolding (`DataProcessor`, `process()`). Hard to name is a design signal:
  the model is probably wrong, not the vocabulary.
- Behavior lives with data — put invariants and rules inside the entity or value
  object they govern; services orchestrate, they do not hold the rules. An
  object that is only getters and setters is an anemic model, and the rules end
  up scattered and duplicated across callers.
- Prefer value objects — model a thing defined only by its attributes as
  immutable and replaceable (`Money`, `Address`), not an identity-bearing
  entity. Reserve entities for what stays the same thing across attribute
  changes.
- Small aggregates — one root enforces a consistency boundary; keep the cluster
  minimal and reference other aggregates by ID, not object reference. Immediate
  consistency inside the boundary, eventual consistency across it.
- Guard the boundary — translate every external model into your own at the seam
  (anti-corruption layer). A foreign schema that leaks into domain code couples
  your rules to something you do not control.
- Keep persistence out of the domain — the repository interface speaks the
  domain language (`findPendingOrders()`) and lives with the domain; the
  SQL/ORM implementation lives in infrastructure.
- Invest where it differentiates — deepen the model in the core domain; buy or
  reuse libraries for generic parts (auth, email, payments) and keep those
  adapters thin.

A bounded context is a model boundary, not a deployment unit. Start with modules
in a monolith; the same word (`Customer`) meaning different things in billing
and shipping is expected, not a bug to unify away.

## Quality bars

Hold the code to all four. When they conflict, say so explicitly and justify the
trade-off rather than silently picking one.

- Readable — obvious on a first read. Precise names, early returns over deep
  nesting, no clever code without a comment earning it.
- Idiomatic — reads like the language and this codebase, not like a translation
  from another ecosystem. Use the platform's own constructs and stdlib.
- Performant — no needless allocation, repeated work, or avoidable I/O.
  Eliminate request waterfalls: start independent async work concurrently and
  await it late. Use the right data structure for the access pattern (index maps
  and sets for repeated lookups, not nested scans).
- Scalable — behavior must hold as input size, data volume, and concurrency
  grow. Call out accidental O(n²) over collections that grow, unbounded caches
  and buffers, per-item queries inside loops (N+1), missing pagination or
  backpressure, and shared mutable state that breaks under concurrency.

Discipline: performance claims need evidence — point at the mechanism (an extra
round trip, a quadratic scan) or measure. Never trade away clarity for speed on
a hot path you have not established is hot.

## Group findings into themes

When reporting what you found (review, refactor), do not emit a flat list of
unrelated nits. Cluster what you find into *themes* — named, recurring concepts
specific to this codebase. A theme is the unit of work that a human can decide
on, schedule, and hand off.

Derive theme names from what is actually there. Do not force findings into a
fixed checklist, and do not invent a theme to fill a category. Coin new names
when the codebase shows a pattern that existing vocabulary does not capture.

A theme qualifies when it has 2+ instances, or 1 instance severe enough to stand
alone. Anything that fits neither stays in a short "one-off notes" list.

Report each theme as:

### <kebab-case-id> — <short human name>

- Principle: <red flag / convention / quality bar it violates>
- Evidence: <file:line>, <file:line> (2-4 concrete instances, more if they exist)
- Why it matters: <the concrete cost — what breaks, slows, or gets harder>
- Fix: <the strategy, not a diff>
- Track: brainstorm | implement | refactor
- Priority: critical | high | medium | low
- Effort: small | medium | large
- Risk: low | medium | high

Track names the phase that should handle it next:

- brainstorm — needs a human decision or more research before anyone touches it
- implement — a local, in-place fix that belongs in the current change
- refactor — a structural change reaching beyond the current change

Order themes by priority, then by blast radius. Lead with the ones that reduce
the most complexity, not the ones that are easiest to describe.

## Honest uncertainty

Say what you could not check. "Not covered by tests", "couldn't verify without
running the migration", and "this depends on the value of X at runtime, which I
did not trace" are complete, useful answers. Confident prose about code you did
not read is not.
