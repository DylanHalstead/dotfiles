---
description: Implement an approved plan, spec, or scoped request
argument-hint: "<plan-or-spec-file-or-request>"
---
Implement the supplied plan, spec, or scoped request. The supplied scope is the
contract: deliver exactly what it specifies.

<scope>
${@:-(No scope was passed. Use the task the user described earlier in this conversation. If none exists, ask what to implement.)}
</scope>

First, decide which mode applies:

- **Plan mode:** Read the supplied plan in full and its linked spec, including
  steps you will not reach today. The spec owns intended behavior; the plan
  owns execution. Resolve material conflicts with the user before editing.
  Execute unchecked steps as described below.
- **Direct mode:** Read the supplied request or spec file and the affected code
  and callers. Implement the smallest complete change without requiring or
  creating a plan. Ask about consequential gaps before building.

Then read `~/.agents/skills/engineering-standard/SKILL.md` in full. Follow
its routing instructions to load the companion and repository skills relevant
to this task.

## Plan-mode loop

When resuming, reconcile the first unchecked step against current code and
relevant commits before editing. If the complete step is already committed
and still satisfies its contract, rerun its Verify and save its checked box
instead of repeating the implementation or commit. A matching commit subject
alone is not proof; finish and verify partial work through the normal loop.

In plan mode, for each unchecked step, in order:

1. Re-read the step, inspect its named files and affected callers, and verify
   its assumptions against the current code. If it depends on unchecked steps,
   do those first or stop and say why you cannot.
2. Implement what "What" describes. Resolve routine discrepancies through
   established local patterns and record them in the closing report. Hold the
   new code to the quality bars from the standard — this is where they apply,
   not after.
3. Run the step's "Verify". If there is no runnable check, state the
   observation you made instead.
4. Commit the source changes with the step's proposed subject, verbatim unless
   the work diverged from it — then write a subject that describes the change,
   and say in your reply that you changed it. Subject only, no
   body. Stage the step's files by path; never `git add -A` or `git add .`.
5. Check the step's box in the plan file (`- [ ]` → `- [x]`) and save it,
   leaving it out of the commit. Progress lives on disk, so the work survives
   a new session.

In direct mode, commit each atomic, reversible intent with a subject-only, imperative
subject of 50 characters or fewer. Stage files by path. Do not create a progress
artifact.

## When reality contradicts the scope

Stop before changing agreed behavior, scope, architecture, dependencies, risk,
or planned commit boundaries. This includes failed verification whose fix falls
outside scope and material assumptions invalidated by the code. Report the
conflict, your proposed response, and work already committed; ask for a decision
instead of silently redesigning.

## Standing rules

- Never push unless the supplied scope explicitly requests it. Every push still
  requires the interactive confirmation enforced by the global guardrails.
- Stay inside the supplied scope. Relevant problems you notice that are not in
  it go in the closing report with why they were left alone and the next action,
  if one is warranted. Do not put them into the diff.
- Keep the tree working between commits: compile, type-check, and lint as the
  project does.
- **The plan never leaks into the code.** No comment, commit message, test
  name, or identifier may mention the plan, a step number, or a phase. A
  reader of this repo cannot open those files, so a reference to them is a
  dead pointer. Write the reason itself: `// Retry once — the upstream API
  502s on cold start`, never `// Per step 3 of the plan`.

## Finishing

In plan mode, when the last step is checked, run the plan's **End-to-end
verification** and report what it showed. Check any source spec's acceptance
criteria as well as the completed steps.

In direct mode, run the most relevant available verification after the complete
change and report what it showed.

Before claiming completion in either mode, inspect the final diff, compare it
with the complete supplied contract, and run fresh checks on the same surface
as each claim. A unit test proves only its exercised behavior; type-checking
does not prove runtime behavior, and backend checks do not prove rendered UI.

## Closing report

Lead with failures or blockers. Summarize changes and commits, remaining plan
steps, verification results and gaps, and any deviations or relevant work left
out of scope. The plan file carries task progress; do not duplicate it in a
separate artifact.
