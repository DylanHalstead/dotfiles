---
description: Research a task and produce candidate approaches with a recommendation
argument-hint: "[--save] <topic>"
---
Research the problem before anyone commits to a solution. Compare real
alternatives where a material decision exists, then recommend the approach you
are willing to defend.

<request>
${@:-(No topic was passed. Use the task the user described earlier in this conversation. If nothing has been described, ask what to brainstorm before proceeding.)}
</request>

## Discipline

This is a research pass. Do not modify source files. You are choosing between
approaches, not building one. Write an artifact only when the request contains
`--save`; remove that marker from the topic before researching.

## How to research

1. Read `~/.pi/agent/skills/engineering-standard/SKILL.md` in full. Follow its
   instructions to identify and load every repository skill that matches this
   task. For substantial feature work, structural refactors, or material API,
   module, abstraction, or architecture decisions, also read
   `~/.pi/agent/skills/software-design-philosophy/SKILL.md` in full. When
   business invariants or domain boundaries are central, also read
   `~/.pi/agent/skills/domain-driven-design/SKILL.md` in full. The code quality
   bars do not require critiquing implementations you have not decided to
   build. Understand the request, and ask clarifying questions before
   researching if the goal is ambiguous.
2. Search the codebase efficiently: escalate `find` → `grep` → `read` rather
   than reading whole trees, and issue independent searches in parallel. Stop
   searching when you can name the constraint you were looking for.
3. Look outward when the answer is not local: existing libraries, how
   comparable systems solve this, and what the project's dependencies already
   provide. An approach that reuses something already installed beats one that
   adds a dependency. Research only facts that can change the recommendation.
   Never recommend an external tool from memory alone: check its current API at
   its repository or official docs, plus the maintenance signals relevant to
   the decision, such as its latest release or whether it is archived. Record
   what you checked so planning does not repeat the work.
4. Generate alternatives only where a real decision exists. Give each a
   different governing priority — for a feature: simplicity vs. performance;
   for a bug: root cause vs. containment; for a restructure: minimal change vs.
   clean boundary. If repository constraints or evidence leave one viable
   approach, name the alternatives they eliminated instead of inventing a
   second design. Distinguish reversible choices from decisions that are costly
   to undo, and spend comparison effort on the latter.
5. Judge each viable candidate by the complexity it adds or removes: change
   amplification (how many places must change together), cognitive load (how
   much someone must know to work on it), and unknown unknowns (how obvious it
   is what a change will break). Cost, risk, and effort come after that.

## Output

Present the result in the reply by default. When the request contains `--save`,
write it to `.pi/brainstorm/<slug>.md` (create the directory if needed), where
`<slug>` is a short kebab-case name derived from the topic.

A saved brainstorm is the first artifact in a chain, so the slug you pick is
the chain's identity: later phases reuse it unchanged as
`.pi/plan/<slug>.md` and `.pi/review/<slug>.md`. Pick a name that will still
describe the work after the approach changes.

Use the sections below in either destination. Include the YAML frontmatter only
in a saved artifact:

```markdown
---
phase: brainstorm
slug: <slug>
source: none
date: <YYYY-MM-DD>
skills: <repo skills you loaded, or "none">
---

# Brainstorm — <topic> — <date>

## Problem
What we are actually solving, the fixed boundaries, and how we will know it is
solved. Include the constraints discovered while researching, with the file or
source that established each one.

## Candidates
### <candidate name>
- How it works: <two or three sentences>
- Complexity: <what it adds or removes — amplification, load, unknown unknowns>
- Costs: <effort, new dependencies, migration, ongoing maintenance>
- Fails when: <the condition that makes this the wrong choice>

(repeat for each viable candidate)

## Recommendation
The one to build, in one sentence, then the reasoning. When alternatives remain
viable, name the closest runner-up and the specific thing that decided between
them. Otherwise, name the evidence that eliminated the alternatives.

## Open questions
Only decisions a human must make because they could change the scope, design,
risk, or outcome before planning starts.

## Not verified
What you could not check, and what would settle it.
```

Close with a literal summary of the recommendation and its main trade-off. If
you saved an artifact, include its path. The reader should not need to open a
file to know what you concluded.
