---
description: Research and resolve what to build, including scope and acceptance criteria
argument-hint: "[topic-or-spec-file]"
---
Work with me to define what we should build. Investigate the problem, discuss
consequential choices, and converge on an agreed specification.

<request>
${@:-(Use the current discussion. If none exists, ask what to specify.)}
</request>

Read any supplied spec first. Read
`~/.agents/skills/engineering-standard/SKILL.md` in full and follow its routing
instructions for relevant skills.

Start from current behavior and the desired outcome. Investigate repository
constraints and external facts that could change the result. Use the research
method in `~/.pi/agent/prompts/brainstorm.md` when comparing approaches; its
research report is not required here.

Focus the discussion on the unresolved choice that most affects the result.
Bring a concrete proposal and its main trade-off, with a viable alternative
when one exists. Carry forward settled decisions, distinguish proposals from
requirements, and infer routine details.

The spec should establish the problem, proposed behavior, scope and non-goals,
material constraints and decisions with their rationale, and testable acceptance
criteria. Include open questions and unverified assumptions where they affect
the result. Keep detail proportional to the work; reference standing repository
conventions instead of copying them. Leave execution steps to planning.

When the spec is ready, summarize it and ask for approval or revisions. Stop
before planning or implementation unless the user requests them.

Save only when asked, using `.pi/spec/<slug>.md` unless the project or user
specifies another location. Update an existing spec in place. Preserve the
agreed result and rationale, not the discussion transcript, and record approval
only when the user has given it. Do not edit source files during this pass.
