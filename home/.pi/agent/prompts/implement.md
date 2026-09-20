---
description: Implement an approved plan or a scoped request
argument-hint: "<plan-file-or-request>"
---
Implement either an approved plan or a well-scoped request. The supplied scope
is the contract: deliver exactly what it specifies.

<scope>
${@:-(No scope was passed. Use the task the user described earlier in this conversation. If none exists, ask what to implement.)}
</scope>

First, decide which mode applies:

- **Plan mode:** The scope is a path to an existing plan file. Read the plan in
  full before doing anything else, including steps you will not reach today.
  Execute its unchecked steps as described below.
- **Direct mode:** The scope is a request, not a plan file. Do not require,
  create, or update a plan. Treat the request as the implementation contract.
  Read the affected code and its callers, implement the smallest complete
  change, verify it, and commit it in atomic commits. If the request is not
  sufficiently scoped to implement safely, ask the user the specific question
  that blocks you.

Then read `~/.pi/agent/skills/engineering-standard/SKILL.md` in full. Follow
its instructions to identify and load every repository skill that matches this
task.

## Plan-mode loop

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

In direct mode, do not create a plan or progress artifact. Commit each atomic,
reversible implementation intent with a subject-only, imperative subject of 50
characters or fewer. Stage files by path; never use `git add -A` or `git add .`.

## When reality contradicts the scope

In plan mode, stop at the end of the current step when reality would change
approved behavior, scope, architecture, dependencies, risk, or atomic commit
boundaries. Do not improvise around a broken step or silently redesign.
Specifically, stop when:

- a Verify fails and the fix is not obviously inside the step's scope
- the code invalidates a material assumption behind the planned design
- a step turns out to need a product or technical decision the plan did not make

In direct mode, stop before a change that would exceed the request or needs a
product or technical decision the request did not make. Report what you found,
what you would do about it, and what is already committed. The user decides
whether to clarify the request or continue.

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
verification** and report what it showed. A plan whose steps all passed but
whose feature does not work is not done.

In direct mode, run the most relevant available verification after the complete
change and report what it showed.

Before claiming completion in either mode, inspect the final diff, compare it
with the complete supplied contract, and run fresh checks on the same surface
as each claim. A unit test proves only its exercised behavior; type-checking
does not prove runtime behavior, and backend checks do not prove rendered UI.

## Closing report

In plan mode, the plan file carries the progress; your reply carries everything
it cannot. In direct mode, your reply is the only progress record. End with:

- what you implemented and committed, with subjects
- which plan steps remain and what blocks each, if in plan mode
- where the code did not match the supplied scope, and what you did about it
- what you verified, including end-to-end verification in plan mode, and what
  you could not verify
- anything found and deliberately left alone, why it was excluded, and the
  next action if one is warranted

Lead with failures and blockers if there are any.
