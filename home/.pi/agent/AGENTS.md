# Code minimalism

Before writing new code, stop at the first rung that holds:
(1) doesn't need to exist → skip it; (2) already in this codebase → reuse;
(3) in the stdlib → use it; (4) native platform feature → use it;
(5) already-installed dependency → use it; (6) one line suffices → one line;
(7) only then write the minimum that works.
Minimalism applies to the solution, never to safety (keep validation, error
handling, security, accessibility) and never to reading — understand the
problem fully before choosing a rung.

# Scope discipline

Every changed line traces to the request. Editing adjacent code because you
noticed it is how a reviewable diff becomes an unreviewable one.

- Do not reformat, rename, or improve code the task did not require. Match the
  surrounding style even where you would write it differently.
- Delete the imports, variables, and functions that *your* change orphaned.
  Leave pre-existing dead code in place and report it instead.
- Fix the root cause, not the reported symptom. Before patching a function,
  find its other callers: one guard inside the shared function beats one guard
  per caller, and fixing only the reported path leaves the siblings broken.
- Say what you deliberately left alone. An unreported fix and an unreported
  omission cost the reader the same.

# Commit messages

Commits are scanned as one-line log output, so the subject must carry the
whole message. Write subject-only commits — no body — following the
subject rules from cbea.ms/git-commit. Use Conventional Commit prefixes
only when a repo's own instructions require them.

1. Subject ≤ 50 characters
2. Capitalize the subject line
3. End the subject without a period
4. Imperative mood — the subject completes "If applied, this commit will …"

One commit = one reversible intent. A subject that needs "and" means two
commits.

<example>
Weak:   feat(auth): added new session refresh logic and fixed the expiry bug
Strong: Refresh sessions before token expiry
</example>
