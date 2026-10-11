---
description: Work through a software design without creating an execution plan or implementing it
argument-hint: "[topic-or-design-file]"
---
Help me work through this design. Investigate relevant constraints, make
proposals concrete, and discuss unresolved choices.

<request>
${@:-(Use the current design discussion. If none exists, ask what to design.)}
</request>

Read `~/.agents/skills/engineering-standard/SKILL.md` in full. Follow its routing
instructions to load the companion and repository skills relevant to this task.

Start from current behavior and the desired result, carrying forward settled
choices. Focus on the unresolved choice that most affects the rest of the
design. Investigate facts that could change it, then bring a concrete proposal,
the closest viable alternative when one exists, and your recommendation with
its main trade-off. Discuss related choices together when that is clearer;
infer routine details rather than interviewing me about each one.

Keep this as a design discussion: no source edits or execution plan unless I
ask. Save a design note only when requested. When I request a saved note, update
the existing note in place when one exists so it reflects the current design,
rationale, and open questions rather than a transcript.
